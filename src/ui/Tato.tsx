import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Phase } from "../domain/radar";
import { phaseNames } from "../domain/radar";
import { poseFrame, transitionFrames } from "../domain/tato-animation";
import { useReducedMotion } from "./useReducedMotion";
import "./tato-idle.css";
import { tatoVoice } from "../domain/tato-voice";

const storyImage = "tato/cochilo-sequencia.png";
const restFrames = {
  dozing: 0,
  nodding: 1,
  sleeping: 2,
  waking: 3,
  stretching: 4,
  settling: 5,
} as const;
type Rest = "awake" | keyof typeof restFrames;
const beats = {
  dozing: ["nodding", 320],
  nodding: ["sleeping", 510],
  waking: ["stretching", 210],
  stretching: ["settling", 350],
  settling: ["awake", 430],
} as const;
function subscribeVisibility(update: () => void) {
  document.addEventListener("visibilitychange", update);
  return () => document.removeEventListener("visibilitychange", update);
}

export function Tato({
  phase,
  settled = true,
  recoveryEvidence = true,
  review = false,
  speech = true,
  collecting = false,
}: {
  phase: Phase;
  settled?: boolean;
  recoveryEvidence?: boolean;
  review?: boolean;
  speech?: boolean;
  collecting?: boolean;
}) {
  const [frame, setFrame] = useState(() => poseFrame(phase));
  const reduced = useReducedMotion();
  const [eyelidsLoaded, setEyelidsLoaded] = useState(false);
  const [storyReady, setStoryReady] = useState(false);
  const [rest, setRest] = useState<Rest>("awake");
  const [pointing, setPointing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [woke, setWoke] = useState(false);
  const current = useRef(phase),
    target = useRef(phase),
    playing = useRef(false),
    generation = useRef(0),
    timer = useRef<number | undefined>(undefined);
  const initialized = useRef(false);
  const visible = useSyncExternalStore(
    subscribeVisibility,
    () => !document.hidden,
  );
  const mounted = useRef(true),
    verifiedRecovery = useRef(false);
  target.current = phase;
  if (recoveryEvidence) verifiedRecovery.current = true;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
      window.clearTimeout(timer.current);
      playing.current = false;
    };
  }, []);
  useEffect(() => {
    const showLatest = () => {
      setFrame(poseFrame(target.current));
      current.current = target.current;
      playing.current = false;
      verifiedRecovery.current = false;
    };
    if (!settled || !initialized.current) {
      if (current.current !== target.current) {
        generation.current++;
        window.clearTimeout(timer.current);
      }
      initialized.current = settled;
      showLatest();
      return;
    }
    if (!visible) {
      generation.current++;
      window.clearTimeout(timer.current);
      showLatest();
      return;
    }
    if (playing.current) return;
    if (current.current === phase) {
      verifiedRecovery.current = false;
      return;
    }
    const rank = { unknown: 0, calm: 0, aware: 1, guard: 2, defense: 3 };
    function play() {
      if (!mounted.current) return;
      if (document.hidden) {
        showLatest();
        return;
      }
      const destination = target.current;
      if (rank[destination] < rank[current.current]) {
        if (!verifiedRecovery.current) {
          showLatest();
          return;
        }
        verifiedRecovery.current = false;
      }
      const token = ++generation.current;
      const sequence = transitionFrames(current.current, destination);
      const frames =
        reduced && sequence.length > 3
          ? [
              sequence[0],
              sequence[Math.floor(sequence.length / 2)],
              sequence[sequence.length - 1],
            ]
          : sequence;
      if (!frames.length) {
        showLatest();
        return;
      }
      playing.current = true;
      let index = 0;
      function next() {
        if (!mounted.current || token !== generation.current) return;
        if (document.hidden) {
          showLatest();
          return;
        }
        setFrame(frames[index]);
        index++;
        if (index < frames.length) {
          timer.current = window.setTimeout(next, reduced ? 170 : 110);
          return;
        }
        current.current = destination;
        playing.current = false;
        if (target.current !== destination) {
          play();
        } else setFrame(poseFrame(destination));
      }
      const images = frames.map((src) => {
        const image = new Image();
        image.src = src;
        return image.decode().catch(() => undefined);
      });
      void Promise.all(images).then(() => {
        if (mounted.current && token === generation.current) next();
      });
    }
    play();
  }, [phase, reduced, visible, settled, recoveryEvidence]);
  const idle =
    !review &&
    frame === "tato/master.webp" &&
    (phase === "calm" || phase === "unknown") &&
    visible;
  const canRest = idle && settled && phase === "calm";
  useEffect(() => {
    if (!canRest) return;
    let active = true;
    const art = new Image();
    art.src = storyImage;
    void art
      .decode()
      .then(() => {
        if (active) setStoryReady(true);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [canRest]);
  useEffect(() => {
    if (!canRest || !storyReady) {
      setRest("awake");
      return;
    }
    if (rest === "sleeping" || (rest === "awake" && pointing)) return;
    const [target, ms] =
      rest === "awake" ? (["dozing", 6200] as const) : beats[rest];
    const timer = window.setTimeout(() => setRest(target), ms);
    return () => window.clearTimeout(timer);
  }, [canRest, storyReady, pointing, rest]);
  const story = canRest && storyReady && rest !== "awake" ? rest : undefined;
  const blink = idle && !story;
  const idleMovement = idle && !story && !reduced;
  const look = review ? poseFrame("defense") : frame;
  const readyToSpeak =
    speech &&
    visible &&
    settled &&
    rest === "awake" &&
    look === poseFrame(review ? "defense" : phase);
  useEffect(() => {
    setSpeaking(false);
    if (!readyToSpeak) return;
    const start = window.setTimeout(() => setSpeaking(true), 700);
    const end = window.setTimeout(() => setSpeaking(false), 3900);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(end);
    };
  }, [readyToSpeak, phase, review, collecting]);
  const line =
    woke && phase === "calm" && !review && !collecting
      ? "Opa, tô de pé! Vamos dar uma farejada no radar?"
      : tatoVoice(phase, review, collecting);
  useEffect(() => {
    for (const src of ["tato/speaking.webp", "tato/speaking-alerts.webp"]) {
      const art = new Image();
      art.src = src;
    }
  }, []);
  function wake() {
    if (canRest && storyReady) {
      if (rest === "sleeping" || rest === "dozing" || rest === "nodding")
        setWoke(true);
      setRest((pose) =>
        pose === "sleeping" || pose === "dozing" || pose === "nodding"
          ? "waking"
          : pose,
      );
    }
  }
  return (
    <>
      <span
        className="tato-stage"
        data-idle={blink ? phase : undefined}
        data-rest={story}
        data-speaking={(speaking && readyToSpeak) || undefined}
        data-alert-idle={
          !review &&
          !reduced &&
          visible &&
          settled &&
          !idle &&
          !playing.current &&
          current.current === phase &&
          frame === poseFrame(phase)
            ? true
            : undefined
        }
        onPointerEnter={(event) => {
          if (event.pointerType === "touch") return;
          setPointing(true);
          wake();
        }}
        onPointerLeave={() => setPointing(false)}
      >
        <img
          className="tato"
          data-phase={phase}
          data-frame={look}
          src={look}
          alt={
            story && rest === "sleeping"
              ? "Tato cochilando"
              : review
                ? "Tato consultando boletins"
                : "Tato · " + phaseNames[phase]
          }
          width="240"
          height="240"
          draggable={false}
          onError={(event) => {
            const image = event.currentTarget;
            if (!image.src.endsWith("master.png"))
              image.src = "tato/master.png";
          }}
        />
        {review && visible && (
          <img
            className="tato-layer tato-review-paw"
            src="tato/frame-14.webp"
            alt=""
            aria-hidden="true"
          />
        )}
        {story && (
          <span
            aria-hidden="true"
            className="tato-story"
            style={{
              backgroundImage: "url(" + storyImage + ")",
              backgroundPosition:
                (restFrames[story] % 3) * 50 +
                "% " +
                Math.floor(restFrames[story] / 3) * 100 +
                "%",
            }}
          />
        )}
        {story && rest === "sleeping" && (
          <>
            <span aria-hidden="true" className="tato-dream">
              <span>z</span>
              <span>z</span>
              <span>z</span>
            </span>
            <button
              className="tato-wake"
              onClick={wake}
              aria-label="Acordar o Tato"
            />
          </>
        )}
        {idleMovement && (
          <img
            className="tato-layer tato-shell"
            src="tato/master.webp"
            alt=""
            aria-hidden="true"
          />
        )}
        {blink && (
          <img
            className="tato-layer tato-eyelids"
            src="tato/eyelids.png"
            alt=""
            aria-hidden="true"
            data-loaded={eyelidsLoaded || undefined}
            onLoad={() => setEyelidsLoaded(true)}
          />
        )}
        {idleMovement && (
          <img
            className="tato-layer tato-glance"
            src="tato/master.webp"
            alt=""
            aria-hidden="true"
          />
        )}
        {speaking && readyToSpeak && (
          <span
            aria-hidden="true"
            className="tato-layer tato-speaking-mouth"
            data-pose={review ? "defense" : phase}
          />
        )}
      </span>
      {speech && (
        <span className="tato-speech-slot">
          <span
            className="tato-speech"
            data-hidden={!readyToSpeak || undefined}
          >
            {line}
          </span>
        </span>
      )}
    </>
  );
}
