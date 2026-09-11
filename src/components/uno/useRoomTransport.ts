"use client";
import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { RoomRequest } from "./useUnoGame";
type Session = { code: string; token: string };
type Result = Awaited<ReturnType<RoomRequest>>;
export function useRoomTransport(
  session: RefObject<Session | null>,
  cursor: RefObject<number>,
) {
  const socket = useRef<WebSocket | null>(null);
  const sequence = useRef(0);
  const pending = useRef(
    new Map<
      number,
      {
        input: unknown;
        resolve: (result: Result) => void;
        reject: (error: Error) => void;
        timer: ReturnType<typeof setTimeout>;
      }
    >(),
  );
  const wake = useRef<(() => void) | null>(null);
  const socketSession = useRef<string | null>(null);
  const sendHttp = useCallback(async (input: unknown) => {
    const response = await fetch("/api/uno", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify(input),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data as Result;
  }, []);
  useEffect(() => {
    let stopped = false;
    let retry: ReturnType<typeof setTimeout>;
    let delay = 1000;
    const rejectPending = () => {
      // The socket died before these moves got a reply. Every mutating action here
      // is safe to retry (replaying an already-applied move fails a clean state
      // check rather than double-applying), so fall back to HTTP instead of
      // surfacing a scary error for a routine reconnect.
      const tasks = [...pending.current.values()];
      pending.current.clear();
      for (const task of tasks) {
        clearTimeout(task.timer);
        sendHttp(task.input).then(task.resolve, task.reject);
      }
    };
    const connect = () => {
      if (stopped) return;
      const ws = new WebSocket(
        `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/uno/socket`,
      );
      socket.current = ws;
      socketSession.current = null;
      ws.onopen = () => {
        delay = 1000;
        wake.current?.();
      };
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "changed") {
            wake.current?.();
            return;
          }
          const task = pending.current.get(message.id);
          if (!task) return;
          clearTimeout(task.timer);
          pending.current.delete(message.id);
          if (message.error) task.reject(new Error(message.error));
          else task.resolve(message.result);
        } catch {
          ws.close(1002, "Invalid response");
        }
      };
      ws.onerror = () => ws.close();
      ws.onclose = (event) => {
        if (socket.current === ws) socket.current = null;
        socketSession.current = null;
        rejectPending();
        if (!stopped) {
          // Code 4000 is our own routine recycle (ahead of the host's function time
          // limit), not a failure, so reconnect immediately instead of backing off.
          const nextDelay = event.code === 4000 ? 250 : delay;
          retry = setTimeout(connect, nextDelay);
          delay = Math.min(delay * 2, 30000);
        }
      };
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      socket.current?.close();
      rejectPending();
    };
  }, [sendHttp]);
  const request = useCallback<RoomRequest>(
    async (action, extra = {}) => {
      const input = { ...session.current, action, after: cursor.current, ...extra };
      const ws = socket.current;
      // Room creation stays HTTP; sockets bind to an existing session on first sync.
      if (
        ws?.readyState === WebSocket.OPEN &&
        session.current &&
        !["create", "join", "quick"].includes(action)
      ) {
        const key = session.current.code + session.current.token;
        if (socketSession.current && socketSession.current !== key) {
          ws.close();
        } else {
          socketSession.current = key;
          const id = ++sequence.current;
          return await new Promise<Result>((resolve, reject) => {
            const timer = setTimeout(() => {
              pending.current.delete(id);
              // No reply within 10s (e.g. the experimental socket bridge wedged
              // silently). The move is safe to resend over HTTP: replaying an
              // already-applied action fails a clean state check server-side
              // rather than double-applying.
              sendHttp(input).then(resolve, reject);
              ws.close();
            }, 10000);
            pending.current.set(id, { input, resolve, reject, timer });
            try {
              ws.send(JSON.stringify({ id, input }));
            } catch {
              clearTimeout(timer);
              pending.current.delete(id);
              sendHttp(input).then(resolve, reject);
            }
          });
        }
      }
      return await sendHttp(input);
    },
    [session, cursor, sendHttp],
  );
  return { request, wake };
}
