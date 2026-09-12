"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import type { RoomAction } from "@/uno/schema";
import type { Card, Snapshot } from "@/uno/types";
import { auth, db, ensureSignedIn } from "@/firebase/client";
import {
  RoomRequestError,
  isExpiredSession,
  isRetryableRequest,
  listenerFailure,
} from "@/uno/connection-errors";
import { useVoiceConnection } from "./useVoiceConnection";

export type RoomRequest = (
  action: RoomAction,
  extra?: Record<string, unknown>,
) => Promise<{ token?: string; snapshot?: Snapshot; left?: boolean }>;

type PublicDoc = {
  unoWarning?: Snapshot["unoWarning"];
  revision?: number;
  pendingDraw: number;
  drawnThisTurn: boolean;
  code: string;
  host: string;
  public: boolean;
  phase: Snapshot["phase"];
  players: {
    id: string;
    name: string;
    count: number;
    voice: boolean;
    seen: number;
    handRevision?: number;
  }[];
  discard: Card[];
  color: Snapshot["color"];
  turn: string;
  direction: number;
  winner: string | null;
  standings: string[];
  matchOver: boolean;
  log: string[];
};
type HandDoc = { revision?: number; hand: Card[]; signals: Snapshot["signals"] };
type Session = { code: string; token: string; self: string };

