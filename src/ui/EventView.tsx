import { useEffect, useRef } from "react";
import {
  ArrowUpRight,
  Activity,
  Bell,
  Bug,
  ChevronRight,
  Radio,
  ShieldAlert,
  X,
} from "lucide-react";
import { categories, states, type Incident } from "../domain/model";
import {
  attackTypes,
  confirmations,
  severityLabels,
  statusLabels,
  vulnerabilityTypes,
} from "../domain/filter";
import { DateText } from "./shared";
import { eventCopy } from "../domain/event-copy";
import { eventScope, isRestored } from "../domain/favorite-services";
import { plain } from "../domain/security";
import { serviceScope } from "../background/notification-copy";

export function EventRow({
  event,
  timeZone,
  open,
  compact,
}: {
  event: Incident;
  timeZone: string;
  open: (event: Incident) => void;
  compact?: boolean;
}) {
  const { title } = eventCopy(event);
  const service = serviceScope(event);
  const reported = event.confirmation === "reported";
  const Icon = attackTypes.includes(event.category)
    ? ShieldAlert
    : vulnerabilityTypes.includes(event.category)
      ? Bug
      : ["OUTAGE", "DEGRADED", "RECOVERED", "MAINTENANCE"].includes(
            event.category,
          )
        ? Activity
        : Radio;
  return (
    <button
      className={"event-row " + (compact ? "compact" : "")}
      data-reported={reported || undefined}
      onClick={() => open(event)}
    >
      <span
        className={
          "event-icon " +
          (event.category === "ACTIVELY_EXPLOITED"
            ? "amber"
            : isRestored(event)
              ? "mint"
              : "")
        }
      >
        <Icon size={17} />
      </span>
      <span className="event-body">
        <span className="event-title">
          {!event.read && <span className="dot unread" title="Não lido" />}
          {title}
        </span>
        {service &&
          !title.toLocaleLowerCase().includes(service.toLocaleLowerCase()) && (
            <span className="event-service">{service}</span>
          )}
        <span className="event-meta">
          <span>
            {reported
              ? "Relato"
              : isRestored(event)
                ? "Restabelecido"
                : categories[event.category]}
          </span>
          <span>{event.evidence.name}</span>
          <span>{eventScope(event)}</span>
          {!reported && <span>{confirmations[event.confirmation]}</span>}
          {compact && (
            <DateText
              at={
                event.resolved ??
                event.updated ??
                event.published ??
                event.detected
              }
              zone={timeZone}
            />
          )}
        </span>
      </span>
      <span className="event-end">
        <DateText
          at={
            event.resolved ??
            event.updated ??
            event.published ??
            event.occurred ??
            event.detected
          }
          zone={timeZone}
        />
        <ChevronRight size={15} />
      </span>
    </button>
  );
}
export function IncidentDetails({
  event,
  loading,
  zone,
  close,
}: {
  event?: Incident;
  loading: boolean;
  zone: string;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="incident-dialog"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      aria-labelledby="incident-title"
    >
      <header>
        <span>
          <Bell size={16} /> Registro do CyberWatch
        </span>
        <button className="icon" aria-label="Fechar detalhes" onClick={close}>
          <X size={18} />
        </button>
      </header>
      {event ? (
        <div className="incident-content">
          <div className="tags">
            <span className="pill mint">
              {isRestored(event) ? "Restabelecido" : categories[event.category]}
            </span>
            <span className="pill">{confirmations[event.confirmation]}</span>
          </div>
          <h2 id="incident-title">{eventCopy(event).title}</h2>
          {eventCopy(event).summary && <p>{eventCopy(event).summary}</p>}
          <p className="muted">
            {event.evidence.name} ·{" "}
            {event.updated
              ? "Atualização"
              : event.resolved
                ? "Restabelecido"
                : "Publicação"}{" "}
            <DateText
              at={event.updated ?? event.resolved ?? event.published}
              zone={zone}
            />
          </p>
          <p className="muted">
            {eventScope(event)} · {confirmations[event.confirmation]}
          </p>
          <a
            className="button"
            href={event.evidence.url}
            target="_blank"
            rel="noreferrer"
          >
            Abrir fonte original <ArrowUpRight size={15} />
          </a>
          <details>
            <summary>Original e metadados</summary>
            <p>
              <strong>Original</strong> · {plain(event.title, 250)}
            </p>
            <dl className="definition">
              {event.organization && (
                <div>
                  <dt>Organização</dt>
                  <dd>{event.organization}</dd>
                </div>
              )}
              {event.service && (
                <div>
                  <dt>Componentes afetados</dt>
                  <dd>{event.service}</dd>
                </div>
              )}
              <div>
                <dt>Situação</dt>
                <dd>{statusLabels[event.status]}</dd>
              </div>
              {event.severity !== "unknown" && (
                <div>
                  <dt>Severidade</dt>
                  <dd>{severityLabels[event.severity]}</dd>
                </div>
              )}
              {event.availability && (
                <div>
                  <dt>Disponibilidade</dt>
                  <dd>{states[event.availability]}</dd>
                </div>
              )}
              {(
                [
                  ["Ocorrência", event.occurred],
                  ["Publicação", event.published],
                  ["Detecção", event.detected],
                  ["Atualização da origem", event.updated],
                  ["Última verificação", event.checked],
                  ["Resolução", event.resolved],
                ] as const
              )
                .filter(([, at]) => at)
                .map(([label, at]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>
                      <DateText at={at} zone={zone} />
                    </dd>
                  </div>
                ))}
              {event.cve && (
                <div>
                  <dt>CVE</dt>
                  <dd>{event.cve}</dd>
                </div>
              )}
            </dl>
          </details>
          {event.related?.length ? (
            <div className="tags">
              {event.related.map((kind) => (
                <span key={kind} className="pill">
                  {categories[kind]}
                </span>
              ))}
            </div>
          ) : null}
          <h3>Evidências</h3>
          <div className="evidence">
            {event.sources.map((source) => (
              <a
                key={source.source + source.url}
                href={source.url}
                target="_blank"
                rel="noreferrer"
              >
                <span>
                  {source.name}
                  <small>
                    {new URL(source.url).hostname} ·{" "}
                    {
                      {
                        official: "Oficial",
                        editorial: "Editorial",
                        local: "Medição local",
                        custom: "Feed cadastrado",
                      }[source.trust]
                    }
                  </small>
                </span>
                <ArrowUpRight size={16} />
              </a>
            ))}
          </div>
          <h3>Linha do tempo</h3>
          <ol className="timeline">
            {event.timeline.map((update) => (
              <li key={update.at + update.text}>
                <DateText at={update.at} zone={zone} />
                <p>
                  {event.language === "pt-BR" ||
                  event.evidence.trust === "local"
                    ? plain(update.text)
                    : update.status === "resolved"
                      ? "A fonte registrou a resolução."
                      : "A fonte publicou uma atualização."}
                </p>
              </li>
            ))}
            {event.transitions.map((transition) => (
              <li key={transition.at + transition.from + transition.to}>
                <DateText at={transition.at} zone={zone} />
                <p>
                  {statusLabels[transition.from]} →{" "}
                  {statusLabels[transition.to]}
                </p>
              </li>
            ))}
            {!event.timeline.length && !event.transitions.length && (
              <li>Sem atualizações publicadas para este registro.</li>
            )}
          </ol>
        </div>
      ) : (
        <p id="incident-title" className="notice">
          {loading
            ? "Abrindo registro…"
            : "Registro indisponível no histórico local."}
        </p>
      )}
    </dialog>
  );
}
