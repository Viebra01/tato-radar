import type { Health } from "../domain/model";
import { CollectionError } from "../providers/http";
export const emptyHealth = (id: string): Health => ({
  id,
  failures: 0,
  next: 0,
});
export function eligible(
  health: Health,
  now: number,
  minutes: number,
  manual: boolean,
): boolean {
  if (health.failures > 0 && now < health.next) return false;
  if (!health.attempted) return true;
  const min = manual ? Math.max(1, Math.min(minutes, 3)) : minutes;
  return now - Date.parse(health.attempted) >= min * 60000;
}
export function failure(
  previous: Health,
  error: unknown,
  at: string,
  minutes: number,
): Health {
  const failures = previous.failures + 1;
  const message =
    error instanceof CollectionError
      ? error.message
      : error instanceof SyntaxError
        ? "JSON inválido"
        : "Formato da resposta incompatível";
  const retry =
    error instanceof CollectionError && Number.isFinite(error.retry)
      ? error.retry!
      : 0;
  const delay = Math.max(
    minutes * 60000,
    Math.min(6 * 3600000, 60000 * 2 ** Math.min(9, failures)),
    failures >= 5 ? 3600000 : 0,
  );
  return {
    ...previous,
    attempted: at,
    failures,
    next: Math.max(Date.parse(at) + delay, retry),
    error: message,
    log: [{ at, result: message }, ...(previous.log ?? [])].slice(0, 15),
  };
}