function toSnapshot(pub: PublicDoc, hand: HandDoc | null, selfId: string): Snapshot {
  return {
    unoWarning: pub.unoWarning ?? null,
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
    actionPending = useRef(false),
    resync = useRef<() => void>(() => {}),
    liveState = useRef<"connecting" | "live" | "retrying" | "blocked">("connecting");

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
    if (!response.ok)
      throw new RoomRequestError(
        data.error || `Request failed (${response.status})`,
        response.status,
      );
    return data;
  }, []);

  const { mic, muted, voiceStatus, stopVoice, syncVoice, startVoice, toggleMute } =
    useVoiceConnection(request, cursor);

  const clearSession = useCallback(() => {
    stopVoice();
    session.current = null;
    latest.current = null;
    publicPart.current = null;
    handPart.current = null;
    cursor.current = 0;
    sessionStorage.removeItem("uno-session");
    setRoom(null);
    setSessionVersion((v) => v + 1);
  }, [stopVoice]);

  const remerge = useCallback(() => {
    if (!session.current || !publicPart.current) return;
    if (!handPart.current) return;
    const own = publicPart.current.players.find((p) => p.id === session.current!.self);
    if (!own || (own.handRevision ?? 0) !== (handPart.current.revision ?? 0)) return;
    const s = toSnapshot(publicPart.current, handPart.current, session.current.self);
    apply(s);
    void syncVoice(s).catch(() =>
      setError("Voice is reconnecting. Game updates are still active."),
    );
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
    const activeSession = session.current;
    const { code } = activeSession;
    let stopped = false;
    let unsubPublic: (() => void) | undefined;
    let unsubHand: (() => void) | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let retryDelay = 1000;
    const current = () => !stopped && session.current === activeSession;
    const fail = (error: unknown) => {
      if (!current() || retry) return;
      unsubPublic?.();
      unsubHand?.();
      const failure = listenerFailure(error);
      liveState.current = failure.retry ? "retrying" : "blocked";
      setError(failure.message);
      if (!failure.retry) return;
      resync.current();
      retry = setTimeout(() => {
        retry = undefined;
        void subscribe();
      }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 15000);
    };
    const subscribe = async () => {
      try {
        const user = await ensureSignedIn();
        if (!current()) return;
        publicPart.current = null;
        handPart.current = null;
        let publicReady = false;
        let handReady = false;
        const ready = () => {
          if (!publicReady || !handReady) return;
          liveState.current = "live";
          retryDelay = 1000;
          setError((message) =>
            /Live updates interrupted|Live connection interrupted/.test(message)
              ? ""
              : message,
          );
        };
        unsubPublic = onSnapshot(
          doc(db, "rooms", code),
          { includeMetadataChanges: true },
          (snap) => {
            if (!current()) return;
            if (!snap.exists()) {
              if (!snap.metadata.fromCache) {
                clearSession();
                setError("This room has ended. Create or join another table.");
              }
              return;
            }
            publicReady = !snap.metadata.fromCache;
            ready();
            publicPart.current = snap.data() as PublicDoc;
            remerge();
          },
          fail,
        );
        unsubHand = onSnapshot(
          doc(db, "rooms", code, "hands", user.uid),
          { includeMetadataChanges: true },
          (snap) => {
            if (!current()) return;
            if (!snap.exists()) {
              resync.current();
              return;
            }
            handReady = !snap.metadata.fromCache;
            ready();
            handPart.current = snap.data() as HandDoc;
            remerge();
          },
          fail,
        );
      } catch (error) {
        fail(error);
      }
    };
    void subscribe();
    return () => {
      stopped = true;
      clearTimeout(retry);
      unsubPublic?.();
      unsubHand?.();
    };
  }, [sessionVersion, remerge, clearSession]);

  // Keep this seat alive on the server (it prunes anyone idle for 90s) even
  // while just waiting out someone else's turn, and give every client a
  // resync in case a realtime update was ever missed — the game otherwise
  // looks stuck until a manual refresh. A backgrounded tab (e.g. a phone
  // screen that dimmed while waiting for your turn) can have its interval
  // timers and its Firestore listen stream both throttled or stalled by the
  // browser, so on top of the periodic ping, force an immediate resync the
  // moment the tab regains focus/visibility — the same thing a manual
  // refresh would give you, without needing the reload.
  useEffect(() => {
    if (!session.current) return;
    const activeSession = session.current;
    let stopped = false;
    let inFlight = false;
    let failures = 0;
    let nextCheck = 0;
    let terminal = false;
    const ping = async () => {
      if (
        stopped ||
        terminal ||
        inFlight ||
        actionPending.current ||
        session.current !== activeSession ||
        !navigator.onLine
      )
        return;
      inFlight = true;
      try {
        const data = await request("sync");
        if (stopped || session.current !== activeSession) return;
        if (data.snapshot) {
          apply(data.snapshot);
          void syncVoice(data.snapshot).catch(() => {});
        }
        failures = 0;
        setError((message) =>
          /^(Connection interrupted|You’re offline)/.test(message) ? "" : message,
        );
      } catch (error) {
        if (stopped || session.current !== activeSession) return;
        if (isExpiredSession(error)) {
          terminal = true;
          clearSession();
          setError("Your table session ended. Please create or join a table again.");
        } else if (!isRetryableRequest(error)) {
          terminal = true;
          setError(
            error instanceof Error ? error.message : "Unable to reconnect to this table.",
          );
        } else if (++failures >= 2) {
          setError("Connection interrupted. Reconnecting…");
        }
      } finally {
        inFlight = false;
        nextCheck =
          Date.now() +
          (failures
            ? Math.min(2000 * 2 ** failures, 15000)
            : liveState.current === "live"
              ? 10000
              : 2000);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void ping();
    };
    const offline = () =>
      setError("You’re offline. Reconnecting when your network returns…");
    resync.current = () => {
      void ping();
    };
    void ping();
    const interval = setInterval(() => {
      if (Date.now() >= nextCheck) void ping();
    }, 1000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onVisible);
    window.addEventListener("offline", offline);
    return () => {
      stopped = true;
      resync.current = () => {};
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onVisible);
      window.removeEventListener("offline", offline);
    };
  }, [sessionVersion, request, apply, syncVoice, clearSession]);

  useEffect(() => () => stopVoice(), [stopVoice]);

  async function act(action: RoomAction, extra: Record<string, unknown> = {}) {
    if (actionPending.current) return;
    actionPending.current = true;
    setError("");
    setBusy(true);
    try {
      await ensureSignedIn();
      const data = await request(action, extra);
      if (data.token && data.snapshot) {
        session.current = {
          code: data.snapshot.code,
          token: data.token,
          self: data.snapshot.self,
        };
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
      if (action === "leave") clearSession();
    } catch (e) {
      if (isExpiredSession(e)) clearSession();
      setError(e instanceof Error ? e.message : "Something went wrong");
      actionPending.current = false;
      if (isRetryableRequest(e)) resync.current();
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
