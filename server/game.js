import { randomInt } from "node:crypto";
import {
  SUITS,
  rankOf,
  rankLabel,
  cardLabel,
  canPlace,
  suggestMove,
} from "../shared/cards.js";
function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
export function shuffledDeck() {
  return shuffle(
    Array.from({ length: 3 }, (_, pack) =>
      SUITS.flatMap((suit) =>
        Array.from({ length: 13 }, (_, i) => ({
          rank: i + 1,
          suit,
          id: `${pack}-${suit}-${i + 1}`,
        })),
      ),
    ).flat(),
  );
}
export function createGame(players) {
  const g = {
    rulesVersion: 3,
    deck: shuffledDeck(),
    recycle: [],
    players: players.map((p) => ({
      ...p,
      stock: [],
      hand: [],
      discards: [[], [], [], []],
      moves: 0,
    })),
    builds: [[]],
    turn: 0,
    turnCount: 0,
    status: "active",
    winner: null,
    moves: 0,
    log: [],
  };
  for (const p of g.players) p.stock = g.deck.splice(-20);
  for (const p of g.players) fill(g, p);
  return g;
}
export function normalizeGame(g) {
  if (g.status === "waiting") return g;
  if (!g.rulesVersion) {
    // Legacy numeric cards remain playable: 0 is displayed and treated as a king.
    // No stocks, hands, history, scores, or chat are reset by the rules upgrade.
    g.rulesVersion = 2;
    g.builds = (g.builds || []).filter((p) => p.length);
    g.builds.push([]);
    g.turnCount ??= 0;
  }
  if (g.status === "active" && g.rulesVersion < 3) {
    const handSizes = g.players.map((p) => p.hand.length);
    for (const p of g.players) {
      const keep = [];
      for (const card of p.hand) {
        if (rankOf(card) === 1) tableAce(g, p, card);
        else keep.push(card);
      }
      p.hand = keep;
    }
    g.players.forEach((p, index) => fill(g, p, handSizes[index]));
    g.rulesVersion = 3;
    g.log = g.log.slice(-30);
  }
  return g;
}
function tableAce(g, p, card) {
  let index = g.builds.findIndex((pile) => pile.length === 0);
  if (index < 0) {
    index = g.builds.length;
    g.builds.push([]);
  }
  g.builds[index].push(card);
  g.builds.push([]);
  g.log.push(
    `${p.name} drew ${cardLabel(card)} → table pile ${index + 1} automatically.`,
  );
}
function fill(g, p, target = 5) {
  while (p.hand.length < target) {
    if (!g.deck.length) g.deck = shuffle(g.recycle.splice(0));
    if (!g.deck.length) break;
    const card = g.deck.pop();
    if (rankOf(card) === 1) tableAce(g, p, card);
    else p.hand.push(card);
  }
}
export function move(g, id, action) {
  if (g.status !== "active") throw Error("This match is not active.");
  normalizeGame(g);
  const p = g.players[g.turn];
  if (p.id !== id) throw Error("Wait for your turn.");
  const index = Number(action.index);
  if (!Number.isInteger(index) || index < 0) throw Error("Choose a card.");
  if (action.type === "pass") {
    if (p.hand.length) throw Error("Discard a hand card to end your turn.");
    g.log.push(`${p.name} passed with an empty hand.`);
    g.turn = (g.turn + 1) % g.players.length;
    g.turnCount++;
    fill(g, g.players[g.turn]);
  } else if (action.type === "discard") {
    const pile = Number(action.pile);
    if (
      pile < 0 ||
      pile > 3 ||
      !Number.isInteger(pile) ||
      index >= p.hand.length
    )
      throw Error("Choose a card from your hand and a discard pile.");
    const card = p.hand.splice(index, 1)[0];
    p.discards[pile].push(card);
    g.log.push(`${p.name} discarded ${cardLabel(card)} → discard ${pile + 1}.`);
    g.turn = (g.turn + 1) % g.players.length;
    g.turnCount++;
    fill(g, g.players[g.turn]);
  } else if (action.type === "play") {
    const target = Number(action.target);
    if (!Number.isInteger(target) || target < 0 || target >= g.builds.length)
      throw Error("Choose a building pile.");
    let source;
    if (action.source === "hand") source = p.hand;
    else if (action.source === "stock") source = p.stock;
    else if (action.source === "discard" && index < 4)
      source = p.discards[index];
    else throw Error("Choose a card.");
    const at = action.source === "hand" ? index : source.length - 1;
    if (at < 0 || at >= source.length) throw Error("That pile is empty.");
    const card = source[at],
      pile = g.builds[target],
      needed = pile.length + 1;
    if (!canPlace(card, pile))
      throw Error(
        needed === 1
          ? "Only an ace can start a new pile. Kings cannot replace an ace."
          : `This pile needs ${rankLabel(needed)} or a king.`,
      );
    source.splice(at, 1);
    pile.push(card);
    g.log.push(
      `${p.name} played ${cardLabel(card)}${rankOf(card) === 13 ? " as " + rankLabel(needed) : ""}${action.source === "stock" ? " from stock" : ""} → pile ${target + 1}.`,
    );
    if (needed === 1) g.builds.push([]);
    if (pile.length === 12) {
      g.recycle.push(...pile);
      g.builds.splice(target, 1);
      g.log.push(`${p.name} completed an A–Q run. Cards recycled.`);
    }
    if (!p.stock.length) {
      g.status = "completed";
      g.winner = p.id;
      g.points =
        25 +
        g.players.reduce(
          (sum, q) => sum + (q.id !== id ? q.stock.length : 0),
          0,
        );
      g.log.push(`${p.name} won the match!`);
    } else if (!p.hand.length) fill(g, p);
  } else throw Error("Unknown action.");
  p.moves = (p.moves || 0) + 1;
  g.moves++;
  g.log = g.log.slice(-30);
  return g;
}
export function botTurn(g) {
  normalizeGame(g);
  const p = g.players[g.turn];
  if (!p.bot || g.status !== "active") return;
  for (let n = 0; n < 150 && g.status === "active"; n++) {
    const action = suggestMove(p, g.builds);
    if (action.type !== "play") break;
    move(g, p.id, action);
  }
  if (g.status === "active") {
    const action = suggestMove(p, g.builds);
    if (action.type !== "play") move(g, p.id, action);
    else
      move(
        g,
        p.id,
        p.hand.length
          ? { type: "discard", index: 0, pile: 0 }
          : { type: "pass", index: 0 },
      );
  }
}
export function publicGame(g, id) {
  // Room upgrades are committed by the API before serialization. Reads must not
  // re-deal or shuffle independently across concurrent clients.
  return {
    ...g,
    deck: undefined,
    recycle: undefined,
    deckCount: g.deck?.length || 0,
    players: g.players.map((p) => ({
      ...p,
      stock: undefined,
      stockCount: p.stock?.length || 0,
      top: p.stock?.at(-1),
      hand: p.id === id ? p.hand : undefined,
      handCount: p.hand?.length || 0,
    })),
  };
}
