# Spite n Malice: free Supabase storage with Netlify hosting

The website stays on Netlify. Game records are stored in Supabase Postgres, on its Free plan. This setup is easiest from a computer; the completed game works on phones.

## 1. Create a free Supabase project

1. Open https://supabase.com/dashboard and sign in (you can use GitHub).
2. Create an organization if prompted. Choose the **Free** plan.
3. Select **New project**. Name it **Spite n Malice**.
4. Generate a strong database password and save it privately in your password manager. You will enter it directly into Netlify, not into chat or GitHub.
5. Choose a region reasonably close to the family members who will play most often. Create the project and wait for it to become ready.

## 2. Create the game tables

1. Open this file on GitHub: https://github.com/isaacsrich-hash/Testcase/blob/main/database/supabase.sql
2. Select **Raw**, then copy the entire SQL file.
3. In your Supabase project, open **SQL Editor → New query**.
4. Paste the SQL and select **Run**. It should complete successfully. The file is safe to run again; it does not delete existing records.
5. The tables live in the private **kindred** schema. If you inspect them in Table Editor, select **kindred** from the schema dropdown instead of **public**. Do not add this schema to the public Data API's exposed schemas.

## 3. Copy the database connection string

1. At the top of your Supabase project, select **Connect**.
2. Select **Transaction pooler** as the connection method. This is the shared pooler, normally on port **6543**, and is suitable for Netlify Functions.
3. Copy the complete PostgreSQL connection string. Leave `[YOUR-PASSWORD]` in it; the updated server inserts your separately supplied password safely.
4. Use this connection string, not the project HTTPS URL and not a publishable/anon/service-role API key. You do not need those API keys for this app.

## 4. Download the database's root certificate

1. Open **Database → Settings** (or **Project Settings → Database**, depending on the dashboard layout).
2. Find **SSL Configuration** and download the **server root / CA certificate**.
3. Open the downloaded `.crt` file in a plain-text editor. Copy its complete text, including `-----BEGIN CERTIFICATE-----` and `-----END CERTIFICATE-----`.
4. Keep this text available for the next step. It lets the game encrypt the connection and verify that it is talking to your Supabase server.

## 5. Add three settings in Netlify

1. Sign in at https://app.netlify.com and open the existing **Spite n Malice game project**. You do not need to create another website.
2. Open **Environment variables** in the project menu. In some layouts it is under **Project configuration → Environment variables**.
3. Add the variables below. Apply them to **Production** and ensure the **Functions** scope is included (or choose all scopes if that is the only option your plan offers).

| Name | Value |
| --- | --- |
| `SUPABASE_DATABASE_URL` | The full **Transaction pooler** PostgreSQL connection string from step 3, leaving `[YOUR-PASSWORD]` in place. |
| `SUPABASE_DATABASE_PASSWORD` | The actual database password saved in step 1. Paste the raw password; do not URL-encode it or surround it with quotes. |
| `SUPABASE_DATABASE_CA` | The complete certificate text from step 4, including both BEGIN/END lines. Multiline text is supported. |

If the UI offers a **Contains secret values** option, enable it for the connection string and password. Keep these settings server-side: never prefix them with `VITE_`, commit them to GitHub, or send them in chat/screenshots.

## 6. Deploy the updated app

1. In your Netlify project, select **Deploys**.
2. Confirm the Git source is **isaacsrich-hash/Testcase**, branch **main**. The latest source must contain `server/supabase.js` and `database/supabase.sql`.
3. Select **Trigger deploy → Deploy site**. If your UI offers a retry with cleared cache, that is also fine.
4. Wait for the new deployment to become **Published**. Its build command is `npm run build`, publish directory is `dist`, and Function is `api`; `netlify.toml` already provides these settings.
5. Open the project's actual **HTTPS website URL** and refresh. Do not use `localhost` in your phone browser.

This updated app does not use Netlify Database, and no longer has the dependency/migration directory that caused Netlify to provision one automatically. Creating or enabling Netlify Database is not part of this setup.

