import type { Snapshot } from "../domain/model";
import type { Source } from "./catalog";
import { request } from "./http";
import { statuspageSnapshot, cloudSnapshot } from "./status";
import { microsoftConsumerSnapshot } from "./microsoft";
import { feedSnapshot } from "./feeds";
import { kevSnapshot, nvdSnapshot } from "./vulnerabilities";
export type Job = {
  id: string;
  source: Source;
  url: string;
  minutes: number;
  history?: boolean;
};
export function jobsFor(source: Source): Job[] {
  const jobs: Job[] = [
    { id: source.id, source, url: source.url, minutes: source.minutes },
  ];
  if (source.history)
    jobs.push({
      id: source.id + "-history",
      source,
      url: source.history,
      history: true,
      minutes: Math.max(10, source.minutes),
    });
  return jobs;
}
export async function collect(
  job: Job,
  at: string,
  cache?: { etag?: string; modified?: string },
) {
  const source = job.source;
  let url = job.url;
  if (source.kind === "nvd") {
    const end = new Date(at);
    const start = new Date(end.getTime() - 48 * 3600000);
    url +=
      "?" +
      new URLSearchParams({
        lastModStartDate: start.toISOString(),
        lastModEndDate: end.toISOString(),
        resultsPerPage: "200",
      });
  }
  const response = await request(url, source.kind === "nvd" ? {} : cache);
  if (response.unchanged) return { response };
  let snapshot: Snapshot;
  switch (source.kind) {
    case "statuspage":
      snapshot = statuspageSnapshot(source, response.body, at, job.history);
      break;
    case "cloud":
      snapshot = cloudSnapshot(source, response.body);
      break;
    case "microsoft-consumer":
      snapshot = microsoftConsumerSnapshot(source, response.body, at);
      break;
    case "kev":
      snapshot = kevSnapshot(source, response.body);
      break;
    case "nvd":
      snapshot = nvdSnapshot(source, response.body);
      break;
    default:
      snapshot = feedSnapshot(source, response.body);
  }
  return { response, snapshot };
}
