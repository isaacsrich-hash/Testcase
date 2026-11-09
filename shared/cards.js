export const SUITS = ["♠", "♥", "♦", "♣"];
export const rankOf = (card) =>
  typeof card === "number" ? (card === 0 ? 13 : card) : card?.rank;
export const suitOf = (card) =>
  typeof card === "object" && card ? card.suit : SUITS[(rankOf(card) || 1) % 4];
export const rankLabel = (rank) =>
  ({ 1: "A", 11: "J", 12: "Q", 13: "K" })[rank] || String(rank);
export const cardLabel = (card) => `${rankLabel(rankOf(card))}${suitOf(card)}`;
export const cardName = (card) =>
  `${{ 1: "Ace", 11: "Jack", 12: "Queen", 13: "King" }[rankOf(card)] || rankOf(card)} of ${{ "♠": "spades", "♥": "hearts", "♦": "diamonds", "♣": "clubs" }[suitOf(card)]}${rankOf(card) === 13 ? " (wild)" : ""}`;
export function canPlace(card, pile) {
  const rank = rankOf(card),
    needed = pile.length + 1;
  return (
    Number.isInteger(rank) &&
    needed <= 12 &&
    (needed === 1 ? rank === 1 : rank === 13 || rank === needed)
  );
}
export function suggestMove(player, builds) {
  const options = [
    {
      source: "stock",
      index: 0,
      card: player.stock ? player.stock.at(-1) : player.top,
    },
    ...(player.hand || []).map((card, index) => ({
      source: "hand",
      index,
      card,
    })),
    ...player.discards.map((pile, index) => ({
      source: "discard",
      index,
      card: pile.at(-1),
    })),
  ];
  for (const option of options) {
    const target = builds.findIndex((pile) => canPlace(option.card, pile));
    if (target >= 0) return { type: "play", ...option, target };
  }
  if (!player.hand?.length) return { type: "pass", index: 0 };
  // Keep low cards accessible on discard piles rather than burying them.
  const hand = player.hand
    .map((card, index) => ({ card, index }))
    .sort((a, b) => rankOf(b.card) - rankOf(a.card));
  for (const { card, index } of hand) {
    const pile = player.discards.findIndex(
      (p) => p.length && rankOf(p.at(-1)) >= rankOf(card),
    );
    if (pile >= 0) return { type: "discard", index, pile };
  }
  const pile = player.discards.findIndex((p) => !p.length);
  if (pile >= 0) return { type: "discard", index: hand[0].index, pile };
  const topRanks = player.discards.map((p) => rankOf(p.at(-1)));
  return {
    type: "discard",
    index: hand[0].index,
    pile: topRanks.indexOf(Math.max(...topRanks)),
  };
}
