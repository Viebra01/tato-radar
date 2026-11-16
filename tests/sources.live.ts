import { describe, expect, it } from "vitest";
import { monitoringSources as sources } from "../src/providers/catalog";
import { collect, jobsFor } from "../src/providers/collector";
const jobs = sources.flatMap(jobsFor);
describe("endpoints públicos sem fixtures", () => {
  it.each(jobs)("$id valida a resposta real", async (job) => {
    const { response, snapshot } = await collect(job, new Date().toISOString());
    expect(response.status).toBe(200);
    expect(snapshot?.events).toBeInstanceOf(Array);
    if (job.source.kind === "statuspage" && !job.history)
      expect(snapshot?.services?.length).toBeGreaterThan(0);
    if (job.source.kind === "microsoft-consumer")
      expect(
        snapshot?.services?.find((service) => service.name === "Outlook.com"),
      ).toBeDefined();
    if (job.source.kind === "kev")
      expect(snapshot?.events.length).toBeGreaterThan(100);
    if (["rss", "bulletin"].includes(job.source.kind))
      expect(snapshot?.events.length).toBeGreaterThan(0);
  });
});
