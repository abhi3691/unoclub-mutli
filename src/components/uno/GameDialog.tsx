import { GameTutorial } from "./GameTutorial";
import { Icon } from "./Icon";
import { useEffect, useRef } from "react";
import type { UnoGame } from "./useUnoGame";
import type { Color } from "@/uno/types";
const colors: Color[] = ["red", "yellow", "green", "blue"];
type Props = Pick<
  UnoGame,
  "rules" | "wild" | "setRules" | "setWild" | "busy" | "act" | "uno"
>;
export function GameDialog({ rules, wild, setRules, setWild, busy, act, uno }: Props) {
  const dialog = useRef<HTMLElement>(null);
  const close = useRef(() => {});
  useEffect(() => {
    close.current = () => {
      setRules(false);
      setWild(null);
    };
  }, [setRules, setWild]);
  const open = !!(rules || wild);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
      }
      if (event.key !== "Tab") return;
      const targets = Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), [href], input, [tabindex='0']",
        ) ?? [],
      );
      const first = targets[0],
        last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, [open]);
  return (
    (rules || wild) && (
      <div className="modal-backdrop">
        <section
          ref={dialog}
          className={`modal ${wild ? "" : "tutorial-modal"}`}
          role="dialog"
          aria-modal="true"
          aria-label={wild ? "Choose a color" : "How to play"}
        >
          <button
            className="close-modal"
            onClick={() => {
              setRules(false);
              setWild(null);
            }}
            aria-label="Close"
          >
            <Icon name="close" />
          </button>
          {wild ? (
            <>
              <h2>Pick your color.</h2>
              <div className="color-picker">
                {colors.map((c) => (
                  <button
                    key={c}
                    className={c}
                    disabled={busy}
                    onClick={() => act("play", { card: wild.id, color: c, uno })}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <GameTutorial />
          )}
        </section>
      </div>
    )
  );
}
