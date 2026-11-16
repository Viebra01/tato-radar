import { ArrowLeft, ArrowUpRight, ChevronRight, Pin } from "lucide-react";
import type { Incident, Service } from "../domain/model";
import { favoriteRecordMatches } from "../domain/favorite-services";
import { readService } from "../domain/service-reading";
import type { deriveRadar } from "../domain/radar";
import type { Watch } from "../domain/settings";
import { DateText } from "./shared";
import { EventRow } from "./EventView";

type ReadingContext = {
  radar: ReturnType<typeof deriveRadar>;
  services: Service[];
  timeZone: string;
};

export function FollowedServices({
  items,
  radar,
  services,
  timeZone,
  open,
  pinned = false,
  configureUrl,
}: ReadingContext & {
  items: Watch[];
  open: (item: Watch) => void;
  pinned?: boolean;
  configureUrl?: string;
}) {
  return (
    <section
      className={pinned ? "pinned-services" : "followed-services"}
      aria-label="Serviços acompanhados"
    >
      <div className="service-section-heading">
        <h2>{pinned ? "Serviços fixados" : "Seus serviços"}</h2>
        {configureUrl && (
          <a href={configureUrl} target="_blank" rel="noreferrer">
            Personalizar
          </a>
        )}
      </div>
      {items.length ? (
        <div className="service-grid">
          {items.map((item) => {
            const reading = readService(item, radar, services);
            return (
              <button
                className="service-tile"
                data-tone={reading.tone}
                key={item.id}
                onClick={() => open(item)}
              >
                <span className="service-tile-title">
                  <strong>{item.name}</strong>
                  <ChevronRight aria-hidden="true" size={14} />
                </span>
                <span className="service-state">
                  <span className="service-dot" aria-hidden="true" />
                  {reading.label}
                </span>
                {reading.reports.length > 0 && (
                  <small className="service-signal">Relato recente</small>
                )}
                {reading.source && <small>{reading.source}</small>}
                {reading.at && (
                  <small>
                    <DateText at={reading.at} zone={timeZone} compact />
                  </small>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="quiet">
          {pinned
            ? "Escolha até quatro favoritos em Personalizar."
            : "Nenhum serviço para esta busca."}
        </p>
      )}
    </section>
  );
}

export function ServiceDetails({
  item,
  radar,
  services,
  timeZone,
  records,
  back,
  open,
  configureUrl,
}: ReadingContext & {
  item: Watch;
  records: Incident[];
  back: () => void;
  open: (incident: Incident) => void;
  configureUrl: string;
}) {
  const reading = readService(item, radar, services);
  const displayed = new Set([
    reading.notice?.id,
    ...reading.reports.map((record) => record.id),
  ]);
  const history = records
    .filter(
      (event) => !displayed.has(event.id) && favoriteRecordMatches(event, item),
    )
    .slice(0, 6);
  return (
    <main className="service-details" aria-labelledby="service-title">
      <button className="button" onClick={back} autoFocus>
        <ArrowLeft size={16} /> Voltar
      </button>
      <h1 id="service-title">{item.name}</h1>
      <div className="service-reading" data-tone={reading.tone}>
        <p className="service-state">
          <span className="service-dot" aria-hidden="true" />
          {reading.label}
        </p>
        {reading.source && <p>{reading.source}</p>}
        {reading.at && (
          <p>
            {reading.notice?.resolved
              ? "Restabelecimento"
              : "Última verificação"}{" "}
            · <DateText at={reading.at} zone={timeZone} />
          </p>
        )}
        {reading.link && (
          <a href={reading.link} target="_blank" rel="noreferrer">
            Abrir fonte <ArrowUpRight size={14} />
          </a>
        )}
      </div>
      {reading.notice && (
        <section className="editorial">
          <h2>Aviso recente</h2>
          <EventRow
            compact
            event={reading.notice}
            timeZone={timeZone}
            open={open}
          />
        </section>
      )}
      <section className="editorial">
        <h2>Relatos recentes</h2>
        {reading.reports.length ? (
          reading.reports
            .slice(0, 3)
            .map((event) => (
              <EventRow
                compact
                key={event.id}
                event={event}
                timeZone={timeZone}
                open={open}
              />
            ))
        ) : (
          <p className="quiet">
            Nenhum relato recente nas fontes acompanhadas.
          </p>
        )}
      </section>
      {history.length > 0 && (
        <details className="editorial">
          <summary>Histórico do serviço</summary>
          {history.map((event) => (
            <EventRow
              compact
              key={event.id}
              event={event}
              timeZone={timeZone}
              open={open}
            />
          ))}
        </details>
      )}
      <a
        className="section-link"
        href={configureUrl}
        target="_blank"
        rel="noreferrer"
      >
        <Pin size={14} /> Fixação e notificações
      </a>
    </main>
  );
}
