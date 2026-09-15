import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { formatSchedule, minScheduleInput } from "./schedule";
import { ensureSignedIn } from "@/firebase/client";
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
  setError,
}: Props) {
  const [scheduledAt, setScheduledAt] = useState("");
  const [title, setTitle] = useState("");
  const [groupId, setGroupId] = useState("");
  const [myGroups, setMyGroups] = useState<{ id: string; name: string }[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const waitingForSchedule = !!room?.scheduledFor && now < room.scheduledFor;
  useEffect(() => {
    if (!room?.scheduledFor || Date.now() >= room.scheduledFor) return;
    const interval = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(interval);
  }, [room?.scheduledFor]);
  useEffect(() => {
    if (room) return;
    let cancelled = false;
    (async () => {
      try {
        const user = await ensureSignedIn();
        const response = await fetch(
          `/api/uno/groups/mine?uid=${encodeURIComponent(user.uid)}`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setMyGroups(data.groups ?? []);
      } catch {
        // Group selection is optional; leave the list empty on failure.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [room]);
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
            {["quick", "friends", "schedule"].map((t) => (
              <button
                key={t}
                className={tab === t ? "selected" : ""}
                onClick={() => setTab(t)}
              >
                {t === "quick" ? "Quick play" : t === "friends" ? "With friends" : "Schedule"}
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
          ) : tab === "friends" ? (
            <>
              <button
                className="primary"
                disabled={busy || !name.trim()}
                onClick={() => act("create", { name })}
              >
                Create private room{" "}
                <span>
                  <Icon name="plus" />
                </span>
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
          ) : (
            <>
              <label className="field-label" htmlFor="schedule-date">
                DATE &amp; TIME
              </label>
              <input
                id="schedule-date"
                type="datetime-local"
                min={minScheduleInput()}
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
              <label className="field-label" htmlFor="schedule-title">
                GAME TITLE (OPTIONAL)
              </label>
              <input
                id="schedule-title"
                maxLength={40}
                placeholder="Friday game night"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              {myGroups.length > 0 && (
                <>
                  <label className="field-label" htmlFor="schedule-group">
                    NOTIFY A GROUP (OPTIONAL)
                  </label>
                  <select
                    id="schedule-group"
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                  >
                    <option value="">No group</option>
                    {myGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <button
                className="primary"
                disabled={busy || !name.trim() || !scheduledAt}
                onClick={async () => {
                  const data = await act("create", {
                    name,
                    scheduledFor: new Date(scheduledAt).getTime(),
                    title: title.trim() || undefined,
                    groupId: groupId || undefined,
                  });
                  if (data?.scheduled) {
                    setScheduledAt("");
                    setTitle("");
                    setGroupId("");
                  }
                }}
              >
                Schedule public game{" "}
                <span>
                  <Icon name="calendar" />
                </span>
              </button>
              <p className="helper">
                Anyone can find and join this game from Community games.
              </p>
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
          {room.scheduledFor && (
            <p className="scheduled-note">
              <Icon name="calendar" /> {room.title || "Game night"} · scheduled for{" "}
              {formatSchedule(room.scheduledFor)}
            </p>
          )}
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
              {waitingForSchedule && (
                <p className="scheduled-note">
                  <Icon name="calendar" /> Dealing opens at{" "}
                  {formatSchedule(room.scheduledFor!)}.
                </p>
              )}
              <button
                className="primary"
                disabled={busy || room.players.length < 2 || waitingForSchedule}
                onClick={() => act("start")}
              >
                {waitingForSchedule
                  ? "Not time yet"
                  : room.phase === "finished"
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
              {waitingForSchedule
                ? `The host can deal once the scheduled time (${formatSchedule(room.scheduledFor!)}) arrives.`
                : room.phase === "lobby"
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
    </section>
  );
}
