"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import type { Card, Snapshot } from "@/uno/types";
import { auth, db, ensureSignedIn } from "@/firebase/client";
import { useVoiceConnection } from "./useVoiceConnection";

export type RoomRequest = (
  action: string,
  extra?: Record<string, unknown>,
) => Promise<{ token?: string; snapshot?: Snapshot; left?: boolean }>;

type PublicDoc = {
  revision?: number;
  pendingDraw: number;
  drawnThisTurn: boolean;
  code: string;
  host: string;
  public: boolean;
  phase: Snapshot["phase"];
  players: { id: string; name: string; count: number; voice: boolean; seen: number }[];
  discard: Card[];
  color: Snapshot["color"];
  turn: string;
  direction: number;
  winner: string | null;
  standings: string[];
  matchOver: boolean;
  log: string[];
};
type HandDoc = { hand: Card[]; signals: Snapshot["signals"] };
type Session = { code: string; token: string; self: string };

function toSnapshot(pub: PublicDoc, hand: HandDoc | null, selfId: string): Snapshot {
  return {
    revision: pub.revision ?? 0,
    pendingDraw: pub.pendingDraw,
    drawnThisTurn: pub.turn === selfId && pub.drawnThisTurn,
    code: pub.code,
    self: selfId,
    host: pub.host,
    public: pub.public,
    phase: pub.phase,
    players: pub.players.map((p) => ({
      id: p.id,
      name: p.name,
      count: p.count,
      voice: p.voice,
      connected: Date.now() - p.seen < 20000,
    })),
    hand: hand?.hand ?? [],
    top: pub.discard.at(-1) ?? null,
    color: pub.color,
    turn: pub.turn,
    direction: pub.direction,
    winner: pub.winner,
    standings: pub.standings ?? [],
    matchOver: pub.matchOver ?? false,
    log: pub.log,
    signals: hand?.signals ?? [],
  };
}

export function useUnoGame() {
  const [name, setName] = useState(""),
    [code, setCode] = useState(""),
    [room, setRoom] = useState<Snapshot | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("quick"),
    [rules, setRules] = useState(false),
    [wild, setWild] = useState<Card | null>(null),
    [uno, setUno] = useState(false),
    [sessionVersion, setSessionVersion] = useState(0);
  const session = useRef<Session | null>(null),
    latest = useRef<Snapshot | null>(null),
    cursor = useRef(0),
    publicPart = useRef<PublicDoc | null>(null),
    handPart = useRef<HandDoc | null>(null),
    actionPending = useRef(false);

  const apply = useCallback((s: Snapshot) => {
    if (latest.current?.code === s.code && latest.current.revision > s.revision) return;
    latest.current = s;
    setRoom(s);
  }, []);

  const request = useCallback<RoomRequest>(async (action, extra = {}) => {
    const body = { ...session.current, action, uid: auth.currentUser?.uid, ...extra };
    const response = await fetch("/api/uno", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data;
  }, []);

  const { mic, muted, voiceStatus, stopVoice, syncVoice, startVoice, toggleMute } =
    useVoiceConnection(request, cursor);

  const remerge = useCallback(() => {
    if (!session.current || !publicPart.current) return;
    const s = toSnapshot(publicPart.current, handPart.current, session.current.self);
    apply(s);
    void syncVoice(s);
  }, [apply, syncVoice]);

  // Restore a saved session once, on mount. sessionStorage isn't available during
  // SSR, so this has to run post-mount in an effect rather than a lazy useState
  // initializer (which would diverge from the server-rendered markup).
  useEffect(() => {
    const saved = sessionStorage.getItem("uno-session");
    if (saved) {
      try {
        session.current = JSON.parse(saved);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSessionVersion((v) => v + 1);
      } catch {
        sessionStorage.removeItem("uno-session");
      }
    }
  }, []);

  // Live-subscribe to this room's public state and this player's private hand
  // whenever the active session changes (join/create/leave), replacing polling.
  useEffect(() => {
    if (!session.current) return;
    const { code } = session.current;
    let stopped = false;
    let unsubPublic: (() => void) | undefined;
    let unsubHand: (() => void) | undefined;
    (async () => {
      const user = await ensureSignedIn();
      if (stopped) return;
      unsubPublic = onSnapshot(doc(db, "rooms", code), (snap) => {
        if (!snap.exists()) return;
        publicPart.current = snap.data() as PublicDoc;
        remerge();
      });
      unsubHand = onSnapshot(doc(db, "rooms", code, "hands", user.uid), (snap) => {
        handPart.current = (snap.data() as HandDoc | undefined) ?? null;
        remerge();
      });
    })().catch(() => setError("Connection interrupted. Please try again."));
    return () => {
      stopped = true;
      unsubPublic?.();
      unsubHand?.();
    };
  }, [sessionVersion, remerge]);

  // Keep this seat alive on the server (it prunes anyone idle for 90s) even
  // while just waiting out someone else's turn, and give every client a
  // periodic resync in case a realtime update was ever missed — the game
  // otherwise looks stuck until a manual refresh.
  useEffect(() => {
    if (!session.current) return;
    const interval = setInterval(() => {
      void request("ping")
        .then((data) => {
          if (data.snapshot) apply(data.snapshot);
        })
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [sessionVersion, request, apply]);

  useEffect(() => () => stopVoice(), [stopVoice]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (actionPending.current) return;
    actionPending.current = true;
    setError("");
    setBusy(true);
    try {
      await ensureSignedIn();
      const data = await request(action, extra);
      if (data.token && data.snapshot) {
        session.current = { code: data.snapshot.code, token: data.token, self: data.snapshot.self };
        sessionStorage.setItem("uno-session", JSON.stringify(session.current));
        publicPart.current = null;
        handPart.current = null;
        cursor.current = 0;
        setSessionVersion((v) => v + 1);
      }
      // Apply the direct response immediately for snappy feedback; the Firestore
      // listener corroborates (or supersedes) it a moment later.
      if (data.snapshot) apply(data.snapshot);
      if (action === "play") {
        setWild(null);
        setUno(false);
      }
      if (action === "leave") {
        stopVoice();
        session.current = null;
        latest.current = null;
        publicPart.current = null;
        handPart.current = null;
        cursor.current = 0;
        sessionStorage.removeItem("uno-session");
        setRoom(null);
        setSessionVersion((v) => v + 1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      actionPending.current = false;
      setBusy(false);
    }
  }
  async function toggleVoice() {
    if (!room) {
      setError("Join a table to use voice chat.");
      return;
    }
    if (mic) {
      stopVoice();
      await act("voice", { voice: false });
      return;
    }
    try {
      await startVoice();
      await act("voice", { voice: true });
    } catch {
      stopVoice();
      setError("Microphone unavailable. Allow microphone access on HTTPS or localhost.");
    }
  }

  return {
    name,
    setName,
    code,
    setCode,
    room,
    error,
    setError,
    busy,
    tab,
    setTab,
    rules,
    setRules,
    wild,
    setWild,
    uno,
    setUno,
    mic,
    muted,
    voiceStatus,
    act,
    toggleVoice,
    toggleMute,
  };
}
export type UnoGame = ReturnType<typeof useUnoGame>;
