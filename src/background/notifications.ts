import { matchingWatch, type Settings } from "../domain/settings";
import type { Incident } from "../domain/model";
import { db, type Alert } from "../storage/db";
import { formatNotification } from "./notification-copy";
import {
  favoriteServiceMatches,
  isRelevantIncident,
  isRestored,
  serviceChoices,
} from "../domain/favorite-services";
import { hasBrazilScope } from "../domain/brazil";
export function canNotify(incident: Incident, settings: Settings, now: number) {
  if (!settings.notifications || settings.dnd || settings.snooze > now)
    return false;
  if (!isRelevantIncident(incident, settings.watch)) return false;
  if (
    !hasBrazilScope(incident) &&
    (!settings.notifyGlobal || incident.confirmation !== "official")
  )
    return false;
  const category = incident.category;
  const report = incident.confirmation === "reported";
  if (["unconfirmed", "contested"].includes(incident.confirmation))
    return false;
  const favorites = matchingWatch(incident, settings.watch);
  const recovery =
    isRestored(incident) && incident.transitions.at(-1)?.to === "resolved";
  const alertCategory = recovery
    ? "RECOVERED"
    : report
      ? category === "SUSPECTED_BREACH"
        ? "SUSPECTED_BREACH"
        : "CYBER_NEWS"
      : category;
  if (!settings.alertCategories.includes(alertCategory)) return false;
  if (
    alertCategory === "OUTAGE" ||
    alertCategory === "DEGRADED" ||
    alertCategory === "RECOVERED"
  ) {
    const configured = serviceChoices(settings.watch)
      .filter((item) => item.alerts && favoriteServiceMatches(incident, item))
      .flatMap((item) =>
        settings.serviceAlerts[item.id]
          ? [settings.serviceAlerts[item.id]]
          : [],
      );
    if (
      configured.length &&
      !configured.some(
        (mode) =>
          mode === "changes" ||
          (mode === "outage" && alertCategory === "OUTAGE") ||
          (mode === "recovery" && alertCategory !== "DEGRADED"),
      )
    )
      return false;
  }
  if (favorites.length && !favorites.some((item) => item.alerts)) return false;
  if (settings.favoritesOnly && !favorites.some((item) => item.alerts))
    return false;
  if (incident.status === "resolved" && !recovery) return false;
  const time = incident.updated ?? incident.published ?? incident.occurred;
  return !!time && now - Date.parse(time) <= 86400000;
}
async function display(alert: Alert) {
  await chrome.notifications.create(alert.id, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icon-128.png"),
    title: alert.title.slice(0, 150),
    message: alert.message.slice(0, 280),
  });
}
export async function notify(
  incidents: Incident[],
  settings: Settings,
  now: number,
) {
  const sorted = [
    ...new Map(incidents.map((incident) => [incident.id, incident])).values(),
  ].sort(
    (a, b) =>
      Number(matchingWatch(b, settings.watch).some((item) => item.priority)) -
      Number(matchingWatch(a, settings.watch).some((item) => item.priority)),
  );
  for (const incident of sorted
    .filter((item) => canNotify(item, settings, now))
    .slice(0, 5)) {
    const last = await db.alerts.get(incident.id);
    const state = [incident.status, incident.category].join("|");
    const fingerprint = "v2|" + state + "|" + incident.confirmation;
    if (
      last?.fingerprint === fingerprint ||
      last?.fingerprint?.startsWith(state + "|")
    )
      continue;
    if (last && !last.fingerprint) continue;
    const recovery =
      incident.category === "RECOVERED" || incident.status === "resolved";
    if (
      !recovery &&
      last &&
      now - Date.parse(last.at) < settings.cooldown * 60000
    )
      continue;
    const alert: Alert = {
      id: incident.id,
      incidentId: incident.id,
      at: new Date(now).toISOString(),
      fingerprint,
      ...formatNotification(
        incident,
        matchingWatch(incident, settings.watch).find((item) => item.priority)
          ?.name,
      ),
    };
    if (!hasBrazilScope(incident))
      alert.message = "Brasil não confirmado. " + alert.message;
    await db.alerts.put(alert);
    try {
      await display(alert);
    } catch (error) {
      console.warn("Tato Radar: falha ao exibir notificação", error);
    }
  }
}
export async function digest(settings: Settings, now: number) {
  if (
    !settings.digest ||
    !settings.notifications ||
    settings.dnd ||
    settings.snooze > now
  )
    return;
  const last = await db.meta.get("digest");
  if (!last) {
    await db.meta.put({ id: "digest", value: now });
    return;
  }
  if (now - last.value < settings.digest * 3600000) return;
  const total = await db.incidents
    .where("read")
    .equals(0)
    .filter((event) => isRelevantIncident(event, settings.watch))
    .count();
  await db.meta.put({ id: "digest", value: now });
  if (!total) return;
  const alert = {
    id: "digest",
    at: new Date(now).toISOString(),
    title: "Tato Radar | Resumo de monitoramento",
    message:
      (total === 1 ? "1 registro não lido." : total + " registros não lidos.") +
      " Abra o painel para consultar as fontes.",
  };
  await db.alerts.put(alert);
  try {
    await display(alert);
  } catch (error) {
    console.warn("Tato Radar: falha ao exibir resumo", error);
  }
}
