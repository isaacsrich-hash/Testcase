# Kindred on Netlify, with free Supabase storage

Follow the complete setup checklist in [SUPABASE.md](SUPABASE.md).

The website and game API run on Netlify. Supabase Postgres stores users, matches, chat, and leaderboard history. Local development continues to use SQLite.

- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`
- Node version: 24 (configured in `netlify.toml`)
- GitHub repository: `isaacsrich-hash/Testcase`, branch `main`

Set `SUPABASE_DATABASE_URL`, `SUPABASE_DATABASE_PASSWORD`, and `SUPABASE_DATABASE_CA` in Netlify's Production environment, with Functions scope, after creating the Supabase schema. See [SUPABASE.md](SUPABASE.md) for the exact steps. Redeploy after saving the variables.

Do not enable Netlify Database for this version. Existing Netlify Database storage is not automatically disconnected or deleted; preserve any existing data before removing it and confirm its billing state separately.

Do not upload only `dist` using Netlify Drop: the game also needs its server Function. Import/build from GitHub so the Function is deployed with the website.

The connection is encrypted and certificate-verified. No credentials belong in browser code or GitHub. The `kindred` schema is private and should not be exposed through the Supabase Data API.

The old Netlify-managed database migrations have been replaced by `database/supabase.sql`, run manually in Supabase's SQL Editor. This prevents creating new paid Netlify storage automatically. Changing this backend does not copy existing game records from an old database.
