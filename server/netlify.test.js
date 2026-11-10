import { suggestMove } from "../shared/cards.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createPostgresStore } from "./store.js";
import { createNetlifyHandler } from "./netlify-handler.js";

test("Netlify function routing, Postgres migration, full match scoring, chat and cold-start recovery", async (t) => {
  const directory = await mkdtemp("/tmp/kindred-postgres-");
  let pg = new PGlite(directory);
  let released = 0;
  const pool = {
    connect: async () => ({
      query: (text, params) => pg.query(text, params),
      release: () => released++,
    }),
  };
  t.after(async () => {
    await pg.close();
    await rm(directory, { recursive: true, force: true });
  });
  const schema = await readFile(
    new URL("../database/supabase.sql", import.meta.url),
    "utf8",
  );
  await pg.exec(schema);
  await pg.exec(schema); // Re-running the setup must not delete existing tables.
  assert.equal(
    (
      await pg.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='kindred'",
      )
    ).rows.length,
    4,
  );
  assert.equal(
    (
      await pg.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='users'",
      )
    ).rows.length,
    0,
  );
  let handler = createNetlifyHandler(createPostgresStore(pool));
  async function api(path, body, token, expected = 200, direct = true) {
    const response = await handler(
      {
        httpMethod: body ? "POST" : "GET",
        path: (direct ? "/.netlify/functions/api" : "/api") + path,
        headers: {
          "content-type": "application/json",
          authorization: "Bearer " + (token || ""),
        },
        body: body ? JSON.stringify(body) : "",
        isBase64Encoded: false,
      },
      {},
    );
    const text = Buffer.from(
      response.body,
      response.isBase64Encoded ? "base64" : "utf8",
    ).toString();
    assert.equal(response.statusCode, expected, text);
    assert.equal(response.headers["cache-control"], "no-store");
    return JSON.parse(text);
  }
  assert.equal((await api("/health")).status, "ready");
  const a = await api("/session", { name: "Alex" }),
    b = await api("/session", { name: "Sam" }, null, 200, false);
  let r = await api(
    "/rooms",
    { practice: false, title: "Netlify game night" },
    a.token,
  );
  await api("/rooms/" + r.id, null, b.token, 404);
  r = await api("/join", { code: r.code }, b.token);
  assert.equal(r.state.players.length, 2);
  r = await api("/rooms/" + r.id + "/start", {}, a.token);
  assert.equal(r.state.players[1].hand, undefined);
  // Load an older active deal through the deployed Function route. The upgrade
  // must commit once, preserve every card, and reject pre-upgrade hand indexes.
  const beforeUpgrade = r.version;
  const legacy = JSON.parse(
    (await pg.query("SELECT state FROM kindred.rooms WHERE id=$1", [r.id]))
      .rows[0].state,
  );
  const aceSource = [
    legacy.deck,
    legacy.recycle,
    ...legacy.players.map((p) => p.stock),
    ...legacy.builds,
  ].find((pile) => pile.some((card) => card.rank === 1));
  const aceIndex = aceSource.findIndex((card) => card.rank === 1);
  const ace = aceSource.splice(aceIndex, 1)[0];
  legacy.deck.push(legacy.players[0].hand[0]);
  legacy.players[0].hand[0] = ace;
  legacy.builds = [...legacy.builds.filter((pile) => pile.length), []];
  legacy.rulesVersion = 2;
  const beforeCount = legacy.builds.length;
  await pg.query("UPDATE kindred.rooms SET state=$1 WHERE id=$2", [
    JSON.stringify(legacy),
    r.id,
  ]);
  const upgraded = (await api("/dashboard", null, a.token)).rooms.find(
    (room) => room.id === r.id,
  );
  assert.equal(upgraded.version, beforeUpgrade + 1);
  assert.equal(upgraded.state.rulesVersion, 3);
  assert.equal(upgraded.state.builds.length, beforeCount + 1);
  assert.equal(upgraded.state.players[0].handCount, 5);
  assert.ok(upgraded.state.players[0].hand.every((card) => card.rank !== 1));
  r = await api("/rooms/" + r.id, null, a.token);
  assert.equal(r.version, upgraded.version);
  assert.equal(r.state.builds.length, upgraded.state.builds.length);
  await api(
    "/rooms/" + r.id + "/move",
    { type: "discard", index: 0, pile: 1, version: beforeUpgrade },
    a.token,
    409,
  );
  const savedUpgrade = JSON.parse(
    (await pg.query("SELECT state FROM kindred.rooms WHERE id=$1", [r.id]))
      .rows[0].state,
  );
  const savedCards = [
    ...savedUpgrade.deck,
    ...savedUpgrade.recycle,
    ...savedUpgrade.builds.flat(),
    ...savedUpgrade.players.flatMap((p) => [
      ...p.stock,
      ...p.hand,
      ...p.discards.flat(),
    ]),
  ];
  assert.equal(savedCards.length, 156);
  assert.equal(new Set(savedCards.map((card) => card.id)).size, 156);
  r = await api(
    "/rooms/" + r.id + "/move",
    { type: "discard", index: 0, pile: 1, version: r.version },
    a.token,
  );
  await api(
    "/rooms/" + r.id + "/move",
    { type: "discard", index: 0, pile: 1, version: r.version - 1 },
    b.token,
    409,
  );
  await api(
    "/rooms/" + r.id + "/chat",
    { body: "Hello from another country!" },
    a.token,
  );
  const version = r.version;
  await pg.exec(schema); // Setup rerun must also preserve existing matches and chat.
  await pg.close();
  pg = new PGlite(directory);
  handler = createNetlifyHandler(createPostgresStore(pool));
  r = await api("/rooms/" + r.id, null, b.token);
  assert.equal(r.version, version);
  assert.equal(r.state.turn, 1);
  assert.equal(r.messages.at(-1).body, "Hello from another country!");
  assert.equal(r.state.players[0].discards[1].length, 1);
  const tokens = { [a.id]: a.token, [b.id]: b.token };
  for (let i = 0; i < 4000 && r.state.status === "active"; i++) {
    const id = r.state.players[r.state.turn].id;
    r = await api("/rooms/" + r.id, null, tokens[id]);
    const p = r.state.players.find((p) => p.id === id);
    const action = suggestMove(p, r.state.builds);
    r = await api(
      "/rooms/" + r.id + "/move",
      { ...action, version: r.version },
      tokens[id],
    );
  }
  assert.equal(r.state.status, "completed");
  const board = await api("/dashboard", null, a.token),
    winner = board.leaderboard.find((p) => p.id === r.state.winner);
  assert.equal(winner.wins, 1);
  assert.equal(winner.points, r.state.points);
  // Completed records are historical snapshots and must never be upgraded.
  const finalSnapshot = JSON.parse(
    (await pg.query("SELECT state FROM kindred.rooms WHERE id=$1", [r.id]))
      .rows[0].state,
  );
  finalSnapshot.rulesVersion = 2;
  await pg.query("UPDATE kindred.rooms SET state=$1 WHERE id=$2", [
    JSON.stringify(finalSnapshot),
    r.id,
  ]);
  const history = await api("/rooms/" + r.id, null, a.token);
  assert.equal(history.version, r.version);
  assert.equal(history.state.rulesVersion, 2);
  assert.equal(history.state.points, r.state.points);
  assert.equal(
    (await pg.query("SELECT state FROM kindred.rooms WHERE id=$1", [r.id]))
      .rows[0].state,
    JSON.stringify(finalSnapshot),
  );

  assert.equal(
    (await api("/session", { token: a.token, restore: true })).id,
    a.id,
  );
  assert.ok(released > 10);
});
