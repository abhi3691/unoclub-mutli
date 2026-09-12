import type { UnoGame } from "./useUnoGame";
import type { Card } from "@/uno/types";
import { PlayingCard } from "./PlayingCard";
import { useCardMotion } from "./useCardMotion";
type Props = Pick<
  UnoGame,
  "name" | "room" | "busy" | "uno" | "setUno" | "setRules" | "setWild" | "act"
>;
export function GameTable({
  name,
  room,
  busy,
  uno,
  setUno,
  setRules,
  setWild,
  act,
}: Props) {
  useCardMotion(room);
  const mine = room?.turn === room?.self && room?.phase === "playing";
  const current = room?.players.find((p) => p.id === room.turn);
  const preview: Card[] = [
    { id: "a", color: "blue", value: "7" },
    { id: "b", color: "green", value: "reverse" },
    { id: "c", color: "red", value: "5" },
    { id: "d", color: "yellow", value: "+2" },
    { id: "e", color: "wild", value: "wild" },
  ];

  return (
    <section className="table-panel">
      <div className="table-toolbar">
        <div>
          <span className="live-badge">{room ? "LIVE TABLE" : "THE CLUB TABLE"}</span>
          <span className="room-label">
            {room ? `Room ${room.code}` : "A seat for everyone"}
          </span>
        </div>
        <button
          className="icon-button"
          onClick={() => setRules(true)}
          aria-label="Game rules"
        >
          ⓘ
        </button>
      </div>
      <div className="felt">
        <div className="felt-line" />
        <div className="table-watermark">uno club</div>
        <div className="opponents">
          {room ? (
            room.players
              .filter((p) => p.id !== room.self)
              .map((p, i) => (
                <div
                  data-player-id={p.id}
                  className={`seat ${room.turn === p.id ? "active-seat" : ""}`}
                  key={p.id}
                >
                  <div className={`avatar avatar-${i % 4}`}>
                    {p.name[0].toUpperCase()}
                  </div>
                  <strong>{p.name}</strong>
                  <small>
                    {p.connected ? `${p.count} cards` : "Reconnecting"}{" "}
                    {p.voice ? "♫" : ""}
                  </small>
                </div>
              ))
          ) : (
            <>
              <div className="empty-seat">
                <span>+</span>Your friend
              </div>
              <div className="empty-seat">
                <span>+</span>Your rival
              </div>
              <div className="empty-seat">
                <span>+</span>Your wildcard
              </div>
            </>
          )}
        </div>
        <div className="center-play">
          <div className="draw-stack">
            <PlayingCard
              back
              onClick={() => room && act("draw")}
              disabled={!mine || busy || !!room?.drawnThisTurn}
            />
            <small>
              {room?.pendingDraw ? `DRAW ${room.pendingDraw} CARDS` : "DRAW PILE"}
            </small>
          </div>
          <span className="direction">{room?.direction === -1 ? "↶" : "↻"}</span>
          <div className="discard">
            <PlayingCard
              card={room?.top ?? { id: "preview", color: "red", value: "5" }}
              disabled
            />
            <small>
              {room?.top ? `${room.color.toUpperCase()} TO PLAY` : "DISCARD PILE"}
            </small>
          </div>
        </div>
        <div className="table-message" role="status" aria-live="polite">
          {room?.phase === "finished"
            ? room.matchOver
              ? "Final standings are in!"
              : `${room.players.find((p) => p.id === room.winner)?.name} takes place #${room.standings.length}!`
            : room?.phase === "playing"
              ? mine
                ? room.pendingDraw
                  ? `Stack a ${room.top?.value} or draw ${room.pendingDraw} cards.`
                  : room.drawnThisTurn
                    ? "You drew a card. Play it, or pass."
                    : "Your turn. Make it a good one."
                : `${current?.name} is thinking…`
              : room
                ? `${room.players.length} of 8 seats filled · Waiting for the host to deal`
                : "The next great game night starts here."}
        </div>
        {room?.phase === "finished" && room.standings.length > 0 && (
          <div className="standings" role="status" aria-live="polite">
            <strong>{room.matchOver ? "Final standings" : "Standings so far"}</strong>
            <ol>
              {room.standings.map((id) => (
                <li key={id}>
                  {room.players.find((x) => x.id === id)?.name ?? "Player left"}
                </li>
              ))}
            </ol>
            {!room.matchOver && (
              <p>
                {room.players
                  .filter((x) => !room.standings.includes(x.id))
                  .map((x) => x.name)
                  .join(" & ")}{" "}
                play next for the remaining places.
              </p>
            )}
          </div>
        )}
        {room?.phase === "playing" && room.log[0] && (
          <p className="table-toast" role="status" aria-live="polite">
            {room.log.slice(0, 2).reverse().join(" · ")}
          </p>
        )}
        <div
          aria-label="Your cards; swipe to see more"
          className={`hand ${room ? "real-hand" : ""}`}
        >
          {(room?.hand.length ? room.hand : !room ? preview : []).map((c) => (
            <PlayingCard
              key={c.id}
              card={c}
              disabled={
                !mine || busy || !!(room?.pendingDraw && c.value !== room.top?.value)
              }
              onClick={() =>
                c.color === "wild" ? setWild(c) : act("play", { card: c.id, uno })
              }
            />
          ))}
        </div>
        {room?.phase === "playing" && (
          <p className="hand-hint">Swipe your cards · Tap a card to play</p>
        )}
        <div className="your-seat">
          <div className="you-avatar">{name[0]?.toUpperCase() || "Y"}</div>
          <div>
            <strong>
              {room ? room.players.find((p) => p.id === room.self)?.name : "You"}
            </strong>
            <small>
              {room ? `${room.hand.length} cards in hand` : "Your winning streak awaits"}
            </small>
          </div>
          {room?.phase === "playing" && (
            <button
              disabled={!mine || busy}
              aria-pressed={uno}
              className={`uno-call ${uno ? "armed" : ""}`}
              onClick={() => setUno(!uno)}
            >
              UNO! {uno ? "✓" : ""}
            </button>
          )}
          {room?.phase === "playing" && !room.drawnThisTurn && (
            <button
              className="mobile-draw"
              disabled={!mine || busy}
              onClick={() => act("draw")}
            >
              {room?.pendingDraw ? `Draw ${room.pendingDraw} cards` : "Draw card"}
            </button>
          )}
          {room?.phase === "playing" && room.drawnThisTurn && (
            <button
              className="mobile-draw"
              disabled={!mine || busy}
              onClick={() => act("pass")}
            >
              Pass
            </button>
          )}
        </div>
      </div>
      <div className="table-footer">
        <span>
          <span className="tiny-colors">● ● ● ●</span> Match a color. Match a number. Make
          a memory.
        </span>
        <span>HOUSE RULES ↗</span>
      </div>
    </section>
  );
}
