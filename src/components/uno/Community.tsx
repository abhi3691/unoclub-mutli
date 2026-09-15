"use client";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { formatSchedule } from "./schedule";
import type { UnoGame } from "./useUnoGame";

const NOW_TICK_MS = 5000;

type Game = {
  code: string;
  title: string | null;
  hostName: string;
  scheduledFor: number;
  playerCount: number;
  groupName: string | null;
};

type Props = Pick<UnoGame, "name" | "busy" | "act">;

export function Community({ name, busy, act }: Props) {
  const [open, setOpen] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => setNow(Date.now()), NOW_TICK_MS);
    return () => clearInterval(interval);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch("/api/uno/community", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Community games unavailable. Try again.");
        return response.json();
      })
      .then((data) => {
        if (!controller.signal.aborted) setGames(data.games);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? error.message : "Unable to load games.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, refresh]);
  return (
    <section className="community-card">
      <button
        className="community-heading"
        aria-expanded={open}
        aria-controls="community-content"
        onClick={() => setOpen(!open)}
      >
        <Icon name="calendar" /> Community games{" "}
        <span>{open ? "Hide" : "View schedule"}</span>
      </button>
      {open && (
        <div id="community-content">
          <p>Public games the community has scheduled, soonest first.</p>
          <button
            className="community-refresh"
            disabled={loading}
            onClick={() => setRefresh((value) => value + 1)}
          >
            <Icon name="clockwise" /> Refresh
          </button>
          {loading ? (
            <p role="status">Loading schedule…</p>
          ) : error ? (
            <p role="alert">{error}</p>
          ) : games.length === 0 ? (
            <p>No community games scheduled yet. Host one from “Pull up a chair”.</p>
          ) : (
            <ul className="community-list">
              {games.map((g) => {
                const notYetOpen = now < g.scheduledFor;
                return (
                  <li key={g.code}>
                    <div>
                      <strong>{g.title || "Game night"}</strong>
                      <span>{formatSchedule(g.scheduledFor)}</span>
                      <span>
                        Hosted by {g.hostName} · {g.playerCount}/8 seated
                        {g.groupName ? ` · ${g.groupName}` : ""}
                      </span>
                      {notYetOpen && (
                        <span className="community-wait">
                          Opens for joining at {formatSchedule(g.scheduledFor)}
                        </span>
                      )}
                    </div>
                    <button
                      disabled={busy || !name.trim() || notYetOpen}
                      onClick={() => act("join", { name, code: g.code })}
                    >
                      {notYetOpen ? "Not yet" : "Join"} <Icon name="arrowUpRight" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {!name.trim() && games.length > 0 && (
            <p className="community-note">
              Enter your display name above to join a scheduled game.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
