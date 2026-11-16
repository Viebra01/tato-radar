import type { Health, Incident } from "./model";
import type { Settings } from "./settings";
import { monitoringSources } from "../providers/catalog";
import { hasBrazilScope } from "./brazil";
import { isRelevantIncident, isRestored } from "./favorite-services";
import { sourceCoverage } from "./coverage";
export type Phase = "unknown" | "calm" | "aware" | "guard" | "defense";
export const phaseNames: Record<Phase, string> = {
  unknown: "Sem avaliação",
  calm: "Tranquilo",
  aware: "Atento",
  guard: "Em guarda",
  defense: "Modo Hacker",
};

const severityOrder = { critical: 4, high: 3, medium: 2, low: 1, unknown: 0 };
const day = 24 * 60 * 60 * 1000;
const latest = (event: Incident) =>
  event.updated ?? event.published ?? event.occurred ?? event.detected;

function within(at: string | undefined, now: number, age: number) {
  const elapsed = now - Date.parse(at ?? "");
  return elapsed >= 0 && elapsed < age;
}

export function currentSource(
  event: Incident,
  health: Health[],
  settings: Settings,
  now: number,
  requireLiveSnapshot = false,
) {
  return (event.sources?.length ? event.sources : [event.evidence]).some(
    (ref) => {
      if (settings.disabled.includes(ref.source)) return false;
      const source = monitoringSources.find((item) => item.id === ref.source);
      if (
        requireLiveSnapshot &&
        (!source ||
          !["statuspage", "cloud", "microsoft-consumer"].includes(source.kind))
      )
        return false;
      const interval =
        settings.intervals[ref.source] ??
        source?.minutes ??
        settings.monitors.find((m) => "http-" + m.id === ref.source)?.minutes ??
        settings.feeds.find((f) => "feed-" + f.id === ref.source)?.minutes ??
        10;
      const freshness = Math.max(10, interval * 3) * 60000;
      return health.some((row) => {
        if (!within(row.success, now, freshness)) return false;
        if (
          requireLiveSnapshot &&
          (row.id !== ref.source || row.error || !row.eventIds)
        )
          return false;
        return (
          (row.id === ref.source || row.id === ref.source + "-history") &&
          (row.eventIds
            ? row.eventIds.some((id) => event.keys.includes("id:" + id))
            : within(event.checked, now, freshness))
        );
      });
    },
  );
}
export function deriveRadar(
  events: Incident[],
  health: Health[],
  settings: Settings,
  now: number,
) {
  const verification = sourceCoverage(health, settings, now, "alerts");
  const bulletinVerification = sourceCoverage(
    health,
    settings,
    now,
    "bulletins",
  );
  const lastSuccess = verification.sources
    .flatMap(({ row }) => (row?.success ? [row.success] : []))
    .sort()
    .at(-1);
  const coverage = verification.complete;
  const unique = [
    ...new Map(
      events.map((e) => [e.keys?.find((k) => k.startsWith("id:")) ?? e.id, e]),
    ).values(),
  ];
  const relevant = unique.filter((e) => isRelevantIncident(e, settings.watch));
  const candidates = relevant
    .filter(
      (e) =>
        e.status === "active" &&
        e.category !== "MAINTENANCE" &&
        ["official", "observed", "corroborated"].includes(e.confirmation),
    )
    .sort(
      (a, b) =>
        severityOrder[b.severity] - severityOrder[a.severity] ||
        latest(b).localeCompare(latest(a)),
    );
  const active: Incident[] = [];
  const stale: Incident[] = [];
  for (const event of candidates) {
    const recent = within(
      event.updated ?? event.published ?? event.occurred,
      now,
      day,
    );
    if (currentSource(event, health, settings, now, !recent))
      active.push(event);
    else if (recent) stale.push(event);
  }
  const brazil = active.filter(
    (e) =>
      hasBrazilScope(e) &&
      (e.evidence.trust === "local" ||
        e.evidence.trust === "official" ||
        e.confirmation === "corroborated"),
  );
  const global = active.filter(
    (e) => !hasBrazilScope(e) && e.confirmation === "official",
  );
  const critical = brazil.some(
    (e) =>
      e.severity === "critical" &&
      e.evidence.trust !== "local" &&
      ["official", "corroborated"].includes(e.confirmation),
  );
  const count = brazil.length;
  const phase: Phase =
    critical || count >= 5
      ? "defense"
      : count >= 3
        ? "guard"
        : count >= 1
          ? "aware"
          : coverage
            ? "calm"
            : "unknown";
  const phrase = count
    ? count +
      " " +
      (count === 1 ? "incidente merece atenção" : "incidentes merecem atenção")
    : coverage
      ? "Radar atualizado"
      : lastSuccess
        ? "Monitoramento parcial"
        : "Aguardando primeira coleta";
  const recovered = relevant
    .filter((e) => isRestored(e) && within(e.resolved, now, day))
    .sort((a, b) => (b.resolved ?? "").localeCompare(a.resolved ?? ""));
  const news = relevant
    .filter(
      (e) =>
        e.confirmation === "reported" &&
        within(
          e.published ?? e.detected,
          now,
          ["OUTAGE", "DEGRADED", "RECOVERED"].includes(e.category)
            ? 2 * day
            : 7 * day,
        ),
    )
    .sort((a, b) =>
      (b.published ?? b.detected).localeCompare(a.published ?? a.detected),
    );
  return {
    phase,
    count,
    phrase,
    coverage,
    verification,
    bulletinVerification,
    brazil,
    global,
    recovered: recovered.filter(hasBrazilScope),
    globalRecovered: recovered.filter(
      (e) => !hasBrazilScope(e) && e.confirmation === "official",
    ),
    news,
    stale,
    lastSuccess,
  };
}
