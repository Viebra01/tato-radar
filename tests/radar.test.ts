import { describe, it, expect } from "vitest";
import { deriveRadar } from "../src/domain/radar";
import { defaults, settingsSchema } from "../src/domain/settings";
import { merge } from "../src/domain/correlation";
import { monitoringSources } from "../src/providers/catalog";
import { cloudSnapshot } from "../src/providers/status";
import { sourceCoverage } from "../src/domain/coverage";
import {
  bulletinTitle,
  securitySources,
} from "../src/domain/security-bulletins";
const now = Date.parse("2026-11-16T12:00:00Z"),
  at = new Date(now).toISOString();
const health = monitoringSources.map((s) => ({
  id: s.id,
  success: at,
  failures: 0,
  next: 0,
}));
function event(id = "one") {
  return merge(
    undefined,
    {
      id,
      title: "Indisponibilidade de serviço no Brasil",
      summary: "",
      category: "OUTAGE",
      confirmation: "official",
      severity: "medium",
      status: "active",
      region: "BR",
      evidence: {
        source: "github",
        name: "GitHub",
        url: "https://www.githubstatus.com/incidents/" + id,
        trust: "official",
      },
      timeline: [],
      published: at,
    },
    at,
    true,
  ).incident;
}
describe("Tato e recorte canônico", () => {
  it("usa as regiões ainda afetadas pelo Google Cloud para alertas no Brasil", () => {
    const source = monitoringSources.find(({ id }) => id === "gcloud")!;
    const saoPaulo = { id: "southamerica-east1", title: "São Paulo" };
    const item = {
      id: "google-test",
      external_desc: "Instabilidade em serviço no Brasil",
      status_impact: "SERVICE_OUTAGE",
      created: at,
      uri: "/incidents/google-test",
      previously_affected_locations: [saoPaulo],
    };
    function radar(locations: { id: string; title: string }[], end?: string) {
      const [entry] = cloudSnapshot(
        source,
        JSON.stringify([
          { ...item, currently_affected_locations: locations, end },
        ]),
      ).events;
      const incident = merge(undefined, entry, at, true).incident;
      return deriveRadar([incident], health, defaults, now);
    }
    expect(radar([saoPaulo]).brazil).toHaveLength(1);
    expect(
      radar([{ id: "us-east1", title: "South Carolina" }]).brazil,
    ).toHaveLength(0);
    expect(radar([]).brazil).toHaveLength(0);
    expect(radar([], at).recovered).toHaveLength(1);
  });
  it("traduz regressão no boletim e preserva componente e referência", () => {
    const base = event();
    expect(
      bulletinTitle({
        ...base,
        title: "USN-9064-2: Pillow regression",
        evidence: {
          ...base.evidence,
          source: securitySources.find(({ platform }) => platform === "ubuntu")!
            .id,
        },
      }),
    ).toBe("Pillow · correção de regressão · USN-9064-2");
  });
  it("classifica a coleta recente vazia, a falha com dados e a fonte atrasada", () => {
    const selected = ["github", "cloudflare", "microsoft365", "openai"];
    const checked = sourceCoverage(
      [
        {
          id: "github",
          success: at,
          error: "Falha de rede",
          failures: 1,
          next: 0,
        },
        {
          id: "cloudflare",
          success: "2026-11-16T10:00:00Z",
          failures: 0,
          next: 0,
        },
        { id: "microsoft365", success: at, count: 0, failures: 0, next: 0 },
        { id: "discord", success: at, failures: 0, next: 0 },
      ],
      {
        ...defaults,
        disabled: monitoringSources
          .filter((source) => !selected.includes(source.id))
          .map((source) => source.id),
      },
      now,
    );
    expect(checked.groups).toEqual({
      failed: 1,
      late: 1,
      waiting: 1,
      current: 1,
    });
    expect(
      checked.sources.find((source) => source.id === "github")?.row?.success,
    ).toBe(at);
    expect(
      checked.sources.find((source) => source.id === "microsoft365")?.row
        ?.count,
    ).toBe(0);
    expect(checked.complete).toBe(false);
  });
  it.each([
    [0, "calm"],
    [1, "aware"],
    [2, "aware"],
    [3, "guard"],
    [4, "guard"],
    [5, "defense"],
    [8, "defense"],
  ])("%i ativos geram %s", (count, phase) =>
    expect(
      deriveRadar(
        Array.from({ length: Number(count) }, (_, i) => event(String(i))),
        health,
        defaults,
        now,
      ).phase,
    ).toBe(phase),
  );
  it("conta uma vez o mesmo incidente com vários componentes", () => {
    const one = { ...event(), service: "API, Pages, Actions" };
    expect(deriveRadar([one, one], health, defaults, now).count).toBe(1);
  });
  it("uma coleta de hoje não torna uma queda antiga atual", () => {
    const old = "2026-11-13T12:00:00Z";
    const global = {
      ...event("global-old"),
      title: "GitHub outage",
      organization: "GitHub",
      region: undefined,
      published: old,
    };
    const local = { ...event("brazil-old"), published: old };
    const report = {
      ...local,
      id: "report-old",
      keys: ["id:report-old"],
      confirmation: "reported" as const,
    };
    const radar = deriveRadar([global, local, report], health, defaults, now);
    expect(radar.brazil).toEqual([]);
    expect(radar.global).toEqual([]);
    expect(radar.news).toEqual([]);
    expect(
      deriveRadar([{ ...local, updated: at }], health, defaults, now).brazil,
    ).toHaveLength(1);
  });
  it("ordena incidentes ativos por gravidade e depois pela atualização", () => {
    const oldHigh = {
      ...event("old"),
      severity: "high" as const,
      updated: "2026-11-16T10:00:00Z",
    };
    const latestHigh = {
      ...event("new"),
      severity: "high" as const,
      updated: at,
    };
    const latestMedium = event("medium");
    expect(
      deriveRadar(
        [latestMedium, oldHigh, latestHigh],
        health,
        defaults,
        now,
      ).brazil.map((item) => item.id),
    ).toEqual([latestHigh.id, oldHigh.id, latestMedium.id]);
  });
  it("crítico confirmado escala, relato e falha local não", () => {
    expect(
      deriveRadar([{ ...event(), severity: "critical" }], health, defaults, now)
        .phase,
    ).toBe("defense");
    expect(
      deriveRadar(
        [{ ...event(), severity: "critical", confirmation: "reported" }],
        health,
        defaults,
        now,
      ).count,
    ).toBe(0);
    expect(
      deriveRadar(
        [
          {
            ...event(),
            severity: "critical",
            confirmation: "observed",
            evidence: {
              ...event().evidence,
              trust: "local",
              url: "https://sistema.com.br",
            },
          },
        ],
        health,
        defaults,
        now,
      ).phase,
    ).toBe("aware");
  });
  it("favorito global fica separado", () => {
    const one = {
      ...event(),
      title: "GitHub outage",
      organization: "GitHub",
      region: undefined,
    };
    const r = deriveRadar([one], health, defaults, now);
    expect(r.count).toBe(0);
    expect(r.global).toHaveLength(1);
  });
  it("não toma fonte offline como recuperação", () => {
    expect(deriveRadar([], [], defaults, now).phase).toBe("unknown");
    expect(
      deriveRadar(
        [event()],
        health.map((h) => ({ ...h, error: "HTTP 503" })),
        defaults,
        now,
      ).phase,
    ).toBe("aware");
    expect(deriveRadar([event()], health, defaults, now + 86400000).phase).toBe(
      "unknown",
    );
  });
  it("mantém incidentes antigos quando a origem ainda os lista como ativos", () => {
    const open = {
      ...event(),
      published: new Date(now - 2 * 86400000).toISOString(),
    };
    const snapshot = {
      ...health.find(({ id }) => id === "github")!,
      eventIds: [open.id],
    };
    expect(deriveRadar([open], [snapshot], defaults, now).brazil).toEqual([
      open,
    ]);
    for (const onlyHistory of [
      { ...snapshot, id: "github-history" },
      { ...snapshot, eventIds: [] },
      { ...snapshot, eventIds: undefined },
      { ...snapshot, error: "Falha de rede" },
    ]) {
      const radar = deriveRadar([open], [onlyHistory], defaults, now);
      expect(radar.brazil).toHaveLength(0);
      expect(radar.recovered).toHaveLength(0);
    }
    expect(
      deriveRadar(
        [{ ...open, category: "MAINTENANCE" }],
        [snapshot],
        defaults,
        now,
      ).brazil,
    ).toHaveLength(0);
  });
  it("recalcula recuperação parcial e total", () => {
    const one = { ...event(), status: "resolved" as const, resolved: at };
    expect(deriveRadar([one, event("two")], health, defaults, now).phase).toBe(
      "aware",
    );
    expect(deriveRadar([one], health, defaults, now).phase).toBe("calm");
    expect(deriveRadar([one], health, defaults, now).recovered).toHaveLength(1);
  });
  it("separa restabelecimento no Brasil de favorito global", () => {
    const one = { ...event(), status: "resolved" as const, resolved: at };
    const global = {
      ...event("global"),
      title: "GitHub outage",
      organization: "GitHub",
      region: undefined,
      status: "resolved" as const,
      resolved: at,
    };
    const radar = deriveRadar([one, global], health, defaults, now);
    expect(radar.recovered.map((entry) => entry.id)).toEqual([one.id]);
    expect(radar.globalRecovered.map((entry) => entry.id)).toEqual([global.id]);
  });
  it("preserva um alerta em coleta parcial e marca sumiço como desatualização", () => {
    const one = event();
    const source = {
      ...health.find((row) => row.id === "github")!,
      error: "503",
    };
    const recent = deriveRadar(
      [one],
      [{ ...source, eventIds: [one.id] }],
      defaults,
      now,
    );
    const missing = deriveRadar(
      [one],
      [{ ...source, eventIds: [] }],
      defaults,
      now,
    );
    expect(recent.coverage).toBe(false);
    expect(recent.brazil).toEqual([one]);
    expect(missing.brazil).toHaveLength(0);
    expect(missing.recovered).toHaveLength(0);
    expect(missing.stale).toEqual([one]);
  });
  it("configuração antiga recebe opções novas sem perder favoritos", () => {
    const { notifyGlobal: _global, ...old } = defaults;
    void _global;
    const next = settingsSchema.parse({
      ...old,
      staticTato: true,
      tatoBlinkWithReducedMotion: false,
      tatoStoryWithReducedMotion: false,
    });
    expect(next.watch).toEqual(defaults.watch);
    expect(next.notifyGlobal).toBe(false);
    expect(next).not.toHaveProperty("staticTato");
    expect(next).not.toHaveProperty("tatoStoryWithReducedMotion");
  });
  it("mostra falha dos boletins sem mudar a cobertura dos alertas", () => {
    const lastAlertCheck = new Date(now - 60000).toISOString();
    const radar = deriveRadar(
      [],
      health.map((row) =>
        row.id === "msrc"
          ? { ...row, error: "HTTP 503" }
          : { ...row, success: lastAlertCheck },
      ),
      defaults,
      now,
    );
    expect(radar.phase).toBe("calm");
    expect(radar.lastSuccess).toBe(lastAlertCheck);
    expect(radar.bulletinVerification.groups.failed).toBe(1);
    expect(radar.verification.sources.some(({ id }) => id === "msrc")).toBe(
      false,
    );
  });
});
