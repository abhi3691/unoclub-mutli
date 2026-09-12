"use client";
import { getApps, initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  signInAnonymously,
  type User,
} from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApps()[0]! : initializeApp(config);
export const auth = getAuth(app);
export const db = getFirestore(app);

// NEXT_PUBLIC_FIREBASE_EMULATOR=true points the client at a local `firebase
// emulators:start` instance instead of the real project, for local dev/testing.
let emulatorsConnected = false;
if (process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === "true" && !emulatorsConnected) {
  emulatorsConnected = true;
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

/** Resolves once anonymous sign-in completes, giving a stable uid for this browser. */
let signingIn: Promise<User> | null = null;
export function ensureSignedIn(): Promise<User> {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  if (signingIn) return signingIn;
  signingIn = auth
    .authStateReady()
    .then(async () => auth.currentUser ?? (await signInAnonymously(auth)).user)
    .finally(() => {
      signingIn = null;
    });
  return signingIn;
}
