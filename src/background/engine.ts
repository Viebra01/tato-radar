import type { Event, Health, Incident } from "../domain/model";
import { advance, initialProbe, type Observation } from "../domain/probe";
import { permissionPattern } from "../domain/security";
import { getSettings, type Monitor } from "../domain/settings";
import {
  monitoringSources as sources,
  type Source,
} from "../providers/catalog";
import { deriveRadar } from "../domain/radar";
import { collect, jobsFor, type Job } from "../providers/collector";
import { CollectionError, request } from "../providers/http";
import { db, saveEvents, saveServices } from "../storage/db";
import { digest, notify } from "./notifications";
import { eligible, emptyHealth, failure } from "./schedule";

const sourceJob = (job: Job) => ({
  ...job,
  monitor: undefined as Monitor | undefined,
});
type Task = ReturnType<typeof sourceJob>;
const origin = (task: Task) => new URL(task.url).origin;
function customSource(monitor: Monitor): Source {
  return {
    id: "http-" + monitor.id,
    name: monitor.name,
    home: monitor.url,
    url: monitor.url,
    kind: "statusfeed",
    minutes: monitor.minutes,
    note: "Medição HTTP da rede deste navegador.",
  };
}
async function runSource(
  task: Task,
  before: Health,
  at: string,
): Promise<Incident[]> {
  if (
    task.source.id.startsWith("feed-") &&
    !(await chrome.permissions.contains({
      origins: [permissionPattern(task.url)],
    }))
  ) {
    throw new CollectionError("Permissão do domínio ausente");
  }
  // Refresh cached Google Cloud incidents once after the regional parser changes.
  const parserVersion = task.source.id === "gcloud" ? 1 : undefined;
  const { response, snapshot } = await collect(
    task,
    at,
    before.eventIds && before.parserVersion === parserVersion
      ? before
      : undefined,
  );
  return db.transaction(
    "rw",
    [db.health, db.incidents, db.services],
    async () => {
      const changes = snapshot
        ? await saveEvents(snapshot.events, at, !before.success)
        : [];
      if (snapshot?.services)
        await saveServices(snapshot.services, task.source.id);
      if (response.unchanged && !task.history)
        await db.services
          .where("source")
          .equals(task.source.id)
          .modify({ checked: at });
      const eventIds =
        snapshot?.events.map((event) => event.id) ?? before.eventIds;
      if (response.unchanged && eventIds?.length)
        await db.incidents
          .where("keys")
          .anyOf(eventIds.map((id) => "id:" + id))
          .modify({ checked: at });
      await db.health.put({
        eventIds,
        parserVersion,
        id: task.id,
        attempted: at,
        success: at,
        failures: 0,
        next: 0,
        etag: response.unchanged
          ? (response.etag ?? before.etag)
          : response.etag,
        modified: response.unchanged
          ? (response.modified ?? before.modified)
          : response.modified,
        count: snapshot?.events.length ?? before.count,
        originUpdated: snapshot?.originUpdated ?? before.originUpdated,
        log: [
          {
            at,
            result: response.unchanged
              ? "HTTP 304 · sem alteração"
              : "HTTP " + response.status,
          },
          ...(before.log ?? []),
        ].slice(0, 15),
      });
      return changes;
    },
  );
}
async function runMonitor(
  task: Task,
  monitor: Monitor,
  before: Health,
  at: string,
  network: boolean,
): Promise<Incident[]> {
  if (
    !(await chrome.permissions.contains({
      origins: [permissionPattern(task.url)],
    }))
  )
    throw new CollectionError("Permissão do domínio ausente");
  let observation: Observation = "unknown";
  let detail = "";
  let error: CollectionError | undefined;
  try {
    const result = await request(task.url, {
      method: monitor.method,
      timeout: monitor.timeout * 1000,
      probe: true,
    });
    const status = result.status;
    detail = status === 0 ? "Redirecionamento bloqueado" : "HTTP " + status;
    if (status >= 200 && status < 300) observation = "good";
    if (status >= 500) observation = "bad";
  } catch (cause) {
    if (!(cause instanceof CollectionError)) throw cause;
    error = cause;
    detail = cause.message;
    if (cause.status !== 429 && network) observation = "bad";
  }
  return db.transaction(
    "rw",
    [db.probes, db.services, db.health, db.incidents, db.meta],
    async () => {
      const previous = (await db.probes.get(task.id)) ?? initialProbe;
      const next = advance(
        previous,
        observation,
        at,
        monitor.failures,
        monitor.successes,
        task.id + ":" + at,
      );
      await db.probes.put({ ...next, id: task.id });
      const durationMs = previous.since
        ? Date.parse(at) - Date.parse(previous.since)
        : undefined;
      const evidence = {
        source: task.id,
        name: monitor.name,
        url: monitor.url,
        trust: "local" as const,
      };
      const events: Event[] = [];
      const common = {
        organization: monitor.name,
        service: monitor.name,
        severity: monitor.severity,
        confirmation: "observed" as const,
        evidence,
        timeline: [{ at, text: monitor.method + " · " + detail }],
        updated: at,
        availability: next.state,
        raw: {
          method: monitor.method,
          response: detail,
          scope: "Rede deste navegador",
        },
      };
      if (next.outageId && !previous.outageId)
        events.push({
          ...common,
          id: next.outageId,
          title: monitor.name + " · possível indisponibilidade",
          summary:
            monitor.failures +
            " verificações seguidas falharam a partir da rede deste navegador. " +
            detail +
            ".",
          category: "OUTAGE",
          status: "active",
          occurred: next.since,
        });
      if (next.state === "RECOVERED" && previous.outageId)
        events.push({
          ...common,
          id: previous.outageId,
          title: monitor.name + " · recuperação observada",
          summary:
            monitor.successes +
            " verificações seguidas responderam com sucesso a partir da rede deste navegador.",
          category: "RECOVERED",
          related: ["OUTAGE"],
          status: "resolved",
          occurred: previous.since,
          resolved: at,
          durationMs,
        });
      await saveServices(
        [
          {
            id: task.id,
            source: task.id,
            organization: monitor.name,
            name: monitor.name,
            state: next.state,
            checked: at,
            url: task.url,
            detail: monitor.method + " · " + detail,
          },
        ],
        task.id,
      );
      await db.health.put(
        error?.status === 429
          ? failure(before, error, at, task.minutes)
          : {
              id: task.id,
              attempted: at,
              success: observation !== "unknown" ? at : before.success,
              failures: 0,
              next: 0,
              error: observation === "unknown" ? detail : undefined,
              log: [{ at, result: detail }, ...(before.log ?? [])].slice(0, 15),
            },
      );
      if (error?.status === 429)
        await db.meta.put({
          id: "origin:" + origin(task),
          value: failure(before, error, at, task.minutes).next,
        });
      const changes = await saveEvents(events, at, false);
      return monitor.mute ? [] : changes;
    },
  );
}
let active: Promise<void> | undefined;
export function synchronize(manual = false): Promise<void> {
  if (active) return active;
  active = tick(manual).finally(() => {
    active = undefined;
  });
  return active;
}
async function tick(manual: boolean) {
  const settings = await getSettings();
  const tasks: Task[] = sources
    .flatMap((source) =>
      jobsFor({
        ...source,
        minutes: Math.max(source.minutes, settings.intervals[source.id] ?? 0),
      }),
    )
    .map(sourceJob);
  for (const feed of settings.feeds) {
    const source: Source = {
      ...feed,
      id: "feed-" + feed.id,
      home: feed.url,
      kind: "rss",
      note: "Feed personalizado.",
    };
    tasks.push(...jobsFor(source).map(sourceJob));
  }
  for (const monitor of settings.monitors) {
    const source = customSource(monitor);
    tasks.push({ ...sourceJob(jobsFor(source)[0]), monitor });
  }
  const now = Date.now();
  const health = new Map(
    (await db.health.toArray()).map((row) => [row.id, row]),
  );
  const candidates = tasks.filter(
    (task) =>
      !settings.disabled.includes(task.source.id) &&
      eligible(
        health.get(task.id) ?? emptyHealth(task.id),
        now,
        task.minutes,
        manual,
      ),
  );
  const changes: Incident[] = [];
  const normal = candidates.filter((task) => !task.monitor);
  const probes = candidates.filter((task) => task.monitor);
  async function batch(queue: Task[], network: boolean): Promise<boolean> {
    const groups = new Map<string, Task[]>();
    for (const task of queue) {
      const key = origin(task);
      if (groups.has(key)) groups.get(key)!.push(task);
      else groups.set(key, [task]);
    }
    const origins = [...groups];
    let index = 0;
    let online = false;
    await Promise.all(
      Array.from({ length: Math.min(4, origins.length) }, async () => {
        while (index < origins.length) {
          const [key, tasks] = origins[index++];
          const limit = await db.meta.get("origin:" + key);
          if (limit && Date.now() < limit.value) continue;
          tasks.sort((a, b) =>
            (health.get(a.id)?.attempted ?? "").localeCompare(
              health.get(b.id)?.attempted ?? "",
            ),
          );
          const task = tasks[0];
          const before = health.get(task.id) ?? emptyHealth(task.id);
          const at = new Date().toISOString();
          await db.transaction("rw", [db.health, db.meta], async () => {
            await db.health.put({ ...before, attempted: at });
            await db.meta.put({
              id: "origin:" + key,
              value: Date.now() + 15000,
            });
          });
          try {
            const records = task.monitor
              ? await runMonitor(task, task.monitor, before, at, network)
              : await runSource(task, before, at);
            changes.push(...records);
            if (!task.monitor && !task.source.id.startsWith("feed-"))
              online = true;
          } catch (error) {
            const row = failure(before, error, at, task.minutes);
            await db.transaction("rw", [db.health, db.meta], async () => {
              await db.health.put(row);
              if (error instanceof CollectionError && error.status === 429)
                await db.meta.put({ id: "origin:" + key, value: row.next });
            });
          }
        }
      }),
    );
    return online;
  }
  const collected = await batch(normal, false);
  const online =
    navigator.onLine &&
    (collected ||
      (await db.health.toArray()).some(
        (row) =>
          sources.some(
            (source) => source.kind === "statuspage" && source.id === row.id,
          ) &&
          row.success &&
          !row.error &&
          now - Date.parse(row.success) < 180000,
      ));
  await batch(probes, online);
  if (candidates.length)
    await db.meta.put({ id: "lastSync", value: Date.now() });
  await notify(changes, settings, Date.now());
  await digest(settings, Date.now());
  await updateBadge();
}
export async function updateBadge() {
  const settings = await getSettings();
  const { count, phase, phrase } = deriveRadar(
    await db.incidents.toArray(),
    await db.health.toArray(),
    settings,
    Date.now(),
  );
  const previous = await chrome.storage.local.get([
    "tatoPhase",
    "tatoIconVersion",
  ]);
  const version = chrome.runtime.getManifest().version;
  if (previous.tatoPhase !== phase || previous.tatoIconVersion !== version) {
    await chrome.action.setIcon({
      path: {
        16: "icon-16.png",
        32: "icon-32.png",
      },
    });
    await chrome.storage.local.set({
      tatoPhase: phase,
      tatoIconVersion: version,
    });
  }
  await chrome.action.setTitle({ title: "Tato Radar · " + phrase });
  await chrome.action.setBadgeBackgroundColor({ color: "#247d68" });
  await chrome.action.setBadgeText({
    text: count > 99 ? "99+" : count ? String(count) : "",
  });
}
