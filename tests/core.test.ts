import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyFilters, matches } from "../src/domain/filter";
import { canonical, plain, publicUrl } from "../src/domain/security";
import { advance, initialProbe } from "../src/domain/probe";
import {
  defaults,
  matchingWatch,
  settingsSchema,
} from "../src/domain/settings";
import { merge, similar } from "../src/domain/correlation";
import type { Event } from "../src/domain/model";
import { CollectionError, request } from "../src/providers/http";
import { sources } from "../src/providers/catalog";
import { statuspageSnapshot } from "../src/providers/status";
import { feedSnapshot } from "../src/providers/feeds";
import { kevSnapshot, nvdSnapshot } from "../src/providers/vulnerabilities";
import { emptyHealth, eligible, failure } from "../src/background/schedule";
import { canNotify, notify } from "../src/background/notifications";
import { hasBrazilScope, isBrazilPriority } from "../src/domain/brazil";
import { eventCopy } from "../src/domain/event-copy";
import {
  eventScope,
  favoriteServiceMatches,
  isRelevantIncident,
} from "../src/domain/favorite-services";
import { formatNotification } from "../src/background/notification-copy";
import { db, saveEvents, WatchDb } from "../src/storage/db";

const now = Date.parse("2026-11-12T16:00:00Z");
const at = new Date(now).toISOString();
const oneDay = 86400000;
const source = (id: string) => sources.find((item) => item.id === id)!;
const example: Event = {
  id: "rss:1",
  title:
    "GitHub investigates suspected unauthorized access affecting customers",
  summary: "An article described unauthorized access.",
  category: "SUSPECTED_BREACH",
  organization: "GitHub",
  severity: "unknown",
  confirmation: "reported",
  status: "published",
  published: at,
  occurred: new Date(now - 21 * oneDay).toISOString(),
  evidence: {
    source: "rss",
    name: "Example editorial",
    url: "https://example.com/a",
    trust: "editorial",
  },
  timeline: [],
};
const dbNames: string[] = [];
afterEach(async () => {
  for (const name of dbNames.splice(0)) await Dexie.delete(name);
});
function database() {
  const name = "test-" + crypto.randomUUID();
  dbNames.push(name);
  return new WatchDb(name);
}

