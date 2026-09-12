"use client";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
type Entry = { name: string; wins: number; games: number; winRate: number };
export function Leaderboard() {
  const [open, setOpen] = useState(false);
  const [players, setPlayers] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch("/api/uno/leaderboard", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Leaderboard unavailable. Try again.");
        return response.json();
      })
      .then((data) => {
        if (!controller.signal.aborted) setPlayers(data.players);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? error.message : "Unable to load rankings.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, refresh]);
  return (
    <section className="leaderboard-card">
      <button
        className="leaderboard-heading"
        aria-expanded={open}
        aria-controls="leaderboard-content"
        onClick={() => setOpen(!open)}
      >
        <Icon name="trophy" /> Leaderboard <span>{open ? "Hide" : "View rankings"}</span>
      </button>
      {open && (
        <div id="leaderboard-content">
          <p>Top 50 players · Ranked by wins. Equal wins share a rank.</p>
          <p className="leaderboard-note">
            New results count from this update. Stats belong to your browser identity;
            clearing browser data starts a new profile.
          </p>
          <button
            className="leaderboard-refresh"
            disabled={loading}
            onClick={() => setRefresh((value) => value + 1)}
          >
            <Icon name="clockwise" /> Refresh
          </button>
          {loading ? (
            <p role="status">Loading rankings…</p>
          ) : error ? (
            <p role="alert">{error}</p>
          ) : players.length === 0 ? (
            <p>No winners yet. Finish a game to get on the board!</p>
          ) : (
            <div className="leaderboard-scroll">
              <table>
                <caption className="leaderboard-caption">All-time game results</caption>
                <thead>
                  <tr>
                    <th scope="col">Rank</th>
                    <th scope="col">Player</th>
                    <th scope="col">Wins</th>
                    <th scope="col">Games</th>
                    <th scope="col">Win %</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player, index) => (
                    <tr key={index}>
                      <td>
                        {players.findIndex((entry) => entry.wins === player.wins) + 1}
                      </td>
                      <th scope="row">{player.name}</th>
                      <td>{player.wins}</td>
                      <td>{player.games}</td>
                      <td>{player.winRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
