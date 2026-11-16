import type { Phase } from "./radar";
const frame = (index: number) =>
  "tato/frame-" + String(index).padStart(2, "0") + ".webp";
export function poseFrame(phase: Phase): string {
  return phase === "calm" || phase === "unknown"
    ? "tato/master.webp"
    : frame({ aware: 3, guard: 7, defense: 15 }[phase]);
}
export function transitionFrames(from: Phase, to: Phase): string[] {
  if (from === to) return [];
  const rank: Record<Phase, number> = {
    unknown: 0,
    calm: 0,
    aware: 3,
    guard: 7,
    defense: 15,
  };
  if (rank[from] === rank[to]) return [poseFrame(to)];
  if (rank[to] > rank[from])
    return Array.from({ length: rank[to] - rank[from] }, (_, i) =>
      frame(rank[from] + i + 1),
    );
  if (from === "defense")
    return [0, 1, 2, 3, 4, 5]
      .map((index) => "tato/recover-" + index + ".webp")
      .concat(
        to === "guard"
          ? [frame(5), frame(6), frame(7)]
          : to === "aware"
            ? [frame(2), frame(3)]
            : [poseFrame(to)],
      );
  return Array.from({ length: rank[from] - rank[to] }, (_, i) =>
    frame(rank[from] - i - 1),
  ).concat([poseFrame(to)]);
}
