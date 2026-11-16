import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Settings2,
  RefreshCw,
  PanelRightOpen,
  ArrowUpRight,
  ArrowLeft,
} from "lucide-react";
import { db } from "../storage/db";
import {
  defaults,
  getSettings,
  type Settings,
  type Watch,
} from "../domain/settings";
import type { Incident } from "../domain/model";
import { deriveRadar, phaseNames } from "../domain/radar";
import {
  isRelevantIncident,
  serviceChoices,
} from "../domain/favorite-services";
import { eventCopy } from "../domain/event-copy";
import { Tato } from "./Tato";
import { FollowedServices, ServiceDetails } from "./FollowedServices";
import { Coverage } from "./Coverage";
import { UserSettings } from "./UserSettings";
import type { Phase } from "../domain/radar";
import { EventRow, IncidentDetails } from "./EventView";
import { DateText } from "./shared";
import { SecurityUpdates } from "./SecurityUpdates";
import { recentBulletins } from "../domain/security-bulletins";
type Page =
  "now" | "services" | "history" | "settings" | "coverage" | "security";
function route(): Page {
  return (
    (
      {
        services: "services",
        history: "history",
        settings: "settings",
        watch: "settings",
        sources: "settings",
        coverage: "coverage",
        security: "security",
      } as Record<string, Page>
    )[location.hash.slice(1)] ?? "now"
  );
}
export function App() {
  const [lastPhase, setLastPhase] = useState<Phase>("unknown");
  const [page, setPage] = useState<Page>(route),
    [storedSettings, setSettings] = useState<Settings>(),
    [, setNow] = useState(Date.now()),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [offset, setOffset] = useState(0),
    [detail, setDetail] = useState<string>(),
    [serviceId, setServiceId] = useState<string>(),
    [windowId, setWindowId] = useState<number>();
  const snapshot = useLiveQuery(() =>
    db.transaction("r", [db.incidents, db.health, db.services], async () => ({
      records: await db.incidents.toArray(),
      health: await db.health.toArray(),
      services: await db.services.toArray(),
    })),
  );
  const records = snapshot?.records ?? [],
    health = snapshot?.health ?? [],
    services = snapshot?.services ?? [];
  const settings = storedSettings ?? defaults;
  const now = Date.now();
  const popup = document.body.dataset.surface === "popup",
    side = document.body.dataset.surface === "sidepanel";
  useEffect(() => {
    const load = () => {
      void getSettings().then(setSettings);
    };
    const hash = () => {
      setPage(route());
      if (location.hash.startsWith("#incident="))
        setDetail(decodeURIComponent(location.hash.slice(10)));
    };
    load();
    void chrome.storage.local.get("tatoPhase").then((v) => {
      if (
        typeof v.tatoPhase === "string" &&
        ["unknown", "calm", "aware", "guard", "defense"].includes(v.tatoPhase)
      )
        setLastPhase(v.tatoPhase as Phase);
    });
    hash();
    void chrome.windows.getCurrent().then((w) => setWindowId(w.id));
    chrome.storage.onChanged.addListener(load);
    window.addEventListener("hashchange", hash);
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => {
      chrome.storage.onChanged.removeListener(load);
      window.removeEventListener("hashchange", hash);
      window.clearInterval(timer);
    };
  }, []);
  const radar = deriveRadar(records, health, settings, now);
  const bulletins = recentBulletins(records, now);
  const previousActive = useRef(new Set<string>());
  const recoveryEvidence = radar.recovered.some((event) =>
    previousActive.current.has(event.id),
  );
  useEffect(() => {
    previousActive.current = new Set(radar.brazil.map((event) => event.id));
  }, [radar.brazil]);
  const all = records
    .filter((e) => isRelevantIncident(e, settings.watch))
    .sort((a, b) =>
      (b.updated ?? b.published ?? b.detected).localeCompare(
        a.updated ?? a.published ?? a.detected,
      ),
    );
  const filtered = all.filter(
    (e) =>
      (!status || e.status === status) &&
      [eventCopy(e).title, eventCopy(e).summary, e.organization, e.service]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  function go(value: Page) {
    location.hash = value;
    setPage(value);
    setDetail(undefined);
    setServiceId(undefined);
    setOffset(0);
  }
  function open(event: Incident) {
    setDetail(event.id);
    void db.incidents.update(event.id, { read: 1 });
    if (popup)
      void chrome.tabs.create({
        url: chrome.runtime.getURL(
          "index.html#incident=" + encodeURIComponent(event.id),
        ),
      });
  }
  async function sync() {
    setBusy(true);
    try {
      const result = await chrome.runtime.sendMessage({ type: "SYNC" });
      if (!result?.ok) throw new Error("Falha de sincronização");
      setNow(Date.now());
      setMessage("Ciclo concluído. Confira as fontes em Cobertura.");
    } catch {
      setMessage("Não foi possível atualizar agora.");
    } finally {
      setBusy(false);
    }
  }
  async function panel() {
    try {
      if (windowId == null) return;
      await chrome.sidePanel.open({ windowId });
    } catch {
      void chrome.tabs.create({ url: chrome.runtime.getURL("sidepanel.html") });
    }
  }
  const list = (events: Incident[], empty: string, limit = 20) => (
    <div className="event-list">
      {events.length ? (
        events
          .slice(0, limit)
          .map((event) => (
            <EventRow
              key={event.id}
              event={event}
              compact={popup}
              timeZone={settings.timeZone}
              open={open}
            />
          ))
      ) : (
        <p className="quiet">{empty}</p>
      )}
    </div>
  );
  const { failed, late, waiting } = radar.verification.groups;
  const coverageReason =
    [
      failed
        ? failed === 1
          ? "1 fonte com falha"
          : failed + " fontes com falha"
        : "",
      late
        ? late === 1
          ? "1 coleta atrasada"
          : late + " coletas atrasadas"
        : "",
      waiting ? waiting + " aguardando coleta" : "",
    ]
      .filter(Boolean)
      .join(" · ") || (radar.coverage ? "" : "Nenhuma fonte ativa");
  const alertEmpty = !snapshot
    ? "Lendo os dados do radar…"
    : radar.coverage
      ? "Nenhum incidente em andamento confirmado pelas fontes consultadas."
      : radar.lastSuccess
        ? "Sem alerta confirmado. Parte das fontes ainda precisa ser verificada."
        : "Aguardando a primeira coleta bem-sucedida.";
  const summary = (
    <section
      className="radar-summary"
      data-phase={radar.phase}
      aria-label="Situação do radar"
    >
      <Tato
        phase={snapshot ? radar.phase : lastPhase}
        settled={!!snapshot}
        recoveryEvidence={recoveryEvidence}
      />
      <div className="radar-reading">
        <span className="eyebrow">Tato · Técnico do radar</span>
        <h1>{snapshot ? radar.phrase : "Verificando fontes…"}</h1>
        {snapshot && radar.phase !== "unknown" && radar.phase !== "calm" && (
          <p className="tato-phase">{phaseNames[radar.phase]}</p>
        )}
        {snapshot && coverageReason && <p>{coverageReason}</p>}
        <p>
          {radar.lastSuccess ? (
            <>
              Última coleta útil ·{" "}
              <DateText at={radar.lastSuccess} zone={settings.timeZone} />
            </>
          ) : snapshot ? (
            "Sem coleta bem-sucedida"
          ) : (
            "Lendo dados locais…"
          )}
        </p>
        <button className="coverage-link" onClick={() => go("coverage")}>
          Ver cobertura
        </button>
        <button
          className="coverage-link bulletin-link"
          aria-label="Boletins de segurança"
          onClick={() => go("security")}
        >
          Boletins de segurança
          {bulletins.length > 0 && (
            <span
              className="bulletin-count"
              title="Boletins coletados nos últimos 30 dias"
            >
              {bulletins.length}
            </span>
          )}
        </button>
      </div>
    </section>
  );
  const choices = serviceChoices(settings.watch);
  const selectedService = choices.find(({ id }) => id === serviceId);
  const pins = [...new Set(settings.pinnedServices)].flatMap((id) => {
    const item = choices.find((item) => item.id === id);
    return item ? [item] : [];
  });
  const serviceContext = {
    radar,
    services,
    timeZone: settings.timeZone,
  };
  const configureServices = chrome.runtime.getURL("index.html#settings");
  const openService = (item: Watch) => {
    setServiceId(item.id);
    window.scrollTo(0, 0);
  };
  const surface =
    "radar-app " + (popup ? "radar-popup" : side ? "radar-side" : "radar-full");
  if (page === "coverage")
    return (
      <div className={surface}>
        <Coverage
          verification={radar.verification}
          timeZone={settings.timeZone}
          back={() => go("now")}
        />
      </div>
    );
  if (page === "security")
    return (
      <div className={surface}>
        <SecurityUpdates
          bulletins={bulletins}
          timeZone={settings.timeZone}
          back={() => go("now")}
          verification={radar.bulletinVerification}
        />
      </div>
    );
  if (selectedService && !detail)
    return (
      <div className={surface}>
        <ServiceDetails
          {...serviceContext}
          item={selectedService}
          records={all}
          back={() => setServiceId(undefined)}
          open={open}
          configureUrl={configureServices}
        />
      </div>
    );
  return (
    <div className={surface}>
      <header className="radar-header">
        <a href="#now" onClick={() => go("now")} className="wordmark">
          CyberWatch<span>Radar Brasil</span>
        </a>
        <div>
          <button
            className="icon"
            aria-label="Atualizar"
            disabled={busy}
            onClick={() => void sync()}
          >
            <RefreshCw size={17} className={busy ? "spin" : ""} />
          </button>
          <button
            className="icon"
            aria-label="Configurações"
            onClick={() =>
              popup
                ? void chrome.tabs.create({
                    url: chrome.runtime.getURL("index.html#settings"),
                  })
                : go("settings")
            }
          >
            <Settings2 size={18} />
          </button>
        </div>
      </header>
      {message && (
        <p className="radar-message" role="status">
          {message}
        </p>
      )}
      {!popup && (
        <nav className="radar-nav" aria-label="Navegação principal">
          {(
            [
              ["now", "Agora"],
              ["services", "Serviços"],
              ["history", "Histórico"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              aria-current={page === id ? "page" : undefined}
              onClick={() => go(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      )}
      {(popup || page === "now") && (
        <>
          {summary}
          <FollowedServices
            {...serviceContext}
            items={pins}
            open={openService}
            configureUrl={configureServices}
            pinned
          />

          <section
            className="editorial editorial-brazil"
            aria-labelledby="alerts-now"
          >
            <h2 id="alerts-now">Alertas agora</h2>
            <p className="section-description">
              Incidentes em andamento com impacto no Brasil.
            </p>
            {list(radar.brazil, alertEmpty, popup ? 3 : 20)}
            {snapshot && !radar.coverage && !radar.brazil.length && (
              <button className="coverage-link" onClick={() => go("coverage")}>
                Conferir fontes do radar
              </button>
            )}
            {popup && radar.brazil.length > 3 && (
              <a
                className="section-link"
                href={chrome.runtime.getURL("index.html#now")}
                target="_blank"
                rel="noreferrer"
              >
                Ver todos os avisos no Brasil <ArrowUpRight size={14} />
              </a>
            )}
          </section>
          <section className="editorial editorial-reports">
            <h2>Notícias e relatos</h2>
            {list(
              radar.news,
              "Nenhum relato relevante recente.",
              popup ? 2 : 20,
            )}
            {popup && radar.news.length > 2 && (
              <a
                className="section-link"
                href={chrome.runtime.getURL("index.html#history")}
                target="_blank"
                rel="noreferrer"
              >
                Mais registros no histórico <ArrowUpRight size={14} />
              </a>
            )}
          </section>
          <section className="editorial">
            <h2>Avisos dos favoritos</h2>
            <p className="section-description">
              Avisos públicos de serviços que você acompanha, com impacto no
              Brasil ainda incerto.
            </p>
            {list(
              radar.global,
              "Nenhum aviso público recente nos seus favoritos.",
              popup ? 2 : 20,
            )}
          </section>
          <section className="editorial security-preview">
            <h2>Atualizações de segurança</h2>
            <p className="section-description">
              {bulletins.length
                ? bulletins.length +
                  (bulletins.length === 1
                    ? " boletim oficial recente sobre Windows e Ubuntu."
                    : " boletins oficiais recentes sobre Windows e Ubuntu.")
                : "Boletins oficiais da Microsoft e da Canonical."}
            </p>
            <button className="coverage-link" onClick={() => go("security")}>
              Consultar boletins
            </button>
          </section>
          {radar.recovered.length > 0 && (
            <section className="editorial editorial-recovered">
              <h2>Restabelecidos</h2>
              {list(radar.recovered, "", popup ? 2 : 20)}
            </section>
          )}
          {radar.globalRecovered.length > 0 && (
            <section className="editorial editorial-recovered">
              <h2>Restabelecidos nos favoritos</h2>
              {list(radar.globalRecovered, "", popup ? 2 : 20)}
            </section>
          )}
          {!popup && radar.stale.length > 0 && (
            <details className="editorial">
              <summary>
                Últimos avisos sem verificação atual · {radar.stale.length}
              </summary>
              {list(radar.stale, "Sem avisos desatualizados.")}
            </details>
          )}
        </>
      )}
      {page === "services" && !popup && (
        <>
          <h1 className="page-title">Seus serviços</h1>
          <label className="search">
            <input
              aria-label="Buscar serviço"
              placeholder="Buscar serviço…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <FollowedServices
            {...serviceContext}
            items={choices.filter((item) =>
              [item.name, ...item.keywords].some((text) =>
                text.toLowerCase().includes(query.trim().toLowerCase()),
              ),
            )}
            open={openService}
            configureUrl={configureServices}
          />
        </>
      )}
      {page === "history" && !popup && (
        <>
          <h1 className="page-title">Histórico</h1>
          <div className="toolbar">
            <input
              aria-label="Buscar histórico"
              placeholder="Buscar incidente ou empresa…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOffset(0);
              }}
            />
            <select
              aria-label="Situação"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">Todas as situações</option>
              <option value="active">Em andamento</option>
              <option value="resolved">Resolvidos</option>
              <option value="published">Notícias</option>
            </select>
          </div>
          {list(
            filtered.slice(offset, offset + 25),
            "Sem registros para esta busca.",
            25,
          )}
          <div className="pager">
            <button disabled={!offset} onClick={() => setOffset(offset - 25)}>
              Anterior
            </button>
            <span>{filtered.length} registros</span>
            <button
              disabled={offset + 25 >= filtered.length}
              onClick={() => setOffset(offset + 25)}
            >
              Próxima
            </button>
          </div>
        </>
      )}
      {page === "settings" && !popup && (
        <div className="settings-stack">
          <button className="text-button" onClick={() => go("now")}>
            <ArrowLeft size={15} />
            Voltar ao radar
          </button>
          <h1>Configurações</h1>
          <UserSettings settings={settings} records={all} />
          <a
            href={chrome.runtime.getURL("demo.html")}
            target="_blank"
            rel="noreferrer"
          >
            Demonstração do Tato <ArrowUpRight size={14} />
          </a>
        </div>
      )}
      <footer className="radar-footer">
        {popup ? (
          <button className="primary" onClick={() => void panel()}>
            <PanelRightOpen size={16} /> Abrir painel
          </button>
        ) : (
          <small>Monitoramento enquanto o navegador permite.</small>
        )}
        <a
          href={chrome.runtime.getURL("index.html")}
          target="_blank"
          rel="noreferrer"
          aria-label="Abrir página completa"
        >
          <ArrowUpRight size={17} />
          {popup ? "Página completa" : ""}
        </a>
      </footer>
      {!popup && detail && (
        <IncidentDetails
          event={records.find((e) => e.id === detail)}
          loading={false}
          zone={settings.timeZone}
          close={() => setDetail(undefined)}
        />
      )}
    </div>
  );
}
