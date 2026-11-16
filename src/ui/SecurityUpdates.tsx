import { useState } from "react";
import { ArrowLeft, ArrowUpRight, ShieldCheck } from "lucide-react";
import type { sourceCoverage } from "../domain/coverage";
import type { Incident } from "../domain/model";
import {
  bulletinTitle,
  securityPlatform,
  securitySources,
} from "../domain/security-bulletins";
import { DateText } from "./shared";
import { Tato } from "./Tato";

type Filter = "all" | "windows" | "ubuntu";
const filterNames = {
  all: "Todos",
  windows: "Windows",
  ubuntu: "Ubuntu",
} as const;
const collectionStates = {
  failed: "Falha na última coleta",
  late: "Coleta atrasada",
  waiting: "Aguardando primeira coleta",
  current: "Coleta em dia",
} as const;

export function SecurityUpdates({
  bulletins,
  timeZone,
  back,
  verification,
}: {
  bulletins: Incident[];
  timeZone: string;
  back: () => void;
  verification: ReturnType<typeof sourceCoverage>;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(12);
  const [query, setQuery] = useState("");
  const search = query.trim().toLocaleLowerCase("pt-BR");
  const counts = { all: bulletins.length, windows: 0, ubuntu: 0 };
  for (const item of bulletins) {
    const platform = securityPlatform(item);
    if (platform) counts[platform]++;
  }
  const filtered = bulletins.filter(
    (entry) =>
      (filter === "all" || securityPlatform(entry) === filter) &&
      [bulletinTitle(entry), entry.title, entry.cve].some((term) =>
        term?.toLocaleLowerCase("pt-BR").includes(search),
      ),
  );

  return (
    <main className="security-view" aria-labelledby="security-title">
      <button className="button" onClick={back} autoFocus>
        <ArrowLeft size={16} /> Voltar ao radar
      </button>
      <section className="security-intro">
        <div>
          <p className="eyebrow">Tato · Modo consulta</p>
          <h1 id="security-title">Atualizações de segurança</h1>
          <p>
            Boletins oficiais coletados nos últimos 30 dias. Abra a fonte para
            conferir as versões afetadas e a orientação do fornecedor.
          </p>
        </div>
        <Tato phase="calm" review />
      </section>
      <details
        className="security-sources"
        open={
          securitySources.some(
            ({ id }) =>
              verification.sources.find((source) => source.id === id)?.state !==
              "current",
          ) || undefined
        }
      >
        <summary>Cobertura dos boletins</summary>
        <ul>
          {securitySources.map((source) => {
            const entry = verification.sources.find(
              ({ id }) => id === source.id,
            );
            return (
              <li key={source.id}>
                <a href={source.home} target="_blank" rel="noreferrer">
                  {source.name} <ArrowUpRight aria-hidden="true" size={12} />
                </a>
                <small>
                  {entry ? collectionStates[entry.state] : "Fonte pausada"}
                  {entry?.row?.success && (
                    <>
                      {" "}
                      · Última coleta útil em{" "}
                      <DateText
                        at={entry.row.success}
                        zone={timeZone}
                        compact
                      />
                    </>
                  )}
                </small>
              </li>
            );
          })}
        </ul>
      </details>
      <nav aria-label="Filtrar boletins" className="security-filters">
        {Object.entries(filterNames).map(([key, label]) => (
          <button
            key={key}
            aria-label={label}
            aria-pressed={filter === key}
            onClick={() => {
              setFilter(key as Filter);
              setLimit(12);
            }}
          >
            {label} <span aria-hidden="true">{counts[key as Filter]}</span>
          </button>
        ))}
      </nav>
      <input
        className="security-search"
        type="search"
        aria-label="Buscar boletim"
        placeholder="Buscar por CVE, USN ou componente…"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setLimit(12);
        }}
      />
      {filtered.length ? (
        <div>
          {filtered.slice(0, limit).map((event) => (
            <a
              key={event.id}
              className="security-entry"
              href={event.evidence.url}
              target="_blank"
              rel="noreferrer"
            >
              <ShieldCheck aria-hidden="true" size={18} />
              <span>
                <strong>{bulletinTitle(event)}</strong>
                <small>
                  {event.evidence.name} ·{" "}
                  <DateText
                    at={event.updated ?? event.published}
                    zone={timeZone}
                    compact
                  />
                </small>
              </span>
              <ArrowUpRight aria-hidden="true" size={14} />
            </a>
          ))}
          {filtered.length > limit && (
            <button className="button" onClick={() => setLimit(limit + 12)}>
              Mostrar mais boletins
            </button>
          )}
        </div>
      ) : (
        <p className="quiet">
          {search
            ? "Nenhum boletim encontrado para essa busca."
            : "Nenhum boletim recente coletado para este filtro."}
        </p>
      )}
    </main>
  );
}
