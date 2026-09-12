import { Icon } from "./Icon";
import type { UnoGame } from "./useUnoGame";

type Props = Pick<
  UnoGame,
  | "room"
  | "name"
  | "setName"
  | "code"
  | "setCode"
  | "tab"
  | "setTab"
  | "busy"
  | "act"
  | "error"
  | "setError"
>;
export function RoomLobby({
  room,
  name,
  setName,
  code,
  setCode,
  tab,
  setTab,
  busy,
  act,
  error,
  setError,
}: Props) {
  return (
    <section className="lobby-card">
      <div className="eyebrow">{room ? "YOU’RE AT THE TABLE" : "PULL UP A CHAIR"}</div>
      <h2>{room ? "Let’s play." : "Let’s shuffle things up."}</h2>
      {!room ? (
        <>
          <p>Meet new people or bring your favorite ones.</p>
          <label className="field-label" htmlFor="name">
            YOUR DISPLAY NAME
          </label>
          <input
            id="name"
            autoComplete="nickname"
            enterKeyHint="done"
            maxLength={20}
            placeholder="What should we call you?"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="tabs">
            {["quick", "friends"].map((t) => (
              <button
                key={t}
                className={tab === t ? "selected" : ""}
                onClick={() => setTab(t)}
              >
                {t === "quick" ? "Quick play" : "With friends"}
              </button>
            ))}
          </div>
          {tab === "quick" ? (
            <>
              <button
                className="primary"
                disabled={busy || !name.trim()}
                onClick={() => act("quick", { name })}
              >
                Find a table{" "}
                <span>
                  <Icon name="arrowUpRight" />
                </span>
              </button>
              <p className="helper">Join a public table. New friends included.</p>
            </>
          ) : (
            <>
              <button
                className="primary"
                disabled={busy || !name.trim()}
                onClick={() => act("create", { name })}
              >
                Create private room <span>+</span>
              </button>
              <div className="join-row">
                <input
                  aria-label="Room code"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="go"
                  placeholder="6-character code"
                  value={code}
                  maxLength={6}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
                <button
                  disabled={busy || !name.trim() || code.length !== 6}
                  onClick={() => act("join", { name, code })}
                >
                  Join <Icon name="arrowUpRight" />
                </button>
              </div>
            </>
          )}
          <div className="divider" />
          <div className="lobby-note">
            <span>
              <Icon name="players" />
            </span>
            <div>
              <strong>More friends. More chaos.</strong>
              <p>
                2–8 players at every table.
                <br />
                No downloads. Just deal.
              </p>
            </div>
          </div>
        </>
      ) : (
        <>
          <p>
            {room.public
              ? "Public table · Anyone can join"
              : "Private table · Invite your people"}
          </p>
          <button
            className="room-code"
            onClick={() =>
              navigator.clipboard
                .writeText(room.code)
                .then(() => setError("Room code copied!"))
                .catch(() => setError(`Share this code: ${room.code}`))
            }
          >
            {room.code}
            <small>
              COPY CODE <Icon name="copy" />
            </small>
          </button>
          <div className="member-count">{room.players.length}/8 players seated</div>
          {room.host === room.self && room.phase !== "playing" ? (
            <>
              <button
                className="primary"
                disabled={busy || room.players.length < 2}
                onClick={() => act("start")}
              >
                {room.phase === "finished"
                  ? room.matchOver
                    ? "Play again"
                    : "Deal next round"
                  : "Deal the cards"}{" "}
                <span>
                  <Icon name="arrowUpRight" />
                </span>
              </button>
              {room.phase === "finished" && !room.matchOver && (
                <button
                  className="skip"
                  disabled={busy}
                  onClick={() => act("skipRanking")}
                >
                  Skip ranking &amp; end game
                </button>
              )}
            </>
          ) : (
            <p className="helper">
              {room.phase === "lobby"
                ? "The host will start when everyone is ready."
                : room.phase === "finished" && !room.matchOver
                  ? "Waiting for the host to deal the next round, or skip ranking."
                  : "Match the active color or the top card’s symbol."}
            </p>
          )}
          <button className="leave" onClick={() => act("leave")} disabled={busy}>
            Leave table
          </button>
        </>
      )}
      {error && (
        <p role="status" className="notice">
          {error}
        </p>
      )}
    </section>
  );
}
