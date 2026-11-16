import { useEffect, useState } from "react";
import { Tato } from "./Tato";
import { phaseNames, type Phase } from "../domain/radar";
const sequence: Phase[] = [
  "calm",
  "aware",
  "guard",
  "defense",
  "guard",
  "aware",
  "calm",
];
export function TatoDemo() {
  const [phase, setPhase] = useState<Phase>("calm"),
    [step, setStep] = useState(-1);
  useEffect(() => {
    if (step < 0) return;
    setPhase(sequence[step]);
    const timer = window.setTimeout(
      () => setStep(step >= sequence.length - 1 ? -1 : step + 1),
      1500,
    );
    return () => clearTimeout(timer);
  }, [step]);
  return (
    <main className="demo">
      <span className="eyebrow">Demonstração · exemplos fictícios</span>
      <h1>Conheça o Tato.</h1>
      <p>O tatu-bola que acompanha seu radar.</p>
      <Tato phase={phase} />
      <h2 aria-live="polite">{phaseNames[phase]}</h2>
      <p>
        {step >= 4
          ? "Recuperação gradual · demonstração"
          : "Prévia isolada das poses"}
      </p>
      <div className="demo-controls">
        {Object.entries(phaseNames).map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              setStep(-1);
              setPhase(key as Phase);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <button className="primary" onClick={() => setStep(0)}>
        Reproduzir sequência
      </button>
      <small>
        A prévia funciona sem acessar o armazenamento ou emitir notificações.
      </small>
    </main>
  );
}