## 7. Test that saving works

1. Open the website. A practice match should appear.
2. Make a move: select a card from your hand, then place it on a matching shared pile. Or select a hand card and place it in a personal discard pile to end the turn.
3. Send a message in **Table talk**.
4. Refresh the page. The match and message should still be present.
5. In **Settings**, set your name and country. Download and privately keep your player recovery key.
6. Create a family table, copy its invitation, and open it on another device or in a separate browser profile. Set a different player name and join.
7. Start the game as the host. Check that turns and chat appear on both devices.
8. Close and reopen the game. Use **Match history** to resume it.

## 8. Stop paying for unused Netlify storage

An already-created Netlify database is separate from this code change. Switching the app to Supabase does not automatically remove it or stop its charges.

After the Supabase version works, check **Netlify → Data & storage → Database** and your team's billing/usage settings. If the old database contains any records you want, export/back them up before disabling or deleting it. The new Supabase database starts empty; existing Netlify/SQLite records are not automatically transferred. Only remove the old database after confirming you no longer need it or have preserved its data. Check Netlify's current billing page to verify that the unused database no longer incurs usage.

## Free-plan limits and recovery

Supabase's current Free plan includes **500 MB of database space** and **5 GB of egress**. Free projects may pause after **one week of inactivity**; resume a paused project from its dashboard. Free service limits and provider policies can change. Netlify hosting and Functions have their own usage limits: this setup avoids Netlify database charges, not every possible hosting charge.

Automatic database backups are not included in Supabase's Free plan. Keep periodic exports if your family history is important. Your player recovery file restores access to existing database records; it is not a database backup.

## If something goes wrong

- **The old error still says “Enable Netlify Database”:** the old app version is deployed. Check the latest Git commit and redeploy from `main`.
- **“Game storage is not connected”:** confirm all three variables are saved for Production/Functions and redeploy after saving them.
- **Certificate errors in the `api` Function log:** copy the complete CA certificate from your project's Database Settings. Do not disable TLS verification.
- **Authentication failed:** check the database password, the project-specific username in the copied pooler URL, and port 6543.
- **`kindred.users` / relation missing:** run `database/supabase.sql` in the SQL Editor of the same Supabase project used in your connection string.
- **Connection timeouts:** ensure the Supabase project is active and use the Transaction pooler endpoint rather than the direct IPv6-only connection.

For help, share a screenshot with connection strings, passwords, and player keys hidden. A public website URL and a redacted error message are enough for initial diagnosis.

## Verification and remaining setup

The application is checked locally with game/API tests, the Postgres schema and full multiplayer flow on embedded Postgres, strict TLS configuration tests, and the Netlify Function bundler. A live connection to your Supabase project cannot be verified until you configure the database and Netlify environment variables. No Supabase project has been created by this chat.

Official references:

- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/guides/platform/ssl-enforcement
- https://supabase.com/pricing

### Storage diagnostic codes

The public `/api/health` endpoint checks access to the four game tables without creating profiles or returning player records. Its fixed error codes help diagnose setup without exposing connection details:

- `DB_CONFIG`: a required server variable is missing or malformed.
- `DB_LOGIN`: Supabase rejected the database credentials; verify the saved password and exact pooler username/host.
- `DB_CERTIFICATE`: certificate verification failed; replace the CA variable with the complete project root certificate, then redeploy. Keep verification enabled.
- `DB_TABLES`: the selected database is missing game tables/columns; run the complete setup SQL in that same project.
- `DB_ACCESS`: the database user cannot access the private game schema.
- `DB_CONNECTION`: check the project is active and the Transaction pooler address is correct.
- `DB_BUSY`: connection limits have been reached; wait and retry.

The separately saved `SUPABASE_DATABASE_PASSWORD` is authoritative even if an inline password was pasted into the connection string. Raw `[YOUR-PASSWORD]` and URL-encoded placeholders are both supported.
