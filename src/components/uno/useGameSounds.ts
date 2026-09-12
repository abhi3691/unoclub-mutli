"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Snapshot } from "@/uno/types";

type Sound = "play" | "draw" | "turn" | "uno" | "finish" | "deal";
const notes: Record<Sound, number[]> = {
  play: [420, 260],
  draw: [220, 340],
  turn: [523, 784],
  uno: [659, 880, 1047],
  finish: [523, 659, 784, 1047],
  deal: [260, 330, 390],
};

export function useGameSounds(room: Snapshot | null) {
  const [enabled, setEnabled] = useState(true);
  const enabledRef = useRef(true);
  const context = useRef<AudioContext | null>(null);
  const previous = useRef<Snapshot | null>(null);
  const interacted = useRef(false);
  const spoken = useRef<string | null>(null);
  const active = useRef(new Set<OscillatorNode>());

  const play = useCallback((sound: Sound) => {
    const ctx = context.current;
    if (!enabledRef.current || !ctx || ctx.state !== "running" || document.hidden) return;
    const now = ctx.currentTime;
    notes[sound].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + index * 0.085;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.075, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      active.current.add(oscillator);
      oscillator.onended = () => {
        active.current.delete(oscillator);
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(start);
      oscillator.stop(start + 0.13);
    });
  }, []);

  useEffect(() => {
    try {
      enabledRef.current = localStorage.getItem("uno-sounds") !== "off";
      setEnabled(enabledRef.current);
    } catch {
      /* Storage can be unavailable in private browsing. */
    }
    const unlock = () => {
      interacted.current = true;
      if (!enabledRef.current) return;
      try {
        context.current ??= new AudioContext();
        if (context.current.state === "suspended")
          void context.current.resume().catch(() => {});
      } catch {
        /* Gameplay remains available without audio support. */
      }
    };
    const silence = () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      for (const oscillator of active.current) oscillator.stop();
    };
    const visibility = () => {
      if (document.hidden) silence();
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      document.removeEventListener("visibilitychange", visibility);
      silence();
      void context.current?.close().catch(() => {});
      context.current = null;
    };
  }, []);

  useEffect(() => {
    const old = previous.current;
    previous.current = room;
    if (!room || !old || old.code !== room.code || room.revision <= old.revision) return;
    const warning = room.unoWarning;
    if (warning && warning.id !== old.unoWarning?.id && warning.id !== spoken.current) {
      spoken.current = warning.id;
      if (
        enabledRef.current &&
        interacted.current &&
        !document.hidden &&
        Date.now() - warning.at < 15000 &&
        "speechSynthesis" in window
      ) {
        const message = new SpeechSynthesisUtterance(
          `${warning.name} forgot to call UNO. Draw two cards.`,
        );
        message.lang = "en-US";
        message.rate = 0.95;
        message.volume = 0.8;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(message);
      }
    }
    if (room.phase === "finished" && old.phase !== "finished") play("finish");
    else if (room.phase === "playing" && old.phase !== "playing") play("deal");
    else if (room.phase === "playing") {
      if (room.turn === room.self && old.turn !== room.self) play("turn");
      else if (room.top?.id !== old.top?.id) play("play");
      else if (
        room.players.some(
          (p) => p.count > (old.players.find((o) => o.id === p.id)?.count ?? p.count),
        )
      )
        play("draw");
    }
  }, [room, play]);

  function toggle() {
    const next = !enabledRef.current;
    enabledRef.current = next;
    setEnabled(next);
    try {
      localStorage.setItem("uno-sounds", next ? "on" : "off");
    } catch {}
    if (!next) {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      for (const oscillator of active.current) oscillator.stop();
      return;
    }
    try {
      context.current ??= new AudioContext();
      void context.current
        .resume()
        .then(() => play("turn"))
        .catch(() => {});
    } catch {}
  }
  return { enabled, toggle, play };
}
