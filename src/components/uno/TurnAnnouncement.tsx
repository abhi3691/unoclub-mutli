import { useEffect, useState } from "react";
import type { Snapshot } from "@/uno/types";
import { Icon } from "./Icon";
export function TurnAnnouncement({ room }: { room: Snapshot }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(timer);
  }, []);
  if (!visible) return null;
  const mine = room.turn === room.self;
  const name = room.players.find((player) => player.id === room.turn)?.name ?? "Player";
  return (
    <div
      className="turn-announcement"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <Icon name={mine ? "cards" : "players"} />
      <div>
        <strong>{mine ? "Your turn!" : `${name}'s turn`}</strong>
        <p>
          {room.pendingDraw
            ? `${mine ? "Stack" : `${name} must stack`} ${room.top?.value} or draw ${room.pendingDraw} cards.`
            : mine
              ? room.drawnThisTurn
                ? "Play your drawn card, or tap Pass."
                : `Match ${room.color} or the top card’s symbol. A wild also works.`
              : "Wait for your turn. Check the player order above."}
        </p>
      </div>
    </div>
  );
}
