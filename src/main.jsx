import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Plus,
  House,
  Users,
  Trophy,
  History,
  Settings,
  HelpCircle,
  Bell,
  ChevronDown,
  ChevronRight,
  Check,
  CheckCheck,
  ShieldCheck,
  Flame,
  Star,
  Send,
  MessageCircle,
  Globe2,
  Volume2,
  VolumeX,
  X,
  Copy,
  Link,
  Play,
  Flag,
  Leaf,
  Spade,
  Sparkles,
  Target,
  BookOpen,
  LogOut,
  Clock,
  MoreHorizontal,
  Crown,
} from "lucide-react";
import "./style.css";
// Preserve existing player sessions and recovery-file compatibility after rebranding.
const tokenKey = "kindred-token";
let auth = localStorage.getItem(tokenKey) || "";
async function api(path, body, method) {
  const r = await fetch("/api" + path, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + auth,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Could not connect.");
  return data;
}
const initials = (n) =>
  n
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("") || "SM";
const flags = {
  Canada: "🇨🇦",
  "United Kingdom": "🇬🇧",
  Australia: "🇦🇺",
  "United States": "🇺🇸",
  India: "🇮🇳",
  "South Africa": "🇿🇦",
  France: "🇫🇷",
  Other: "🌎",
};
function Avatar({
  name = "Alex",
  index = 0,
  size = "",
  flag = false,
  country,
}) {
  return (
    <span className={`avatar av${index % 4} ${size}`}>
      {initials(name)}
      {flag && <span className="avatar-flag">{flags[country] || "🌍"}</span>}
    </span>
  );
}
function Card({
  value,
  onClick,
  selected,
  back = false,
  empty = false,
  small = false,
  label,
  disabled = false,
}) {
  return (
    <button
      disabled={disabled}
      aria-label={
        label ||
        (back
          ? "Face down card"
          : empty
            ? "Empty card slot"
            : value === 0
              ? "Wild card"
              : `Card ${value}`)
      }
      onClick={onClick}
      className={`card ${back ? "card-back" : ""} ${empty ? "card-empty" : ""} ${value === 0 && !empty ? "wild" : ""} ${selected ? "selected" : ""} ${small ? "small" : ""} ${!empty && value > 0 && value % 2 === 0 ? "red" : ""}`}
    >
      {back ? (
        <span className="back-medallion">
          <Spade size={22} />
        </span>
      ) : empty ? (
        <Plus size={21} />
      ) : (
        <>
          <span className="card-corner">
            {value === 0 ? "W" : value}
            <span>{value === 0 ? "✦" : "♦"}</span>
          </span>
          <span className="card-symbol">
            {value === 0 ? <Sparkles /> : value % 2 === 0 ? "♦" : <Spade />}
          </span>
          <span className="card-corner bottom">
            {value === 0 ? "W" : value}
            <span>{value === 0 ? "✦" : "♦"}</span>
          </span>
        </>
      )}
    </button>
  );
}
function App() {
  const [user, setUser] = useState(null),
    [dashboard, setDashboard] = useState({ rooms: [], leaderboard: [] }),
    [room, setRoom] = useState(null),
    [page, setPage] = useState("table"),
    [modal, setModal] = useState(null),
    [selected, setSelected] = useState(null),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [sound, setSound] = useState(false),
    [copied, setCopied] = useState(false),
    [connected, setConnected] = useState(false);
  const chatBottom = useRef(null),
    initialized = useRef(false);
  async function refresh() {
    const d = await api("/dashboard");
    setDashboard(d);
    setUser(d.user);
    return d;
  }
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    (async () => {
      try {
        const u = await api("/session", { token: auth });
        auth = u.token;
        localStorage.setItem(tokenKey, auth);
        setUser(u);
        const d = await refresh();
        setConnected(true);
        const code = new URLSearchParams(location.search).get("invite");
        if (code) {
          setModal({ type: "join", code });
        }
        const active = d.rooms.find(
          (r) => r.state.status === "active" || r.state.status === "waiting",
        );
        if (active) setRoom(await api("/rooms/" + active.id));
        else if (!code) {
          const r = await api("/rooms", {
            practice: true,
            title: "A little friendly rivalry",
          });
          setRoom(r);
          await refresh();
        }
      } catch (e) {
        setConnected(false);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  useEffect(() => {
    if (!room) return;
    let disposed = false;
    const timer = setInterval(async () => {
      try {
        const r = await api("/rooms/" + room.id);
        if (!disposed) {
          setRoom(r);
          setConnected(true);
        }
      } catch {
        if (!disposed) setConnected(false);
      }
    }, 2000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [room?.id]);
  useEffect(() => {
    chatBottom.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [room?.messages?.length]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  async function task(fn) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
      setToast(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function newRoom(practice, title) {
    await task(async () => {
      const r = await api("/rooms", { practice, title });
      setRoom(r);
      setSelected(null);
      setPage("table");
      setModal(practice ? null : { type: "invite" });
      await refresh();
    });
  }
  function chime() {
    if (!sound) return;
    try {
      const a = new AudioContext(),
        o = a.createOscillator(),
        v = a.createGain();
      o.connect(v);
      v.connect(a.destination);
      v.gain.value = 0.035;
      o.frequency.value = 600;
      o.start();
      v.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.18);
      o.stop(a.currentTime + 0.2);
      o.onended = () => a.close();
    } catch {}
  }
  async function play(target) {
    if (!selected) {
      setToast("Select a card from your hand, stock, or discard pile first.");
      return;
    }
    await task(async () => {
      const r = await api("/rooms/" + room.id + "/move", {
        ...selected,
        type: "play",
        target,
        version: room.version,
      });
      setRoom(r);
      setSelected(null);
      chime();
      if (r.state.status === "completed")
        setToast(
          r.state.winner === user.id
            ? "You won! A little bragging is allowed. 🎉"
            : "Good game! Ready for a rematch?",
        );
      await refresh();
    });
  }
  async function discard(pile) {
    if (selected?.source !== "hand") {
      setToast(
        "Choose a card from your hand, then a discard pile to end your turn.",
      );
      return;
    }
    await task(async () => {
      const r = await api("/rooms/" + room.id + "/move", {
        type: "discard",
        index: selected.index,
        pile,
        version: room.version,
      });
      setRoom(r);
      setSelected(null);
      await refresh();
    });
  }
  async function copyInvite() {
    const url = location.origin + "/?invite=" + room.code;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setToast("Copy the invitation link shown below.");
    }
  }
  const g = room?.state,
    me = g?.players.find((p) => p.id === user?.id),
    opponents = g?.players.filter((p) => p.id !== user?.id) || [],
    myTurn = g?.status === "active" && g.players[g.turn]?.id === user?.id;
  const completed = dashboard.rooms.filter(
      (r) => r.state.status === "completed",
    ),
    wins = completed.filter((r) => r.state.winner === user?.id).length,
    totalMoves = dashboard.rooms.reduce(
      (n, r) =>
        n + (r.state.players.find((p) => p.id === user?.id)?.moves || 0),
      0,
    ),
    xp = totalMoves * 10 + wins * 100,
    level = Math.floor(xp / 500) + 1;
  const nav = [
    ["table", House, "Game room"],
    ["family", Users, "My family"],
    ["leaderboard", Trophy, "Leaderboard"],
    ["history", History, "Match history"],
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          aria-label="Spite n Malice home"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            setPage("table");
          }}
        >
          <span className="brand-icon">
            <Spade size={25} fill="currentColor" />
          </span>
          <span className="brand-name">
            Spite <i>n</i>
            <strong>
              Malice<span>♠</span>
            </strong>
          </span>
        </a>
        <div className="brand-tagline">FAMILY. CARDS. CHAOS.</div>
        <div
          className="family-switch"
          onClick={() => setPage("family")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && setPage("family")}
        >
          <span className="family-icon">⚡</span>
          <div>
            <strong>The family room</strong>
            <small>Your favorite rivals.</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">THE CLUBHOUSE</div>
        <nav>
          {nav.map(([key, Icon, label]) => (
            <button
              key={key}
              className={"nav-item " + (page === key ? "active" : "")}
              onClick={() => {
                setPage(key);
                refresh().catch(() => {});
              }}
            >
              <Icon size={19} />
              {label}
              {key === "table" && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-invite">
          <span className="invite-art">
            <Users size={27} />
            <span>+</span>
          </span>
          <h3>
            Got a rival
            <br />
            in the family?
          </h3>
          <p>
            Save them a seat.
            <br />
            Then show no mercy.
          </p>
          <button onClick={() => setModal({ type: "create" })}>
            Invite your family <ArrowUpRight size={15} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <button onClick={() => setModal({ type: "rules" })}>
            <HelpCircle size={18} />
            How to play
          </button>
          <button onClick={() => setModal({ type: "profile" })}>
            <Settings size={18} />
            Settings
          </button>
          <div
            className="user-panel"
            onClick={() => setModal({ type: "profile" })}
            role="button"
            tabIndex={0}
            onKeyDown={(e) =>
              e.key === "Enter" && setModal({ type: "profile" })
            }
          >
            <Avatar name={user?.name} />
            <div>
              <strong>{user?.name || "Connecting…"}</strong>
              <small>
                Level {level} · {level < 3 ? "Rising rival" : "Card shark"}
              </small>
            </div>
            <ChevronRight size={16} />
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="mobile-wordmark">
            Spite <i>n</i> Malice <Spade size={16} />
          </div>
          <div className="breadcrumb">
            <Spade size={15} /> The family arena <span>/</span>{" "}
            <strong>{nav.find((n) => n[0] === page)?.[2]}</strong>
          </div>
          <div className="top-actions">
            <button
              className="level-badge"
              onClick={() => setModal({ type: "quests" })}
            >
              <Star size={15} fill="currentColor" /> LVL {level}
              <span>{xp} XP</span>
            </button>
            <span className={"connection " + (!connected ? "offline" : "")}>
              <i />{" "}
              {busy
                ? "Saving…"
                : connected
                  ? "All progress saved"
                  : "Reconnecting…"}
            </span>
            <button
              className="icon-button notification"
              aria-label="Notifications"
              onClick={() => setModal({ type: "notifications" })}
            >
              <Bell size={20} />
              <b />
            </button>
            <span className="top-divider" />
            <button
              className="profile-button"
              aria-label="Player settings"
              onClick={() => setModal({ type: "profile" })}
            >
              <Avatar name={user?.name} size="tiny" />
            </button>
          </div>
        </header>
        <main>
          <section
            className={"page-heading " + (page === "table" ? "arena-hero" : "")}
          >
            <div className="hero-copy">
              <div className="eyebrow">
                <Sparkles size={12} /> FAMILY GAME NIGHT. UPGRADED.
              </div>
              <h1>
                {page === "table" ? (
                  <>
                    Play your cards.
                    <br />
                    <span>Stir up trouble.</span>
                  </>
                ) : page === "family" ? (
                  "Your favorite rivals."
                ) : page === "leaderboard" ? (
                  "Earn your bragging rights."
                ) : (
                  "Every rivalry has a story."
                )}
              </h1>
              <p>
                {page === "table"
                  ? "Different countries. One table. Absolutely no mercy."
                  : page === "family"
                    ? "Bring the whole crew. Distance doesn’t get a seat at this table."
                    : page === "leaderboard"
                      ? "Big moves. Bigger wins. Who’s running the family table?"
                      : "Your saved matches and legendary comebacks, all in one place."}
              </p>
              <div className="hero-actions">
                <button
                  className="primary"
                  onClick={() => setModal({ type: "create" })}
                >
                  <Plus size={17} /> New family game
                </button>
                <button
                  className="hero-join"
                  onClick={() => setModal({ type: "join" })}
                >
                  <Link size={15} /> Join a table <ArrowUpRight size={14} />
                </button>
              </div>
            </div>
            {page === "table" && (
              <div className="hero-art" aria-hidden="true">
                <span className="hero-orbit orbit-one" />
                <span className="hero-orbit orbit-two" />
                <span className="hero-spark spark-one">✦</span>
                <span className="hero-spark spark-two">✦</span>
                <div className="hero-card hero-card-one">
                  <span>
                    7<small>♦</small>
                  </span>
                  <b>♦</b>
                </div>
                <div className="hero-card hero-card-two">
                  <span>
                    W<small>✦</small>
                  </span>
                  <Sparkles size={45} />
                  <em>WILD SIDE</em>
                </div>
                <div className="hero-card hero-card-three">
                  <span>
                    1<small>♠</small>
                  </span>
                  <Spade size={46} fill="currentColor" />
                </div>
                <span className="hero-art-tag">
                  <Flame size={13} /> BRING YOUR GAME FACE
                </span>
              </div>
            )}
          </section>
          {error && (
            <div className="error" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}
          <section className="stats-row">
            <div className="stat">
              <span className="stat-icon green">
                <Trophy size={21} />
              </span>
              <div>
                <small>VICTORIES</small>
                <strong>
                  {wins} <span>games won</span>
                </strong>
              </div>
              <span className="stat-decoration">
                <ArrowUpRight size={18} />
              </span>
            </div>
            <div className="stat">
              <span className="stat-icon orange">
                <Flame size={21} />
              </span>
              <div>
                <small>MATCHES COMPLETED</small>
                <strong>
                  {completed.length} <span>games completed</span>
                </strong>
              </div>
            </div>
            <button
              className="stat quest-stat"
              onClick={() => setModal({ type: "quests" })}
            >
              <span className="stat-icon purple">
                <Target size={21} />
              </span>
              <div>
                <small>YOUR FIRST MISSION</small>
                <strong>
                  {totalMoves >= 5
                    ? "Mission accomplished"
                    : "Make 5 moves. Claim your moment."}{" "}
                  <span>{Math.min(totalMoves, 5)}/5</span>
                </strong>
                <span className="quest-track">
                  <i
                    style={{
                      width: Math.min((totalMoves / 5) * 100, 100) + "%",
                    }}
                  />
                </span>
              </div>
              <ChevronRight size={17} />
            </button>
          </section>
          {page === "table" ? (
            <div className="game-layout">
              <div className="game-column">
                <section className="game-panel">
                  <div className="game-panel-head">
                    <div className="game-title">
                      <span className="table-icon">
                        <Spade size={18} />
                      </span>
                      <div>
                        <h2>{room?.title || "Your family table"}</h2>
                        <span>
                          {room?.practice
                            ? "A practice match · 3 players"
                            : `${g?.players.length || 0} of 4 seats filled · Private table`}
                        </span>
                      </div>
                    </div>
                    <div className="table-tools">
                      <span className="live-tag">
                        <i />
                        {room?.practice
                          ? "PRACTICE"
                          : g?.status === "waiting"
                            ? "LOBBY"
                            : "LIVE GAME"}
                      </span>
                      <button
                        className="icon-button"
                        aria-label={sound ? "Mute sound" : "Enable sound"}
                        onClick={() => setSound(!sound)}
                      >
                        {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
                      </button>
                      <button
                        className="icon-button"
                        aria-label="Table options"
                        onClick={() => setModal({ type: "tableOptions" })}
                      >
                        <MoreHorizontal size={21} />
                      </button>
                    </div>
                  </div>
                  {loading ? (
                    <div className="loading">
                      <Spade className="pulse" />
                      <h3>Setting your table…</h3>
                    </div>
                  ) : g?.status === "waiting" ? (
                    <div className="lobby">
                      <span className="lobby-art">
                        <Users size={42} />
                      </span>
                      <div className="eyebrow">SAVE A SEAT FOR YOUR PEOPLE</div>
                      <h2>The best games start with family.</h2>
                      <p>
                        Share your private invitation. Up to four players can
                        join,
                        <br />
                        and everyone’s progress stays saved.
                      </p>
                      <div className="lobby-seats">
                        {g.players.map((p, i) => (
                          <div key={p.id}>
                            <Avatar {...p} flag size="large" index={i} />
                            <strong>{p.name}</strong>
                            <small>{p.country}</small>
                          </div>
                        ))}
                        {Array.from(
                          { length: 4 - g.players.length },
                          (_, i) => (
                            <div key={i}>
                              <span className="empty-avatar">
                                <Plus />
                              </span>
                              <strong>Open seat</strong>
                              <small>Someone you love</small>
                            </div>
                          ),
                        )}
                      </div>
                      <button
                        className="primary"
                        onClick={() => setModal({ type: "invite" })}
                      >
                        <Link size={16} /> Invite family
                      </button>
                      {room.host === user?.id && (
                        <button
                          disabled={g.players.length < 2 || busy}
                          className="secondary"
                          onClick={() =>
                            task(async () => {
                              setRoom(
                                await api("/rooms/" + room.id + "/start", {}),
                              );
                              await refresh();
                            })
                          }
                        >
                          <Play size={16} /> Start game
                        </button>
                      )}
                      <p className="muted">
                        {room.host === user?.id
                          ? "Start when everyone is here. At least 2 players needed."
                          : "Waiting for the host to start the game."}
                      </p>
                    </div>
                  ) : g ? (
                    <>
                      <div className="felt-surround">
                        <div className="felt-table">
                          <div className="felt-outline" />
                          <div className="table-watermark">
                            <Spade size={42} />
                            <span>
                              SPITE <i>n</i> MALICE
                            </span>
                            <small>PLAY NICE. OR DON’T.</small>
                          </div>
                          <div className="opponents">
                            {opponents.map((p, i) => (
                              <div
                                key={p.id}
                                className={
                                  "opponent " +
                                  (g.players[g.turn]?.id === p.id &&
                                  g.status === "active"
                                    ? "playing"
                                    : "")
                                }
                              >
                                <div className="opponent-profile">
                                  <Avatar {...p} index={i + 1} flag />
                                  <div>
                                    <strong>
                                      {p.name}{" "}
                                      {p.bot && (
                                        <span className="bot-label">BOT</span>
                                      )}
                                    </strong>
                                    <small>{p.country}</small>
                                  </div>
                                  <span className="opponent-count">
                                    {p.stockCount}
                                    <small>left</small>
                                  </span>
                                </div>
                                <div className="opponent-cards">
                                  <div className="mini-hand">
                                    {Array.from(
                                      { length: Math.min(p.handCount, 5) },
                                      (_, i) => (
                                        <span key={i} />
                                      ),
                                    )}
                                  </div>
                                  <Card value={p.top} small disabled />
                                  <span className="opponent-stock-label">
                                    STOCK
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="building-area">
                            <div className="building-label">
                              <span /> SHARED BUILDING PILES <span />
                            </div>
                            <div className="building-piles">
                              {g.builds.map((pile, i) => (
                                <div key={i} className="build-wrap">
                                  <button
                                    className={
                                      "build-target " +
                                      (selected && myTurn ? "available" : "")
                                    }
                                    aria-label={`Play to building pile ${i + 1}, needs ${pile.length + 1}`}
                                    onClick={() => play(i)}
                                    disabled={!myTurn || busy}
                                  >
                                    {pile.length ? (
                                      <span className="build-card">
                                        <span className="build-card-number">
                                          {pile.length}
                                          <small>♦</small>
                                        </span>
                                        <span
                                          className={
                                            pile.length % 2 === 0
                                              ? "red-text"
                                              : ""
                                          }
                                        >
                                          {pile.length % 2 === 0 ? (
                                            "♦"
                                          ) : (
                                            <Spade
                                              size={28}
                                              fill="currentColor"
                                            />
                                          )}
                                        </span>
                                        <span className="build-card-number rotated">
                                          {pile.length}
                                          <small>♦</small>
                                        </span>
                                      </span>
                                    ) : (
                                      <span className="empty-build">
                                        <span>1</span>
                                        <Spade size={25} />
                                        <small>START HERE</small>
                                      </span>
                                    )}
                                  </button>
                                  <span className="pile-caption">
                                    {pile.length
                                      ? `Next: ${pile.length + 1}`
                                      : "Start with 1"}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <span className="build-hint">
                              Build from 1 to 12. Wild cards go anywhere.
                            </span>
                          </div>
                          <div className="draw-pile">
                            <Card back disabled small />
                            <span>
                              {g.deckCount}
                              <small>DRAW PILE</small>
                            </span>
                          </div>
                          <div className="table-side-note">
                            <ShieldCheck size={16} />
                            Private family table
                          </div>
                          <div className="your-seat">
                            <Avatar
                              name={user?.name}
                              flag
                              country={user?.country}
                              size="large"
                            />
                            <span>
                              {user?.name} <small>YOU</small>
                            </span>
                          </div>
                        </div>
                      </div>
                      <div
                        className={
                          "turn-banner " + (!myTurn ? "waiting-turn" : "")
                        }
                      >
                        <span className="turn-dot" />
                        <strong>
                          {g.status === "completed"
                            ? `${g.players.find((p) => p.id === g.winner)?.name} wins! 🎉`
                            : myTurn
                              ? "Your move, " + user?.name + "!"
                              : `${g.players[g.turn]?.name}’s turn`}
                        </strong>
                        <span>
                          {g.status === "completed"
                            ? "A good game deserves a rematch."
                            : myTurn
                              ? "Select a card, then choose a building pile."
                              : "This game is saved. Come back whenever you’re ready."}
                        </span>
                        <span className="turn-number">
                          {g.status === "completed"
                            ? "FINISHED"
                            : `TURN ${Math.floor(g.moves / g.players.length) + 1}`}
                        </span>
                      </div>
                      <div className="player-zone">
                        <div className="stock-zone">
                          <div className="zone-label">
                            YOUR STOCK <span>{me?.stockCount}</span>
                          </div>
                          <div className="stock-stack">
                            <Card
                              value={me?.top}
                              disabled={!myTurn || busy}
                              selected={selected?.source === "stock"}
                              onClick={() =>
                                setSelected({ source: "stock", index: 0 })
                              }
                            />
                          </div>
                          <span className="zone-help">Empty this to win</span>
                        </div>
                        <div className="hand-zone">
                          <div className="zone-label">
                            YOUR HAND <span>{me?.handCount} CARDS</span>
                          </div>
                          <div className="hand-cards">
                            {me?.hand?.map((v, i) => (
                              <Card
                                key={i}
                                value={v}
                                selected={
                                  selected?.source === "hand" &&
                                  selected.index === i
                                }
                                disabled={!myTurn || busy}
                                onClick={() =>
                                  setSelected({ source: "hand", index: i })
                                }
                              />
                            ))}
                          </div>
                          <span className="zone-help">
                            {selected
                              ? "Choose a pile to play your card"
                              : "A good move starts with a little mischief."}
                          </span>
                        </div>
                        <div className="discard-zone">
                          <div className="zone-label">YOUR DISCARD PILES</div>
                          <div className="discard-cards">
                            {me?.discards?.map((pile, i) => (
                              <div key={i}>
                                <Card
                                  small
                                  empty={!pile.length}
                                  value={pile.at(-1)}
                                  disabled={!myTurn || busy}
                                  selected={
                                    selected?.source === "discard" &&
                                    selected.index === i
                                  }
                                  label={`Discard pile ${i + 1}${pile.length ? ", top card " + pile.at(-1) : ", empty"}`}
                                  onClick={() =>
                                    selected?.source === "hand"
                                      ? discard(i)
                                      : pile.length
                                        ? setSelected({
                                            source: "discard",
                                            index: i,
                                          })
                                        : setToast(
                                            "Select a card from your hand to discard here.",
                                          )
                                  }
                                />
                                <span>{i + 1}</span>
                              </div>
                            ))}
                          </div>
                          <span className="zone-help">
                            Discard a hand card to end your turn
                          </span>
                        </div>
                      </div>
                      <div className="game-footer">
                        <span>
                          <ShieldCheck size={14} /> Every move is saved
                          automatically
                        </span>
                        {g.status === "completed" ? (
                          <button
                            onClick={() => newRoom(!!room.practice, room.title)}
                          >
                            Play again <ArrowRight size={15} />
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (!myTurn) {
                                setToast("Wait for your turn.");
                                return;
                              }
                              if (!me.handCount) {
                                task(async () => {
                                  setRoom(
                                    await api("/rooms/" + room.id + "/move", {
                                      type: "pass",
                                      index: 0,
                                      version: room.version,
                                    }),
                                  );
                                  await refresh();
                                });
                              } else if (selected?.source === "hand")
                                setToast(
                                  "Click one of your four discard piles to end your turn.",
                                );
                              else
                                setToast(
                                  "Select a card from your hand, then place it on a discard pile.",
                                );
                            }}
                          >
                            End turn <ArrowRight size={15} />
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="empty-state">
                      <Spade />
                      <h3>Your table is waiting.</h3>
                      <button
                        className="primary"
                        onClick={() => setModal({ type: "create" })}
                      >
                        Start a game
                      </button>
                    </div>
                  )}
                </section>
                <div className="below-table">
                  <span className="little-sparkle">✦</span>
                  <p>
                    Playfully ruthless.
                    <br />
                    <strong>Always family.</strong>
                  </p>
                  <button onClick={() => setModal({ type: "rules" })}>
                    <BookOpen size={16} /> Learn the rules{" "}
                    <ArrowUpRight size={15} />
                  </button>
                </div>
              </div>
              <aside className="right-rail">
                <section className="chat-panel">
                  <div className="section-head">
                    <h2>
                      <MessageCircle size={17} /> Table talk
                    </h2>
                    <span className="soft-tag">
                      {room?.practice ? "Practice" : "Family only"}
                    </span>
                  </div>
                  <div className="chat-welcome">
                    <span>🔥</span>
                    <strong>
                      Good cards.
                      <br />
                      Great trash talk.
                    </strong>
                    <p>
                      {room?.practice
                        ? "Try a message! Invite your family for a real conversation."
                        : "Cheer them on. Talk a little trash. Make it feel like home."}
                    </p>
                  </div>
                  <div className="chat-messages">
                    {room?.messages?.map((m) => (
                      <div
                        key={m.id}
                        className={
                          "chat-message " + (m.user === user?.id ? "mine" : "")
                        }
                      >
                        {m.user === "system" ? (
                          <div className="system-message">
                            <ShieldCheck size={13} />
                            {m.body}
                          </div>
                        ) : (
                          <>
                            <Avatar
                              name={m.name}
                              size="tiny"
                              index={m.user === user?.id ? 0 : 1}
                            />
                            <div>
                              <div className="message-meta">
                                <strong>
                                  {m.name}
                                  {m.user === user?.id ? " (you)" : ""}
                                </strong>
                                <time>
                                  {new Date(m.created).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </time>
                              </div>
                              <p>{m.body}</p>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                    <div ref={chatBottom} />
                  </div>
                  <div className="quick-reactions">
                    {["Good luck! 🍀", "Nice move 👏", "Your turn!"].map(
                      (t) => (
                        <button
                          key={t}
                          disabled={!room || busy}
                          onClick={() =>
                            task(async () => {
                              setRoom(
                                await api("/rooms/" + room.id + "/chat", {
                                  body: t,
                                }),
                              );
                            })
                          }
                        >
                          {t}
                        </button>
                      ),
                    )}
                  </div>
                  <form
                    className="chat-input"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (message.trim())
                        task(async () => {
                          setRoom(
                            await api("/rooms/" + room.id + "/chat", {
                              body: message,
                            }),
                          );
                          setMessage("");
                        });
                    }}
                  >
                    <input
                      aria-label="Message your table"
                      placeholder="A little friendly banter…"
                      value={message}
                      maxLength={500}
                      onChange={(e) => setMessage(e.target.value)}
                      disabled={!room}
                    />
                    <button
                      aria-label="Send message"
                      disabled={!message.trim() || busy}
                    >
                      <Send size={17} />
                    </button>
                  </form>
                  <div className="chat-note">
                    <ShieldCheck size={11} /> Just between the people at your
                    table.
                  </div>
                </section>
                <section className="leader-panel">
                  <div className="section-head">
                    <h2>
                      <Trophy size={17} /> Family standings
                    </h2>
                    <button
                      aria-label="View leaderboard"
                      onClick={() => setPage("leaderboard")}
                    >
                      <ArrowUpRight size={17} />
                    </button>
                  </div>
                  <div className="leader-sub">
                    Every family needs a reigning champion.
                  </div>
                  {dashboard.leaderboard.slice(0, 3).map((p, i) => (
                    <div className="leader-row" key={p.id}>
                      <span className={"rank rank-" + i}>
                        {i === 0 ? <Crown size={16} /> : i + 1}
                      </span>
                      <Avatar {...p} index={i} size="tiny" />
                      <div>
                        <strong>
                          {p.name}
                          {p.id === user?.id && <small>YOU</small>}
                        </strong>
                        <span>{p.wins} wins</span>
                      </div>
                      <b>
                        {p.points}
                        <small>pts</small>
                      </b>
                    </div>
                  ))}
                  {dashboard.leaderboard.length < 2 && (
                    <button
                      className="leader-invite"
                      onClick={() => setModal({ type: "create" })}
                    >
                      <Plus size={14} /> Invite your first challenger
                    </button>
                  )}
                  <button
                    className="view-all"
                    onClick={() => setPage("leaderboard")}
                  >
                    View leaderboard <ArrowRight size={14} />
                  </button>
                </section>
                <div className="timezone-note">
                  <Globe2 size={19} />
                  <span>
                    Different time zones.
                    <br />
                    <strong>Always the same family.</strong>
                  </span>
                  <span>♡</span>
                </div>
              </aside>
            </div>
          ) : page === "leaderboard" ? (
            <section className="content-panel">
              <div className="content-heading">
                <div>
                  <span className="eyebrow">THE FAMILY HALL OF FAME</span>
                  <h2>Bragging rights, earned.</h2>
                  <p>
                    All-time scores from completed family matches. Practice
                    games don’t affect your ranking.
                  </p>
                </div>
                <Trophy size={42} />
              </div>
              <div className="leader-table">
                <div className="leader-table-head">
                  <span>RANK</span>
                  <span>PLAYER</span>
                  <span>PLAYED</span>
                  <span>WINS</span>
                  <span>POINTS</span>
                </div>
                {dashboard.leaderboard.map((p, i) => (
                  <div className="leader-table-row" key={p.id}>
                    <span className="rank">{i === 0 ? <Crown /> : i + 1}</span>
                    <span>
                      <Avatar {...p} index={i} />
                      <strong>
                        {p.name} {p.id === user?.id ? "(you)" : ""}
                        <small>
                          {flags[p.country] || "🌎"} {p.country}
                        </small>
                      </strong>
                    </span>
                    <span>{p.played}</span>
                    <span>{p.wins}</span>
                    <b>{p.points}</b>
                  </div>
                ))}
              </div>
              <div className="friendly-note">
                <Sparkles size={20} />
                <p>
                  Win a match to earn 25 points, plus 1 point for every card
                  left in your opponents’ stock.
                </p>
              </div>
              <button
                className="primary"
                onClick={() => setModal({ type: "create" })}
              >
                Challenge the family <ArrowUpRight size={16} />
              </button>
            </section>
          ) : page === "history" ? (
            <section className="content-panel">
              <div className="content-heading">
                <div>
                  <h2>Your games, always here.</h2>
                  <p>Active tables, saved turns, and finished rivalries.</p>
                </div>
                <History size={38} />
              </div>
              <div className="history-list">
                {dashboard.rooms.map((r) => (
                  <button
                    key={r.id}
                    className="history-item"
                    onClick={() =>
                      task(async () => {
                        setRoom(await api("/rooms/" + r.id));
                        setSelected(null);
                        setPage("table");
                      })
                    }
                  >
                    <span className="history-icon">
                      <Spade />
                    </span>
                    <span>
                      <strong>{r.title}</strong>
                      <small>
                        {new Date(r.created).toLocaleDateString()} ·{" "}
                        {r.practice ? "Practice" : "Family match"} ·{" "}
                        {r.state.players.length} players
                      </small>
                    </span>
                    <span className="status-pill">
                      {r.state.status === "completed"
                        ? r.state.winner === user?.id
                          ? "You won!"
                          : "Completed"
                        : r.state.status === "waiting"
                          ? "Waiting for family"
                          : "In progress"}
                    </span>
                    <ArrowRight size={18} />
                  </button>
                ))}
              </div>
              {!dashboard.rooms.length && (
                <p>No games yet. Your next good memory starts at the table.</p>
              )}
            </section>
          ) : (
            <section className="content-panel">
              <div className="content-heading">
                <div>
                  <span className="eyebrow">YOUR FAVORITE PEOPLE</span>
                  <h2>No distance too far for game night.</h2>
                  <p>
                    Invite someone to a table to bring them into your family
                    room.
                  </p>
                </div>
                <Users size={42} />
              </div>
              <div className="family-grid">
                {dashboard.leaderboard.map((p, i) => (
                  <div className="family-card" key={p.id}>
                    <Avatar {...p} index={i} flag size="large" />
                    <h3>
                      {p.name} {p.id === user?.id && <small>(you)</small>}
                    </h3>
                    <p>{p.country}</p>
                    <span>
                      {p.wins} victories · {p.played} games
                    </span>
                    <button
                      className="secondary"
                      onClick={() =>
                        setModal(
                          p.id === user?.id
                            ? { type: "profile" }
                            : {
                                type: "create",
                                title: `${user?.name} vs ${p.name}`,
                              },
                        )
                      }
                    >
                      {p.id === user?.id ? "Edit profile" : "Challenge"}
                      <ArrowUpRight size={15} />
                    </button>
                  </div>
                ))}
                <button
                  className="family-card add-family"
                  onClick={() => setModal({ type: "create" })}
                >
                  <span className="empty-avatar">
                    <Plus />
                  </span>
                  <h3>Save them a seat</h3>
                  <p>Family is only an invite away.</p>
                  <span>
                    Invite someone <ArrowRight size={14} />
                  </span>
                </button>
              </div>
              <button
                className="secondary"
                onClick={() => setModal({ type: "join" })}
              >
                <Link size={16} /> Have an invitation? Join a table
              </button>
            </section>
          )}
          <footer className="site-footer">
            <span>Family game night. With a wild side.</span>
            <span>
              ♠ SPITE N MALICE <span>·</span> Play your cards. Own the table.
            </span>
            <button onClick={() => setModal({ type: "rules" })}>
              House rules <ArrowUpRight size={12} />
            </button>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCheck size={20} />
          {toast}
          <button
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => e.target === e.currentTarget && setModal(null)}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={modal.type + " dialog"}
          >
            <button
              className="modal-close icon-button"
              onClick={() => setModal(null)}
              aria-label="Close dialog"
            >
              <X size={21} />
            </button>
            <ModalContent
              modal={modal}
              room={room}
              user={user}
              busy={busy}
              copied={copied}
              copyInvite={copyInvite}
              newRoom={newRoom}
              setModal={setModal}
              task={task}
              refresh={refresh}
              setRoom={setRoom}
              setPage={setPage}
              setUser={setUser}
              xp={xp}
              level={level}
              totalMoves={totalMoves}
              setToast={setToast}
            />
          </div>
        </div>
      )}
    </div>
  );
}
function ModalContent({
  modal,
  room,
  user,
  busy,
  copied,
  copyInvite,
  newRoom,
  setModal,
  task,
  refresh,
  setRoom,
  setPage,
  setUser,
  xp,
  level,
  totalMoves,
  setToast,
}) {
  useEffect(() => {
    const f = (e) => {
      if (e.key === "Escape") setModal(null);
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, []);
  const [title, setTitle] = useState(modal.title || "Sunday family table"),
    [code, setCode] = useState(modal.code || ""),
    [name, setName] = useState(user?.name || ""),
    [country, setCountry] = useState(user?.country || "Canada"),
    [localError, setLocalError] = useState("");
  async function join(e) {
    e.preventDefault();
    setLocalError("");
    try {
      const input = code.trim();
      const value = input.includes("invite=")
        ? new URL(input).searchParams.get("invite")
        : input;
      await task(async () => {
        const r = await api("/join", { code: value });
        setRoom(r);
        setPage("table");
        setModal(null);
        history.replaceState({}, "", location.pathname);
        await refresh();
      });
    } catch (e) {
      setLocalError(e.message);
    }
  }
  if (modal.type === "create")
    return (
      <>
        <span className="modal-art">
          <Users size={30} />
        </span>
        <span className="eyebrow">THE MORE, THE MERRIER</span>
        <h2>Make room for a little rivalry.</h2>
        <p>
          Create a private table and share the invitation with your family. Play
          together or take turns when life allows.
        </p>
        <label>
          Give your table a name
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={40}
          />
        </label>
        <div className="modal-features">
          <span>
            <Globe2 size={17} /> 2–4 players, anywhere
          </span>
          <span>
            <ShieldCheck size={17} /> Every turn saved
          </span>
        </div>
        <button
          className="primary full"
          disabled={busy}
          onClick={() => newRoom(false, title)}
        >
          Create family table <ArrowRight size={17} />
        </button>
        <button
          className="secondary full"
          disabled={busy}
          onClick={() => newRoom(true, "A little friendly rivalry")}
        >
          Practice with bots <Spade size={17} />
        </button>
        <button
          className="text-button"
          onClick={() => setModal({ type: "join" })}
        >
          Already have an invite? Join a table
        </button>
      </>
    );
  if (modal.type === "invite")
    return (
      <>
        <span className="modal-art">
          <Link size={30} />
        </span>
        <h2>Your people, one link away.</h2>
        <p>
          Share this private invitation with your family. They can join from a
          phone, tablet, or computer.
        </p>
        <label>
          Invitation link
          <input readOnly value={location.origin + "/?invite=" + room?.code} />
        </label>
        <button className="primary full" onClick={copyInvite}>
          {copied ? <Check size={17} /> : <Copy size={17} />}{" "}
          {copied ? "Invitation copied!" : "Copy invitation"}
        </button>
        <div className="invite-code">
          Or share the table code <strong>{room?.code}</strong>
        </div>
        <p className="modal-footnote">
          Invite links work wherever this app is hosted. For family abroad, the
          app must be deployed to a public HTTPS address.
        </p>
      </>
    );
  if (modal.type === "join")
    return (
      <>
        <span className="modal-art">
          <House size={30} />
        </span>
        <h2>There’s a seat for you.</h2>
        <p>Paste the invitation link or code your family shared.</p>
        <form onSubmit={join}>
          <label>
            Invitation link or code
            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </label>
          {localError && <p className="error">{localError}</p>}
          <button className="primary full" disabled={busy || !code.trim()}>
            Join the family table <ArrowRight size={17} />
          </button>
        </form>
      </>
    );
  if (modal.type === "profile")
    return (
      <>
        <span className="modal-art">
          <Settings size={30} />
        </span>
        <h2>Make yourself at home.</h2>
        <p>Your family will see this name and country at the table.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            task(async () => {
              setUser(await api("/profile", { name, country }, "PATCH"));
              await refresh();
              setModal(null);
              setToast(
                "Your profile is updated. Your new name appears in future matches.",
              );
            });
          }}
        >
          <label>
            Your name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              required
            />
          </label>
          <label>
            Your country
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              {Object.keys(flags).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <button className="primary full" disabled={busy || !name.trim()}>
            Save profile <Check size={17} />
          </button>
        </form>
        <div className="profile-recovery">
          <h3>Keep your seat, on any device.</h3>
          <p>
            Save a private player key to recover your games if you change
            browsers. Anyone with this file can access your profile, so keep it
            safe.
          </p>
          <button
            className="secondary full"
            onClick={() => {
              const blob = new Blob(
                [JSON.stringify({ kindred: 1, token: auth })],
                { type: "application/json" },
              );
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "spite-n-malice-player-key.json";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            Download private player key
          </button>
          <label className="restore-label">
            Restore an existing player
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                task(async () => {
                  if (file.size > 4096)
                    throw Error("Choose a Spite n Malice player key file.");
                  let key;
                  try {
                    key = JSON.parse(await file.text());
                  } catch {
                    throw Error("That is not a valid player key file.");
                  }
                  if (key.kindred !== 1 || typeof key.token !== "string")
                    throw Error("Choose a Spite n Malice player key file.");
                  const u = await api("/session", {
                    token: key.token,
                    restore: true,
                  });
                  auth = u.token;
                  localStorage.setItem(tokenKey, auth);
                  location.assign("/");
                });
              }}
            />
          </label>
        </div>
      </>
    );
  if (modal.type === "rules")
    return (
      <>
        <span className="modal-art">
          <BookOpen size={30} />
        </span>
        <span className="eyebrow">THE RULES OF THE RIVALRY</span>
        <h2>A little spite. A lot of fun.</h2>
        <p>
          Be the first to empty your 20-card stock. Your hand and discard piles
          help you get there.
        </p>
        <ol className="rules">
          <li>
            <strong>Build together.</strong> The four shared piles go from 1 to
            12, in order. Start any empty pile with a 1.
          </li>
          <li>
            <strong>Play your cards.</strong> Select a card from your hand, the
            top of your stock, or the top of a discard pile. Then click a
            building pile.
          </li>
          <li>
            <strong>Go a little wild.</strong> W cards stand in for any number.
            Completed piles are recycled.
          </li>
          <li>
            <strong>Keep going.</strong> Play as many cards as you can. Empty
            your hand to draw five more.
          </li>
          <li>
            <strong>Pass the turn.</strong> Select a hand card and click one of
            your four discard piles. Your hand refills at the start of your next
            turn.
          </li>
        </ol>
        <div className="friendly-note">
          <Trophy size={20} />
          <p>
            Empty your stock to win 25 points, plus one point for every card
            left in the other players’ stock. Practice wins don’t count on the
            family leaderboard.
          </p>
        </div>
        <button className="primary full" onClick={() => setModal(null)}>
          Let’s play <ArrowRight size={16} />
        </button>
      </>
    );
  if (modal.type === "quests")
    return (
      <>
        <span className="modal-art">
          <Target size={30} />
        </span>
        <h2>Little moves. Big progress.</h2>
        <p>
          You’re at level {level}, with {xp} XP. Every move you make earns 10
          XP, and every victory earns 100.
        </p>
        <div className="quest-card">
          <span>
            <Flame /> First steps
          </span>
          <strong>Make 5 moves</strong>
          <progress value={Math.min(totalMoves, 5)} max="5" />
          <small>
            {Math.min(totalMoves, 5)} / 5{" "}
            {totalMoves >= 5 ? "· Completed! 🎉" : ""}
          </small>
        </div>
        <div className="quest-card">
          <span>
            <Star /> Next level
          </span>
          <strong>
            {500 - (xp % 500)} XP to level {level + 1}
          </strong>
          <progress value={xp % 500} max="500" />
        </div>
      </>
    );
  if (modal.type === "notifications")
    return (
      <>
        <span className="modal-art">
          <Bell size={30} />
        </span>
        <h2>You’re all caught up.</h2>
        <p>
          Your current table updates automatically while it’s open. Check Match
          history to resume any saved game.
        </p>
        <p className="modal-footnote">
          Email and push notifications aren’t enabled in this version.
        </p>
        <button
          className="primary full"
          onClick={() => {
            setPage("history");
            setModal(null);
          }}
        >
          View saved matches <ArrowRight size={16} />
        </button>
      </>
    );
  return (
    <>
      <span className="modal-art">
        <Spade size={30} />
      </span>
      <h2>Your table, your time.</h2>
      <p>
        Every move and message is saved automatically. Leave whenever you need
        to, and resume from Match history.
      </p>
      {room && !room.practice && (
        <button
          className="primary full"
          onClick={() => setModal({ type: "invite" })}
        >
          <Link size={17} /> Share this table
        </button>
      )}
      <button
        className="secondary full"
        onClick={() => setModal({ type: "rules" })}
      >
        <BookOpen size={17} /> Read the house rules
      </button>
      <button
        className="secondary full"
        onClick={() => {
          setPage("history");
          setModal(null);
        }}
      >
        <History size={17} /> Find another saved match
      </button>
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