describe("rede e agendamento", () => {
  it("usa cache condicional e aceita 304", async () => {
    const result = await request(
      "https://example.com",
      { etag: '"saved"' },
      async (_, options) => {
        expect(new Headers(options?.headers).get("If-None-Match")).toBe(
          '"saved"',
        );
        expect(options?.credentials).toBe("omit");
        expect(options?.redirect).toBe("error");
        return new Response(null, { status: 304 });
      },
    );
    expect(result.unchanged).toBe(true);
  });
  it("preserva o erro de origem sem mudar o estado de um serviço", async () => {
    await expect(
      request(
        "https://example.com",
        {},
        async () => new Response("offline", { status: 503 }),
      ),
    ).rejects.toMatchObject({ status: 503 });
  });
  it("limita tamanho de resposta", async () => {
    await expect(
      request(
        "https://example.com",
        {},
        async () =>
          new Response("abc", { headers: { "content-length": "9000000" } }),
      ),
    ).rejects.toThrow("6 MiB");
  });
  it("diferencia timeout de erro de rede", async () => {
    const fetcher: typeof fetch = async (_, options) =>
      new Promise((_, reject) => {
        options?.signal?.addEventListener("abort", () =>
          reject(options.signal?.reason),
        );
      });
    await expect(
      request("https://example.com", { timeout: 5 }, fetcher),
    ).rejects.toThrow("Tempo limite");
    await expect(
      request("https://example.com", {}, async () => {
        throw new TypeError("offline");
      }),
    ).rejects.toThrow("Falha de rede");
  });
  it("interpreta 429 sem classificar como falha do serviço", async () => {
    await expect(
      request(
        "https://example.com",
        { probe: true },
        async () =>
          new Response("wait", {
            status: 429,
            headers: { "retry-after": "60" },
          }),
      ),
    ).rejects.toMatchObject({ status: 429, retry: expect.any(Number) });
  });
  it("honra Retry-After, inclusive na coleta manual", () => {
    const bad = failure(
      emptyHealth("a"),
      new CollectionError("HTTP 429", 429, now + 3600000),
      at,
      3,
    );
    expect(eligible(bad, now + 60000, 3, true)).toBe(false);
    expect(eligible(bad, now + 3600000, 3, false)).toBe(true);
  });
  it("aplica circuito e mantém dados do último sucesso", () => {
    const bad = failure(
      { ...emptyHealth("a"), success: at, failures: 4 },
      new Error("incompatível"),
      at,
      3,
    );
    expect(bad.success).toBe(at);
    expect(bad.next).toBeGreaterThanOrEqual(now + 3600000);
    expect(bad.log?.[0]?.result).toBe("Formato da resposta incompatível");
  });
  it("limita cliques sucessivos e retoma quando vence o prazo", () => {
    const state = { ...emptyHealth("a"), attempted: at };
    expect(eligible(state, now + 1000, 3, true)).toBe(false);
    expect(eligible(state, now + 120000, 3, false)).toBe(false);
    expect(eligible(state, now + 180000, 3, false)).toBe(true);
  });
});
describe("adaptadores e sanitização", () => {
  it("valida o schema do Statuspage e aceita uma lista vazia legítima", () => {
    const snapshot = statuspageSnapshot(
      source("github"),
      JSON.stringify({
        page: {},
        status: { indicator: "none", description: "ok" },
        components: [],
        incidents: [],
      }),
      at,
    );
    expect(snapshot.events).toEqual([]);
    expect(snapshot.services).toEqual([]);
    expect(() =>
      statuspageSnapshot(source("github"), '{"incidents":[]}', at),
    ).toThrow();
    expect(() => statuspageSnapshot(source("github"), "malformed", at)).toThrow(
      SyntaxError,
    );
  });
  it("associa a disponibilidade ao componente declarado oficialmente", () => {
    const snapshot = statuspageSnapshot(
      source("github"),
      JSON.stringify({
        page: { updated_at: at },
        status: { indicator: "major", description: "Partial outage" },
        components: [{ id: "x", name: "Actions", status: "partial_outage" }],
        incidents: [
          {
            id: "i",
            name: "Actions",
            status: "investigating",
            created_at: at,
            components: [
              { id: "x", name: "Actions", status: "partial_outage" },
            ],
          },
        ],
      }),
      at,
    );
    expect(snapshot.services?.[0].state).toBe("OUTAGE_CONFIRMED");
    expect(snapshot.events[0]).toMatchObject({
      confirmation: "official",
      category: "OUTAGE",
      published: at,
    });
    expect(snapshot.events[0].occurred).toBeUndefined();
  });
  it("RSS mantém suspeita, data publicada e URL de evidência", () => {
    const rss =
      "<rss><channel><title>News</title><item><title>GitHub breach reported</title><link>https://example.com/item</link><description><![CDATA[<script>alert(1)</script>Resumo]]></description><pubDate>" +
      at +
      "</pubDate></item></channel></rss>";
    const result = feedSnapshot(source("bc"), rss).events[0];
    expect(result).toMatchObject({
      summary: "Resumo",
      confirmation: "reported",
      category: "SUSPECTED_BREACH",
      published: at,
    });
    expect(result.occurred).toBeUndefined();
  });
  it("Atom escolhe o link alternate em lugar de self", () => {
    const atom =
      '<feed xmlns="http://www.w3.org/2005/Atom"><title>Feed</title><entry><title>Update</title><id>one</id><link rel="self" href="https://example.com/feed"/><link rel="alternate" href="https://example.com/story"/><published>' +
      at +
      "</published></entry></feed>";
    expect(feedSnapshot(source("bc"), atom).events[0].evidence.url).toBe(
      "https://example.com/story",
    );
  });
  it("rejeita DTD, HTML e URLs executáveis", () => {
    expect(() => feedSnapshot(source("bc"), "<!DOCTYPE rss><rss/>")).toThrow();
    expect(() =>
      feedSnapshot(source("bc"), "<html><title>Fake</title></html>"),
    ).toThrow();
    expect(publicUrl("javascript:alert(1)")).toBeUndefined();
    expect(publicUrl("http://2130706433")).toBeUndefined();
    expect(publicUrl("http://name.internal/path")).toBeUndefined();
    expect(publicUrl("http://user:pass@public.com")).toBeUndefined();
    expect(publicUrl("http://[::1]/")).toBeUndefined();
    expect(plain('<iframe src="https://fake.com">foo</iframe>')).toBe("foo");
    expect(plain("&lt;script&gt;alert(1)&lt;/script&gt;Texto")).toBe("Texto");
  });
  it("diferencia CVE crítica de exploração registrada no KEV", () => {
    const nvd = nvdSnapshot(
      source("nvd"),
      JSON.stringify({
        totalResults: 1,
        vulnerabilities: [
          {
            cve: {
              id: "CVE-2026-1234",
              published: at,
              lastModified: at,
              descriptions: [],
              metrics: { cvssMetricV31: [{ cvssData: { baseScore: 9.8 } }] },
            },
          },
        ],
      }),
    ).events[0];
    const kev = kevSnapshot(
      source("kev"),
      JSON.stringify({
        dateReleased: at,
        vulnerabilities: [
          {
            cveID: nvd.cve,
            vendorProject: "Vendor",
            product: "Product",
            vulnerabilityName: "Issue",
            dateAdded: "2026-11-12",
            shortDescription: "Description",
          },
        ],
      }),
    ).events[0];
    expect(nvd).toMatchObject({
      category: "VULNERABILITY",
      severity: "critical",
    });
    expect(kev).toMatchObject({
      category: "ACTIVELY_EXPLOITED",
      severity: "unknown",
      confirmation: "official",
    });
    expect(kev.occurred).toBeUndefined();
    expect(
      merge(merge(undefined, nvd, at, true).incident, kev, at, false).incident
        .severity,
    ).toBe("critical");
  });
});
describe("verificação local", () => {
  it("gera alerta apenas após três falhas e recuperação após dois sucessos", () => {
    let probe = advance(initialProbe, "good", at, 3, 2, "one");
    expect(probe.state).toBe("OPERATIONAL");
    for (let attempt = 0; attempt < 2; attempt++)
      probe = advance(probe, "bad", at, 3, 2, "one");
    expect(probe.outageId).toBeUndefined();
    probe = advance(probe, "bad", at, 3, 2, "one");
    expect(probe).toMatchObject({
      outageId: "one",
      state: "SUSPECTED_OUTAGE",
      since: at,
    });
    probe = advance(probe, "good", at, 3, 2, "one");
    expect(probe.state).toBe("RECOVERING");
    probe = advance(probe, "good", at, 3, 2, "one");
    expect(probe.state).toBe("RECOVERED");
    expect(probe.outageId).toBeUndefined();
  });
  it("interrompe a contagem de falhas se a conectividade fica desconhecida", () => {
    let probe = advance(initialProbe, "bad", at, 2, 2, "one");
    probe = advance(probe, "unknown", at, 2, 2, "one");
    expect(probe).toMatchObject({ state: "UNKNOWN", failures: 0 });
    expect(advance(probe, "bad", at, 2, 2, "one").outageId).toBeUndefined();
  });
});
describe("incidentes, histórico e preferências", () => {
  it("correlaciona reportagens semelhantes sem duplicar o incidente", async () => {
    const store = database();
    await store.transaction("rw", store.incidents, () =>
      saveEvents(
        [
          example,
          {
            ...example,
            id: "other:1",
            title:
              "GitHub investigates suspected unauthorized access affecting some customers",
            evidence: {
              ...example.evidence,
              source: "other",
              url: "https://example.com/two",
            },
          },
        ],
        at,
        true,
        store,
      ),
    );
    const rows = await store.incidents.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].sources).toHaveLength(2);
    expect(rows[0].read).toBe(1);
    store.close();
  });
  it("separa causas diferentes e evita coincidência distante no tempo", () => {
    expect(similar(example, { ...example, category: "OUTAGE" })).toBe(false);
    expect(
      similar(example, {
        ...example,
        published: new Date(now - 5 * oneDay).toISOString(),
      }),
    ).toBe(false);
    expect(similar(example, { ...example, organization: "Cloudflare" })).toBe(
      false,
    );
    expect(canonical("https://example.com/a?utm_medium=x&b=2#extra")).toBe(
      "https://example.com/a?b=2",
    );
  });
  it("filtra publicação e ocorrência separadamente", () => {
    const row = merge(undefined, example, at, false).incident;
    expect(
      matches(
        row,
        { ...emptyFilters, period: "7", q: "github", unread: true },
        defaults.watch,
        now,
        "America/Sao_Paulo",
      ),
    ).toBe(true);
    expect(
      matches(
        row,
        { ...emptyFilters, period: "7", date: "occurred" },
        defaults.watch,
        now,
        "America/Sao_Paulo",
      ),
    ).toBe(false);
    expect(
      matches(
        row,
        { ...emptyFilters, region: "br" },
        defaults.watch,
        now,
        "America/Sao_Paulo",
      ),
    ).toBe(false);
  });
  it("encontra favoritos com fronteiras e preserva os campos de importação", () => {
    expect(
      matchingWatch(example, defaults.watch).map((item) => item.name),
    ).toContain("GitHub");
    expect(
      matchingWatch({ title: "A pledge and an edge case" }, defaults.watch).map(
        (item) => item.name,
      ),
    ).toContain("Edge");
    expect(
      matchingWatch({ title: "A pledge" }, defaults.watch).map(
        (item) => item.name,
      ),
    ).not.toContain("Edge");
    expect(settingsSchema.parse(JSON.parse(JSON.stringify(defaults)))).toEqual(
      defaults,
    );
    expect(
      settingsSchema.safeParse({
        ...defaults,
        monitors: [{ url: "http://127.0.0.1" }],
      }).success,
    ).toBe(false);
  });
  it("persiste registros e histórico de alertas após reabertura", async () => {
    const store = database();
    await store.transaction("rw", store.incidents, () =>
      saveEvents([example], at, true, store),
    );
    await store.alerts.put({
      id: example.id,
      incidentId: example.id,
      title: "Título",
      message: "Mensagem",
      at,
    });
    store.close();
    const next = new WatchDb(store.name);
    expect(await next.incidents.count()).toBe(1);
    expect(await next.alerts.get(example.id)).toMatchObject({
      incidentId: example.id,
    });
    next.close();
  });
  it("migra IndexedDB da versão 1 preservando os registros", async () => {
    const name = "migration-" + crypto.randomUUID();
    dbNames.push(name);
    const old = new Dexie(name);
    old.version(1).stores({
      incidents: "id,*keys,read,published,detected,category",
      health: "id",
      services: "id,source",
      probes: "id",
      alerts: "id,incidentId,at",
    });
    await old
      .table("incidents")
      .put(merge(undefined, example, at, true).incident);
    old.close();
    const migrated = new WatchDb(name);
    expect(await migrated.incidents.count()).toBe(1);
    await migrated.meta.put({ id: "lastSync", value: now });
    expect((await migrated.meta.get("lastSync"))?.value).toBe(now);
    migrated.close();
  });
  it("deduplica alertas no cooldown e preserva o vínculo com o incidente", async () => {
    const create = vi.fn(async () => "test-alert");
    vi.stubGlobal("chrome", {
      runtime: {
        getURL: (path: string) => "chrome-extension://fixture/" + path,
      },
      notifications: { create },
    });
    const incident = merge(
      undefined,
      {
        ...example,
        id: "fixture-alert",
        region: "BR",
        category: "OUTAGE",
        status: "active",
        confirmation: "official",
      },
      at,
      false,
    ).incident;
    try {
      await notify([incident, incident], defaults, now);
      await notify([incident], defaults, now + 30000);
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        incident.id,
        expect.objectContaining({
          title: "Tato Radar | GitHub informa indisponibilidade",
          message: expect.stringContaining("Comunicado de"),
        }),
      );
      expect(await db.alerts.get(incident.id)).toMatchObject({
        incidentId: incident.id,
        at,
      });
    } finally {
      await db.alerts.delete(incident.id);
      vi.unstubAllGlobals();
    }
  });
  it("resume a atualização de status em português sem copiar texto externo", () => {
    const event = merge(
      undefined,
      {
        ...example,
        title: "Disruption with Sign-in and Sign-up",
        summary: "We are investigating the disruption.",
        category: "DEGRADED",
        confirmation: "official",
        raw: { status: "investigating" },
        evidence: {
          ...example.evidence,
          name: "GitHub Status",
          trust: "official",
        },
      },
      at,
      false,
    ).incident;
    expect(formatNotification(event)).toEqual({
      title: "Tato Radar | GitHub informa instabilidade",
      message:
        "Impacto relatado em login e cadastro. O fornecedor está investigando. Comunicado de GitHub Status.",
    });
  });
  it("explica a exploração conhecida e atribui a confirmação à CISA", () => {
    const event = merge(
      undefined,
      {
        ...example,
        cve: "CVE-2026-1234",
        category: "ACTIVELY_EXPLOITED",
        confirmation: "official",
        organization: "Fornecedor",
        service: "Produto",
      },
      at,
      false,
    ).incident;
    expect(formatNotification(event)).toEqual({
      title: "Tato Radar | CVE-2026-1234 com exploração confirmada",
      message:
        "A CISA registrou exploração conhecida em Produto (Fornecedor) no catálogo KEV.",
    });
  });
  it("distingue observação local de relato editorial nas notificações", () => {
    const reported = merge(undefined, example, at, false).incident;
    expect(formatNotification(reported)).toMatchObject({
      title: "Tato Radar | Reportagem sobre suspeita de invasão",
    });
    const observed = {
      ...reported,
      category: "RECOVERED" as const,
      confirmation: "observed" as const,
      status: "resolved" as const,
      resolved: at,
      evidence: { ...reported.evidence, trust: "local" as const },
    };
    expect(formatNotification(observed).message).toContain("na sua rede");
  });
  it("mantém recuperação oficial ancorada em transição de estado", () => {
    const active = merge(
      undefined,
      {
        ...example,
        region: "BR",
        category: "OUTAGE",
        confirmation: "official",
        status: "active",
        availability: "OUTAGE_CONFIRMED",
      },
      at,
      false,
    ).incident;
    const resolved = merge(
      active,
      {
        ...example,
        region: "BR",
        category: "OUTAGE",
        confirmation: "official",
        status: "resolved",
        resolved: at,
      },
      at,
      false,
    ).incident;
    expect(resolved.transitions.at(-1)).toEqual({
      at,
      from: "active",
      to: "resolved",
    });
    expect(resolved.related).toContain("RECOVERED");
    expect(canNotify(resolved, defaults, now)).toBe(true);
  });
  it("recuperação local é elegível e não perturbe bloqueia alertas", () => {
    const active = merge(
      undefined,
      {
        ...example,
        evidence: {
          ...example.evidence,
          url: "https://example.com.br/",
          trust: "local",
        },
        category: "OUTAGE",
        confirmation: "observed",
        status: "active",
      },
      at,
      false,
    ).incident;
    const resolved = merge(
      active,
      {
        ...example,
        evidence: {
          ...example.evidence,
          url: "https://example.com.br/",
          trust: "local",
        },
        category: "RECOVERED",
        confirmation: "observed",
        status: "resolved",
        updated: at,
      },
      at,
      false,
    ).incident;
    expect(canNotify(resolved, defaults, now)).toBe(true);
    expect(canNotify(resolved, { ...defaults, dnd: true }, now)).toBe(false);
    expect(canNotify(resolved, { ...defaults, snooze: now + 1 }, now)).toBe(
      false,
    );
  });
  it("filtra notícias internacionais, manutenção e falhas técnicas avulsas", () => {
    expect(isBrazilPriority(example, defaults.watch)).toBe(false);
    expect(
      isBrazilPriority(
        {
          ...example,
          region: "BR",
          category: "VULNERABILITY",
          severity: "critical",
        },
        defaults.watch,
      ),
    ).toBe(false);
    expect(
      isBrazilPriority(
        { ...example, region: "BR", category: "MAINTENANCE" },
        defaults.watch,
      ),
    ).toBe(false);
    const local = {
      ...example,
      title: "Pix fica fora do ar",
      organization: undefined,
      summary: "",
      category: "OUTAGE" as const,
    };
    expect(isBrazilPriority(local, defaults.watch)).toBe(true);
    expect(
      hasBrazilScope({
        ...local,
        title: "Aplicativo ganha modo escuro",
        evidence: {
          ...local.evidence,
          url: "https://canaltech.com.br/tecnologia/novo/",
        },
      }),
    ).toBe(false);
    expect(
      isBrazilPriority(
        { ...local, title: "Como evitar o golpe do Pix" },
        defaults.watch,
      ),
    ).toBe(false);
  });
  it("aplica o recorte também ao alerta e apresenta título e resumo em português", () => {
    const event = merge(
      undefined,
      {
        ...example,
        title: "GitHub service disruption in Brazil",
        summary: "Investigating impact.",
        category: "DEGRADED",
        confirmation: "official",
        raw: { status: "investigating" },
      },
      at,
      false,
    ).incident;
    expect(isBrazilPriority(event, defaults.watch)).toBe(true);
    expect(canNotify(event, defaults, now)).toBe(true);
    expect(eventCopy(event)).toMatchObject({
      title: "GitHub informa instabilidade",
      summary: expect.stringContaining("O fornecedor está investigando"),
    });
    expect(
      canNotify(
        { ...event, title: "GitHub service disruption" },
        { ...defaults, notifyGlobal: true },
        now,
      ),
    ).toBe(true);
    expect(
      eventCopy({
        ...event,
        language: "pt-BR",
        title: "GitHub registra instabilidade no Brasil",
      }).title,
    ).toBe("GitHub registra instabilidade no Brasil");
  });
  it("mostra aviso do Exchange no Outlook sem declarar impacto no Brasil", () => {
    const feed =
      "<rss><channel><title>Microsoft</title><item><title>Microsoft Admin Center</title><link>https://status.cloud.microsoft/</link><guid>teste</guid><description>Potentially impacted services include Exchange Online and Microsoft Teams. Current status: Investigating.</description><status>ServiceDegradation</status></item></channel></rss>";
    const [event] = feedSnapshot(source("microsoft365"), feed).events;
    const outlook = defaults.watch.find(
      (item) => item.name === "Microsoft Outlook",
    )!;
    expect(event).toMatchObject({
      category: "DEGRADED",
      service: "Exchange Online, Microsoft Teams",
      confirmation: "official",
    });
    expect(favoriteServiceMatches(event, outlook)).toBe(true);
    expect(isRelevantIncident(event, defaults.watch)).toBe(true);
    expect(eventScope(event)).toBe("Brasil não confirmado");
    expect(
      isRelevantIncident(
        { ...event, category: "SECURITY_BREACH" },
        defaults.watch,
      ),
    ).toBe(false);
    expect(
      isRelevantIncident({ ...event, service: "SharePoint Online" }, [outlook]),
    ).toBe(false);
  });
  it("recupera acentos também em registros locais já gravados", () => {
    const event = merge(
      undefined,
      {
        ...example,
        language: "pt-BR",
        summary:
          "Caixa Econ&ocirc;mica: usu&amp;aacute;rios relatam servi&ccedil;os inst&aacute;veis.",
      },
      at,
      false,
    ).incident;
    expect(eventCopy(event).summary).toBe(
      "Caixa Econômica: usuários relatam serviços instáveis.",
    );
    expect(
      plain("&amp;lt;script&amp;gt;alert(1)&amp;lt;/script&amp;gt;Ol&aacute;"),
    ).toBe("Olá");
  });
  it("seleciona quedas, recuperações e instabilidades por favorito", () => {
    const degraded = merge(
      undefined,
      {
        ...example,
        title: "GitHub em instabilidade no Brasil",
        category: "DEGRADED",
        confirmation: "official",
        status: "active",
      },
      at,
      false,
    ).incident;
    const outage = { ...degraded, category: "OUTAGE" as const };
    const recovered = {
      ...outage,
      status: "resolved" as const,
      resolved: at,
      transitions: [{ at, from: "active" as const, to: "resolved" as const }],
    };
    const settings = {
      ...defaults,
      serviceAlerts: { "default-3": "outage" as const },
    };
    expect(canNotify(outage, settings, now)).toBe(true);
    expect(canNotify(degraded, settings, now)).toBe(false);
    expect(canNotify(recovered, settings, now)).toBe(false);
    expect(
      canNotify(
        recovered,
        { ...settings, serviceAlerts: { "default-3": "recovery" } },
        now,
      ),
    ).toBe(true);
    expect(
      canNotify(
        degraded,
        { ...settings, serviceAlerts: { "default-3": "changes" } },
        now,
      ),
    ).toBe(true);
  });
});
