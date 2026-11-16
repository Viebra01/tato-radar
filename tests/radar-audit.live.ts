import "fake-indexeddb/auto";
import { mkdir, writeFile } from "node:fs/promises";
import { it, expect } from "vitest";
import { monitoringSources } from "../src/providers/catalog";
import { collect, jobsFor } from "../src/providers/collector";
import { deriveRadar } from "../src/domain/radar";
import { defaults } from "../src/domain/settings";
import { hasBrazilScope } from "../src/domain/brazil";
import { isRelevantIncident } from "../src/domain/favorite-services";
import type { Incident, Health } from "../src/domain/model";
import { db, saveEvents } from "../src/storage/db";

it("rastreia registros públicos reais até o radar", async () => {
  const now = Date.now(),
    at = new Date(now).toISOString();
  const health: Health[] = [];
  const occurrences = new Map<string, string[]>();
  const jobs = monitoringSources.flatMap(jobsFor);
  const results = await Promise.allSettled(jobs.map((job) => collect(job, at)));
  for (const [index, result] of results.entries()) {
    const job = jobs[index];
    if (result.status === "rejected") {
      health.push({
        id: job.id,
        failures: 1,
        next: 0,
        error: String(result.reason),
      });
      continue;
    }
    const events = result.value.snapshot?.events ?? [];
    health.push({
      id: job.id,
      success: at,
      failures: 0,
      next: 0,
      eventIds: events.map((event) => event.id),
    });
    for (const event of events) {
      const jobs = occurrences.get(event.id) ?? [];
      occurrences.set(event.id, [...jobs, job.id]);
    }
    await saveEvents(events, at, true);
  }
  const records = await db.incidents.toArray(),
    radar = deriveRadar(records, health, defaults, now);
  const groups: [string, Incident[]][] = [
    ["Ativo no Brasil", radar.brazil],
    ["Favorito sem confirmação no Brasil", radar.global],
    ["Restabelecido no Brasil", radar.recovered],
    ["Restabelecido em favorito", radar.globalRecovered],
    ["Notícia ou relato", radar.news],
    ["Dados desatualizados", radar.stale],
  ];
  const included = new Map(
    groups.flatMap(([label, events]) =>
      events.map((event) => [event.id, label] as const),
    ),
  );
  await mkdir("work", { recursive: true });
  await writeFile(
    "work/diagnostico-fontes.json",
    JSON.stringify(
      {
        at,
        health,
        records: records.map((event) => ({
          id: event.id,
          title: event.title,
          url: event.evidence.url,
          source: event.evidence.name,
          category: event.category,
          status: event.status,
          date: event.published,
          resolved: event.resolved,
          confirmation: event.confirmation,
          scopeBrazil: hasBrazilScope(event),
          sources: event.sources.length,
          occurrences: event.keys
            .filter((key) => key.startsWith("id:"))
            .flatMap((key) => occurrences.get(key.slice(3)) ?? []),
          decision:
            included.get(event.id) ??
            (!isRelevantIncident(event, defaults.watch)
              ? "Fora dos critérios de relevância"
              : "Somente histórico ou sem evidência atual"),
        })),
      },
      null,
      2,
    ),
  );
  expect(records.length).toBeGreaterThan(0);
  db.close();
}, 60000);
