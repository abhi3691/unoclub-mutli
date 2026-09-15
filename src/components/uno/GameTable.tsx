import { TurnAnnouncement } from "./TurnAnnouncement";
import { Icon } from "./Icon";
import type { ReactNode } from "react";
import type { UnoGame } from "./useUnoGame";
import type { Card } from "@/uno/types";
import { PlayingCard } from "./PlayingCard";
import { useCardMotion } from "./useCardMotion";
type Props = Pick<
  UnoGame,
  "name" | "room" | "busy" | "uno" | "setUno" | "setRules" | "setWild" | "act"
> & { children?: ReactNode };
export function GameTable({
  children,
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
  const winnerId = room?.matchOver ? (room.standings[0] ?? room.winner) : room?.winner;
  const winnerName =
    room?.players.find((player) => player.id === winnerId)?.name ?? "Player who left";
  const winnerPlace = room ? room.standings.indexOf(winnerId ?? "") + 1 : 0;
  const activePlayers =
    room?.players.filter((player) => !room.standings.includes(player.id)) ?? [];
  const turnIndex = activePlayers.findIndex((player) => player.id === room?.turn);
  const turnOrder =
    turnIndex < 0
      ? []
      : activePlayers.map(
          (_, index) =>
            activePlayers[
              (turnIndex + index * (room?.direction ?? 1) + activePlayers.length) %
                activePlayers.length
            ],
        );
  const preview: Card[] = [
    { id: "a", color: "blue", value: "7" },
    { id: "b", color: "green", value: "reverse" },
    { id: "c", color: "red", value: "5" },
    { id: "d", color: "yellow", value: "+2" },
    { id: "e", color: "wild", value: "wild" },
  ];

  return (
    <section className={`table-panel ${mine ? "is-your-turn" : ""}`}>
      {room?.phase === "playing" && (
        <TurnAnnouncement
          key={`${room.code}:${room.turn}:${room.pendingDraw}:${room.drawnThisTurn}`}
          room={room}
        />
      )}
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
          <Icon name="info" />
        </button>
      </div>
      <div className="felt">
        <div className="felt-line" />
        <div className="table-watermark">uno club</div>
        {room?.phase === "playing" && (
          <div className="board-turn-controls">
            <div className="turn-summary" role="status">
              <strong>
                {mine ? "Your turn" : `${current?.name ?? "Player"}'s turn`}
              </strong>
              <span>
                Next:{" "}
                {turnOrder[1]?.id === room.self
                  ? "You"
                  : (turnOrder[1]?.name ?? "Waiting")}
              </span>
              <small>
                {uno
                  ? "UNO ready. Play your card."
                  : "Have 2 cards? Call UNO before playing."}
              </small>
              <button className="turn-help" onClick={() => setRules(true)}>
                <Icon name="info" /> How to play
              </button>
            </div>
            {room?.phase === "playing" && (
              <button
                disabled={!mine || busy}
                aria-pressed={uno}
                className={`uno-call uno-buzzer ${uno ? "armed" : ""}`}
                type="button"
                aria-label={
                  uno
                    ? "UNO ready for your next card. Press to cancel"
                    : "Call UNO with your next card"
                }
                title="Press before playing your second-to-last card"
                onClick={() => setUno(!uno)}
              >
                <span className="uno-buzzer-label">UNO!</span>
                <span className="uno-buzzer-state">
                  {uno ? (
                    <>
                      <Icon name="check" /> Ready
                    </>
                  ) : (
                    "Press to call"
                  )}
                </span>
              </button>
            )}
          </div>
        )}
        {room?.phase === "playing" && (
          <nav className="turn-flow" aria-label="Player turn order">
            <p>
              {room.direction === 1 ? "Clockwise" : "Counterclockwise"} · Special cards
              can change who goes next
            </p>
            <ol>
              {turnOrder.map((player, index) => (
                <li key={player.id} aria-current={index === 0 ? "step" : undefined}>
                  {index > 0 && <Icon name="arrowRight" />}
                  <span>
                    <small>
                      {index === 0 ? "NOW" : index === 1 ? "NEXT" : `THEN ${index}`}
                    </small>
                    <b>{player.id === room.self ? "You" : player.name}</b>
                  </span>
                </li>
              ))}
            </ol>
          </nav>
        )}
        {room?.phase === "finished" && winnerId && (
          <section
            className="winner-announcement"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="winner-trophy">
              <Icon name="trophy" />
            </span>
            <div>
              <p>{room.matchOver ? "Game complete" : "Round complete"}</p>
              <h2>
                {winnerPlace <= 1
                  ? winnerId === room.self
                    ? "You win!"
                    : `${winnerName} wins!`
                  : `${winnerName} takes place #${winnerPlace}!`}
              </h2>
              <span>
                {winnerId === room.self ? "Nicely played! " : "Well played! "}
                {room.matchOver
                  ? "The final standings are below."
                  : "The remaining players can continue for their places."}
              </span>
            </div>
          </section>
        )}
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
                    {p.voice && <Icon name="mic" />}
                  </small>
                </div>
              ))
          ) : (
            <>
              <div className="empty-seat">
                <span>
                  <Icon name="plus" />
                </span>
                Your friend
              </div>
              <div className="empty-seat">
                <span>
                  <Icon name="plus" />
                </span>
                Your rival
              </div>
              <div className="empty-seat">
                <span>
                  <Icon name="plus" />
                </span>
                Your wildcard
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
          <span className="direction">
            <Icon name={room?.direction === -1 ? "counterclockwise" : "clockwise"} />
          </span>
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
              ? `${winnerName} wins the game!`
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
              {room.standings.map((id, index) => (
                <li key={id}>
                  <span className="standing-rank">{index + 1}</span>
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
        {room && children}
        <div className="hand-dock">
          <div className="hand-heading">
            <strong>
              Your hand <span>{room?.hand.length ?? 5}</span>
            </strong>
            <span>
              {mine
                ? "Your turn"
                : room?.phase === "playing"
                  ? "Waiting for your turn"
                  : "Ready when you are"}
            </span>
          </div>
          <div
            tabIndex={0}
            role="group"
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
            <p className="hand-hint">
              <Icon name="arrowLeft" /> Swipe to see every card <Icon name="arrowRight" />
            </p>
          )}
          <div className="your-seat">
            <div className="you-avatar">{name[0]?.toUpperCase() || "Y"}</div>
            <div>
              <strong>
                {room ? room.players.find((p) => p.id === room.self)?.name : "You"}
              </strong>
              <small>
                {room
                  ? `${room.hand.length} cards in hand`
                  : "Your winning streak awaits"}
              </small>
            </div>
            {room?.phase === "playing" && !room.drawnThisTurn && (
              <button
                className="mobile-draw"
                disabled={!mine || busy}
                onClick={() => act("draw")}
              >
                <Icon name="cards" />
                {room?.pendingDraw ? `Draw ${room.pendingDraw} cards` : "Draw card"}
              </button>
            )}
            {room?.phase === "playing" && room.drawnThisTurn && (
              <button
                className="mobile-draw"
                disabled={!mine || busy}
                onClick={() => act("pass")}
              >
                Pass <Icon name="arrowRight" />
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="table-footer">
        <span>
          <span className="tiny-colors">
            <Icon name="dot" /> <Icon name="dot" /> <Icon name="dot" />{" "}
            <Icon name="dot" />
          </span>{" "}
          Match a color. Match a number. Make a memory.
        </span>
        <span>
          HOUSE RULES <Icon name="arrowUpRight" />
        </span>
      </div>
    </section>
  );
}
