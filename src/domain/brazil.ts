import type { Event, Service } from "./model";
import { matchingWatch, type Watch } from "./settings";

const normalize = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const domesticTargets =
  /\b(?:pix|gov\.br|banco central do brasil|banco do brasil|caixa economica federal|caixa vida e previdencia|receita federal|meu inss|sus digital|conecte sus|serpro|dataprev|ssw sistemas|correios|sistema unico de saude|portal da transparencia)\b/u;
const nationalScope =
  /\b(?:no brasil|em todo o brasil|em territorio brasileiro|in brazil|across brazil|brazilian (?:users|customers|companies|government|banks|hospitals)|usuarios brasileiros|clientes brasileiros|populacao brasileira|empresas brasileiras|redes brasileiras)\b/u;
const nationalLocation = /\b(?:brasil|brazil|sao paulo|southamerica-east1)\b/u;
const incidentSignal =
  /\b(?:vaz(?:a(?:m|ram|dos?)?|ou|amento(?:s)?)|ciberataqu\w*|ataque (?:hacker|cibernetico)|dados expostos|invasao|invadid\w*|ransomware|ddos|roubo de dados|data breach|data leak|outage|disruption|indisponivel|indisponibilidade|instabilidade|fora do ar|interromp\w*|falha (?:afeta|em|no|na)|fraude em massa|golpe (?:do pix|em massa))\b/u;
const wideImpact =
  /\b(?:milhoes|milhao|million|em massa|em todo o brasil|nacional|across brazil|hospita\w*|rede bancaria|bancos?|pagamentos?|sistema de saude|servicos publicos|governo federal|prefeitura|eleicoes|energia eletrica|operadora\w*|telecomunicac\w*)\b/u;
const securityIncidents = new Set([
  "SECURITY_BREACH",
  "SUSPECTED_BREACH",
  "DATA_LEAK",
  "RANSOMWARE",
  "DDOS",
]);

function brazilianDomain(url: string) {
  try {
    return new URL(url).hostname.endsWith(".br");
  } catch {
    return false;
  }
}

export function hasBrazilScope(event: Event): boolean {
  if (event.region) return event.region.toUpperCase() === "BR";
  if (event.evidence.trust === "local")
    return brazilianDomain(event.evidence.url);
  if (event.locations) {
    const brazil = event.locations.some((location) =>
      nationalLocation.test(normalize(location)),
    );
    if (
      brazil ||
      (event.evidence.source === "gcloud" && event.status === "active")
    )
      return brazil;
  }
  const title = normalize(event.title);
  const affected = normalize([event.organization, event.service].join(" "));
  return (
    domesticTargets.test(affected) ||
    nationalScope.test(title) ||
    nationalScope.test(normalize(event.summary)) ||
    (event.confirmation === "official" && nationalLocation.test(affected)) ||
    (incidentSignal.test(title) &&
      /(?:pix|caixa|receita federal|dataprev|serpro|prefeitura|correios)/i.test(
        title,
      ))
  );
}

export function isBrazilPriority(event: Event, watch: Watch[]): boolean {
  if (!hasBrazilScope(event) || event.status === "planned") return false;
  if (
    ["MAINTENANCE", "VULNERABILITY", "ACTIVELY_EXPLOITED"].includes(
      event.category,
    )
  )
    return false;
  if (event.evidence.trust === "local") return true;
  const title = normalize(event.title);
  if (
    /^(?:como (?:evitar|se proteger|identificar)|o que (?:e|fazer)|dicas para|guia (?:de|para))\b/u.test(
      title,
    )
  )
    return false;
  const knownIncident =
    securityIncidents.has(event.category) ||
    ["OUTAGE", "DEGRADED", "RECOVERED"].includes(event.category) ||
    incidentSignal.test(title);
  if (!knownIncident) return false;
  return (
    event.severity === "critical" ||
    event.severity === "high" ||
    domesticTargets.test(title) ||
    domesticTargets.test(
      normalize([event.organization, event.service].join(" ")),
    ) ||
    wideImpact.test(title) ||
    matchingWatch(event, watch).some((item) => item.priority)
  );
}

export function isBrazilService(service: Service): boolean {
  if (service.source.startsWith("http-")) return brazilianDomain(service.url);
  return nationalLocation.test(normalize(service.name));
}
