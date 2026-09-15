import { FieldValue, type Transaction } from "firebase-admin/firestore";
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
  handRevision?: number;
};
type PublicRoom = Omit<Room, "players" | "deck" | "signals"> & {
  players: PublicPlayer[];
};
type HandDoc = {
  revision?: number;
  playerId: string;
  hand: Room["deck"];
  token: string;
  signals: Room["signals"];
};

const rooms = () => db().collection("rooms");
const handsOf = (code: string) => rooms().doc(code).collection("hands");
const secretOf = (code: string) => rooms().doc(code).collection("secret").doc("state");

/** Reconstructs the full in-memory Room (private hand/token/deck included) from Firestore. */
async function loadRoom(tx: Transaction, code: string): Promise<Room | null> {
  const publicSnap = await tx.get(rooms().doc(code));
  if (!publicSnap.exists) return null;
  const pub = publicSnap.data() as PublicRoom;
  // One batched round trip for the deck doc + every hand doc, instead of one
  // round trip per document — halves the transaction's read latency.
  const [secretSnap, ...handSnaps] = await tx.getAll(
    secretOf(code),
    ...pub.players.map((p) => handsOf(code).doc(p.uid)),
  );
  const deck = (secretSnap!.data()?.deck as Room["deck"]) ?? [];
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
    handRevision: (() => {
      const previous = before?.players.find((old) => old.id === p.id);
      const changed =
        !previous ||
        JSON.stringify(previous.hand) !== JSON.stringify(p.hand) ||
        JSON.stringify(before?.signals.filter((sig) => sig.to === p.id).slice(-50)) !==
          JSON.stringify(signals.filter((sig) => sig.to === p.id).slice(-50));
      return changed
        ? (room.revision ?? 0)
        : ((previous as typeof previous & { handRevision?: number })?.handRevision ?? 0);
    })(),
  }));
  tx.set(rooms().doc(code), { ...rest, players: publicPlayers });
  if (!before || JSON.stringify(before.deck) !== JSON.stringify(deck))
    tx.set(secretOf(code), { deck });
  for (const p of players) {
    const mine = signals.filter((s) => s.to === p.id).slice(-50);
    const revision = publicPlayers.find((player) => player.id === p.id)!.handRevision;
    const doc: HandDoc = {
      revision,
      playerId: p.id,
      hand: p.hand,
      token: p.token,
      signals: mine,
    };
    const previous = before?.players.find((player) => player.id === p.id) as
      (Room["players"][number] & { handRevision?: number }) | undefined;
    if (!previous || previous.handRevision !== revision)
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

export type CommunityGame = {
  code: string;
  title: string | null;
  hostName: string;
  scheduledFor: number;
  playerCount: number;
  groupName: string | null;
};
export async function listCommunityGames(): Promise<CommunityGame[]> {
  const cutoff = Date.now() - 15 * 60 * 1000; // still list a game briefly after its start time
  const snap = await rooms()
    .where("public", "==", true)
    .where("phase", "==", "lobby")
    .where("scheduledFor", ">", cutoff)
    .orderBy("scheduledFor", "asc")
    .limit(50)
    .get();
  const rows = snap.docs.map((doc) => doc.data() as PublicRoom);
  const groupIds = [...new Set(rows.map((r) => r.groupId).filter((id): id is string => !!id))];
  const groupNames = new Map<string, string>();
  if (groupIds.length) {
    const groupSnaps = await db().getAll(...groupIds.map((id) => db().collection("groups").doc(id)));
    for (const groupSnap of groupSnaps)
      if (groupSnap.exists) groupNames.set(groupSnap.id, String(groupSnap.data()!.name));
  }
  return rows.map((data) => {
    const host = data.players.find((p) => p.id === data.host);
    return {
      code: data.code,
      title: data.title ?? null,
      hostName: host?.name ?? "Host",
      scheduledFor: data.scheduledFor ?? 0,
      playerCount: data.players.length,
      groupName: data.groupId ? (groupNames.get(data.groupId) ?? null) : null,
    };
  });
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
      if (code && before) store.set(code, structuredClone(before));
      let result: Awaited<ReturnType<typeof unoAction>>;
      try {
        result = unoAction(action, store);
      } catch (e) {
        throw new GameRuleError(e instanceof Error ? e.message : "Invalid move");
      }
      const finalCode = result.snapshot?.code ?? code;
      if (!finalCode) return result;

      const after = store.get(finalCode) ?? null;
      // Award once when first place is decided; retries and ranking rounds
      // cannot cross this transition again. Stats commit atomically with the move.
      // Only public (quick-play) rooms count toward the leaderboard.
      if (
        action.action === "play" &&
        before?.phase === "playing" &&
        before.standings.length === 0 &&
        after?.phase === "finished" &&
        after.standings.length > 0 &&
        after.public
      ) {
        for (const player of after.players) {
          tx.set(
            db().collection("unoLeaderboard").doc(player.uid),
            {
              name: player.name,
              wins: FieldValue.increment(player.id === after.standings[0] ? 1 : 0),
              games: FieldValue.increment(1),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        }
      }
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
