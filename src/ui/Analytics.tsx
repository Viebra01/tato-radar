import { Activity, Building2, Globe2, Shield } from "lucide-react";
import { calendar, severityLabels } from "../domain/filter";
import type { Incident } from "../domain/model";
const day = 86400000;
function Ranking({ rows, total }: { rows: [string, number][]; total: number }) {
  if (!rows.length) return <p className="muted">Sem dados no período.</p>;
  return (
    <div className="chart ranking">
      {rows.map(([name, count]) => (
        <div key={name}>
          <span>
            {name}
            <b>{count}</b>
          </span>
          <meter
            min={0}
            max={Math.max(1, total)}
            value={count}
            aria-label={name}
          />
        </div>
      ))}
    </div>
  );
}
function rank(values: (string | undefined)[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const value of values)
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 6);
}
export function Analytics({
  events,
  now,
  zone,
}: {
  events: Incident[];
  now: number;
  zone: string;
}) {
  if (!events.length) return null;
  const days = Array.from({ length: 7 }, (_, index) =>
    calendar(now - (6 - index) * day, zone),
  );
  const counts = new Map(days.map((value) => [value, 0]));
  for (const event of events) {
    const date = calendar(event.detected, zone);
    if (counts.has(date)) counts.set(date, counts.get(date)! + 1);
  }
  const week = events.filter(
    (event) =>
      event.published &&
      Date.parse(event.published) >= now - 7 * day &&
      Date.parse(event.published) <= now,
  );
  const active = week.filter((event) => event.status === "active").length;
  const resolved = week.filter((event) => event.status === "resolved").length;
  const knownSeverity = week.filter((event) => event.severity !== "unknown");
  return (
    <section className="card analytics">
      <div className="section-title">
        <h2>Cobertura dos últimos 7 dias</h2>
        <span className="muted">Histórico local das fontes integradas</span>
      </div>
      <div className="analytics-grid">
        <div>
          <h3>
            <Activity size={16} /> Registros detectados
          </h3>
          <Ranking
            rows={[...counts].map(([date, count]) => [
              date.slice(8) + "/" + date.slice(5, 7),
              count,
            ])}
            total={Math.max(...counts.values())}
          />
        </div>
        <div>
          <h3>
            <Shield size={16} /> Severidade na origem
          </h3>
          <Ranking
            rows={rank(
              knownSeverity.map((event) => severityLabels[event.severity]),
            )}
            total={knownSeverity.length}
          />
          <p className="muted">
            {week.length - knownSeverity.length} sem avaliação · {active} em
            andamento · {resolved} resolvidos
          </p>
        </div>
        <div>
          <h3>
            <Building2 size={16} /> Organizações identificadas
          </h3>
          <Ranking
            rows={rank(week.map((event) => event.organization))}
            total={week.length}
          />
        </div>
        <div>
          <h3>
            <Globe2 size={16} /> Escopo geográfico informado
          </h3>
          <Ranking
            rows={rank(
              week.flatMap((event) =>
                event.locations?.length ? event.locations : [event.region],
              ),
            )}
            total={week.length}
          />
        </div>
      </div>
    </section>
  );
}
