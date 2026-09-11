import { unoAction, type Input, type Room } from "./server";

export class StorageError extends Error {}
const PREFIX = "uno:v1:";
const INDEX = PREFIX + "public";
// Compare and replace the complete room plus its matchmaking entry atomically.
// Concurrent requests retry against fresh state; no process-local lock is used.
const COMMIT = `
local current = redis.call('GET', KEYS[1])
if (current or '') ~= ARGV[1] then return 0 end
if ARGV[2] == '' then
 redis.call('DEL', KEYS[1])
 redis.call('ZREM', KEYS[2], ARGV[3])
else
 redis.call('SET', KEYS[1], ARGV[2], 'EX', 1800)
 if ARGV[4] == '1' then
  redis.call('ZADD', KEYS[2], ARGV[5], ARGV[3])
 else redis.call('ZREM', KEYS[2], ARGV[3]) end
end
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', ARGV[6])
return 1
`;
async function command<T>(args: (string | number)[]): Promise<T> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token)
    throw new StorageError(
      "Multiplayer storage is not configured. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel and redeploy.",
    );
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error("Redis request failed");
    return data.result as T;
  } catch {
    throw new StorageError(
      "Multiplayer storage is temporarily unavailable. Please try again.",
    );
  }
}
export async function storedUnoAction(input: Input) {
  const configured = !!(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
  if (!configured && !process.env.VERCEL) return unoAction(input);
  if (!configured)
    throw new StorageError(
      "Multiplayer storage is not configured. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel and redeploy.",
    );
  for (let attempt = 0; attempt < 12; attempt++) {
    const store = new Map<string, Room>();
    let raw: string | null = null;
    let code = input.code;
    let action = input;
    if (input.action === "quick") {
      const codes = await command<string[]>([
        "ZREVRANGEBYSCORE",
        INDEX,
        "+inf",
        Date.now() - 20000,
        "LIMIT",
        0,
        20,
      ]);
      for (const candidate of codes) {
        const value = await command<string | null>(["GET", PREFIX + candidate]);
        if (!value) continue;
        const room = JSON.parse(value) as Room;
        if (room.public && room.phase === "lobby" && room.players.length < 8) {
          code = candidate;
          raw = value;
          store.set(code, room);
          action = { ...input, action: "join", code };
          break;
        }
      }
      if (!raw) action = { ...input, action: "create", public: true };
    } else if (input.action !== "create") {
      raw = await command<string | null>(["GET", PREFIX + code]);
      if (raw) store.set(code!, JSON.parse(raw));
    }
    const result = unoAction(action, store);
    if (result.snapshot) code = result.snapshot.code;
    const room = store.get(code!);
    const committed = await command<number>([
      "EVAL",
      COMMIT,
      2,
      PREFIX + code,
      INDEX,
      raw ?? "",
      room ? JSON.stringify(room) : "",
      code!,
      room?.public && room.phase === "lobby" && room.players.length < 8 ? "1" : "0",
      Date.now(),
      Date.now() - 1800000,
    ]);
    if (committed === 1) return result;
    await new Promise((resolve) => setTimeout(resolve, 10 + Math.random() * 30));
  }
  throw new StorageError("The table is busy. Please try your move again.");
}
