import type { Phase } from "./radar";

export function tatoVoice(phase: Phase, review = false, collecting = false) {
  if (collecting) return "Um instante, estou farejando as fontes.";
  if (review)
    return "Hora de reforçar a carapaça. Vamos conferir as atualizações?";
  const messages: Record<Phase, string> = {
    unknown:
      "Tem fonte fora da toca. Confira a cobertura antes de tirar conclusões.",
    calm: "Carapaça tranquila, radar ligado. Vamos conferir as novidades?",
    aware: "Opa, farejei um alerta no Brasil. Vamos conferir a fonte?",
    guard: "Carapaça a postos. Há incidentes no Brasil pedindo atenção.",
    defense: "Capuz no lugar. Vamos conferir os alertas mais importantes.",
  };
  return messages[phase];
}
