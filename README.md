# Uno Online

Run `npm run dev -- --hostname 0.0.0.0` for development or `npm run build` followed by `npm start` for production. This is the standalone Uno Online project.

## Multiplayer hosting

Deploy this Next.js app to one persistent Node.js process behind HTTPS. Room codes and public matchmaking work across browsers connected to that same server. Rooms currently live in process memory and are lost on restart. Do not deploy this room implementation to stateless serverless functions or multiple independent replicas. Move room state to a shared transactional store before horizontal scaling.

The local preview is not a public Internet deployment. No hosting account or public endpoint has been configured.

## Voice

Voice uses browser WebRTC with opt-in microphone permission, individual mute, and authenticated room signaling. HTTPS (or localhost) is required. Google STUN is configured for direct peer discovery. A production TURN relay must be configured for restrictive NAT/firewall networks. Browser-to-browser audio has not been verified across external networks.

## Rules

2–8 players; seven cards each; color/symbol matching; skip, reverse, draw two, wild, wild draw four; +2 cards stack: play another +2 or draw the accumulated total and end your turn. +4 cards also stack, adding four each time. Only matching penalty types can stack. Drawing ends the turn. Starting Wild +4 is disallowed if the player has a matching color; stacking a +4 in response to a +4 is allowed regardless of matching colors. Arm UNO before playing the second-to-last card to avoid a two-card penalty. Disconnected players are removed after 90 seconds. Host can start a rematch. Speech commands are not implemented; voice chat allows players to talk during play.

## Checks

`npm run typecheck`

With the app running: `node scripts/check-uno.mjs`. This verifies capacity, host permissions, hidden hands, turn checks, draw behavior, token authentication, matchmaking and voice presence.
