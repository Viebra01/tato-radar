import type { Incident } from "./model";
import { plain } from "./security";
import { formatNotification } from "../background/notification-copy";
import { isRestored } from "./favorite-services";

export function eventCopy(event: Incident) {
  if (isRestored(event) && event.resolved)
    return {
      title:
        (event.evidence.trust === "local"
          ? "Acesso restabelecido na sua rede"
          : "Restabelecido") +
        " · " +
        (event.organization ?? event.service ?? event.evidence.name),
      summary:
        "Recuperação informada pela fonte em " +
        new Intl.DateTimeFormat("pt-BR", {
          timeZone: "America/Sao_Paulo",
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date(event.resolved)) +
        ".",
    };

  if (
    event.language === "pt-BR" ||
    event.evidence.source === "certbr" ||
    event.evidence.trust === "local"
  ) {
    return { title: plain(event.title, 250), summary: plain(event.summary) };
  }
  const notice = formatNotification(event);
  return {
    title: notice.title.replace(/^CyberWatch \| /, ""),
    summary: notice.message,
  };
}
