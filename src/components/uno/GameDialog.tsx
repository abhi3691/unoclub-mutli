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
          className="modal"
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
            <>
              <div className="eyebrow">THE CLUB RULEBOOK</div>
              <h2>First to zero wins.</h2>
              <p>
                Everyone starts with 7 cards. On your turn, match the discard’s color or
                symbol, or play a wild card.
              </p>
              <p>
                <b>Skip</b> skips the next player. <b>Reverse</b> changes direction.{" "}
                <b>+2</b> passes a draw penalty to the next player. Stack another +2 to
                add two more, or draw the total and lose your turn. In a two-player game,
                stacking sends the penalty back to your opponent. <b>+4</b> stacks the
                same way: another +4 adds four more, or draw the total and lose your turn.
                Stack only the same type (+2 on +2, +4 on +4). Starting a Wild +4 requires
                no matching color; responding to a +4 with another +4 is always allowed.
                Choose a color each time.
              </p>
              <p>
                Drawing takes one card and ends your turn. Tap <b>UNO!</b> before playing
                your second-to-last card, or draw two penalty cards. Pick a new color when
                you play a wild.
              </p>
              <p>
                Invite friends with the room code or use Quick play for a public table.
                The host deals once at least two players join.
              </p>
            </>
          )}
        </section>
      </div>
    )
  );
}
