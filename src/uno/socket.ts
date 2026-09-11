import type { WebSocket, RawData } from "ws";
import { roomActionSchema } from "./schema";
import { storedUnoAction } from "./storage";

const subscribers = new Map<WebSocket, string>();
const HEARTBEAT_MS = 20000;
// Recycle well before the socket route's 300s maxDuration, so Vercel never force-kills
// the function mid-request; the client reconnects instantly on this close code.
const RECYCLE_MS = 270000;
const RECYCLE_CODE = 4000;
/** Each socket receives only its own authenticated response, never another hand. */
export function handleRoomSocket(socket: WebSocket) {
  let queue = Promise.resolve();
  let queued = 0;
  let windowStart = Date.now();
  let messages = 0;
  let authenticated: { code: string; token: string } | null = null;
  let alive = true;
  const send = (value: unknown) => {
    if (socket.readyState === 1) socket.send(JSON.stringify(value));
  };
  socket.on("pong", () => {
    alive = true;
  });
  // Detects half-open connections (e.g. a sleeping laptop or a dropped mobile radio)
  // that never fire a close event on their own, so the client can reconnect instead
  // of a move silently hanging.
  const heartbeat = setInterval(() => {
    if (!alive) {
      socket.terminate();
      return;
    }
    alive = false;
    try {
      socket.ping();
    } catch {
      socket.terminate();
    }
  }, HEARTBEAT_MS);
  let recycle: ReturnType<typeof setTimeout>;
  const closeForRecycle = () => {
    // Never cut off a message that is still being processed; try again shortly.
    if (queued > 0) {
      recycle = setTimeout(closeForRecycle, 500);
      return;
    }
    socket.close(RECYCLE_CODE, "recycle");
  };
  recycle = setTimeout(closeForRecycle, RECYCLE_MS);
  const onMessage = (raw: RawData) => {
    if (Date.now() - windowStart > 1000) {
      windowStart = Date.now();
      messages = 0;
    }
    if (++messages > 50 || queued >= 24) {
      socket.close(1008, "Too many requests");
      return;
    }
    queued++;
    queue = queue
      .then(async () => {
        if (socket.readyState !== 1) return;
        let id: number | undefined;
        try {
          const message = JSON.parse(raw.toString());
          if (!Number.isSafeInteger(message.id) || message.id < 0)
            throw new Error("Invalid request ID");
          id = message.id;
          const input = roomActionSchema.parse(message.input);
          if (
            authenticated &&
            (input.code !== authenticated.code || input.token !== authenticated.token)
          )
            throw new Error("Reconnect to change rooms.");
          const result = await storedUnoAction(input);
          const code = result.snapshot?.code ?? input.code;
          if (result.snapshot) {
            authenticated = {
              code: result.snapshot.code,
              token: result.token ?? input.token!,
            };
            subscribers.set(socket, result.snapshot.code);
          }
          send({ id, result });
          if (input.action !== "sync") {
            for (const [peer, room] of subscribers)
              if (peer !== socket && room === code && peer.readyState === 1)
                peer.send(JSON.stringify({ type: "changed" }));
          }
          if (input.action === "leave") {
            authenticated = null;
            subscribers.delete(socket);
          }
        } catch (error) {
          send({
            id,
            error: error instanceof Error ? error.message : "Invalid socket request",
          });
        }
      })
      .finally(() => {
        queued--;
      });
  };
  socket.on("message", onMessage);
  socket.on("error", () => socket.close());
  socket.on("close", () => {
    clearInterval(heartbeat);
    clearTimeout(recycle);
    subscribers.delete(socket);
  });
}
