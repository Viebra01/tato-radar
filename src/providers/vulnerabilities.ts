import { z } from "zod";
import type { Event, Snapshot, Severity } from "../domain/model";
import { iso, plain } from "../domain/security";
import type { Source } from "./catalog";

const cveId = z.string().regex(/^CVE-\d{4}-\d{4,}$/);
const kev = z.object({
  dateReleased: z.string(),
  vulnerabilities: z.array(
    z.object({
      cveID: cveId,
      vendorProject: z.string(),
      product: z.string(),
      vulnerabilityName: z.string(),
      dateAdded: z.string(),
      shortDescription: z.string(),
      knownRansomwareCampaignUse: z.string().optional(),
    }),
  ),
});
const score = z.object({
  cvssData: z.object({ baseScore: z.number().min(0).max(10) }),
  type: z.string().optional(),
});
const nvd = z.object({
  timestamp: z.string().optional(),
  totalResults: z.number(),
  vulnerabilities: z.array(
    z.object({
      cve: z.object({
        id: cveId,
        published: z.string(),
        lastModified: z.string(),
        vulnStatus: z.string().optional(),
        descriptions: z.array(
          z.object({ lang: z.string(), value: z.string() }),
        ),
        metrics: z.record(z.string(), z.unknown()).optional(),
      }),
    }),
  ),
});
function timestampUtc(value: string) {
  return iso(/T\d\d:\d\d:\d\d(?:\.\d+)?$/.test(value) ? value + "Z" : value);
}
export function kevSnapshot(source: Source, body: string): Snapshot {
  const data = kev.parse(JSON.parse(body));
  return {
    originUpdated: iso(data.dateReleased),
    events: data.vulnerabilities.map((item): Event => ({
      id: source.id + ":" + item.cveID,
      title: plain(item.vulnerabilityName, 250),
      summary: plain(item.shortDescription),
      organization: plain(item.vendorProject, 110),
      service: plain(item.product, 110),
      category: "ACTIVELY_EXPLOITED",
      cve: item.cveID,
      severity: "unknown",
      confirmation: "official",
      status: "published",
      published: iso(item.dateAdded),
      publishedPrecision: "day",
      evidence: {
        source: source.id,
        name: source.name,
        url: source.home + "?search_api_fulltext=" + item.cveID,
        trust: "official",
      },
      timeline: [],
      raw: { ransomware: plain(item.knownRansomwareCampaignUse, 80) },
    })),
  };
}
export function nvdSnapshot(source: Source, body: string): Snapshot {
  const data = nvd.parse(JSON.parse(body));
  return {
    originUpdated: data.timestamp ? timestampUtc(data.timestamp) : undefined,
    events: data.vulnerabilities.map(({ cve }): Event => {
      const metrics = cve.metrics ?? {};
      const parsed = z
        .array(score)
        .safeParse(
          metrics.cvssMetricV40 ??
            metrics.cvssMetricV31 ??
            metrics.cvssMetricV30 ??
            metrics.cvssMetricV2,
        );
      const values = parsed.success ? parsed.data : [];
      const cvss = (
        values.find((value) => value.type === "Primary") ?? values[0]
      )?.cvssData.baseScore;
      const severity: Severity =
        cvss == null
          ? "unknown"
          : cvss >= 9
            ? "critical"
            : cvss >= 7
              ? "high"
              : cvss >= 4
                ? "medium"
                : "low";
      return {
        id: source.id + ":" + cve.id,
        cve: cve.id,
        title: cve.id,
        summary: plain(cve.descriptions.find((d) => d.lang === "en")?.value),
        category: "VULNERABILITY",
        severity,
        confirmation: cve.vulnStatus === "Rejected" ? "contested" : "official",
        status: "published",
        published: timestampUtc(cve.published),
        updated: timestampUtc(cve.lastModified),
        evidence: {
          source: source.id,
          name: source.name,
          url: "https://nvd.nist.gov/vuln/detail/" + cve.id,
          trust: "official",
        },
        timeline: [],
        raw: {
          cvss: cvss?.toString() ?? "",
          status: plain(cve.vulnStatus, 60),
        },
      };
    }),
  };
}
