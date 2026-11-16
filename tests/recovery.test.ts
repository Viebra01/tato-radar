import "fake-indexeddb/auto";
import { it, expect, vi } from "vitest";
import { statuspageSnapshot } from "../src/providers/status";
import { sources } from "../src/providers/catalog";
import { db, saveEvents } from "../src/storage/db";
import { defaults } from "../src/domain/settings";
import { notify } from "../src/background/notifications";
import { eventCopy } from "../src/domain/event-copy";
it("fonte → registro único → alerta → Restabelecido → link sem reenvio", async () => {
  const at = new Date().toISOString(),
    create = vi.fn(async (_id: string, _options: { title: string }) => {
      void _id;
      void _options;
      return "test";
    });
  const source = sources.find((s) => s.id === "github")!;
  const payload = (status: string) =>
    JSON.stringify({
      page: {},
      incidents: [
        {
          id: "pipeline-test",
          name: "Instabilidade no Brasil",
          status,
          created_at: at,
          updated_at: at,
          resolved_at: status === "resolved" ? at : null,
          components: [
            { id: "one", name: "São Paulo", status: "partial_outage" },
            { id: "two", name: "API Brasil", status: "partial_outage" },
          ],
          incident_updates: [],
        },
      ],
    });
  vi.stubGlobal("chrome", {
    runtime: { getURL: (p: string) => p },
    notifications: { create },
  });
  try {
    const first = statuspageSnapshot(
      source,
      payload("investigating"),
      at,
      true,
    );
    const changes = await saveEvents(first.events, at, false);
    await notify(changes, defaults, Date.now());
    await notify(
      [{ ...changes[0], summary: "Atualização do mesmo incidente" }],
      defaults,
      Date.now() + 3600000,
    );
    const second = statuspageSnapshot(source, payload("resolved"), at, true);
    const resolved = await saveEvents(second.events, at, false);
    expect(resolved).toHaveLength(1);
    expect(eventCopy(resolved[0]).title).toMatch(/^Restabelecido/);
    await notify(resolved, defaults, Date.now());
    await notify(resolved, defaults, Date.now() + 3600000);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][1].title).toContain("Restabelecido");
    expect((await db.alerts.get("github:pipeline-test"))?.incidentId).toBe(
      "github:pipeline-test",
    );
  } finally {
    await db.incidents.delete("github:pipeline-test");
    await db.alerts.delete("github:pipeline-test");
    vi.unstubAllGlobals();
  }
});
