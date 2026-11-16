import { z } from "zod";
import type { Availability, Event, Snapshot } from "../domain/model";
import { iso, plain } from "../domain/security";
import type { Source } from "./catalog";

const products = z
  .array(
    z.object({
      ServiceDisplayName: z.string().min(1),
      ServiceWorkloadName: z.string().min(1),
      Status: z.string().min(1),
      Id: z.string().nullish(),
      Title: z.string().nullish(),
      Message: z.string().nullish(),
      AuthoredDateTime: z.string().nullish(),
      InternalDateTime: z.string().nullish(),
    }),
  )
  .nonempty();

const states: Record<string, Availability> = {
  available: "OPERATIONAL",
  operational: "OPERATIONAL",
  servicedegradation: "DEGRADED",
  serviceinterruption: "OUTAGE_CONFIRMED",
  servicerestored: "RECOVERED",
};

export function microsoftStatus(status: string) {
  return status.toLowerCase().replace(/\s+/g, "");
}
function postDate(value?: string | null) {
  return value?.startsWith("0001-") ? undefined : iso(value);
}

export function microsoftConsumerSnapshot(
  source: Source,
  body: string,
  at: string,
): Snapshot {
  const rows = products.parse(JSON.parse(body));
  const events = new Map<string, Event>();
  const services = rows.map((item) => {
    const state = states[microsoftStatus(item.Status)] ?? "UNKNOWN";
    const service = plain(item.ServiceDisplayName, 110);
    const published = postDate(item.AuthoredDateTime);
    const updated = postDate(item.InternalDateTime);
    if (
      item.Id &&
      ["DEGRADED", "OUTAGE_CONFIRMED", "RECOVERED"].includes(state)
    ) {
      const id = source.id + ":" + item.Id;
      const previous = events.get(id);
      const incident: Event = {
        id,
        title: plain(item.Title, 250) || service,
        summary: plain(item.Message),
        organization: source.organization,
        service,
        category:
          state === "RECOVERED"
            ? "RECOVERED"
            : state === "OUTAGE_CONFIRMED"
              ? "OUTAGE"
              : "DEGRADED",
        status: state === "RECOVERED" ? "resolved" : "active",
        severity: "unknown",
        confirmation: "official",
        availability: state,
        published,
        updated,
        resolved: state === "RECOVERED" ? (updated ?? published) : undefined,
        evidence: {
          source: source.id,
          name: source.name,
          trust: "official",
          url: source.home,
        },
        timeline: [],
      };
      const representative =
        previous?.status === "active" &&
        (incident.status === "resolved" || previous.category === "OUTAGE")
          ? previous
          : incident;
      events.set(id, {
        ...representative,
        service: previous?.service
          ? previous.service + ", " + service
          : service,
      });
    }
    return {
      id: source.id + ":" + item.ServiceWorkloadName,
      source: source.id,
      name: service,
      organization: source.organization ?? source.name,
      state,
      checked: at,
      url: source.home,
    };
  });
  return { events: [...events.values()], services };
}
