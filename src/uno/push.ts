import webpush from "web-push";
import { db } from "@/firebase/admin";
import { listGroupMembers } from "./groups";

export type PushSubscriptionData = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey)
    throw new Error("Push notifications are not configured on the server.");
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:support@example.com",
    publicKey,
    privateKey,
  );
  configured = true;
}

const subscriptionsOf = (uid: string) => db().collection("pushSubscriptions").doc(uid);

export async function saveSubscription(uid: string, subscription: PushSubscriptionData) {
  await subscriptionsOf(uid).set({ ...subscription, updatedAt: Date.now() });
}

export async function notifyGroupMembers(
  groupId: string,
  excludeUid: string,
  payload: { title: string; body: string; url: string },
) {
  ensureConfigured();
  const members = await listGroupMembers(groupId, excludeUid);
  if (!members.length) return;
  const refs = members.map((m) => subscriptionsOf(m.uid));
  const snaps = await db().getAll(...refs);
  const message = JSON.stringify(payload);
  await Promise.all(
    snaps.map(async (snap) => {
      if (!snap.exists) return;
      const subscription = snap.data() as PushSubscriptionData;
      try {
        await webpush.sendNotification(subscription, message);
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) await snap.ref.delete();
        else console.error("Push send failed:", error);
      }
    }),
  );
}
