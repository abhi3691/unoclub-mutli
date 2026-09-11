# Uno Online multiplayer game v2

Run `npm run dev -- --hostname 0.0.0.0` for development or `npm run build` followed by `npm start` for production. This is the standalone Uno Online project.

## Multiplayer hosting

For Vercel, connect an Upstash Redis database and add these server-only environment variables to your Vercel project, then redeploy:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Use the read/write REST token, not the read-only token. Never prefix these with NEXT_PUBLIC. Choose a database region close to the Vercel function region. All players must use the same deployed site and database. No Redis credentials are included in this project.

Rooms are now stored in Redis with atomic compare-and-swap updates and 30-minute idle expiry. Public matchmaking is shared across instances. Local development without Redis continues to use memory. On Vercel, missing storage configuration produces a clear error instead of silently creating isolated rooms.

The game uses native WebSockets where supported, with HTTP fallback and a 400 ms reconciliation heartbeat. Actual update latency includes network and database round trips. Revisions prevent stale snapshots from undoing newer moves; duplicate local button submissions are blocked. This does not eliminate cold starts or provide zero-latency delivery. At scale, use a managed realtime transport to reduce polling volume.

## Voice

Voice uses browser WebRTC with opt-in microphone permission, individual mute, and authenticated room signaling. HTTPS (or localhost) is required. Google STUN is configured for direct peer discovery. A production TURN relay must be configured for restrictive NAT/firewall networks. Browser-to-browser audio has not been verified across external networks.

## Rules

2–8 players; seven cards each; color/symbol matching; skip, reverse, draw two, wild, wild draw four; +2 cards stack: play another +2 or draw the accumulated total and end your turn. +4 cards also stack, adding four each time. Only matching penalty types can stack. Drawing ends the turn. Starting Wild +4 is disallowed if the player has a matching color; stacking a +4 in response to a +4 is allowed regardless of matching colors. Arm UNO before playing the second-to-last card to avoid a two-card penalty. Disconnected players are removed after 90 seconds. Host can start a rematch. Speech commands are not implemented; voice chat allows players to talk during play.

## Checks

`npm run typecheck`

With the app running: `node scripts/check-uno.mjs`. This verifies capacity, host permissions, hidden hands, turn checks, draw behavior, token authentication, matchmaking and voice presence.

## Code structure and formatting

`Uno.tsx` composes the page. `GameTable`, `RoomLobby`, `VoicePanel`, `GameDialog`, `GameHeader`, and `PlayingCard` own the UI. `useUnoGame` coordinates room state, `useVoiceConnection` handles WebRTC, `useRoomTransport` handles WebSocket/HTTP transport, and `useCardMotion` handles animation.

Run `npm run format` to format the project or `npm run format:check` to validate formatting.

## WebSocket transport

The client now sends authenticated game actions and voice signaling over a native WebSocket at `/api/uno/socket` when available. Other players on the same function instance receive immediate invalidation notifications. A 400 ms synchronization heartbeat reconciles changes across Vercel instances through Redis; Redis pub/sub fan-out is not yet implemented. Socket messages never broadcast another player's private hand. Disconnects reconnect with backoff; HTTP remains available while disconnected. Unconfirmed mutation requests are not automatically replayed.

Vercel uses `@vercel/functions` experimental WebSocket upgrades with Fluid compute enabled. Configure Redis as above. Local `next dev` uses HTTP fallback; use Vercel CLI 54.14.2 or newer (`vercel dev`) to test the upgrade endpoint locally. Redeploy to activate the socket endpoint. Production socket behavior still needs verification against your deployed URL.
