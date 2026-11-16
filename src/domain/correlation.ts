import type { Event, Incident, Update } from "./model";
import { canonical } from "./security";
const day = 86400000;
function words(title: string) {
  return new Set(
    title
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .match(/[\p{L}\p{N}]{3,}/gu) ?? [],
  );
}
export function similar(a: Event, b: Event): boolean {
  if (
    a.category !== b.category ||
    a.cve ||
    b.cve ||
    a.confirmation !== "reported" ||
    b.confirmation !== "reported"
  )
    return false;
  if (
    a.organization &&
    b.organization &&
    a.organization.toLowerCase() !== b.organization.toLowerCase()
  )
    return false;
  if (
    a.service &&
    b.service &&
    a.service.toLowerCase() !== b.service.toLowerCase()
  )
    return false;
  const delta = Math.abs(
    Date.parse(a.published ?? "") - Date.parse(b.published ?? ""),
  );
  if (!(delta <= 2 * day)) return false;
  const left = words(a.title),
    right = words(b.title);
  const common = [...left].filter((word) => right.has(word)).length;
  return common >= 5 && common / new Set([...left, ...right]).size >= 0.8;
}
export function keys(event: Event): string[] {
  const url = canonical(event.evidence.url);
  return [
    "id:" + event.id,
    ...(event.cve ? ["cve:" + event.cve] : []),
    ...(url && event.confirmation === "reported" ? ["url:" + url] : []),
  ];
}
export function merge(
  old: Incident | undefined,
  event: Event,
  at: string,
  baseline: boolean,
) {
  const refs = new Map(
    (old?.sources ?? []).map((source) => [
      source.source + "|" + source.url,
      source,
    ]),
  );
  refs.set(event.evidence.source + "|" + event.evidence.url, event.evidence);
  const officialKev =
    old?.category === "ACTIVELY_EXPLOITED" &&
    event.category === "VULNERABILITY";
  const older =
    old &&
    old.evidence.source === event.evidence.source &&
    old.updated &&
    event.updated &&
    old.updated > event.updated;
  const secondReport =
    old &&
    old.confirmation === "reported" &&
    event.confirmation === "reported" &&
    old.evidence.source !== event.evidence.source;
  const preserve = officialKev || older || secondReport;
  const base = preserve ? old : event;
  const changed =
    !old ||
    old.status !== base.status ||
    old.category !== base.category ||
    old.title !== base.title ||
    old.summary !== base.summary ||
    (!!event.updated && event.updated > (old.updated ?? "") && !preserve);
  const history = new Map<string, Update>();
  for (const update of [...(old?.timeline ?? []), ...event.timeline])
    history.set(update.at + "|" + update.text, update);
  if ((changed || secondReport) && event.summary && !event.timeline.length) {
    const update = {
      at: event.updated ?? event.published ?? at,
      text: event.summary,
      status: event.status,
    };
    history.set(update.at + "|" + update.text, update);
  }
  const incident: Incident = {
    ...base,
    resolved:
      base.resolved ??
      (base.category === "RECOVERED" &&
      base.status === "resolved" &&
      base.evidence.trust === "local" &&
      base.confirmation === "observed"
        ? base.updated
        : undefined),
    id: old?.id ?? event.id,
    keys: [...new Set([...(old?.keys ?? []), ...keys(event)])],
    severity:
      event.cve && event.severity === "unknown"
        ? (old?.severity ?? base.severity)
        : officialKev
          ? event.severity
          : base.severity,
    related: [
      ...new Set([
        ...(old?.related ?? []),
        ...(event.related ?? []),
        ...(old && old.category !== event.category
          ? [old.category, event.category]
          : []),
      ]),
    ].filter((category) => category !== base.category),
    sources: [...refs.values()].slice(-30),
    checked: at,
    detected: old?.detected ?? at,
    read: changed && !baseline ? 0 : (old?.read ?? 1),
    timeline: [...history.values()]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 100),
    transitions: [
      ...(old?.transitions ?? []),
      ...(old && old.status !== base.status
        ? [{ at: base.updated ?? at, from: old.status, to: base.status }]
        : []),
    ].slice(-100),
  };
  if (
    old?.availability &&
    !incident.availability &&
    incident.status === "resolved" &&
    ["OUTAGE", "DEGRADED"].includes(incident.category)
  ) {
    incident.related = [
      ...new Set([...(incident.related ?? []), "RECOVERED" as const]),
    ];
  }
  return { incident, changed };
}
