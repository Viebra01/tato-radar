import Dexie, { type Table } from "dexie";
import type { Event, Health, Incident, Probe, Service } from "../domain/model";
import { keys, merge, similar } from "../domain/correlation";

export type Alert = {
  id: string;
  incidentId?: string;
  title: string;
  message: string;
  at: string;
  fingerprint?: string;
};
export class WatchDb extends Dexie {
  incidents!: Table<Incident, string>;
  health!: Table<Health, string>;
  services!: Table<Service, string>;
  probes!: Table<Probe & { id: string }, string>;
  alerts!: Table<Alert, string>;
  meta!: Table<{ id: string; value: number }, string>;
  constructor(name = "cyberwatch") {
    super(name);
    this.version(1).stores({
      incidents: "id,*keys,read,published,detected,category",
      health: "id",
      services: "id,source",
      probes: "id",
      alerts: "id,incidentId,at",
    });
    this.version(2).stores({ meta: "id" });
  }
}
export const db = new WatchDb();
export async function saveEvents(
  events: Event[],
  at: string,
  baseline: boolean,
  storage = db,
) {
  if (!events.length) return [];
  const recent = events.some((event) => event.confirmation === "reported")
    ? await storage.incidents
        .where("detected")
        .above(new Date(Date.parse(at) - 7 * 86400000).toISOString())
        .toArray()
    : [];
  const byId = new Map(recent.map((event) => [event.id, event]));
  const index = new Map<string, Incident>();
  const changes: Incident[] = [];
  const ids = [...new Set(events.flatMap(keys))];
  for (const event of await storage.incidents
    .where("keys")
    .anyOf(ids)
    .distinct()
    .toArray()) {
    event.keys.forEach((key) => index.set(key, event));
  }
  const rows = new Map<string, Incident>();
  for (const event of events) {
    const exact = keys(event)
      .map((key) => index.get(key))
      .find(Boolean);
    const previous =
      exact ??
      (event.confirmation === "reported"
        ? [...byId.values()].find((other) => similar(event, other))
        : undefined);
    const result = merge(previous, event, at, baseline);
    const row = result.incident;
    byId.set(row.id, row);
    rows.set(row.id, row);
    row.keys.forEach((key) => index.set(key, row));
    if (result.changed) changes.push(row);
  }
  await storage.incidents.bulkPut([...rows.values()]);
  return changes;
}
export async function saveServices(
  services: Service[],
  source: string,
  storage = db,
) {
  const before = await storage.services.where({ source }).toArray();
  const byId = new Map(before.map((service) => [service.id, service]));
  const rows = services.map((service) => {
    const old = byId.get(service.id);
    byId.delete(service.id);
    return {
      ...service,
      history:
        old?.state === service.state
          ? old.history
          : [
              ...(old?.history ?? []),
              { at: service.checked, state: service.state },
            ].slice(-60),
    };
  });
  await storage.services.bulkPut(rows);
  await storage.services.bulkDelete([...byId.keys()]);
}
