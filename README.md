# Uno Online multiplayer game v8

Run `npm run dev -- --hostname 0.0.0.0` for development or `npm run build` followed by `npm start` for production. This is the standalone Uno Online project.

## Multiplayer hosting

Room state lives in Firestore. Create a Firebase project (Firestore Database + Anonymous Authentication enabled), then set these environment variables in Vercel (and locally in `.env`):

- `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` — from Firebase Console → Project Settings → Your apps (safe to expose to the browser; access is controlled by Firestore Security Rules, not by hiding these).
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — a service account key from Project Settings → Service accounts → Generate new private key (server-only, never expose these).

Deploy `firestore.rules` and `firestore.indexes.json` with `firebase deploy --only firestore` (requires `firebase login` once). A player's hand and the undealt draw pile are stored in access-restricted documents (per-player and server-only respectively) so no client can ever read another player's hand or see upcoming draws.

Every mutation (play, draw, start, join, …) runs inside a Firestore transaction around the same pure `unoAction` rules engine, so concurrent moves from different players never corrupt room state. Clients subscribe to the room's public document and their own private hand document with `onSnapshot`, so every player sees updates the moment they're written — no polling, no WebSocket server to keep alive.

For local development without a real Firebase project, run the Firestore + Auth emulators (`firebase emulators:start --only firestore,auth`, requires a JDK) and set `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`, and `NEXT_PUBLIC_FIREBASE_EMULATOR=true`.

## Voice

Voice uses browser WebRTC with opt-in microphone permission, individual mute, and authenticated room signaling. HTTPS (or localhost) is required. Google STUN is configured for direct peer discovery. A production TURN relay must be configured for restrictive NAT/firewall networks. Browser-to-browser audio has not been verified across external networks.

## Rules

2–8 players; seven cards each; color/symbol matching; skip, reverse, draw two, wild, wild draw four; +2 cards stack: play another +2 or draw the accumulated total and end your turn. +4 cards also stack, adding four each time. Only matching penalty types can stack. Drawing ends the turn. Starting Wild +4 is disallowed if the player has a matching color; stacking a +4 in response to a +4 is allowed regardless of matching colors. Arm UNO before playing the second-to-last card to avoid a two-card penalty. Disconnected players are removed after 90 seconds. Host can start a rematch. Speech commands are not implemented; voice chat allows players to talk during play.

## Checks

`npm run typecheck`

With the app running: `node scripts/check-uno.mjs`. This verifies capacity, host permissions, hidden hands, turn checks, draw behavior, token authentication, matchmaking and voice presence.

## Code structure and formatting

`Uno.tsx` composes the page. `GameTable`, `RoomLobby`, `VoicePanel`, `GameDialog`, `GameHeader`, and `PlayingCard` own the UI. `useUnoGame` coordinates room state via Firestore realtime listeners, `useVoiceConnection` handles WebRTC voice signaling, and `useCardMotion` handles animation. `src/firebase/client.ts` and `src/firebase/admin.ts` hold the Firebase SDK setup; `src/uno/storage.ts` bridges the pure `unoAction` rules engine (`src/uno/server.ts`) to Firestore transactions.

Run `npm run format` to format the project or `npm run format:check` to validate formatting.
