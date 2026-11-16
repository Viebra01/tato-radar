import { synchronize, updateBadge } from "./engine";
import { db } from "../storage/db";
const alarm = "cyberwatch:sync";
function report(error: unknown) {
  console.error("Tato Radar:", error);
}
async function start() {
  if (!(await chrome.alarms.get(alarm)))
    await chrome.alarms.create(alarm, { periodInMinutes: 1 });
  await synchronize();
}
chrome.runtime.onInstalled.addListener(() => {
  void start().catch(report);
});
chrome.runtime.onStartup.addListener(() => {
  void start().catch(report);
});
chrome.alarms.onAlarm.addListener((event) => {
  if (event.name === alarm) void synchronize().catch(report);
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.settings) void start().catch(report);
});
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (
    sender.id !== chrome.runtime.id ||
    !sender.url?.startsWith(chrome.runtime.getURL(""))
  )
    return;
  if (message?.type === "SYNC") {
    void startAlarmAndSync().then(
      () => reply({ ok: true }),
      (error) => {
        report(error);
        reply({ ok: false });
      },
    );
    return true;
  }
  if (message?.type === "BADGE") {
    void updateBadge().then(
      () => reply({ ok: true }),
      (error) => {
        report(error);
        reply({ ok: false });
      },
    );
    return true;
  }
});
async function startAlarmAndSync() {
  if (!(await chrome.alarms.get(alarm)))
    await chrome.alarms.create(alarm, { periodInMinutes: 1 });
  await synchronize(true);
}
chrome.notifications.onClicked.addListener((id) => {
  void (async () => {
    const alert = await db.alerts.get(id);
    const hash = alert?.incidentId
      ? "#incident=" + encodeURIComponent(alert.incidentId)
      : "#live";
    await chrome.tabs.create({
      url: chrome.runtime.getURL("index.html" + hash),
    });
    await chrome.notifications.clear(id);
  })().catch(report);
});
