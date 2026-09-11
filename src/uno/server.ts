import { randomBytes, randomInt } from "node:crypto";
import type { Card, Color, Signal, Snapshot } from "./types";
type Player = {
  id: string;
  token: string;
  uid: string;
  name: string;
  hand: Card[];
  voice: boolean;
  seen: number;
};
export type Room = {
  revision?: number;
  pendingDraw: number;
  drawnThisTurn: boolean;
  code: string;
  host: string;
  public: boolean;
  phase: Snapshot["phase"];
  players: Player[];
  deck: Card[];
  discard: Card[];
  color: Color;
  turn: string;
  direction: number;
  winner: string | null;
  standings: string[];
  matchOver: boolean;
  log: string[];
  signals: Signal[];
  seq: number;
  updated: number;
};
/** Players still in the running for a placement — everyone not already ranked. */
function activePlayers(r: Room): Player[] {
  const ranked = r.standings ?? [];
  return r.players.filter((p) => !ranked.includes(p.id));
}
const g = globalThis as typeof globalThis & { unoRooms?: Map<string, Room> };
const rooms = (g.unoRooms ??= new Map<string, Room>());
export type Input = {
  action: string;
  name?: string;
  code?: string;
  token?: string;
  uid?: string;
  public?: boolean;
  card?: string;
  color?: Color;
  uno?: boolean;
  voice?: boolean;
  after?: number;
  to?: string;
  data?: Signal["data"];
};
function fail(message: string): never {
  throw new Error(message);
}
function shuffle(cards: Card[]) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
function deck() {
  const cards: Card[] = [];
  const add = (color: Card["color"], value: string) =>
    cards.push({ id: randomBytes(6).toString("hex"), color, value });
  for (const color of ["red", "yellow", "green", "blue"] as Color[]) {
    add(color, "0");
    for (let copy = 0; copy < 2; copy++)
      for (const value of [
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "skip",
        "reverse",
        "+2",
      ])
        add(color, value);
  }
  for (let i = 0; i < 4; i++) {
    add("wild", "wild");
    add("wild", "+4");
  }
  return shuffle(cards);
}
function draw(r: Room, p: Player, n = 1) {
  for (let i = 0; i < n; i++) {
    if (!r.deck.length && r.discard.length > 1) {
      const top = r.discard.pop()!;
      r.deck = shuffle(r.discard);
      r.discard = [top];
    }
    const c = r.deck.pop();
    if (c) p.hand.push(c);
  }
}
function advance(r: Room, n = 1) {
  const active = activePlayers(r);
  const index = active.findIndex((p) => p.id === r.turn);
  r.turn =
    active[(index + n * r.direction + active.length * 10) % active.length]?.id ?? "";
  r.drawnThisTurn = false;
}
function playable(r: Room, c: Card) {
  const top = r.discard.at(-1);
  return c.color === "wild" || c.color === r.color || (!!top && c.value === top.value);
}
function log(r: Room, s: string) {
  r.log = [s, ...r.log].slice(0, 15);
}
function snapshot(r: Room, p: Player, after = 0): Snapshot {
  r.revision = (r.revision ?? 0) + 1;
  return {
    revision: r.revision,
    pendingDraw: r.pendingDraw ?? 0,
    drawnThisTurn: r.turn === p.id && r.drawnThisTurn,
    code: r.code,
    self: p.id,
    host: r.host,
    public: r.public,
    phase: r.phase,
    players: r.players.map((x) => ({
      id: x.id,
      name: x.name,
      count: x.hand.length,
      voice: x.voice,
      connected: Date.now() - x.seen < 20000,
    })),
    hand: p.hand,
    top: r.discard.at(-1) ?? null,
    color: r.color,
    turn: r.turn,
    direction: r.direction,
    winner: r.winner,
    standings: r.standings ?? [],
    matchOver: r.matchOver ?? false,
    log: r.log,
    signals: r.signals.filter((s) => s.to === p.id && s.id > after),
  };
}
export function unoAction(input: Input, store = rooms) {
  const rooms = store;
  const now = Date.now();
  for (const [code, r] of rooms) if (now - r.updated > 1800000) rooms.delete(code);
  let r = rooms.get(input.code ?? "");
  if (input.action === "create" || input.action === "quick") {
    if (input.action === "quick")
      r = [...rooms.values()].find(
        (x) =>
          x.public &&
          x.phase === "lobby" &&
          x.players.length < 8 &&
          now - x.updated < 20000,
      );
    if (!r) {
      if (rooms.size >= 200) fail("All tables are busy. Try again shortly.");
      let code: string;
      do {
        code = randomBytes(3).toString("hex").toUpperCase();
      } while (rooms.has(code));
      r = {
        pendingDraw: 0,
        drawnThisTurn: false,
        code,
        host: "",
        public: input.action === "quick" || !!input.public,
        phase: "lobby",
        players: [],
        deck: [],
        discard: [],
        color: "red",
        turn: "",
        direction: 1,
        winner: null,
        standings: [],
        matchOver: false,
        log: [],
        signals: [],
        seq: 0,
        updated: now,
      };
      rooms.set(code, r);
    }
  }
  if (!r) fail("Room not found. Check your six-character code.");
  if (["create", "quick", "join"].includes(input.action)) {
    if (!input.uid) fail("Not signed in yet. Please try again in a moment.");
    if (r.phase !== "lobby") fail("This round has started. Join another table.");
    if (r.players.length >= 8) fail("This room is full (8 players).");
    if (r.players.some((x) => x.uid === input.uid))
      fail("You're already seated at this table.");
    const p: Player = {
      id: randomBytes(8).toString("hex"),
      token: randomBytes(24).toString("hex"),
      uid: input.uid,
      name: input.name?.trim().slice(0, 20) || "Player",
      hand: [],
      voice: false,
      seen: now,
    };
    r.players.push(p);
    r.host ||= p.id;
    r.updated = now;
    log(r, `${p.name} joined the table`);
    return { token: p.token, snapshot: snapshot(r, p) };
  }
  const p = r.players.find((x) => x.token === input.token);
  if (!p) fail("Your session expired. Please join again.");
  p.seen = now;
  r.updated = now;
  // Remove abandoned seats and pass their turn, so a closed browser cannot block a match.
  for (const absent of [...r.players])
    if (now - absent.seen > 90000) {
      if (r.turn === absent.id) advance(r);
      r.players = r.players.filter((x) => x !== absent);
      r.deck.push(...absent.hand);
      if (r.host === absent.id) r.host = r.players[0]?.id ?? "";
      log(r, `${absent.name} disconnected`);
    }
  if (input.action === "ping") {
    // No-op: reaching here already refreshed `seen` and ran the stale-player
    // sweep above, and we always return a fresh snapshot below. Lets an idle
    // player (e.g. waiting out someone else's long turn) avoid being pruned
    // as disconnected, and gives every client a periodic resync as a
    // safety net if a realtime update is ever missed.
  }
  if (input.action === "leave") {
    if (r.turn === p.id) advance(r);
    r.players = r.players.filter((x) => x !== p);
    r.deck.push(...p.hand);
    if (r.host === p.id) r.host = r.players[0]?.id ?? "";
    if (!r.players.length) rooms.delete(r.code);
    return { left: true };
  }
  if (input.action === "start") {
    if (p.id !== r.host) fail("Only the host can deal.");
    if (r.phase === "playing") fail("A round is already in progress.");
    // A finished round with standings still open (not skipped, not everyone
    // ranked yet) continues the match: only the still-unranked players are
    // dealt back in to decide the remaining placements. Anything else — the
    // lobby, or a match that finished/was skipped — starts a fresh match.
    const continuing = r.phase === "finished" && !r.matchOver && r.standings.length > 0;
    if (!continuing) {
      r.standings = [];
      r.matchOver = false;
    }
    const active = continuing ? activePlayers(r) : r.players;
    if (active.length < 2) fail("Invite at least one more player.");
    r.pendingDraw = 0;
    r.drawnThisTurn = false;
    r.deck = deck();
    r.discard = [];
    r.direction = 1;
    r.winner = null;
    for (const x of r.players) x.hand = [];
    for (const x of active) draw(r, x, 7);
    // Only a Wild or Wild +4 is invalid as the opening card and gets redrawn;
    // every other card keeps its usual effect on who plays first (below).
    let top = r.deck.pop()!;
    while (top.color === "wild") {
      r.deck.unshift(top);
      top = r.deck.pop()!;
    }
    r.discard = [top];
    r.color = top.color as Color;
    r.turn = active[0].id;
    r.phase = "playing";
    log(
      r,
      continuing
        ? `Next round dealt for ${active.map((x) => x.name).join(", ")}!`
        : "Cards dealt. Let’s play!",
    );
    if (top.value === "skip") {
      log(r, `Opening skip: ${active[0].name} loses their turn`);
      advance(r);
    } else if (top.value === "reverse") {
      r.direction = -1;
      log(r, "Opening reverse: play starts in the other direction");
    } else if (top.value === "+2") {
      draw(r, active[0], 2);
      log(r, `Opening +2: ${active[0].name} draws 2 and is skipped`);
      advance(r);
    }
  }
  if (input.action === "skipRanking") {
    if (p.id !== r.host) fail("Only the host can skip.");
    if (r.phase !== "finished" || r.matchOver) fail("Nothing to skip right now.");
    r.matchOver = true;
    log(r, "Ranking skipped — standings are final.");
  }
  if (input.action === "pass") {
    if (r.phase !== "playing" || r.turn !== p.id) fail("Wait for your turn.");
    if (!r.drawnThisTurn) fail("Draw a card before passing.");
    log(r, `${p.name} passed`);
    advance(r);
  }
  if (input.action === "play" || input.action === "draw") {
    if (r.phase !== "playing" || r.turn !== p.id) fail("Wait for your turn.");
    if (input.action === "draw") {
      if (r.pendingDraw) {
        const count = r.pendingDraw;
        draw(r, p, count);
        r.pendingDraw = 0;
        log(r, `${p.name} drew ${count} ${count === 1 ? "card" : "cards"}`);
        advance(r);
      } else {
        if (r.drawnThisTurn) fail("You already drew. Play your card or pass.");
        const before = p.hand.length;
        draw(r, p, 1);
        const c = p.hand.length > before ? p.hand.at(-1)! : null;
        if (c && playable(r, c)) {
          r.drawnThisTurn = true;
          log(r, `${p.name} drew a card and can play it`);
        } else {
          log(r, `${p.name} drew a card and missed their turn`);
          advance(r);
        }
      }
    } else {
      const c = p.hand.find((x) => x.id === input.card);
      if (!c) fail("That card is not in your hand.");
      const top = r.discard.at(-1)!;
      if (r.pendingDraw && c.value !== top.value)
        fail(`Stack a ${top.value} or draw ${r.pendingDraw} cards.`);
      if (c.color !== "wild" && c.color !== r.color && c.value !== top.value)
        fail("Match the color or symbol, or play a wild.");
      if (c.value === "+4" && !r.pendingDraw && p.hand.some((x) => x.color === r.color))
        fail("Play your matching color before a Wild +4.");
      if (c.color === "wild" && !input.color) fail("Choose a color for your wild.");
      p.hand = p.hand.filter((x) => x !== c);
      r.discard.push(c);
      r.color = c.color === "wild" ? input.color! : c.color;
      log(r, `${p.name} played ${c.color} ${c.value}`);
      if (p.hand.length === 1 && !input.uno) {
        draw(r, p, 2);
        log(r, `${p.name} forgot UNO! +2 cards`);
      } else if (p.hand.length === 1) log(r, `${p.name} called UNO!`);
      if (c.value === "reverse") r.direction *= -1;
      advance(r);
      if (c.value === "+2" || c.value === "+4") {
        r.pendingDraw = (r.pendingDraw || 0) + (c.value === "+2" ? 2 : 4);
        log(r, `Draw penalty: ${r.pendingDraw} cards. Stack ${c.value} or draw.`);
      } else if (c.value === "skip" || (c.value === "reverse" && activePlayers(r).length === 2))
        advance(r);
      if (!p.hand.length) {
        r.standings = [...r.standings, p.id];
        const remaining = r.players.filter((x) => !r.standings.includes(x.id));
        r.phase = "finished";
        r.winner = p.id;
        if (remaining.length <= 1) {
          if (remaining.length === 1) r.standings.push(remaining[0].id);
          r.matchOver = true;
          log(r, `${p.name} takes place #${r.standings.indexOf(p.id) + 1}. Standings are final!`);
        } else {
          r.matchOver = false;
          log(
            r,
            `${p.name} takes place #${r.standings.length}! ${remaining
              .map((x) => x.name)
              .join(" & ")} play on for the rest.`,
          );
        }
      }
    }
  }
  if (input.action === "voice") {
    p.voice = !!input.voice;
  }
  if (input.action === "signal") {
    if (!input.to || !input.data || !r.players.some((x) => x.id === input.to))
      fail("Voice peer unavailable.");
    r.signals.push({ id: ++r.seq, from: p.id, to: input.to, data: input.data });
    r.signals = r.signals.slice(-500);
  }
  if (r.phase === "playing" && r.players.length === 1) {
    r.phase = "finished";
    r.winner = r.players[0].id;
    if (!r.standings.includes(r.players[0].id)) r.standings = [...r.standings, r.players[0].id];
    r.matchOver = true;
  }
  return { snapshot: snapshot(r, p, input.after) };
}
