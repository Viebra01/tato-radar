import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { Category, Event, Snapshot } from "../domain/model";
import { canonical, iso, plain, publicUrl } from "../domain/security";
import type { Source } from "./catalog";
import { microsoftStatus } from "./microsoft";

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  processEntities: false,
  removeNSPrefix: true,
});
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function scalar(value: unknown): string {
  return typeof value === "string"
    ? value
    : typeof record(value)["#text"] === "string"
      ? String(record(value)["#text"])
      : "";
}
function array(value: unknown): unknown[] {
  return Array.isArray(value)
    ? value
    : value == null || value === ""
      ? []
      : [value];
}
export function newsCategory(title: string): Category {
  if (/\bransomware\b/i.test(title)) return "RANSOMWARE";
  if (/\bddos\b|denial.of.service attack/i.test(title)) return "DDOS";
  if (
    /data (?:leak|exposure)|vazamento de dados|dados (?:vazam|expostos)/i.test(
      title,
    )
  )
    return "DATA_LEAK";
  if (
    /\bbreach\b|invadid|comprometimento|ciberataque|ataque (?:hacker|cibernético)/i.test(
      title,
    )
  )
    return "SUSPECTED_BREACH";
  if (/fora do ar|indisponível|indisponibilidade|\boutage\b/i.test(title))
    return "OUTAGE";
  if (/instabilidade|\bdisruption\b/i.test(title)) return "DEGRADED";
  return "CYBER_NEWS";
}
function feedLink(value: unknown) {
  for (const item of array(value)) {
    const obj = record(item);
    if (obj["@_rel"] && obj["@_rel"] !== "alternate") continue;
    const url = publicUrl(plain(obj["@_href"] ?? scalar(item), 2048));
    if (url) return url;
  }
}
export function feedSnapshot(source: Source, body: string): Snapshot {
  if (
    /<!\s*(DOCTYPE|ENTITY)\b/i.test(
      body.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, ""),
    ) ||
    XMLValidator.validate(body) !== true
  )
    throw new Error("XML inválido ou DTD bloqueada");
  const root = record(parser.parse(body));
  const atom = "feed" in root;
  const feed = record(atom ? root.feed : record(root.rss).channel);
  if (!("title" in feed)) throw new Error("Resposta não é RSS/Atom");
  const events = array(atom ? feed.entry : feed.item)
    .filter(
      (value) =>
        source.platform !== "windows" ||
        /\b(?:Windows|Win32k|NTFS)\b/i.test(scalar(record(value).title)),
    )
    .slice(0, 200)
    .flatMap((value): Event[] => {
      const item = record(value);
      const title = plain(scalar(item.title), 250);
      const url = feedLink(item.link);
      if (!title || !url) return [];
      const description = scalar(
        item.description ?? item.summary ?? item.content,
      );
      const summary = plain(description);
      const published = iso(scalar(item.pubDate ?? item.published));
      const updated = iso(scalar(item.updated));
      const official = source.kind !== "rss";
      const trust = official
        ? "official"
        : source.id.startsWith("feed-")
          ? "custom"
          : "editorial";
      const microsoft = source.id === "microsoft365";
      const providerStatus = microsoftStatus(scalar(item.status));
      const affected = microsoft
        ? plain(description, 2200).split(
            /Current status:|Previous status:|Scope of impact:/i,
          )[0]
        : "";
      const service = microsoft
        ? [
            "Outlook",
            "Exchange Online",
            "Microsoft Teams",
            "SharePoint Online",
            "Microsoft Copilot 365",
          ]
            .filter((name) =>
              affected.toLowerCase().includes(name.toLowerCase()),
            )
            .join(", ") || undefined
        : undefined;
      const category =
        microsoft && providerStatus === "serviceinterruption"
          ? "OUTAGE"
          : microsoft && providerStatus === "servicedegradation"
            ? "DEGRADED"
            : microsoft && providerStatus === "servicerestored"
              ? "RECOVERED"
              : source.kind === "bulletin"
                ? "SECURITY_ADVISORY"
                : source.kind === "statusfeed"
                  ? "SERVICE_NOTICE"
                  : newsCategory(title);
      const id =
        source.id +
        ":" +
        (plain(scalar(item.guid ?? item.id), 300) || canonical(url));
      const cve =
        source.platform === "windows"
          ? plain(scalar(item.guid ?? item.id), 50)
              .match(/^CVE-\d{4}-\d{4,}$/i)?.[0]
              ?.toUpperCase()
          : undefined;
      return [
        {
          id,
          title,
          summary,
          category,
          organization: source.organization,
          service,
          cve,
          language:
            source.language ??
            (/^pt(?:[-_]|$)/i.test(scalar(feed.language))
              ? "pt-BR"
              : undefined),
          severity: "unknown",
          status:
            microsoft && ["OUTAGE", "DEGRADED"].includes(category)
              ? "active"
              : category === "RECOVERED"
                ? "resolved"
                : "published",
          confirmation: official ? "official" : "reported",
          published,
          updated,
          resolved:
            category === "RECOVERED" ? (updated ?? published) : undefined,
          evidence: { source: source.id, name: source.name, url, trust },
          timeline: [],
        },
      ];
    });
  return {
    events,
    originUpdated: iso(scalar(feed.lastBuildDate ?? feed.updated)),
  };
}
