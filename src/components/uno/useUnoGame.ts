"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Card, Snapshot } from "@/uno/types";
import { useRoomTransport } from "./useRoomTransport";
import { useVoiceConnection } from "./useVoiceConnection";
export type RoomRequest = (
  action: string,
  extra?: Record<string, unknown>,
) => Promise<{ token?: string; snapshot?: Snapshot; left?: boolean }>;
export function useUnoGame() {
  const [name, setName] = useState(""),
    [code, setCode] = useState(""),
    [room, setRoom] = useState<Snapshot | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("quick"),
    [rules, setRules] = useState(false),
    [wild, setWild] = useState<Card | null>(null),
    [uno, setUno] = useState(false);
  const session = useRef<{ code: string; token: string } | null>(null),
    latest = useRef<Snapshot | null>(null),
    cursor = useRef(0),
    processing = useRef(false),
    actionPending = useRef(false);
  const { request, wake } = useRoomTransport(session, cursor);
  const { mic, muted, voiceStatus, stopVoice, syncVoice, startVoice, toggleMute } =
    useVoiceConnection(request, cursor);
  const apply = useCallback((s: Snapshot) => {
    if (latest.current?.code === s.code && latest.current.revision > s.revision) return;
    latest.current = s;
    setRoom(s);
  }, []);
  useEffect(() => {
    const saved = sessionStorage.getItem("uno-session");
    if (saved) {
      try {
        session.current = JSON.parse(saved);
      } catch {
        sessionStorage.removeItem("uno-session");
      }
    }
    const sync = async () => {
      if (!session.current || processing.current || actionPending.current) return;
      processing.current = true;
      try {
        const activeSession = session.current;
        const data = await request("sync");
        if (session.current !== activeSession) return;
        const s = data.snapshot;
        if (!s) return;
        apply(s);
        await syncVoice(s);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Connection interrupted");
      } finally {
        processing.current = false;
      }
    };
    wake.current = () => {
      void sync();
    };
    const timer = setInterval(sync, 400);
    return () => {
      clearInterval(timer);
      wake.current = null;
      stopVoice();
    };
  }, [apply, request, stopVoice, syncVoice, wake]);
  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (actionPending.current) return;
    actionPending.current = true;
    setError("");
    setBusy(true);
    try {
      const data = await request(action, extra);
      if (data.token && data.snapshot) {
        session.current = { code: data.snapshot.code, token: data.token };
        sessionStorage.setItem("uno-session", JSON.stringify(session.current));
        cursor.current = 0;
      }
      if (data.snapshot) apply(data.snapshot);
      if (action === "play") {
        setWild(null);
        setUno(false);
      }
      if (action === "leave") {
        stopVoice();
        session.current = null;
        latest.current = null;
        sessionStorage.removeItem("uno-session");
        setRoom(null);
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
