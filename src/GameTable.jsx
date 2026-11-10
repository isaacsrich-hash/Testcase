import React, { useEffect, useRef, useState } from "react";
import {
  Volume2,
  VolumeX,
  Settings,
  Plus,
  Lightbulb,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  Eye,
  X,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import {
  rankOf,
  rankLabel,
  suitOf,
  cardName,
  canPlace,
  suggestMove,
} from "../shared/cards.js";

export function PlayingCard({
  value,
  back = false,
  empty = false,
  selected = false,
  onClick,
  disabled = false,
  label,
  small = false,
  effective,
  draggable = false,
  onDragStart,
}) {
  const rank = rankOf(value),
    suit = suitOf(value),
    red = suit === "♥" || suit === "♦";
  const interactive = !!onClick,
    Tag = interactive ? "button" : "span";
  return (
    <Tag
      {...(interactive
        ? { type: "button", disabled, "aria-pressed": selected }
        : {})}
      aria-label={
        label ||
        (back ? "Face down card" : empty ? "Empty pile" : cardName(value))
      }
      className={`playing-card ${small ? "compact-card" : ""} ${red ? "red-suit" : ""} ${back ? "card-back" : ""} ${empty ? "empty-card" : ""} ${rank === 13 && !empty && !back ? "king-card" : ""} ${selected ? "is-selected" : ""}`}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
    >
      {back ? (
        <>
          <span className="card-back-border" />
          <b>
            S<span>&</span>M
          </b>
        </>
      ) : empty ? (
        <span className="empty-label">
          <span className="empty-word">EMPTY</span>
          <span className="empty-mark">—</span>
        </span>
      ) : (
        <>
          <span className="corner upper">
            {rankLabel(rank)}
            <small>{suit}</small>
          </span>
          {rank === 13 && effective ? (
            <span className="king-assignment">
              <b>WILD</b>
              <small>={rankLabel(effective)}</small>
            </span>
          ) : (
            <span className="card-pip">{suit}</span>
          )}
          <span className="corner lower">
            {rankLabel(rank)}
            <small>{suit}</small>
          </span>
        </>
      )}
    </Tag>
  );
}
function dragData(event, selection, onSelect) {
  onSelect(selection);
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData(
    "application/x-spite-card",
    JSON.stringify(selection),
  );
}
function readDrag(event) {
  try {
    const card = JSON.parse(
      event.dataTransfer.getData("application/x-spite-card"),
    );
    return ["hand", "stock", "discard"].includes(card.source) &&
      Number.isInteger(card.index)
      ? card
      : null;
  } catch {
    return null;
  }
}
function DiscardPile({
  pile,
  index,
  player,
  own,
  selected,
  onSelect,
  onDiscard,
  canAct,
  busy,
  onInspect,
}) {
  const viewport = useRef(null);
  useEffect(() => {
    const el = viewport.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [pile.length]);
  return (
    <div className="discard-stack">
      <div
        className="pile-viewport"
        ref={viewport}
        role="region"
        aria-label={`${own ? "Your" : player.name + "’s"} discard pile ${index + 1} stack`}
        tabIndex={pile.length > 3 ? 0 : undefined}
        onDragOver={(event) => {
          if (canAct) event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          const card = readDrag(event);
          if (canAct && card?.source === "hand") onDiscard(index, card);
        }}
      >
        <div className="discard-peek">
          {pile.slice(0, -1).map((card, i) => (
            <span
              className={`peek-label ${["♥", "♦"].includes(suitOf(card)) ? "red-suit" : ""}`}
              key={card.id || i}
              aria-label={cardName(card)}
            >
              <b>{rankLabel(rankOf(card))}</b>
              <small
                className={["♥", "♦"].includes(suitOf(card)) ? "red-text" : ""}
              >
                {suitOf(card)}
              </small>
            </span>
          ))}
        </div>
        <PlayingCard
          small
          value={pile.at(-1)}
          empty={!pile.length}
          selected={
            own && selected?.source === "discard" && selected.index === index
          }
          disabled={!canAct || busy}
          onClick={
            own
              ? () =>
                  selected?.source === "hand"
                    ? onDiscard(index)
                    : pile.length
                      ? onSelect({ source: "discard", index })
                      : null
              : undefined
          }
          label={
            own
              ? `Discard pile ${index + 1}${pile.length ? ", top card " + cardName(pile.at(-1)) : ", empty"}`
              : `${player.name} discard pile ${index + 1}`
          }
        />
      </div>
      {pile.length > 1 ? (
        <button
          className="pile-inspect"
          onClick={() => onInspect({ playerId: player.id, index })}
          aria-label={`See all ${pile.length} cards in ${own ? "your" : player.name + "’s"} discard pile ${index + 1}`}
        >
          <Eye size={12} /> {pile.length} cards
        </button>
      ) : (
        <span className="pile-number">{index + 1}</span>
      )}
    </div>
  );
}
function Seat({
  player,
  own,
  selected,
  onSelect,
  onDiscard,
  canAct,
  busy,
  discardMode,
  current,
  onInspect,
}) {
  const hand = player.hand || [],
    piles = player.discards || [[], [], [], []];
  const selectionIs = (source, index = 0) =>
    own &&
    selected?.source === source &&
    (source === "stock" || selected.index === index);
  return (
    <div
      className={`player-lane ${own ? "own-lane" : "opponent-lane"} ${current ? "current-seat" : ""}`}
    >
      <div className="seat-profile">
        <span className="seat-avatar">
          {player.name?.[0]?.toUpperCase() || "?"}
        </span>
        <div>
          <strong>
            {player.name}
            {own && <span className="you-tag">YOU</span>}
            {player.bot && <span className="bot-tag">BOT</span>}
          </strong>
          <span>
            {own
              ? current
                ? "Select a card to play"
                : "Waiting for your turn"
              : `${current ? "Playing" : "Waiting"} · ${player.handCount} cards in hand`}
          </span>
        </div>
      </div>
      <div className="seat-stock">
        <div className="stock-top">
          <PlayingCard
            value={player.top}
            empty={!player.stockCount}
            selected={selectionIs("stock")}
            disabled={!canAct || busy}
            onClick={
              own ? () => onSelect({ source: "stock", index: 0 }) : undefined
            }
            draggable={canAct && !busy && !!player.stockCount}
            onDragStart={(event) =>
              dragData(event, { source: "stock", index: 0 }, onSelect)
            }
            label={
              own
                ? "Your stock, " +
                  (player.stockCount ? cardName(player.top) : "empty")
                : `${player.name} stock, ${player.stockCount} cards left`
            }
          />
          <span className="stock-count">{player.stockCount}</span>
        </div>
        <span className="zone-title">STOCK / PAY-OFF</span>
      </div>
      <div
        className={`seat-discards ${discardMode && own ? "choose-discard" : ""}`}
      >
        <div className="discard-piles">
          {piles.map((pile, index) => (
            <DiscardPile
              key={index}
              pile={pile}
              index={index}
              player={player}
              own={own}
              selected={selected}
              onSelect={onSelect}
              onDiscard={onDiscard}
              canAct={canAct}
              busy={busy}
              onInspect={onInspect}
            />
          ))}
        </div>
        <span className="zone-title">
          {discardMode && own
            ? "CHOOSE A PILE TO END YOUR TURN"
            : "DISCARD PILES"}
        </span>
      </div>
      <div className="seat-hand">
        <div className={own ? "hand-cards" : "opponent-hand"}>
          {own
            ? hand.map((card, index) => (
                <PlayingCard
                  key={card.id || index}
                  value={card}
                  selected={selectionIs("hand", index)}
                  disabled={!canAct || busy}
                  onClick={() => onSelect({ source: "hand", index })}
                  draggable={canAct && !busy}
                  onDragStart={(event) =>
                    dragData(event, { source: "hand", index }, onSelect)
                  }
                />
              ))
            : Array.from(
                { length: Math.min(player.handCount || 0, 5) },
                (_, i) => <PlayingCard key={i} back />,
              )}
        </div>
        <span className="zone-title">
          {own ? (
            <>
              YOUR HAND <span className="hand-swipe">· SWIPE ↔</span>
            </>
          ) : (
            "HAND"
          )}
        </span>
      </div>
    </div>
  );
}
export default function GameTable({
  game: g,
  room,
  user,
  selected,
  onSelect,
  onPlay,
  onDiscard,
  onPass,
  onRematch,
  onRules,
  onOptions,
  onToast,
  onNewGame,
  onExit,
  onChat,
  connected = true,
  busy,
  sound,
  onSound,
}) {
  const [discardMode, setDiscardMode] = useState(false),
    [hintTarget, setHintTarget] = useState(null),
    [logOpen, setLogOpen] = useState(false),
    [inspected, setInspected] = useState(null);
  const buildsEnd = useRef(null),
    logEnd = useRef(null);
  const me = g.players.find((p) => p.id === user.id),
    opponents = g.players.filter((p) => p.id !== user.id),
    myTurn = g.status === "active" && g.players[g.turn]?.id === user.id;
  const emptyCount = g.builds.filter((p) => !p.length).length,
    activePiles = g.builds.filter((p) => p.length).length;
  useEffect(() => {
    setDiscardMode(false);
    setHintTarget(null);
  }, [room.version]);
  useEffect(() => {
    const log = logEnd.current?.parentElement;
    if (log) log.scrollTop = log.scrollHeight;
  }, [g.log?.length]);
  useEffect(() => {
    if (activePiles > 4) {
      const piles = buildsEnd.current?.parentElement;
      if (piles) piles.scrollTop = piles.scrollHeight;
    }
  }, [activePiles]);
  useEffect(() => {
    if (!inspected) return;
    const close = (event) => {
      if (event.key === "Escape") setInspected(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [inspected]);
  const viewedPlayer = g.players.find((p) => p.id === inspected?.playerId);
  const viewedPile = viewedPlayer?.discards?.[inspected?.index];
  function pickCard(card) {
    setHintTarget(null);
    onSelect(card);
  }
  function hint() {
    if (!myTurn) {
      onToast("Hints are available on your turn.");
      return;
    }
    const action = suggestMove(me, g.builds);
    if (action.type === "play") {
      onSelect({ source: action.source, index: action.index });
      setHintTarget(action.target);
      onToast(
        `Try ${cardName(action.card)} from ${action.source === "stock" ? "your stock" : action.source === "hand" ? "your hand" : "a discard pile"} on pile ${action.target + 1}.`,
      );
    } else {
      setDiscardMode(true);
      if (action.type === "discard")
        onSelect({ source: "hand", index: action.index });
      onToast(
        action.type === "pass"
          ? "Your hand is empty. You can pass this turn."
          : "No building move is available. Choose a hand card and a discard pile to end your turn.",
      );
    }
  }
  function endTurn() {
    if (!myTurn) return;
    if (!me.handCount) {
      onPass();
      return;
    }
    setDiscardMode(true);
    onToast(
      selected?.source === "hand"
        ? "Choose one of your four discard piles."
        : "Select a hand card, then place it on a discard pile to end your turn.",
    );
  }
  return (
    <section className="classic-table" aria-label="Spite n Malice card table">
      <header className="classic-table-header">
        <div className="table-wordmark">
          SPITE <i>n</i> MALICE<span>THE CARD TABLE</span>
        </div>
        <div className="table-meta">
          <button className="exit-game" onClick={onExit}>
            <ArrowLeft size={15} /> Matches
          </button>
          <button className="classic-new-game" onClick={onNewGame}>
            <Plus size={15} /> New family game
          </button>
          <span>
            Round <b>{Math.floor((g.turnCount || 0) / g.players.length) + 1}</b>
          </span>
          <span>
            Draw pile <b>{g.deckCount}</b>
          </span>
          <span className="practice-label">
            {room.practice ? "Practice" : "Family match"}
          </span>
          <button
            aria-label={sound ? "Mute sound" : "Enable sound"}
            onClick={onSound}
          >
            {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button aria-label="Table options" onClick={onOptions}>
            <Settings size={18} />
          </button>
        </div>
      </header>
      <div className="opponent-lanes">
        {opponents.map((player) => (
          <Seat
            key={player.id}
            player={player}
            own={false}
            selected={null}
            onSelect={() => {}}
            onDiscard={() => {}}
            onInspect={setInspected}
            canAct={false}
            current={
              g.status === "active" && g.players[g.turn]?.id === player.id
            }
          />
        ))}
      </div>
      <div className="table-middle">
        <aside className="table-help">
          <section className="race-panel">
            <h3>RACE TO ZERO</h3>
            {g.players.map((p) => (
              <div key={p.id}>
                <span>
                  {p.id === user.id ? "You" : p.name}
                  <b>{p.stockCount} left</b>
                </span>
                <progress max="20" value={p.stockCount} />
              </div>
            ))}
          </section>
          <button className="how-panel" onClick={onRules}>
            <h3>HOW TO PLAY</h3>
            <p>
              Build A → Q in any suit. Kings are wild after the ace. Empty your
              stock first to win.
            </p>
            <span>
              Read the rules <ArrowRight size={13} />
            </span>
          </button>
        </aside>
        <div className="centre-area">
          <div className="centre-heading">
            <span>SHARED BUILDING PILES</span>
            <small>{activePiles} active · Ace to start</small>
          </div>
          <div className="building-belt">
            <div className="centre-draw">
              <PlayingCard back />
              <span className="draw-count">{g.deckCount}</span>
              <small>DRAW</small>
            </div>
            <div className="shared-piles">
              {g.builds.map((pile, index) => {
                const top = pile.at(-1),
                  allowed =
                    selected &&
                    myTurn &&
                    canPlace(
                      selected.source === "stock"
                        ? me.top
                        : selected.source === "hand"
                          ? me.hand?.[selected.index]
                          : me.discards?.[selected.index]?.at(-1),
                      pile,
                    );
                return (
                  <div
                    className={`shared-build ${!pile.length ? "ace-build" : ""} ${hintTarget === index ? "hinted-build" : ""}`}
                    key={index}
                  >
                    <button
                      type="button"
                      className={`building-target ${allowed ? "legal-target" : ""}`}
                      disabled={!myTurn || busy}
                      aria-label={
                        pile.length
                          ? `Play to building pile ${index + 1}, needs ${rankLabel(pile.length + 1)}`
                          : "Play ace to start a new pile"
                      }
                      onClick={() => onPlay(index)}
                      onDragOver={(event) => {
                        if (myTurn) event.preventDefault();
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const card = readDrag(event);
                        if (myTurn && card) onPlay(index, card);
                      }}
                    >
                      {pile.length ? (
                        <PlayingCard
                          value={top}
                          effective={
                            rankOf(top) === 13 ? pile.length : undefined
                          }
                        />
                      ) : (
                        <span className="ace-placeholder">
                          <b>A</b>
                          <span>PLAY ACE</span>
                          <small>NEW PILE</small>
                        </span>
                      )}
                    </button>
                    <span className="next-rank">
                      {pile.length
                        ? `NEXT: ${rankLabel(pile.length + 1)}`
                        : "DROP HERE"}
                    </span>
                  </div>
                );
              })}
              <span ref={buildsEnd} />
            </div>
          </div>
          <p className="ace-note">
            Only an ace opens a new pile. More aces? More space. No pile limit.
          </p>
        </div>
        <aside className="table-controls">
          <section className={"game-log " + (logOpen ? "log-open" : "")}>
            <h3>GAME LOG</h3>
            <div>
              {g.log?.length ? (
                g.log
                  .slice(-8)
                  .map((line, i) => <p key={`${g.moves}-${i}`}>{line}</p>)
              ) : (
                <p>The table is ready. Play an ace to begin.</p>
              )}
              <span ref={logEnd} />
            </div>
          </section>
          <button
            className="end-turn-button"
            disabled={busy || (!myTurn && g.status !== "completed")}
            onClick={g.status === "completed" ? onRematch : endTurn}
          >
            {g.status === "completed" ? "PLAY AGAIN" : "END TURN · DISCARD"}
          </button>
          <button
            className="hint-button"
            disabled={busy || !myTurn}
            onClick={hint}
          >
            <Lightbulb size={16} /> HINT
          </button>
          <button className="rules-button" onClick={onRules}>
            <BookOpen size={16} /> RULES
          </button>
          <button
            className="log-toggle"
            onClick={() => setLogOpen(!logOpen)}
            aria-expanded={logOpen}
          >
            GAME LOG
          </button>
        </aside>
      </div>
      <div className={`classic-turn ${myTurn ? "my-turn" : ""}`} role="status">
        <span />
        <strong>
          {" "}
          {g.status === "completed"
            ? `${g.players.find((p) => p.id === g.winner)?.name} wins!`
            : myTurn
              ? `Your move, ${user.name}!`
              : `${g.players[g.turn]?.name}’s turn`}
        </strong>
        <small>
          {g.status === "completed"
            ? "Saved to match history"
            : discardMode
              ? "Select a hand card, then a discard pile"
              : myTurn
                ? "Click or drag a card to play"
                : "Your match is saved. Return whenever you’re ready."}
        </small>
      </div>
      <Seat
        player={{ ...me, name: user.name }}
        own
        selected={selected}
        onSelect={pickCard}
        onDiscard={onDiscard}
        onInspect={setInspected}
        canAct={myTurn}
        busy={busy}
        discardMode={discardMode}
        current={myTurn}
      />
      <footer className="classic-table-footer">
        <span>
          <ShieldCheck size={15} />{" "}
          {busy
            ? "Saving…"
            : connected
              ? "Every move saved automatically"
              : "Reconnecting — saved progress is kept"}
        </span>
        <button onClick={onChat}>
          <MessageCircle size={16} /> Table talk
        </button>
      </footer>
      {viewedPile && (
        <div
          className="pile-inspection-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setInspected(null);
          }}
        >
          <section
            className="pile-inspection"
            role="dialog"
            aria-modal="true"
            aria-label={`Discard pile ${inspected.index + 1} cards`}
          >
            <button
              className="pile-inspection-close"
              aria-label="Close discard pile"
              onClick={() => setInspected(null)}
            >
              <X size={22} />
            </button>
            <h2>
              {viewedPlayer.id === user.id ? "Your" : viewedPlayer.name + "’s"}{" "}
              discard pile {inspected.index + 1}
            </h2>
            <p>Bottom → top. Only the top card can be played.</p>
            <div className="inspected-cards">
              {viewedPile.map((card, i) => (
                <div key={card.id || i}>
                  <PlayingCard value={card} />
                  <span>
                    {i === viewedPile.length - 1
                      ? "TOP CARD"
                      : i === 0
                        ? "BOTTOM CARD"
                        : `Card ${i + 1}`}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
