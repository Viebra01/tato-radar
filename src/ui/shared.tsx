export function DateText({
  at,
  zone,
  day,
  compact,
}: {
  at?: string | number;
  zone: string;
  day?: boolean;
  compact?: boolean;
}) {
  if (!at) return <span title="Horário não informado">—</span>;
  const date = new Date(at);
  if (!Number.isFinite(date.getTime())) return <span>—</span>;
  return (
    <time dateTime={date.toISOString()} title={date.toISOString()}>
      {new Intl.DateTimeFormat("pt-BR", {
        timeZone: day ? "UTC" : zone,
        ...(compact && !day
          ? {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            }
          : { dateStyle: "short", timeStyle: day ? undefined : "short" }),
      }).format(date)}
    </time>
  );
}
