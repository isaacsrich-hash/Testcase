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
  let room = await api(
    "/rooms",
    { practice: false, title: "The family card table" },
    alex.token,
  );
  await api("/join", { code: room.code }, vera.token);
  await api("/rooms/" + room.id + "/start", {}, alex.token);
  const db = new DatabaseSync(directory + "/kindred.sqlite");
  const game = JSON.parse(
    db.prepare("SELECT state FROM rooms WHERE id=?").get(room.id).state,
  );
  const pool = [
    ...game.deck,
    ...game.players.flatMap((p) => [...p.stock, ...p.hand]),
  ];
  function take(rank, suit) {
    const i = pool.findIndex(
      (c) => (!rank || c.rank === rank) && (!suit || c.suit === suit),
    );
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
  const aces = Array.from({ length: 8 }, () => take(1));
  game.players[0].stock = [
    ...Array.from({ length: 12 }, () => {
      const i = pool.findIndex((c) => c.rank !== 1);
      return pool.splice(i, 1)[0];
    }),
    ...aces,
  ];
  game.players[1].stock = Array.from({ length: 20 }, () => take());
  game.players[1].hand = Array.from({ length: 5 }, () => take());
  game.deck = pool;
  const displayCard = (rank) =>
    pool.some((c) => c.rank === rank) ? take(rank) : take();
  game.players[1].discards = [
    [displayCard(13), displayCard(11)],
    [displayCard(6)],
    [],
    [displayCard(12), displayCard(10), displayCard(3)],
  ];
  game.players[0].discards = [
    [],
    [displayCard(12), displayCard(9)],
    [displayCard(7)],
    [displayCard(10), displayCard(8), displayCard(4)],
  ];
  const allCards = [
    ...game.deck,
    ...game.players.flatMap((p) => [
      ...p.stock,
      ...p.hand,
      ...p.discards.flat(),
    ]),
  ];
  assert.equal(allCards.length, 156);
  assert.equal(new Set(allCards.map((c) => c.id)).size, 156);
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
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(
    (token) => localStorage.setItem("kindred-token", token),
    alex.token,
  );
  await page.route("**/api/**", async (route) => {
    const u = new URL(route.request().url());
    const response = await route.fetch({ url: base + u.pathname + u.search });
    await route.fulfill({ response });
  });
  await page.goto("http://127.0.0.1:5173");
  await page.getByText("Your move, Alex!", { exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("button", { name: "HINT", exact: true }).click();
  assert.equal(
    await page.locator(".own-lane .seat-stock .is-selected").count(),
    1,
  );
  assert.equal(await page.locator(".hinted-build").count(), 1);
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
    .getByText(/Only an ace can start/)
    .first()
    .waitFor();
  assert.equal(await page.locator(".shared-build").count(), 1);
  async function aceFromStock(expected) {
    await page.locator(".own-lane .seat-stock button").click();
    await page
      .getByRole("button", {
        name: "Play ace to start a new pile",
        exact: true,
      })
      .click();
    await page.waitForFunction(
      (n) => document.querySelectorAll(".shared-build").length === n,
      expected,
    );
  }
  await aceFromStock(2);
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
    await aceFromStock(i + 2);
    if (i === 2)
      await page.screenshot({
        path: "/tmp/spite-reference-desktop.png",
        fullPage: true,
      });
  }
  assert.equal(await page.locator(".shared-build").count(), 9);
  await page
    .locator(".own-lane .hand-cards")
    .getByRole("button", { name: "Ace of hearts", exact: true })
    .dragTo(
      page.getByRole("button", {
        name: "Play ace to start a new pile",
        exact: true,
      }),
    );
  await page.waitForFunction(
    () => document.querySelectorAll(".shared-build").length === 10,
  );
  console.log(
    "PASS: kings cannot open piles; king plays as 2; nine aces create ten spaces; click and drag both work.",
  );
  for (const width of [1920, 1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      "Page overflow at " + width,
    );
    const positions = await page
      .locator(".own-lane")
      .evaluate((lane) =>
        [".seat-stock", ".seat-discards", ".seat-hand"].map(
          (c) => lane.querySelector(c).getBoundingClientRect().left,
        ),
      );
    assert.ok(
      positions[0] < positions[1] && positions[1] < positions[2],
      "Stock/discards/hand order at " + width,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/spite-reference-mobile.png",
    fullPage: true,
  });
  await page
    .locator(".own-lane .hand-cards")
    .getByRole("button", { name: "2 of diamonds", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Discard pile 1, empty", exact: true })
    .click();
  await page.getByText("Vera’s turn", { exact: false }).first().waitFor();
  await page
    .getByRole("textbox", { name: "Message your table" })
    .fill("Family table check");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page.getByText("Family table check", { exact: true }).waitFor();
  await page.reload();
  await page.getByText("Family table check", { exact: true }).waitFor();
  assert.equal(await page.locator(".shared-build").count(), 10);
  assert.equal(await page.locator(".own-lane .hand-cards button").count(), 2);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: layout order at six screen widths; discard ends turn; expanded piles, hand and chat survive reload.",
  );
} finally {
  await browser?.close();
  server.kill();
  await new Promise((resolve) => server.once("exit", resolve));
  await rm(directory, { recursive: true, force: true });
}
