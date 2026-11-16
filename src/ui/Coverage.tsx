import { ArrowLeft } from "lucide-react";
import type { sourceCoverage } from "../domain/coverage";
import { DateText } from "./shared";

const statuses = {
  failed: "A última coleta falhou",
  late: "Coleta atrasada",
  waiting: "Aguardando primeira coleta",
} as const;

export function Coverage({
  verification,
  timeZone,
  back,
}: {
  verification: ReturnType<typeof sourceCoverage>;
  timeZone: string;
  back: () => void;
}) {
  const blocked = (["failed", "late", "waiting"] as const).flatMap((state) =>
    verification.sources.flatMap((source) =>
      source.state === state ? [{ source, state }] : [],
    ),
  );
  const current = verification.sources.filter(
    (source) => source.state === "current",
  );
  const empty = current.filter(
    ({ row, kind }) => row?.count === 0 && kind !== "http",
  );
  return (
    <main className="coverage-screen" aria-labelledby="coverage-title">
      <button className="button" onClick={back} autoFocus>
        <ArrowLeft size={16} /> Voltar ao radar
      </button>
      <h1 id="coverage-title">Cobertura</h1>
      <section>
        <h2>O que não pôde ser verificado?</h2>
        {blocked.length ? (
          <ul className="coverage-list">
            {blocked.map(({ source, state }) => (
              <li key={source.id}>
                <strong>{source.name}</strong>
                <span>{statuses[state]}</span>
                <small>
                  {source.row?.success ? (
                    <>
                      Dados anteriores de{" "}
                      <DateText at={source.row.success} zone={timeZone} />
                    </>
                  ) : (
                    "Sem dados anteriores"
                  )}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            {verification.complete
              ? "Todas as fontes ativas foram consultadas recentemente."
              : "Nenhuma fonte ativa no radar."}
          </p>
        )}
      </section>
      <section>
        <h2>O que é uma limitação normal?</h2>
        <ul className="coverage-list">
          <li>
            <strong>SSW e Caixa / Pix</strong>
            <span>
              A cobertura integrada acompanha publicações. A consulta não mede a
              disponibilidade desses serviços.
            </span>
          </li>
          <li>
            <strong>Outlook corporativo e pessoal</strong>
            <span>
              A Microsoft publica o estado geral do Outlook.com. Para o Exchange
              Online, a cobertura depende dos comunicados públicos que a
              Microsoft divulga.
            </span>
          </li>
        </ul>
      </section>
      <section>
        <h2>O que está em dia?</h2>
        <p>
          {current.length === 1
            ? "1 fonte consultada recentemente."
            : current.length + " fontes consultadas recentemente."}
        </p>
        {empty.length > 0 && (
          <p>
            Consultadas sem registros no último ciclo ·{" "}
            {empty.map((source) => source.name).join(", ")}.
          </p>
        )}
      </section>
    </main>
  );
}
