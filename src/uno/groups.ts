import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/firebase/admin";

export type GroupSummary = { id: string; name: string; memberCount: number };
export type GroupMember = { uid: string; name: string };

const groups = () => db().collection("groups");
const membersOf = (groupId: string) => groups().doc(groupId).collection("members");
const userGroupsDoc = (uid: string) => db().collection("userGroups").doc(uid);

export async function listGroups(): Promise<GroupSummary[]> {
  const snap = await groups().orderBy("memberCount", "desc").limit(100).get();
  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: String(data.name || "Group"),
      memberCount: Number(data.memberCount) || 0,
    };
  });
}

export async function createGroup(
  uid: string,
  memberName: string,
  groupName: string,
): Promise<GroupSummary> {
  const name = groupName.trim().slice(0, 40);
  if (!name) throw new Error("Group name is required.");
  const ref = groups().doc();
  await db().runTransaction(async (tx) => {
    tx.set(ref, { name, memberCount: 1, createdAt: FieldValue.serverTimestamp() });
    tx.set(membersOf(ref.id).doc(uid), {
      uid,
      name: memberName.trim().slice(0, 20) || "Player",
      joinedAt: FieldValue.serverTimestamp(),
    });
    tx.set(
      userGroupsDoc(uid),
      { groups: { [ref.id]: { name, joinedAt: Date.now() } } },
      { merge: true },
    );
  });
  return { id: ref.id, name, memberCount: 1 };
}

export async function joinGroup(
  uid: string,
  memberName: string,
  groupId: string,
): Promise<void> {
  const ref = groups().doc(groupId);
  await db().runTransaction(async (tx) => {
    const [groupSnap, memberSnap] = await Promise.all([
      tx.get(ref),
      tx.get(membersOf(groupId).doc(uid)),
    ]);
    if (!groupSnap.exists) throw new Error("Group not found.");
    if (memberSnap.exists) return; // already a member; idempotent
    tx.set(membersOf(groupId).doc(uid), {
      uid,
      name: memberName.trim().slice(0, 20) || "Player",
      joinedAt: FieldValue.serverTimestamp(),
    });
    tx.update(ref, { memberCount: FieldValue.increment(1) });
    tx.set(
      userGroupsDoc(uid),
      { groups: { [groupId]: { name: groupSnap.data()!.name, joinedAt: Date.now() } } },
      { merge: true },
    );
  });
}

export async function listMyGroups(uid: string): Promise<{ id: string; name: string }[]> {
  const snap = await userGroupsDoc(uid).get();
  const data = snap.data()?.groups as Record<string, { name: string }> | undefined;
  if (!data) return [];
  return Object.entries(data).map(([id, g]) => ({ id, name: g.name }));
}

export async function listGroupMembers(
  groupId: string,
  excludeUid: string,
): Promise<GroupMember[]> {
  const snap = await membersOf(groupId).get();
  return snap.docs
    .map((doc) => doc.data() as GroupMember)
    .filter((m) => m.uid !== excludeUid);
}
