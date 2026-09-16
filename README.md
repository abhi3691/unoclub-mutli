# Uno Online multiplayer game v15

Run `npm run dev -- --hostname 0.0.0.0` for development or `npm run build` followed by `npm start` for production. This is the standalone Uno Online project.

## Multiplayer hosting

Room state lives in Firestore. Create a Firebase project (Firestore Database + Anonymous Authentication enabled), then set these environment variables in the Elastic Beanstalk environment (and locally in `.env`):

- `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` — from Firebase Console → Project Settings → Your apps (safe to expose to the browser; access is controlled by Firestore Security Rules, not by hiding these).
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — a service account key from Project Settings → Service accounts → Generate new private key (server-only, never expose these).

Deploy `firestore.rules` and `firestore.indexes.json` with `firebase deploy --only firestore` (requires `firebase login` once). A player's hand and the undealt draw pile are stored in access-restricted documents (per-player and server-only respectively) so no client can ever read another player's hand or see upcoming draws.

Every mutation (play, draw, start, join, …) runs inside a Firestore transaction around the same pure `unoAction` rules engine, so concurrent moves from different players never corrupt room state. Clients subscribe to the room's public document and their own private hand document with `onSnapshot`, so every player sees updates the moment they're written — no polling, no WebSocket server to keep alive.

For local development without a real Firebase project, run the Firestore + Auth emulators (`firebase emulators:start --only firestore,auth`, requires a JDK) and set `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`, and `NEXT_PUBLIC_FIREBASE_EMULATOR=true`.

## Push notifications

Groups get a browser push when a member schedules a game. This needs VAPID keys, set the same way as the Firebase vars above — in the Elastic Beanstalk environment *and* locally in `.env`:

- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — generate with `npx web-push generate-vapid-keys`.
- `VAPID_SUBJECT` — a `mailto:` address for push services to contact if there's an issue.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — same value as `VAPID_PUBLIC_KEY`, exposed to the browser so it can subscribe.

Since `NEXT_PUBLIC_*` vars are baked into the client bundle at build time, changing them only takes effect once the Docker image is rebuilt and redeployed (`eb deploy`) — if "Enable game notifications" reports "Push notifications aren't configured yet", either these aren't set in the environment yet, or they were added after the last deploy. Locally, restart `npm run dev` after editing `.env`.

## Voice

Voice uses browser WebRTC with opt-in microphone permission, individual mute, and authenticated room signaling. HTTPS (or localhost) is required. Google STUN is configured for direct peer discovery. A production TURN relay must be configured for restrictive NAT/firewall networks. Browser-to-browser audio has not been verified across external networks.

## Deployment (AWS Elastic Beanstalk)

The app runs as a Docker container (see `Dockerfile`) on Elastic Beanstalk's Docker platform, which passes environment properties straight into the container at runtime.

The homepage is statically prerendered and initializes the Firebase client SDK at module scope, so `NEXT_PUBLIC_FIREBASE_*` also need to be real values during the Docker *build*, not just at container runtime (the same problem the old Amplify setup worked around by baking env vars into `.env.production` before `npm run build`). `.platform/hooks/prebuild/01_write_build_env.sh` does the EB equivalent automatically: it writes the environment properties configured on the EB environment to `.env.production` right before the image builds, and `next build` picks that file up on its own.

- First-time setup: `eb init` (select the Docker platform and a region), then `eb create <env-name>`.
- The default EB environment is HTTP-only; voice requires HTTPS, so attach an ACM certificate to the environment's load balancer (Application Load Balancer with an HTTPS listener) after creation.
- Configure env vars with `eb setenv NEXT_PUBLIC_FIREBASE_API_KEY=... FIREBASE_PRIVATE_KEY=... VAPID_PUBLIC_KEY=... ...` (the full list from `.env.example`, including `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`), or via the console under Configuration → Software.
- Deploy with `eb deploy`; open the environment with `eb open`.
- Test the image locally first: copy the relevant vars from `.env` into a local `.env.production` (mimicking what the prebuild hook does), then `docker build -t uno-online .` and `docker run -p 8080:80 --env-file .env uno-online`, and check `http://localhost:8080`.

## Rules

2–8 players; seven cards each; color/symbol matching; skip, reverse, draw two, wild, wild draw four; +2 cards stack: play another +2 or draw the accumulated total and end your turn. +4 cards also stack, adding four each time. Only matching penalty types can stack. Drawing ends the turn. Starting Wild +4 is disallowed if the player has a matching color; stacking a +4 in response to a +4 is allowed regardless of matching colors. Arm UNO before playing the second-to-last card to avoid a two-card penalty. Disconnected players are removed after 90 seconds. Host can start a rematch. Speech commands are not implemented; voice chat allows players to talk during play.

## Checks

`npm run typecheck`

With the app running: `node scripts/check-uno.mjs`. This verifies capacity, host permissions, hidden hands, turn checks, draw behavior, token authentication, matchmaking and voice presence.

## Code structure and formatting

`Uno.tsx` composes the page. `GameTable`, `RoomLobby`, `VoicePanel`, `GameDialog`, `GameHeader`, and `PlayingCard` own the UI. `useUnoGame` coordinates room state via Firestore realtime listeners, `useVoiceConnection` handles WebRTC voice signaling, and `useCardMotion` handles animation. `src/firebase/client.ts` and `src/firebase/admin.ts` hold the Firebase SDK setup; `src/uno/storage.ts` bridges the pure `unoAction` rules engine (`src/uno/server.ts`) to Firestore transactions.

Run `npm run format` to format the project or `npm run format:check` to validate formatting.
