"use client";

import { useLayoutEffect, useRef } from "react";
import type { Snapshot } from "@/uno/types";

type Position = { left: number; top: number; width: number; height: number };
type Captured = {
  snapshot: Snapshot;
  cards: Map<string, { box: Position; face: HTMLElement }>;
};
const position = (element: Element): Position => {
  const box = element.getBoundingClientRect();
  return { left: box.left, top: box.top, width: box.width, height: box.height };
};

/** Animate confirmed state changes only; never delay or predict the game rules. */
export function useCardMotion(snapshot: Snapshot | null) {
  const previous = useRef<Captured | null>(null);
  const active = useRef(new Set<() => void>());

  useLayoutEffect(() => {
    const cancel = () => {
      for (const finish of [...active.current]) finish();
    };
    window.addEventListener("resize", cancel);
    window.addEventListener("scroll", cancel, true);
    return () => {
      cancel();
      window.removeEventListener("resize", cancel);
      window.removeEventListener("scroll", cancel, true);
    };
  }, []);

  useLayoutEffect(() => {
    if (!snapshot) {
      previous.current = null;
      for (const finish of [...active.current]) finish();
      return;
    }
    const hand = document.querySelector<HTMLElement>(".real-hand");
    const pile = document.querySelector<HTMLElement>(".draw-stack .playing-card");
    const discard = document.querySelector<HTMLElement>(".discard .playing-card");
    if (!hand || !pile || !discard || !hand.getClientRects().length) {
      previous.current = null;
      return;
    }
    const old = previous.current;
    const cards = new Map<string, { box: Position; face: HTMLElement }>();
    hand.querySelectorAll<HTMLElement>("[data-card-id]").forEach((element) => {
      cards.set(element.dataset.cardId!, {
        box: position(element),
        face: element.cloneNode(true) as HTMLElement,
      });
    });
    previous.current = { snapshot, cards };
    if (
      !old ||
      old.snapshot.code !== snapshot.code ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const seat = (id: string) =>
      document.querySelector<HTMLElement>(`[data-player-id="${id}"] .avatar`);
    const fly = (
      face: HTMLElement,
      from: Position,
      to: Position,
      delay = 0,
      landing?: HTMLElement,
      drawing = false,
    ) => {
      const clone = face.cloneNode(true) as HTMLElement;
      clone.removeAttribute("data-card-id");
      clone.removeAttribute("id");
      clone.setAttribute("aria-hidden", "true");
      clone.setAttribute("tabindex", "-1");
      clone.classList.add("flying-card");
      clone.style.cssText = `position:fixed;left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.height}px;margin:0;z-index:100;pointer-events:none;visibility:visible;`;
      document.body.appendChild(clone);
      if (landing) landing.style.visibility = "hidden";
      const dx = to.left - from.left,
        dy = to.top - from.top;
      const sx = to.width / from.width,
        sy = to.height / from.height;
      const animation = clone.animate(
        [
          { transform: "translate(0,0) rotate(0deg) scale(1)", opacity: 1 },
          {
            transform: `translate(${dx * 0.48}px,${dy * 0.48 - 45}px) rotate(${drawing ? -12 : 12}deg) scale(1.08)`,
            offset: 0.48,
          },
          {
            transform: `translate(${dx}px,${dy}px) rotate(0deg) scale(${sx},${sy})`,
            opacity: 1,
          },
        ],
        { duration: 520, delay, easing: "cubic-bezier(.22,.7,.24,1)", fill: "both" },
      );
      const finish = () => {
        animation.onfinish = null;
        animation.oncancel = null;
        animation.cancel();
        clone.remove();
        if (landing) landing.style.visibility = "";
        active.current.delete(finish);
      };
      active.current.add(finish);
      animation.onfinish = finish;
      animation.oncancel = finish;
    };
    const topChanged = snapshot.top && snapshot.top.id !== old.snapshot.top?.id;
    if (topChanged && old.snapshot.phase === "playing") {
      const owned = old.cards.get(snapshot.top!.id);
      const source =
        owned?.box ??
        (seat(old.snapshot.turn) ? position(seat(old.snapshot.turn)!) : null);
      if (source) fly(owned?.face ?? discard, source, position(discard), 0, discard);
    }
    const added = snapshot.hand.filter(
      (card) => !old.snapshot.hand.some((previousCard) => previousCard.id === card.id),
    );
    const handBox = position(hand);
    added.forEach((card, index) => {
      const element = hand.querySelector<HTMLElement>(`[data-card-id="${card.id}"]`);
      if (!element) return;
      const target = position(element);
      // Offscreen cards land at the visible edge of the swipeable hand.
      const visible =
        target.left >= handBox.left &&
        target.left + target.width <= handBox.left + handBox.width;
      const destination = {
        ...target,
        left: Math.max(
          handBox.left + 6,
          Math.min(target.left, handBox.left + handBox.width - target.width - 6),
        ),
      };
      fly(
        pile,
        position(pile),
        destination,
        index * 75 + (topChanged ? 180 : 0),
        visible ? element : undefined,
        true,
      );
    });
    for (const player of snapshot.players) {
      if (player.id === snapshot.self) continue;
      const oldPlayer = old.snapshot.players.find((p) => p.id === player.id);
      const gained = player.count - (oldPlayer?.count ?? player.count);
      const target = seat(player.id);
      if (gained > 0 && target)
        for (let i = 0; i < Math.min(gained, 7); i++) {
          fly(
            pile,
            position(pile),
            position(target),
            i * 75 + (topChanged ? 180 : 0),
            undefined,
            true,
          );
        }
    }
  }, [snapshot]);
}
