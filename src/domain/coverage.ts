import type { Health } from "./model";
import type { Settings } from "./settings";
import { monitoringSources } from "../providers/catalog";

export function sourceCoverage(
  health: Health[],
  settings: Settings,
  now: number,
  scope: "all" | "alerts" | "bulletins" = "all",
) {
  const byId = new Map(health.map((row) => [row.id, row]));
  const groups = { failed: 0, late: 0, waiting: 0, current: 0 };
  const sources = (
    scope === "bulletins"
      ? monitoringSources.filter((source) => source.platform)
      : [
          ...monitoringSources.filter(
            (source) => scope === "all" || !source.platform,
          ),
          ...settings.feeds.map((feed) => ({
            ...feed,
            id: "feed-" + feed.id,
            kind: "rss",
          })),
          ...settings.monitors.map((monitor) => ({
            ...monitor,
            id: "http-" + monitor.id,
            kind: "http",
          })),
        ]
  )
    .filter((source) => !settings.disabled.includes(source.id))
    .map((source) => {
      const row = byId.get(source.id);
      const delay =
        Math.max(10, (settings.intervals[source.id] ?? source.minutes) * 3) *
        60000;
      const state: keyof typeof groups = row?.error
        ? "failed"
        : !row?.success
          ? "waiting"
          : now - Date.parse(row.success) < delay
            ? "current"
            : "late";
      groups[state]++;
      return {
        id: source.id,
        name: source.name,
        kind: source.kind,
        row,
        state,
      };
    });
  return {
    sources,
    groups,
    complete: sources.length > 0 && sources.length === groups.current,
  };
}
