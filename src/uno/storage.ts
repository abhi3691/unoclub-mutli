import type { Transaction } from "firebase-admin/firestore";
import { db } from "@/firebase/admin";
import { unoAction, type Input, type Room } from "./server";

export class StorageError extends Error {}
/** Marks a rejection as a game-rule validation failure (from `unoAction`/`fail`),
 * so it can pass through as a plain 400 instead of being mistaken for infra trouble. */
class GameRuleError extends Error {}

type PublicPlayer = {
  id: string;
  uid: string;
  name: string;
  voice: boolean;
  seen: number;
  count: number;
};
type PublicRoom = Omit<Room, "players" | "deck" | "signals"> & { players: PublicPlayer[] };
type HandDoc = { playerId: string; hand: Room["deck"]; token: string; signals: Room["signals"] };

const rooms = () => db().collection("rooms");
const handsOf = (code: string) => rooms().doc(code).collection("hands");
const secretOf = (code: string) => rooms().doc(code).collection("secret").doc("state");

/** Reconstructs the full in-memory Room (private hand/token/deck included) from Firestore. */
async function loadRoom(tx: Transaction, code: string): Promise<Room | null> {
  const publicSnap = await tx.get(rooms().doc(code));
  if (!publicSnap.exists) return null;
  const pub = publicSnap.data() as PublicRoom;
  const secretSnap = await tx.get(secretOf(code));
  const deck = (secretSnap.data()?.deck as Room["deck"]) ?? [];
  const handSnaps = await Promise.all(
    pub.players.map((p) => tx.get(handsOf(code).doc(p.uid))),
  );
  const signals: Room["signals"] = [];
  const players = pub.players.map((p, i) => {
    const hand = handSnaps[i]!.data() as HandDoc | undefined;
    signals.push(...(hand?.signals ?? []));
    return { ...p, hand: hand?.hand ?? [], token: hand?.token ?? "" };
  });
  return { ...pub, players, deck, signals };
}

/** Writes every part of a mutated Room back to Firestore (public + per-player private). */
function saveRoom(tx: Transaction, code: string, before: Room | null, room: Room) {
  const { players, deck, signals, ...rest } = room;
  const publicPlayers: PublicPlayer[] = players.map((p) => ({
    id: p.id,
    uid: p.uid,
    name: p.name,
    voice: p.voice,
    seen: p.seen,
    count: p.hand.length,
  }));
  tx.set(rooms().doc(code), { ...rest, players: publicPlayers });
  tx.set(secretOf(code), { deck });
  for (const p of players) {
    const mine = signals.filter((s) => s.to === p.id).slice(-50);
    const doc: HandDoc = { playerId: p.id, hand: p.hand, token: p.token, signals: mine };
    tx.set(handsOf(code).doc(p.uid), doc);
  }
  // Clean up any players who left/were removed this turn (stale hand docs are
  // harmless security-wise but no reason to keep them around).
  const stillHere = new Set(players.map((p) => p.uid));
  for (const p of before?.players ?? [])
    if (!stillHere.has(p.uid)) tx.delete(handsOf(code).doc(p.uid));
}

function deleteRoom(tx: Transaction, code: string, before: Room) {
  tx.delete(rooms().doc(code));
  tx.delete(secretOf(code));
  for (const p of before.players) tx.delete(handsOf(code).doc(p.uid));
}

async function findQuickMatchCandidate(): Promise<string | null> {
  const cutoff = Date.now() - 20000;
  const snap = await rooms()
    .where("public", "==", true)
    .where("phase", "==", "lobby")
    .orderBy("updated", "desc")
    .limit(20)
    .get();
  for (const doc of snap.docs) {
    const data = doc.data() as PublicRoom;
    if (data.updated > cutoff && data.players.length < 8) return doc.id;
  }
  return null;
}

export async function storedUnoAction(input: Input) {
  if (!process.env.FIRESTORE_EMULATOR_HOST && !process.env.FIREBASE_CLIENT_EMAIL)
    throw new StorageError(
      "Multiplayer storage is not configured. Add the Firebase Admin credentials " +
        "in Vercel and redeploy.",
    );
  let hint: string | null = null;
  if (input.action === "quick") hint = await findQuickMatchCandidate();

  try {
    return await db().runTransaction(async (tx) => {
      let code = input.action === "create" ? null : (hint ?? input.code ?? null);
      let action: Input = input;
      let before: Room | null = null;

      if (input.action !== "create") {
        before = code ? await loadRoom(tx, code) : null;
        if (input.action === "quick") {
          const stillValid =
            before && before.phase === "lobby" && before.players.length < 8;
          action = stillValid
            ? { ...input, action: "join", code: code! }
            : { ...input, action: "create", public: true };
          if (!stillValid) {
            code = null;
            before = null;
          }
        }
      }

      const store = new Map<string, Room>();
      if (code && before) store.set(code, before);
      let result: Awaited<ReturnType<typeof unoAction>>;
      try {
        result = unoAction(action, store);
      } catch (e) {
        throw new GameRuleError(e instanceof Error ? e.message : "Invalid move");
      }
      const finalCode = result.snapshot?.code ?? code;
      if (!finalCode) return result;

      const after = store.get(finalCode) ?? null;
      if (before && !after) deleteRoom(tx, finalCode, before);
      else if (after) saveRoom(tx, finalCode, before, after);
      return result;
    });
  } catch (e) {
    if (e instanceof GameRuleError) throw new Error(e.message);
    if (e instanceof StorageError) throw e;
    throw new StorageError("The table is busy. Please try your move again.");
  }
}
