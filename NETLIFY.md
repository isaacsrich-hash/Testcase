# Create a new Kindred site on Netlify

The project now supports Netlify for both the website and game API, using **Netlify Database** for persistent Postgres storage. You do not need a separate game-server provider for this deployment.

## What is prepared

- `netlify.toml`: Vite build (`npm run build`), publish directory (`dist`), Functions directory, Node 24, API rewrites, and client-side routing.
- `netlify/functions/api.mjs`: game API served as a Netlify Function. It never falls back to SQLite or temporary function storage.
- `netlify/database/migrations/0001_create_kindred.sql`: users, rooms, membership, messages, and indexes. Netlify applies this migration to the database during deployment.
- `server/store.js`: transaction-based Postgres adapter, retaining SQLite for local development.
- Room row locks serialize joins and moves across multiple Function instances, preserving the player limit and rejecting stale moves.

## Prerequisites

1. The complete source files must be on the GitHub branch you import. Cloud workspace edits are not automatically synchronized to GitHub; commit and push updates before triggering a new Netlify build.
2. Sign in to your Netlify account. Netlify Database is available on credit-based plans, with usage charges. Check your plan and spending settings before creating the database.

## New-site setup

1. In Netlify, choose **Add new project → Import an existing project** (wording can vary), then connect GitHub.
2. Select `isaacsrich-hash/Testcase` after the application source has been pushed there. Choose the branch containing these files.
3. Use the repository root as the base directory. The checked-in `netlify.toml` sets the build command to `npm run build`, publish directory to `dist`, and Functions directory to `netlify/functions`.
4. Deploy the project. Netlify's documented database integration detects `@netlify/database`, provisions the database, and applies `netlify/database/migrations/`. If database provisioning requires action, open **Data & Storage → Database**, create/enable the database for this new project, then redeploy.
5. If an existing Functions runtime override is present, set `AWS_LAMBDA_JS_RUNTIME` to `nodejs24.x` in the Netlify environment-variable UI and redeploy. This variable must be configured in Netlify's UI/CLI/API, not in `netlify.toml`. Otherwise, Node 24 in the build configuration selects the supported runtime automatically.
6. Wait for the deploy, database migration, and `api` Function to finish successfully. Open the HTTPS URL Netlify assigns to the project. That URL works in Safari on your iPhone and can be shared with family.

Do not upload only `dist` using Netlify Drop. That would deploy the website without the game Function and database migrations.

Netlify injects the database connection configuration into its Functions. Do not paste database credentials into chat, browser code, or source files.

## First test on your phone

1. Open the new `https://…netlify.app` address.
2. Practice against bots, make a move, send a message, and refresh. Your progress and messages should remain.
3. In Settings, set your name and country. Download your private player key and keep it safe; it restores your profile on another device.
4. Create a family table and copy the invitation. Open it on another device or in a separate browser profile, set a different player name, and join.
5. Start the game as the host. Check that turns and chat update on both devices.
6. Close the site and reopen it. Use Match history to resume the table.
7. After completing a family match, check the leaderboard. Practice matches do not award family ranking points.

## Data and deployment scope

A new Netlify database starts empty. The cloud workspace's local SQLite practice games are not automatically copied to it. Once production is configured, games, messages, and scores are saved in the managed database and persist across Function restarts and subsequent site deployments. Use the production URL consistently: deploy previews have separate database branches, and browsers have separate profile keys. Configure backup/recovery and retain your private profile key for long-term recoverability.

The app is still an MVP with browser-based player keys, rather than email/password accounts. Keep table invitations within the family and store player keys privately.

## Verification performed here

- Local SQLite game and API regression tests.
- The production Postgres schema and query adapter tested using PGlite (embedded Postgres), including a complete match, leaderboard scoring, chat, and database reopen recovery.
- Netlify Function event adaptation tested for both public `/api/*` paths and `/.netlify/functions/api/*` paths.
- Desktop/mobile browser checks and production frontend build.

No live Netlify site or managed database has been created or validated by this chat. Netlify-side provisioning, migration application, and public HTTPS access need verification after deployment.

Official references:

- https://docs.netlify.com/build/data-and-storage/netlify-database/getting-started/
- https://docs.netlify.com/build/data-and-storage/netlify-database/migrations/
- https://docs.netlify.com/build/data-and-storage/netlify-database/api/
- https://docs.netlify.com/build/functions/configuration/#nodejs-version-for-runtime
