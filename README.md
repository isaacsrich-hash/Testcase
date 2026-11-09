# Kindred

A family-focused Spite & Malice game, built with React, Vite, Express, and SQLite. Original visual design; no Monopoly branding or assets.

## Run

Requires Node.js 24 (uses `node:sqlite`).

```sh
npm ci --cache /tmp/kindred-npm-cache
npm run dev
```

Vite serves the interface on port 5173 and proxies `/api` to the game server on 3001.

Production:

```sh
npm run build
npm start
```

Express serves the built interface and API on `PORT` (default 3001). Deploy this process behind HTTPS on a public host for family in different countries. No deployment has been performed. Use a persistent writable volume for `DATA_DIR` (default `./data`). Back up the SQLite database; do not deploy it on ephemeral storage. A single server process is the supported topology.

## Netlify deployment

See [NETLIFY.md](NETLIFY.md) for the new-site setup. The website and API can run on Netlify using Netlify Functions and Netlify Database. Production data is stored in managed Postgres; local development continues using SQLite. No live site has been deployed.

## Features

- 2–4 players in private, invite-code rooms; host starts once everyone joins.
- 3-player practice with bots; separate from multiplayer leaderboard scoring.
- Real Spite & Malice rules: 20 stock cards, five-card hands, four personal discards, four shared 1–12 builds, wilds, recycled completed builds.
- Authoritative server validates turns, hidden hands, legal plays, and stale actions.
- SQLite commits each move, lobby join, and chat message. Two-second polling syncs devices. Match history resumes games after browser and server restarts.
- Private table chat and quick reactions.
- Family leaderboard: winner gets 25 points plus opponents’ remaining stock; XP and levels; first-moves goal.
- Browser-based player identities with random bearer keys. Settings can download and restore a private player key on another device. Keep that file private. Anyone holding an invitation may join an unstarted table; anyone holding a player key has access to that profile.
- Responsive layouts, reduced-motion support, optional card sound.

## Scope and limitations

This is a working MVP. There is no email/password login, key revocation, email/push notification service, or public hosting configured. Secure account management and operational hardening should precede broader public use. Family membership currently follows the last joined family table (one family group per profile). Usernames are snapshotted for existing games. A waiting/active game remains available in history; no deletion is provided. Progress needs the same server database and either the original browser key or its recovery file. When no cards remain in the draw deck and a player has an empty hand, End turn allows a pass. Server deployment, backups, and account security are required to make long-term recovery dependable. No paid currency, wagering, or purchases.

## Validation

```sh
npm test
npm run build
```

Tests cover deck conservation, legal/illegal moves, turn enforcement, wilds, recycling, victory/scoring, hand refill, hidden information, and full bot matches. Netlify adapter tests additionally exercise Function routing, Postgres migrations, a complete multiplayer match, and database reopen recovery using embedded Postgres. Browser checks also exercised two isolated players joining, starting, chat synchronization, reload persistence, desktop/mobile rendering, and overflow. API integration checks exercised authorization, stale-action rejection, and SQLite recovery after a server restart.

With the development server running, browser checks can be repeated using `node scripts/browser-smoke.mjs`. Set `CHROMIUM_PATH` if Chromium is installed somewhere other than `/usr/bin/chromium`. Screenshots are written to `/tmp/kindred-checks`.
