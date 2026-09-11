import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// The Admin SDK auto-connects to the local emulator when FIRESTORE_EMULATOR_HOST is
// set (standard Firebase behavior), so no credentials are needed for local dev.
const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;

function buildApp(): App {
  if (getApps().length) return getApps()[0]!;
  if (usingEmulator) {
    return initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || "demo-uno" });
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin credentials are not configured. Set FIREBASE_PROJECT_ID, " +
        "FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY (from a Firebase service " +
        "account key) in Vercel and redeploy.",
    );
  }
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

let firestore: Firestore | null = null;
export function db(): Firestore {
  firestore ??= getFirestore(buildApp());
  return firestore;
}
