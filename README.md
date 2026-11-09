# Spite n Malice

A family-focused Spite & Malice game, built with React, Vite, Express, and SQLite. A traditional green-and-gold card table with large face-rank cards, stock on the left, discard piles in the middle, and a fanned hand on the right. Fonts are served locally with their licenses in `public/fonts/`.

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

## Netlify deployment with Supabase storage

Follow [SUPABASE.md](SUPABASE.md) for the full click-by-click setup. The website and API run on Netlify; Supabase Postgres stores the saved games. Supabase has a Free plan with usage limits. This version does not require or provision Netlify Database. Local development continues using SQLite. Live Supabase access needs the server-side settings described in the guide.

## Features

- 2–4 players in private, invite-code rooms; host starts once everyone joins.
- Two-player practice against a bot; separate from multiplayer leaderboard scoring. Existing larger practice matches remain resumable.
- House rules: three standard 52-card decks, 20 stock cards, five-card hands and four personal discard piles. Shared runs build A–2–…–10–J–Q in any suit. Kings are wild for 2 through Q; only an actual ace can open a pile. Every new ace reveals another space, with no four-pile limit. Completed runs recycle into the draw deck. No jokers or separate W cards.
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

## Rules and saved-game compatibility

New games use suited card objects with ranks A through K. Existing numeric-card games keep their cards, chat, scores, and move history; old zero-valued wilds are interpreted and displayed as kings, 11 as J, and 12 as Q. Active old building piles are retained and surplus empty placeholders become one expandable ace slot. This conversion is deterministic on read and is saved with the next valid move. No database migration or reset is needed.

For the focused browser checks, run `node scripts/table-smoke.mjs` while the development server is running. It starts a separate temporary game database, constructs a card-conserving test deal, and checks ace-only openings, king substitution, more than four simultaneous piles, dragging, layout order, turn ending, and reload persistence. It leaves real player data untouched.
