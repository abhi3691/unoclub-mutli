# Uno Online

Run `npm run dev -- --hostname 0.0.0.0` for development or `npm run build` followed by `npm start` for production. This is the standalone Uno Online project.

## Multiplayer hosting

For Vercel, connect an Upstash Redis database and add these server-only environment variables to your Vercel project, then redeploy:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Use the read/write REST token, not the read-only token. Never prefix these with NEXT_PUBLIC. Choose a database region close to the Vercel function region. All players must use the same deployed site and database. No Redis credentials are included in this project.

Rooms are now stored in Redis with atomic compare-and-swap updates and 30-minute idle expiry. Public matchmaking is shared across instances. Local development without Redis continues to use memory. On Vercel, missing storage configuration produces a clear error instead of silently creating isolated rooms.

The current game transport uses HTTP polling every 400 ms, not Socket.IO/WebSockets. Actual update latency includes network and database round trips. Revisions prevent stale snapshots from undoing newer moves; duplicate local button submissions are blocked. This does not eliminate cold starts or provide zero-latency delivery. At scale, use a managed realtime transport to reduce polling volume.

## Voice

Voice uses browser WebRTC with opt-in microphone permission, individual mute, and authenticated room signaling. HTTPS (or localhost) is required. Google STUN is configured for direct peer discovery. A production TURN relay must be configured for restrictive NAT/firewall networks. Browser-to-browser audio has not been verified across external networks.

## Rules

2–8 players; seven cards each; color/symbol matching; skip, reverse, draw two, wild, wild draw four; +2 cards stack: play another +2 or draw the accumulated total and end your turn. +4 cards also stack, adding four each time. Only matching penalty types can stack. Drawing ends the turn. Starting Wild +4 is disallowed if the player has a matching color; stacking a +4 in response to a +4 is allowed regardless of matching colors. Arm UNO before playing the second-to-last card to avoid a two-card penalty. Disconnected players are removed after 90 seconds. Host can start a rematch. Speech commands are not implemented; voice chat allows players to talk during play.

## Checks

`npm run typecheck`

With the app running: `node scripts/check-uno.mjs`. This verifies capacity, host permissions, hidden hands, turn checks, draw behavior, token authentication, matchmaking and voice presence.
