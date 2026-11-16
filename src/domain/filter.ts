import type { Incident } from "./model";
import { matchingWatch, type Watch } from "./settings";
import { eventCopy } from "./event-copy";
export const attackTypes = [
  "SECURITY_BREACH",
  "SUSPECTED_BREACH",
  "DATA_LEAK",
  "RANSOMWARE",
  "DDOS",
];
export const vulnerabilityTypes = [
  "VULNERABILITY",
  "ACTIVELY_EXPLOITED",
  "SECURITY_ADVISORY",
];
export const severityLabels = {
  critical: "Crítica",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
  unknown: "Sem avaliação",
};
export const confirmations = {
  official: "Fonte oficial",
  observed: "Observação local",
  reported: "Relato editorial",
  unconfirmed: "Sem confirmação",
  corroborated: "Corroborado",
  contested: "Contestado ou corrigido",
};
export const statusLabels = {
  active: "Em andamento",
  resolved: "Resolvido",
  published: "Publicado",
  planned: "Planejado",
};
export const emptyFilters = {
  q: "",
  period: "",
  date: "published",
  from: "",
  to: "",
  region: "",
  organization: "",
  service: "",
  category: "",
  severity: "",
  source: "",
  confirmation: "",
  status: "",
  favorite: false,
  unread: false,
};
export type Filters = typeof emptyFilters;
const normalized = (value: string) =>
  value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
const calendars = new Map<string, Intl.DateTimeFormat>();
export function calendar(at: string | number, timeZone: string) {
  let formatter = calendars.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    calendars.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(new Date(at));
  return ["year", "month", "day"]
    .map((kind) => parts.find((part) => part.type === kind)?.value)
    .join("-");
}
export function eventDate(event: Incident, date: string) {
  return date === "occurred"
    ? event.occurred
    : date === "detected"
      ? event.detected
      : event.published;
}
export function matches(
  event: Incident,
  filters: Filters,
  watch: Watch[],
  now: number,
  timeZone: string,
) {
  const copy = eventCopy(event);
  const text = normalized(
    [
      copy.title,
      copy.summary,
      event.title,
      event.summary,
      event.cve,
      event.organization,
      event.service,
      ...event.sources.map((s) => s.name),
    ].join(" "),
  );
  if (
    !normalized(filters.q)
      .trim()
      .split(/\s+/)
      .every((word) => text.includes(word))
  )
    return false;
  if (
    (filters.unread && event.read) ||
    (filters.favorite && !matchingWatch(event, watch).length)
  )
    return false;
  if (
    (filters.region === "br" && event.region !== "BR") ||
    (filters.region === "world" && (!event.region || event.region === "BR"))
  )
    return false;
  if (
    filters.organization &&
    !normalized(event.organization ?? "").includes(
      normalized(filters.organization),
    )
  )
    return false;
  if (
    filters.service &&
    !normalized(event.service ?? "").includes(normalized(filters.service))
  )
    return false;
  if (
    filters.category &&
    event.category !== filters.category &&
    !event.related?.some((item) => item === filters.category)
  )
    return false;
  if (
    (filters.severity && filters.severity !== event.severity) ||
    (filters.status && filters.status !== event.status) ||
    (filters.confirmation && filters.confirmation !== event.confirmation) ||
    (filters.source && !event.sources.some((s) => s.source === filters.source))
  )
    return false;
  if (!filters.period) return true;
  const at = eventDate(event, filters.date);
  if (!at) return false;
  const dateOnly =
    filters.date === "published" && event.publishedPrecision === "day";
  const localDate = () => (dateOnly ? at.slice(0, 10) : calendar(at, timeZone));
  if (filters.period === "today")
    return localDate() === calendar(now, timeZone);
  if (filters.period === "custom") {
    const day = localDate();
    return (
      (!filters.from || day >= filters.from) &&
      (!filters.to || day <= filters.to)
    );
  }
  return (
    Date.parse(at) >= now - Number(filters.period) * 86400000 &&
    Date.parse(at) <= now
  );
}
