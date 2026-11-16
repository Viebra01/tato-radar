import { z } from "zod";
import type {
  Availability,
  Event,
  Severity,
  Snapshot,
  Status,
} from "../domain/model";
import { iso, plain, publicUrl } from "../domain/security";
import type { Source } from "./catalog";

const component = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  group: z.boolean().optional(),
});
const page = z.object({ updated_at: z.string().optional() });
const incident = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  impact: z.string().optional(),
  shortlink: z.string().optional(),
  created_at: z.string().optional(),
  started_at: z.string().nullish(),
  updated_at: z.string().optional(),
  resolved_at: z.string().nullish(),
  components: z.array(component).optional(),
  incident_updates: z
    .array(
      z.object({
        body: z.string().nullish(),
        created_at: z.string().optional(),
        display_at: z.string().optional(),
        status: z.string().optional(),
      }),
    )
    .default([]),
});
const summary = z.object({
  page,
  status: z.object({ indicator: z.string(), description: z.string() }),
  components: z.array(component),
  incidents: z.array(incident),
  scheduled_maintenances: z.array(incident).optional(),
});
const history = z.object({ incidents: z.array(incident) });
const componentStates: Record<string, Availability> = {
  operational: "OPERATIONAL",
  degraded_performance: "DEGRADED",
  partial_outage: "OUTAGE_CONFIRMED",
  major_outage: "OUTAGE_CONFIRMED",
  under_maintenance: "MAINTENANCE",
};
function providerEvidence(source: Source, url?: string) {
  return {
    source: source.id,
    name: source.name,
    url: publicUrl(url) ?? source.home,
    trust: "official" as const,
  };
}
export function statuspageSnapshot(
  source: Source,
  body: string,
  at: string,
  isHistory = false,
): Snapshot {
  const data = JSON.parse(body);
  if (source.id === "openai" && data.incidents === undefined && !isHistory)
    data.incidents = [];
  const current = isHistory ? undefined : summary.parse(data);
  const items = current
    ? [...current.incidents, ...(current.scheduled_maintenances ?? [])]
    : history.parse(data).incidents;
  const events = items.map((item): Event => {
    const maintenance =
      ["scheduled", "in_progress", "completed"].includes(item.status) ||
      item.impact === "maintenance";
    const resolved = ["resolved", "postmortem", "completed"].includes(
      item.status,
    );
    const status: Status = resolved
      ? "resolved"
      : item.status === "scheduled"
        ? "planned"
        : "active";
    const unavailable = item.components?.some((c) =>
      ["partial_outage", "major_outage"].includes(c.status),
    );
    const severity: Severity =
      item.impact === "critical"
        ? "critical"
        : item.impact === "major"
          ? "high"
          : item.impact === "minor"
            ? "medium"
            : "unknown";
    const timeline = item.incident_updates
      .flatMap((update) => {
        const at = iso(update.display_at) ?? iso(update.created_at);
        const text = plain(update.body);
        const status: Status | undefined = [
          "resolved",
          "completed",
          "postmortem",
        ].includes(update.status ?? "")
          ? "resolved"
          : undefined;
        return at && text ? [{ at, text, status }] : [];
      })
      .sort((a, b) => b.at.localeCompare(a.at));
    return {
      id: source.id + ":" + item.id,
      title: plain(item.name, 250),
      summary: timeline[0]?.text ?? "",
      category: maintenance
        ? "MAINTENANCE"
        : unavailable
          ? "OUTAGE"
          : "DEGRADED",
      organization: source.organization,
      service: item.components
        ?.map((c) => plain(c.name, 80))
        .slice(0, 10)
        .join(", "),
      severity,
      status,
      confirmation: "official",
      availability: resolved
        ? undefined
        : maintenance
          ? "MAINTENANCE"
          : unavailable
            ? "OUTAGE_CONFIRMED"
            : undefined,
      occurred: iso(item.started_at),
      published: iso(item.created_at),
      updated: iso(item.updated_at),
      resolved:
        iso(item.resolved_at) ??
        timeline.find((update) => update.status === "resolved")?.at,
      evidence: providerEvidence(
        source,
        item.shortlink ??
          source.home + "/incidents/" + encodeURIComponent(item.id),
      ),
      timeline,
      raw: { status: plain(item.status, 80), impact: plain(item.impact, 80) },
    };
  });
  const services = current?.components
    .filter((c) => !c.group)
    .map((c) => ({
      id: source.id + ":" + c.id,
      source: source.id,
      name: plain(c.name, 110),
      organization: source.organization ?? source.name,
      state: componentStates[c.status] ?? "UNKNOWN",
      checked: at,
      url: source.home,
    }));
  return { events, services, originUpdated: iso(current?.page.updated_at) };
}
const google = z.array(
  z.object({
    id: z.string(),
    begin: z.string().optional(),
    created: z.string().optional(),
    end: z.string().nullish(),
    modified: z.string().optional(),
    external_desc: z.string(),
    service_name: z.string().optional(),
    status_impact: z.string().optional(),
    uri: z.string(),
    currently_affected_locations: z
      .array(z.object({ id: z.string(), title: z.string().optional() }))
      .optional(),
    previously_affected_locations: z
      .array(z.object({ id: z.string(), title: z.string().optional() }))
      .optional(),
    updates: z
      .array(z.object({ when: z.string(), text: z.string() }))
      .default([]),
  }),
);
export function cloudSnapshot(source: Source, body: string): Snapshot {
  const events = google.parse(JSON.parse(body)).map((item): Event => {
    const resolved = iso(item.end);
    const outage = item.status_impact === "SERVICE_OUTAGE";
    const disruption = item.status_impact === "SERVICE_DISRUPTION";
    const current = item.currently_affected_locations;
    const previous = item.previously_affected_locations;
    const affected =
      source.id === "gcloud" && !resolved
        ? (current ?? (previous ? [] : undefined))
        : [...(current ?? []), ...(previous ?? [])];
    const locations = affected && [
      ...new Set(
        affected.map((location) => plain(location.title ?? location.id, 90)),
      ),
    ];
    const region = affected?.some(
      (location) => location.id === "southamerica-east1",
    )
      ? "BR"
      : undefined;
    return {
      id: source.id + ":" + item.id,
      title: plain(item.external_desc, 250),
      summary: plain(item.updates[0]?.text),
      organization: source.organization,
      service: plain(item.service_name, 160),
      category: outage ? "OUTAGE" : disruption ? "DEGRADED" : "SERVICE_NOTICE",
      region,
      locations,
      severity: "unknown",
      status: resolved
        ? "resolved"
        : outage || disruption
          ? "active"
          : "published",
      confirmation: "official",
      availability: resolved
        ? undefined
        : outage
          ? "OUTAGE_CONFIRMED"
          : disruption
            ? "DEGRADED"
            : undefined,
      occurred: iso(item.begin),
      published: iso(item.created),
      updated: iso(item.modified),
      resolved,
      evidence: providerEvidence(source, new URL(item.uri, source.home).href),
      timeline: item.updates.flatMap((u) => {
        const at = iso(u.when);
        return at ? [{ at, text: plain(u.text) }] : [];
      }),
      raw: { impact: plain(item.status_impact, 80) },
    };
  });
  return {
    events,
    originUpdated: events
      .flatMap((e) => e.updated ?? [])
      .sort()
      .at(-1),
  };
}
