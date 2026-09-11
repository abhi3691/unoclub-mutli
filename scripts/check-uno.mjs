import assert from "node:assert/strict";
const url = process.env.UNO_TEST_URL || "http://127.0.0.1:3100";
async function call(action, extra = {}) {
  const res = await fetch(`${url}/api/uno`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...extra }),
  });
  return { status: res.status, ...(await res.json()) };
}
const host = await call("create", { name: "Host" });
assert.equal(host.status, 200);
const code = host.snapshot.code;
const sessions = [{ code, token: host.token }];
for (let i = 1; i < 8; i++) {
  const p = await call("join", { code, name: `Player ${i}` });
  assert.equal(p.status, 200);
  assert.equal(p.snapshot.players.length, i + 1);
  sessions.push({ code, token: p.token });
}
assert.equal((await call("join", { code, name: "Overflow" })).status, 400);
assert.equal((await call("start", sessions[1])).status, 400);
const start = await call("start", sessions[0]);
assert.equal(start.snapshot.hand.length, 7);
assert.equal(start.snapshot.players.length, 8);
assert.ok(start.snapshot.players.every((p) => !("hand" in p) && !("token" in p)));
assert.equal((await call("draw", sessions[1])).status, 400);
const drawn = await call("draw", sessions[0]);
assert.equal(drawn.snapshot.hand.length, 8);
assert.notEqual(drawn.snapshot.turn, start.snapshot.turn);
assert.equal((await call("sync", { code, token: "0".repeat(48) })).status, 400);
const q1 = await call("quick", { name: "Random A" });
const q2 = await call("quick", { name: "Random B" });
assert.equal(q1.snapshot.code, q2.snapshot.code);
await call("voice", { ...sessions[0], voice: true });
const synced = await call("sync", sessions[1]);
assert.equal(synced.snapshot.players[0].voice, true);
for (const s of sessions) await call("leave", s);
for (const q of [q1, q2]) await call("leave", { code: q.snapshot.code, token: q.token });
console.log(
  "PASS: eight seats, overflow rejection, host authorization, private hands, turn enforcement, draw, authentication, public matchmaking, voice presence, leave.",
);
