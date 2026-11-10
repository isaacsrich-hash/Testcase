import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const directory = await mkdtemp("/tmp/spite-table-test-"),
  port = 3198;
const server = spawn(process.execPath, ["server/index.js"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port), DATA_DIR: directory },
  stdio: ["ignore", "pipe", "pipe"],
});
let browser;
try {
  await new Promise((resolve, reject) => {
    server.stdout.once("data", resolve);
    server.once("error", reject);
  });
  const base = `http://127.0.0.1:${port}`;
  async function api(path, body, token) {
    const r = await fetch(base + "/api" + path, {
      method: body ? "POST" : "GET",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + (token || ""),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const d = await r.json();
    assert.equal(r.status, 200, d.error);
    return d;
  }
  const alex = await api("/session", { name: "Alex" }),
    vera = await api("/session", { name: "Vera" });
  const room = await api(
    "/rooms",
    { practice: false, title: "The family card table" },
    alex.token,
  );
  await api("/join", { code: room.code }, vera.token);
  await api("/rooms/" + room.id + "/start", {}, alex.token);
  const db = new DatabaseSync(directory + "/kindred.sqlite"),
    game = JSON.parse(
      db.prepare("SELECT state FROM rooms WHERE id=?").get(room.id).state,
    );
  const pool = [
    ...game.deck,
    ...game.recycle,
    ...game.builds.flat(),
    ...game.players.flatMap((p) => [
      ...p.stock,
      ...p.hand,
      ...p.discards.flat(),
    ]),
  ];
  function take(rank, suit) {
    const i = pool.findIndex(
      (c) => (!rank || c.rank === rank) && (!suit || c.suit === suit),
    );
    assert.ok(i >= 0);
    return pool.splice(i, 1)[0];
  }
  function nonAce() {
    const i = pool.findIndex((c) => c.rank !== 1);
    assert.ok(i >= 0);
    return pool.splice(i, 1)[0];
  }
  game.players[0].hand = [
    take(1, "♥"),
    take(13, "♠"),
    take(2, "♦"),
    take(11, "♣"),
    take(12, "♥"),
  ];
  const replacement = take(4, "♠"),
    aces = Array.from({ length: 8 }, () => take(1));
  game.players[0].stock = [...Array.from({ length: 12 }, nonAce), ...aces];
  game.players[1].stock = Array.from({ length: 20 }, nonAce);
  game.players[1].hand = Array.from({ length: 5 }, nonAce);
  const displayCard = (rank) =>
    pool.some((c) => c.rank === rank) ? take(rank) : nonAce();
  game.players[1].discards = [
    [displayCard(13), displayCard(11)],
    [displayCard(6)],
    [],
    [displayCard(12), displayCard(10), displayCard(3)],
  ];
  game.players[0].discards = [
    [],
    [displayCard(12), displayCard(9), ...Array.from({ length: 10 }, nonAce)],
    [displayCard(7)],
    [displayCard(10), displayCard(8), displayCard(4)],
  ];
  game.deck = [...pool, replacement];
  game.recycle = [];
  game.builds = [[]];
  game.log = ["Saved previous move"];
  game.rulesVersion = 2;
  const cards = [
    ...game.deck,
    ...game.players.flatMap((p) => [
      ...p.stock,
      ...p.hand,
      ...p.discards.flat(),
    ]),
  ];
  assert.equal(cards.length, 156);
  assert.equal(new Set(cards.map((c) => c.id)).size, 156);
  db.prepare("UPDATE rooms SET state=?,version=version+1 WHERE id=?").run(
    JSON.stringify(game),
    room.id,
  );
  db.close();
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1050 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(
    (token) => localStorage.setItem("kindred-token", token),
    alex.token,
  );
  await page.route("**/api/**", async (route) => {
    const u = new URL(route.request().url()),
      response = await route.fetch({ url: base + u.pathname + u.search });
    await route.fulfill({ response });
  });
  await page.goto("http://127.0.0.1:5173");
  await page.getByText("Your move, Alex!", { exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator(".sidebar").isVisible(), false);
  assert.equal(await page.locator(".topbar").isVisible(), false);
  assert.equal(await page.locator(".right-rail").isVisible(), false);
  assert.equal(await page.locator(".site-footer").isVisible(), false);
  assert.equal(
    await page
      .locator('.own-lane .hand-cards button[aria-label^="Ace of"]')
      .count(),
    0,
  );
  assert.equal(await page.locator(".shared-build").count(), 2);
  const first = await api("/rooms/" + room.id, null, alex.token),
    again = await api("/rooms/" + room.id, null, alex.token);
  assert.equal(first.version, again.version);
  assert.equal(first.state.rulesVersion, 3);
  assert.equal(again.state.builds.length, 2);
  assert.equal(again.state.players.find((p) => p.id === alex.id).handCount, 5);
  await page.getByRole("button", { name: "HINT", exact: true }).click();
  assert.equal(
    await page.locator(".own-lane .seat-stock .is-selected").count(),
    1,
  );
  const king = () =>
    page
      .locator(".own-lane .hand-cards")
      .getByRole("button", { name: "King of spades (wild)", exact: true });
  await king().click();
  assert.equal(await page.locator(".hinted-build").count(), 0);
  await page
    .getByRole("button", { name: "Play ace to start a new pile", exact: true })
    .click();
  await page
    .locator(".toast")
    .getByText(/Only an ace can start/)
    .waitFor();
  assert.equal(await page.locator(".shared-build").count(), 2);
  async function aceFromStock(n) {
    await page.locator(".own-lane .seat-stock button").click();
    await page
      .getByRole("button", {
        name: "Play ace to start a new pile",
        exact: true,
      })
      .click();
    await page.waitForFunction(
      (count) => document.querySelectorAll(".shared-build").length === count,
      n,
    );
  }
  await aceFromStock(3);
  await king().click();
  await page
    .getByRole("button", {
      name: "Play to building pile 1, needs 2",
      exact: true,
    })
    .click();
  await page
    .locator(".shared-build")
    .first()
    .getByText("WILD", { exact: true })
    .waitFor();
  assert.equal(
    await page
      .locator(".shared-build")
      .first()
      .locator(".king-assignment small")
      .textContent(),
    "=2",
  );
  for (let i = 1; i < 8; i++) {
    await aceFromStock(i + 3);
    if (i === 1)
      await page.screenshot({
        path: "/tmp/spite-focus-desktop.png",
        fullPage: true,
      });
  }
  assert.equal(await page.locator(".shared-build").count(), 10);
  await page
    .locator(".own-lane .hand-cards")
    .getByRole("button", { name: "2 of diamonds", exact: true })
    .dragTo(
      page.getByRole("button", {
        name: "Play to building pile 2, needs 2",
        exact: true,
      }),
    );
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".own-lane .hand-cards button").length === 3,
  );
  const pile = page.locator(".own-lane .discard-stack").nth(3);
  assert.equal(await pile.locator(".peek-label").count(), 2);
  assert.ok(
    (await pile
      .locator(".peek-label")
      .first()
      .evaluate((el) => el.getBoundingClientRect().height)) >= 25,
  );
  await pile.getByRole("button", { name: /See all 3 cards/ }).click();
  await page.getByRole("dialog", { name: "Discard pile 4 cards" }).waitFor();
  assert.equal(await page.locator(".inspected-cards .playing-card").count(), 3);
  await page.getByRole("button", { name: "Close discard pile" }).click();
  const longPile = page.locator(".own-lane .discard-stack").nth(1);
  assert.equal(await longPile.locator(".peek-label").count(), 11);
  assert.ok(
    await longPile
      .locator(".pile-viewport")
      .evaluate((el) => el.scrollHeight > el.clientHeight && el.scrollTop > 0),
  );
  await longPile.getByRole("button", { name: /See all 12 cards/ }).click();
  assert.equal(
    await page.locator(".inspected-cards .playing-card").count(),
    12,
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".pile-inspection").count(), 0);
  console.log(
    "PASS: board-only view; saved hand aces auto-play once; readable discard strips and full-pile view; king wilds and expanding piles.",
  );
  for (const width of [1920, 1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      "Overflow at " + width,
    );
    const xs = await page
      .locator(".own-lane")
      .evaluate((lane) =>
        [".seat-stock", ".seat-discards", ".seat-hand"].map(
          (c) => lane.querySelector(c).getBoundingClientRect().left,
        ),
      );
    assert.ok(xs[0] < xs[1] && xs[1] < xs[2]);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/spite-focus-mobile.png",
    fullPage: true,
  });
  await page
    .locator(".own-lane .hand-cards")
    .getByRole("button", { name: "Jack of clubs", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Discard pile 1, empty", exact: true })
    .click();
  await page.getByText("Vera’s turn", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Table talk", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Message your table" })
    .fill("Family table check");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page.getByText("Family table check", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Close chat", exact: true }).click();
  assert.equal(await page.locator(".right-rail").isVisible(), false);
  await page.reload();
  await page.getByText("Vera’s turn", { exact: true }).waitFor();
  assert.equal(await page.locator(".shared-build").count(), 10);
  assert.equal(await page.locator(".own-lane .hand-cards button").count(), 2);
  assert.equal(await page.locator(".right-rail").isVisible(), false);
  await page.getByRole("button", { name: "Table talk", exact: true }).click();
  await page.getByText("Family table check", { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".right-rail").isVisible(), false);
  await page.getByRole("button", { name: "Matches", exact: true }).click();
  assert.equal(await page.locator(".sidebar").isVisible(), true);
  await page.getByRole("button", { name: "Game room", exact: true }).click();
  assert.equal(await page.locator(".sidebar").isVisible(), false);
  assert.equal(await page.locator(".shared-build").count(), 10);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: six screen widths; discard ends turn; hidden chat opens/closes and persists; expanded board and hand survive reload.",
  );
} finally {
  await browser?.close();
  server.kill();
  await new Promise((resolve) => server.once("exit", resolve));
  await rm(directory, { recursive: true, force: true });
}
