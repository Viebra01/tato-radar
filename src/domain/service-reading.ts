import type { Incident, Service } from "./model";
import { states } from "./model";
import {
  favoriteServiceMatches,
  favoriteRecordMatches,
  isRestored,
  serviceMatches,
  servicePage,
} from "./favorite-services";
import { matchingWatch, type Watch } from "./settings";
import type { deriveRadar } from "./radar";
import { monitoringSources } from "../providers/catalog";

type Radar = ReturnType<typeof deriveRadar>;
const urgency = {
  OUTAGE_CONFIRMED: 6,
  SUSPECTED_OUTAGE: 5,
  DEGRADED: 4,
  RECOVERING: 3,
  MAINTENANCE: 2,
  RECOVERED: 1,
  OPERATIONAL: 0,
  UNKNOWN: -1,
};

export function readService(item: Watch, radar: Radar, services: Service[]) {
  const sources = radar.verification.sources;
  const matches = (event: Incident) => favoriteServiceMatches(event, item);
  const active = [...radar.brazil, ...radar.global].find(matches);
  const recovery = [...radar.recovered, ...radar.globalRecovered].find(matches);
  const reports = radar.news.filter((event) =>
    favoriteRecordMatches(event, item),
  );
  const component = services
    .filter(
      (service) =>
        service.state !== "UNKNOWN" &&
        serviceMatches(service, item) &&
        sources.some(
          (source) =>
            source.id === service.source && source.state === "current",
        ),
    )
    .sort((a, b) => urgency[b.state] - urgency[a.state])[0];
  const official = monitoringSources.find((source) =>
    item.id === "essential-outlook"
      ? source.id === "microsoft365"
      : item.id === "essential-personal"
        ? source.id === "microsoft-consumer"
        : source.organization &&
          matchingWatch({ title: source.organization }, [item]).length > 0,
  );
  const checked = sources.find((source) => source.id === official?.id);
  const notice =
    active ??
    (!component || urgency[component.state] < 2 ? recovery : undefined);
  const label = notice
    ? isRestored(notice)
      ? "Restabelecido"
      : notice.confirmation === "observed"
        ? "Falha observada na sua rede"
        : notice.category === "OUTAGE"
          ? "Queda confirmada"
          : "Instabilidade informada"
    : component
      ? states[component.state]
      : checked?.state === "current" && official?.id !== "microsoft-consumer"
        ? "Sem aviso público"
        : official
          ? "Sem verificação recente"
          : "Cobertura por publicações";
  return {
    label,
    notice,
    reports,
    tone:
      active || (component && urgency[component.state] >= 3)
        ? "alert"
        : component?.state === "OPERATIONAL" ||
            notice ||
            component?.state === "RECOVERED"
          ? "good"
          : "neutral",
    at: notice
      ? (notice.resolved ?? notice.checked)
      : (component?.checked ?? checked?.row?.success),
    source:
      notice?.evidence.name ??
      (component?.source.startsWith("http-")
        ? "Verificação da sua rede"
        : sources.find((source) => source.id === component?.source)?.name) ??
      official?.name,
    link:
      notice?.evidence.url ??
      component?.url ??
      official?.home ??
      servicePage(item),
  } as const;
}
