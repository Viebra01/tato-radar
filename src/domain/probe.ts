import type { Probe } from "./model";
export type Observation = "good" | "bad" | "unknown";
export const initialProbe: Probe = {
  state: "UNKNOWN",
  failures: 0,
  successes: 0,
};
export function advance(
  previous: Probe,
  observation: Observation,
  at: string,
  failLimit: number,
  successLimit: number,
  id: string,
): Probe {
  if (observation === "unknown") {
    return {
      ...previous,
      state: "UNKNOWN",
      failures: 0,
      successes: 0,
      since: previous.outageId ? previous.since : undefined,
    };
  }
  if (observation === "bad") {
    const failures = previous.failures + 1;
    const since = previous.since ?? at;
    return {
      state: "SUSPECTED_OUTAGE",
      failures,
      successes: 0,
      since,
      outageId: previous.outageId ?? (failures >= failLimit ? id : undefined),
    };
  }
  if (!previous.outageId) return { ...initialProbe, state: "OPERATIONAL" };
  const successes = previous.successes + 1;
  if (successes >= successLimit) return { ...initialProbe, state: "RECOVERED" };
  return { ...previous, state: "RECOVERING", successes, failures: 0 };
}
