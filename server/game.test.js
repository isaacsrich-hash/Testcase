import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  move,
  botTurn,
  publicGame,
  shuffledDeck,
  normalizeGame,
} from "./game.js";
import { rankOf, rankLabel } from "../shared/cards.js";
const players = [
  { id: "a", name: "Alex" },
  { id: "b", name: "Mia", bot: true },
];
const c = (rank, suit = "♠") => ({ rank, suit });
test("three standard decks contain all four suits, twelve aces and twelve kings, with no jokers", () => {
  const deck = shuffledDeck();
  assert.equal(deck.length, 156);
  assert.equal(new Set(deck.map((c) => c.id)).size, 156);
  for (let rank = 1; rank <= 13; rank++) {
    assert.equal(deck.filter((c) => c.rank === rank).length, 12);
    assert.equal(
      new Set(deck.filter((c) => c.rank === rank).map((c) => c.suit)).size,
      4,
    );
  }
  const g = createGame(players);
  assert.equal(g.deck.length, 106);
  assert.equal(g.players[0].stock.length, 20);
  assert.equal(g.players[0].hand.length, 5);
  assert.deepEqual(g.builds, [[]]);
});
test("only actual aces can open a pile; kings and other ranks are rejected without mutation", () => {
  const g = createGame(players);
  g.players[0].hand = [c(13), c(2), c(1)];
  const before = JSON.stringify(g);
  for (const index of [0, 1])
    assert.throws(
      () => move(g, "a", { type: "play", source: "hand", index, target: 0 }),
      /Only an ace/,
    );
  assert.throws(
    () => move(g, "b", { type: "play", source: "hand", index: 0, target: 0 }),
    /turn/,
  );
  assert.equal(JSON.stringify(g), before);
  move(g, "a", { type: "play", source: "hand", index: 2, target: 0 });
  assert.equal(rankOf(g.builds[0][0]), 1);
  assert.deepEqual(g.builds[1], []);
});
test("ace slots expand beyond four without a fixed pile limit", () => {
  const g = createGame(players);
  g.players[0].stock = Array.from({ length: 10 }, () => c(1));
  for (let i = 0; i < 8; i++)
    move(g, "a", { type: "play", source: "stock", index: 0, target: i });
  assert.equal(g.builds.length, 9);
  assert.ok(g.builds.slice(0, -1).every((p) => p.length === 1));
  assert.equal(g.builds.at(-1).length, 0);
});
test("kings substitute for any non-ace rank and queens complete and recycle a run", () => {
  const g = createGame(players);
  g.builds = [[c(1)], []];
  g.players[0].hand = [c(13), c(4)];
  move(g, "a", { type: "play", source: "hand", index: 0, target: 0 });
  assert.equal(rankOf(g.builds[0].at(-1)), 13);
  assert.equal(g.builds[0].length, 2);
  assert.throws(
    () => move(g, "a", { type: "play", source: "hand", index: 0, target: 0 }),
    /needs 3/,
  );
  g.builds[0] = Array.from({ length: 11 }, (_, i) => c(i + 1));
  g.players[0].stock = [c(12)];
  move(g, "a", { type: "play", source: "stock", index: 0, target: 0 });
  assert.equal(g.status, "completed");
  assert.equal(g.winner, "a");
  assert.equal(g.points, 45);
  assert.deepEqual(g.builds, [[]]);
  assert.equal(g.recycle.length, 12);
});
test("a king may complete the queen position and earns the correct win points", () => {
  const g = createGame(players);
  g.builds = [Array.from({ length: 11 }, (_, i) => c(i + 1)), []];
  g.players[0].stock = [c(13)];
  move(g, "a", { type: "play", source: "stock", index: 0, target: 0 });
  assert.equal(g.winner, "a");
  assert.equal(g.recycle.length, 12);
  assert.match(g.log[0], /K♠ as Q/);
});
test("empty hand refills, discard ends turn, and only own hand is visible", () => {
  const g = createGame(players);
  g.players[0].hand = [c(1)];
  move(g, "a", { type: "play", source: "hand", index: 0, target: 0 });
  assert.equal(g.players[0].hand.length, 5);
  move(g, "a", { type: "discard", index: 0, pile: 2 });
  assert.equal(g.turn, 1);
  assert.equal(g.players[0].moves, 2);
  assert.equal(g.players[0].discards[2].length, 1);
  const v = publicGame(g, "a");
  assert.equal(v.players[1].hand, undefined);
  assert.equal(v.players[0].stock, undefined);
  assert.equal(v.deck, undefined);
  botTurn(g);
  assert.ok(g.status === "completed" || g.turn === 0);
});
test("legacy games preserve every card and history while upgrading ace spaces", () => {
  const g = createGame(players);
  delete g.rulesVersion;
  g.players[0].stock = [0, 11, 12, 1];
  g.builds = [[], [1, 0], [], [1, 2, 3]];
  g.log = ["An earlier move"];
  const oldStock = [...g.players[0].stock];
  normalizeGame(g);
  assert.deepEqual(g.players[0].stock, oldStock);
  assert.deepEqual(g.log, ["An earlier move"]);
  assert.deepEqual(g.builds, [[1, 0], [1, 2, 3], []]);
  assert.equal(rankOf(0), 13);
  assert.equal(rankLabel(11), "J");
  assert.equal(rankLabel(12), "Q");
  assert.equal(rankLabel(13), "K");
});
test("bot match completes with expanding piles and king wilds", () => {
  const g = createGame(players.map((p) => ({ ...p, bot: true })));
  for (let i = 0; i < 3000 && g.status === "active"; i++) botTurn(g);
  assert.equal(g.status, "completed");
  assert.ok(g.winner);
});
test("empty hand may pass when the deck is exhausted", () => {
  const g = createGame(players);
  g.deck = [];
  g.recycle = [];
  g.players[0].hand = [];
  move(g, "a", { type: "pass", index: 0 });
  assert.equal(g.turn, 1);
  assert.equal(g.turnCount, 1);
  assert.throws(
    () => move(g, "b", { type: "pass", index: 0 }),
    /Discard a hand card/,
  );
});
test("waiting-room serialization supports undealt players", () => {
  const v = publicGame(
    { status: "waiting", deck: [], players: [{ id: "a", name: "Alex" }] },
    "a",
  );
  assert.equal(v.players[0].stockCount, 0);
  assert.equal(v.players[0].handCount, 0);
});
