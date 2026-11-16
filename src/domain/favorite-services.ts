import type { Event, Service } from "./model";
import { hasBrazilScope, isBrazilPriority } from "./brazil";
import { matchingWatch, type Watch } from "./settings";

const availability = new Set(["OUTAGE", "DEGRADED", "RECOVERED"]);
export function isRestored(event: Event) {
  return (
    event.status === "resolved" &&
    !!event.resolved &&
    availability.has(event.category) &&
    ["official", "observed", "corroborated"].includes(event.confirmation)
  );
}

export function followedServices(watch: Watch[]) {
  return watch.filter(
    (item) =>
      item.priority && (item.kind === "service" || item.kind === "company"),
  );
}

export function serviceChoices(watch: Watch[]): Watch[] {
  const choices = followedServices(watch);
  const split = [
    {
      id: "default-0",
      name: "Microsoft Outlook",
      entries: [
        {
          id: "essential-outlook",
          name: "Outlook corporativo",
          keywords: ["Exchange Online", "Outlook"],
        },
        {
          id: "essential-personal",
          name: "Outlook pessoal",
          keywords: ["Outlook.com", "Hotmail"],
        },
      ],
    },
    {
      id: "default-8",
      name: "SSW Sistemas",
      entries: [
        { id: "essential-ssw", name: "SSW Sistemas", keywords: ["SSW"] },
      ],
    },
    {
      id: "default-9",
      name: "Caixa Econômica Federal",
      entries: [
        {
          id: "essential-caixa",
          name: "Caixa / Pix",
          keywords: ["Caixa Econômica Federal", "Pix"],
        },
      ],
    },
    {
      id: "default-5",
      name: "OpenAI",
      entries: [
        {
          id: "default-5",
          name: "ChatGPT / OpenAI",
          keywords: ["ChatGPT", "OpenAI"],
        },
      ],
    },
  ];
  return choices.flatMap((item) => {
    const catalog = split.find(
      (entry) => entry.id === item.id && entry.name === item.name,
    );
    return catalog
      ? catalog.entries.map((entry) => ({ ...item, ...entry }))
      : [item];
  });
}

function availabilityAliases(item: Watch): Watch {
  if (/outlook (?:pessoal|corporativo)/i.test(item.name)) return item;
  if (/outlook/i.test(item.name))
    return {
      ...item,
      keywords: [...item.keywords, "Outlook", "Exchange Online"],
    };
  return item;
}

export function favoriteServiceMatches(event: Event, item: Watch): boolean {
  return availability.has(event.category) && favoriteRecordMatches(event, item);
}

export function favoriteRecordMatches(event: Event, item: Watch): boolean {
  if (event.status === "planned") return false;
  if (
    item.id === "essential-outlook" &&
    (event.evidence.source === "microsoft-consumer" ||
      /outlook\.com|hotmail/i.test([event.title, event.service].join(" "))) &&
    !/exchange online|outlook corporativo/i.test(
      [event.title, event.service].join(" "),
    )
  )
    return false;
  return (
    matchingWatch(
      {
        title: event.title,
        service: event.service,
        organization: event.organization,
        category: event.category,
      },
      [availabilityAliases(item)],
    ).length > 0
  );
}

export function isRelevantIncident(event: Event, watch: Watch[]) {
  return (
    isBrazilPriority(event, watch) ||
    (hasBrazilScope(event) &&
      ["official", "corroborated", "observed"].includes(event.confirmation) &&
      [
        "OUTAGE",
        "DEGRADED",
        "RECOVERED",
        "SECURITY_BREACH",
        "DATA_LEAK",
        "RANSOMWARE",
        "DDOS",
      ].includes(event.category) &&
      event.status !== "planned") ||
    ((!event.region || event.region.toUpperCase() === "BR") &&
      serviceChoices(watch).some((item) => favoriteServiceMatches(event, item)))
  );
}

export function eventScope(event: Event) {
  if (event.evidence.trust === "local") return "Detectado da sua rede";
  return hasBrazilScope(event) ? "Impacto no Brasil" : "Brasil não confirmado";
}

export function serviceMatches(service: Service, item: Watch) {
  if (
    service.source === "microsoft-consumer" &&
    /outlook corporativo/i.test(item.name)
  )
    return false;
  return (
    matchingWatch({ title: service.name, organization: service.organization }, [
      availabilityAliases(item),
    ]).length > 0
  );
}

export function servicePage(item: Watch) {
  return /outlook|microsoft 365|microsoft teams|exchange online/i.test(
    item.name,
  )
    ? "https://status.cloud.microsoft/"
    : undefined;
}
