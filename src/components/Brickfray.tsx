import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Settings2,
  Gamepad2,
  Keyboard,
  Globe2,
  Users,
  Plus,
  Hash,
  Copy,
  Check,
  Maximize,
  Volume2,
  MousePointer2,
  Crosshair,
  X,
  Shield,
  Flag,
  Trophy,
  Zap,
  Bomb,
  Swords,
  Radio,
  Send,
  Box,
  RefreshCw,
  SlidersHorizontal,
  Play,
  Info,
} from "lucide-react";
import {
  COLORS,
  DEFAULT_SETTINGS,
  QUALITY,
  WEAPONS,
  loadSettings,
  type Action,
  type MapId,
  type Settings,
} from "~/brickfray/config";
import { translate, languages, type TextKey } from "~/brickfray/i18n";
import type { BrickfrayGame, Screen } from "~/brickfray/game";
import type { HudState, Room } from "~/brickfray/types";
import type { LobbyInfo } from "~/game/net/net";
import "~/brickfray/style.css";
const loadGame = import.meta.env.SSR ? null : () => import("~/brickfray/game");
const maps: MapId[] = ["plaza", "fortress", "docks"];
function Logo() {
  return (
    <span className="bf-logo">
      <i aria-hidden="true">
        <b />
        <b />
        <b />
        <b />
      </i>
      <strong>brickfray</strong>
    </span>
  );
}
function Bot({ color, accessory }: { color: string; accessory: number }) {
  return (
    <div
      className={"bf-bot bf-gear-" + accessory}
      style={{ "--bot": color } as CSSProperties}
      aria-label="Snapbot"
    >
      <div className="bf-bot-shadow" />
      <div className="bf-bot-antenna" />
      <div className="bf-bot-head">
        <i />
        <b />
        <b />
      </div>
      <div className="bf-bot-chest">
        <i />
        <small>+</small>
      </div>
      <div className="bf-bot-arm left" />
      <div className="bf-bot-arm right" />
      <div className="bf-bot-leg left" />
      <div className="bf-bot-leg right" />
    </div>
  );
}
function MapArt({ map }: { map: MapId }) {
  return (
    <div className={"bf-map-art " + map} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
      <i />
      <b />
      <b />
      <span />
    </div>
  );
}
function Modal({
  title,
  close,
  children,
  wide = false,
  closeLabel,
}: {
  title: string;
  closeLabel: string;
  close: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={"bf-dialog " + (wide ? "wide" : "")}
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="bf-dialog-head">
        <h2>{title}</h2>
        <button className="bf-icon" aria-label={closeLabel} onClick={close}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Brickfray({ labMap }: { labMap?: MapId } = {}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    engine = useRef<BrickfrayGame | null>(null);
  const [settings, setSettings] = useState<Settings>({
      ...DEFAULT_SETTINGS,
      binds: { ...DEFAULT_SETTINGS.binds },
    }),
    settingsRef = useRef(settings);
  const [screen, setScreen] = useState<Screen>("home"),
    [modal, setModal] = useState(""),
    [tab, setTab] = useState("input"),
    [map, setMap] = useState<MapId>("plaza"),
    [name, setName] = useState("Builder"),
    [color, setColor] = useState(0),
    [gear, setGear] = useState(0),
    [hud, setHud] = useState<HudState | null>(null),
    [room, setRoom] = useState<Room | null>(null),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [code, setCode] = useState(""),
    [lobbies, setLobbies] = useState<LobbyInfo[] | null>(null),
    [bind, setBind] = useState<Action | null>(null),
    [controlTab, setControlTab] = useState("mouse"),
    [copied, setCopied] = useState(false),
    [chats, setChats] = useState<{ name: string; text: string }[]>([]),
    [chat, setChat] = useState(""),
    [showChat, setShowChat] = useState(false),
    [board, setBoard] = useState(false),
    [networkDebug, setNetworkDebug] = useState(false),
    [ready, setReady] = useState(false);
  const t = (k: TextKey) => translate(settings.language, k);
  useEffect(() => {
    const saved = loadSettings();
    setNetworkDebug(new URLSearchParams(location.search).get("debug") === "1");
    const lang = new URLSearchParams(
      location.search || location.hash.slice(1),
    ).get("lang");
    if (lang && languages.some((l) => l[0] === lang)) saved.language = lang;
    settingsRef.current = saved;
    setSettings(saved);
    let gone = false;
    loadGame?.()
      .then(({ BrickfrayGame }) => {
        if (gone || !canvas.current) return;
        const game = new BrickfrayGame(canvas.current, saved, {
          hud: (h) => {
            setHud(h);
            setBoard(game.input.board);
          },
          screen: setScreen,
          room: setRoom,
          notice: setNotice,
          chat: (name, text) =>
            setChats((c) => [...c.slice(-19), { name, text }]),
        });
        engine.current = game;
        try {
          const p = JSON.parse(
            localStorage.getItem("brickfray.profile") || "null",
          );
          if (
            p &&
            typeof p.name === "string" &&
            COLORS[p.color] &&
            Number.isInteger(p.gear)
          ) {
            setName(p.name);
            setColor(p.color);
            setGear(p.gear);
            game.profile(p.name, p.color, p.gear);
          }
        } catch {}
        setReady(true);
        const query = new URLSearchParams(
            location.search || location.hash.slice(1),
          ),
          m = query.get("map");
        if (m && maps.includes(m as MapId)) {
          game.setMap(m as MapId);
          setMap(m as MapId);
        }
        if (import.meta.env.DEV && labMap) {
          saved.performance = true;
          setSettings({ ...saved });
          setMap(labMap);
          game.startRange(labMap);
        } else if (import.meta.env.DEV && query.get("play") === "solo")
          game.solo();
      })
      .catch((e) => {
        setNotice("connectionFailed");
        console.error("Brickfray initialization", e);
      });
    return () => {
      gone = true;
      engine.current?.dispose();
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    document.documentElement.lang = settings.language;
  }, [settings.language]);
  useEffect(() => {
    if (
      !notice ||
      ["reconnecting", "connectionFailed", "hostLeft"].includes(notice)
    )
      return;
    const timer = setTimeout(
      () => setNotice(""),
      notice === "ctrl" ? 12000 : 5000,
    );
    return () => clearTimeout(timer);
  }, [notice]);
  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    const s = { ...settingsRef.current, [key]: value };
    settingsRef.current = s;
    setSettings(s);
    if (engine.current) {
      Object.assign(engine.current.settings, s);
      if (
        key === "quality" ||
        key === "resolution" ||
        key === "debris" ||
        key === "studSegments"
      )
        engine.current.applySettings();
      else {
        try {
          localStorage.setItem("brickfray.settings", JSON.stringify(s));
        } catch {}
      }
    }
  }
  function profile(n = name, c = color, g = gear) {
    setName(n);
    setColor(c);
    setGear(g);
    engine.current?.profile(n, c, g);
    try {
      localStorage.setItem(
        "brickfray.profile",
        JSON.stringify({ name: n, color: c, gear: g }),
      );
    } catch {}
  }
  function pickMap(m: MapId) {
    setMap(m);
    engine.current?.setMap(m);
    engine.current?.audio.click();
  }
  async function connect(
    kind: "quick" | "private" | "public" | "join",
    value = code,
  ) {
    setBusy(true);
    setModal("");
    try {
      await engine.current?.connect(kind, value);
    } finally {
      setBusy(false);
    }
  }
  async function rooms() {
    setModal("rooms");
    setLobbies(null);
    try {
      setLobbies((await engine.current?.listLobbies()) || []);
    } catch {
      setLobbies([]);
      setNotice("connectionFailed");
    }
  }
  function open(m: string) {
    engine.current?.audio.unlock();
    engine.current?.audio.click();
    if (screen === "playing") engine.current?.pause();
    setModal(m);
  }
  const changeBinding = (value: string) => {
    if (!bind) return;
    const binds = { ...settings.binds, [bind]: value };
    update("binds", binds);
    setBind(null);
  };
  const profilePanel = (
    <div className="bf-profile">
      <label className="bf-name">
        <input
          aria-label={t("name")}
          maxLength={14}
          value={name}
          placeholder={t("namePlaceholder")}
          onChange={(e) => profile(e.target.value)}
        />
        <span>{t("name")}</span>
      </label>
      <div className="bf-colors" role="group" aria-label={t("color")}>
        {COLORS.slice(0, 6).map((c, i) => (
          <button
            key={c}
            aria-label={`${t("color")} ${i + 1}`}
            aria-pressed={color === i}
            onClick={() => profile(name, i)}
            style={{ background: c }}
          >
            {color === i && <Check size={15} />}
          </button>
        ))}
      </div>
      <div className="bf-gear">
        <button
          onClick={() => profile(name, color, (gear + 2) % 3)}
          aria-label={t("accessory")}
        >
          <ChevronLeft size={16} />
        </button>
        <span>{t(("accessory" + gear) as TextKey)}</span>
        <button
          onClick={() => profile(name, color, (gear + 1) % 3)}
          aria-label={t("accessory")}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
  const isGame =
    screen === "playing" || screen === "pause" || screen === "results";
  const onlineResults = screen === "results" && engine.current?.mode !== "solo";
  const leaders = hud
    ? [...hud.scoreboard].sort((a, b) => b.kills - a.kills)
    : [];
  const resultWinner =
    engine.current?.mode === "tdm"
      ? hud?.teamScores[0] === hud?.teamScores[1]
        ? t("draw")
        : t(
            (hud?.teamScores[0] ?? 0) > (hud?.teamScores[1] ?? 0)
              ? "orange"
              : "blue",
          )
      : leaders.length > 1 && leaders[0].kills === leaders[1].kills
        ? t("draw")
        : leaders[0]?.name;
  const range = (
    key: keyof Settings,
    min: number,
    max: number,
    step = 0.01,
    label?: TextKey,
    suffix = "",
  ) => (
    <label className="bf-setting" key={key}>
      <span>{t(label || (key as TextKey))}</span>
      <div>
        <input
          aria-label={t(label || (key as TextKey))}
          type="range"
          min={min}
          max={max}
          step={step}
          value={Number(settings[key])}
          onChange={(e) => update(key, Number(e.target.value) as never)}
        />
        <output>
          {Number(settings[key]).toFixed(step < 1 ? 2 : 0)}
          {suffix}
        </output>
      </div>
    </label>
  );
  const toggle = (key: keyof Settings, label?: TextKey) => (
    <label className="bf-setting" key={key}>
      <span>{t(label || (key as TextKey))}</span>
      <input
        className="bf-toggle"
        type="checkbox"
        checked={!!settings[key]}
        onChange={(e) => update(key, e.target.checked as never)}
      />
    </label>
  );
  const keyLabel = (s: string) =>
    s
      .replace("Key", "")
      .replace("Digit", "")
      .replace("Left", "")
      .replace("Mouse0", "LMB")
      .replace("Mouse2", "RMB");
  return (
    <main className={"bf-app " + (isGame ? "in-game" : "")}>
      <canvas
        className="bf-canvas"
        ref={canvas}
        aria-label="Brickfray 3D arena"
        tabIndex={0}
      />
      {!isGame && <div className="bf-menu-shade" />}
      {!isGame && (
        <header className="bf-header">
          <Logo />
          <div className="bf-header-right">
            <span className="bf-tagline">{t("tag")}</span>
            <label className="bf-language">
              <Globe2 size={17} />
              <select
                aria-label={t("language")}
                value={settings.language}
                onChange={(e) => update("language", e.target.value)}
              >
                {languages.map(([v, n]) => (
                  <option value={v} key={v}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="bf-icon"
              onClick={() => open("settings")}
              aria-label={t("settings")}
            >
              <Settings2 size={21} />
            </button>
          </div>
        </header>
      )}
      {screen === "home" && (
        <div className="bf-home">
          <section className="bf-hero">
            <div className="bf-eyebrow">
              <span />
              {t("free")} <em>·</em> {t("players")}
            </div>
            <h1>
              {t("headline")
                .split("\n")
                .map((line, i) => (
                  <span key={i}>{line}</span>
                ))}
            </h1>
            <p>{t("description")}</p>
            <div className="bf-play-box">
              <button
                className="bf-primary bf-play"
                disabled={!ready || busy}
                onClick={() => connect("quick")}
              >
                <span className="bf-play-icon">
                  <Play size={25} fill="currentColor" />
                </span>
                <span>
                  <strong>{busy ? t("connecting") : t("play")}</strong>
                  <small>{t("quickDesc")}</small>
                </span>
                <ArrowRight size={24} />
              </button>
              <button
                className="bf-solo"
                disabled={!ready || busy}
                onClick={() => {
                  engine.current?.profile(name, color, gear);
                  engine.current?.solo();
                }}
              >
                <Shield size={21} />
                <span>
                  <strong>{t("solo")}</strong>
                  <small>{t("soloDesc")}</small>
                </span>
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="bf-room-links">
              <button onClick={rooms} disabled={busy}>
                <Users size={16} />
                {t("public")}
              </button>
              <button
                onClick={() => connect("private")}
                disabled={!ready || busy}
              >
                <Plus size={16} />
                {t("private")}
              </button>
              <button onClick={() => open("join")}>
                <Hash size={16} />
                {t("join")}
              </button>
            </div>
            <button
              className="bf-mobile-profile bf-secondary"
              onClick={() => open("avatar")}
            >
              <Box size={17} />
              {t("avatar")}
            </button>
          </section>
          <aside className="bf-avatar-card">
            <div className="bf-avatar-title">
              <span>{t("avatar")}</span>
              <i>
                <Radio size={12} />
                {t("ready")}
              </i>
            </div>
            <div className="bf-avatar-stage">
              <div className="bf-stage-ring" />
              <Bot color={COLORS[color]} accessory={gear} />
              <span className="bf-avatar-number">S / 01</span>
            </div>
            {profilePanel}
          </aside>
          <section className="bf-map-section">
            <div className="bf-section-label">
              <span>{t("map")}</span>
              <small>01 — 03</small>
            </div>
            <div className="bf-maps">
              {maps.map((m, i) => (
                <button
                  className={"bf-map " + (map === m ? "selected" : "")}
                  key={m}
                  onClick={() => pickMap(m)}
                  aria-pressed={map === m}
                >
                  <MapArt map={m} />
                  <span className="bf-map-num">0{i + 1}</span>
                  <div className="bf-map-copy">
                    <strong>{t(m)}</strong>
                    <small>{t((m + "Desc") as TextKey)}</small>
                  </div>
                  <span className="bf-map-check">
                    {map === m ? <Check size={14} /> : <ArrowRight size={14} />}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
      {screen === "lobby" && (
        <section className="bf-lobby bf-panel">
          <div className="bf-lobby-top">
            <div>
              <span className="bf-eyebrow">
                {room?.public ? t("public") : t("private")}
              </span>
              <h1>{t("lobby")}</h1>
            </div>
            <button
              className="bf-secondary"
              onClick={() => engine.current?.leave()}
            >
              <ChevronLeft size={16} />
              {t("leave")}
            </button>
          </div>
          {room ? (
            <>
              <div className="bf-room-code">
                <div>
                  <small>{t("code")}</small>
                  <strong>{room.code}</strong>
                </div>
                <button
                  className="bf-icon"
                  aria-label={t("copy")}
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(room.code)
                      .then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      })
                      .catch(() => setNotice("lock"));
                  }}
                >
                  {copied ? <Check /> : <Copy />}
                </button>
                <p>{t("invite")}</p>
              </div>
              <div className="bf-lobby-columns">
                <div className="bf-player-list">
                  {Array.from({ length: 10 }, (_, i) => {
                    const p = room.players[i];
                    return (
                      <div
                        className={"bf-player-row " + (!p ? "empty" : "")}
                        key={i}
                      >
                        <span className="bf-player-slot">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        {p ? (
                          <>
                            <Box color={COLORS[p.color]} size={22} />
                            <strong>{p.name}</strong>
                            <small>
                              {p.id === room.host
                                ? t("host")
                                : p.id === engine.current?.localId
                                  ? t("you")
                                  : t("ready")}
                            </small>
                            {room.mode === "tdm" && (
                              <i className={"bf-team team-" + p.team}>
                                {t(p.team === 0 ? "orange" : "blue")}
                              </i>
                            )}
                          </>
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="bf-room-settings">
                  <MapArt map={room.map} />
                  <label>
                    {t("map")}
                    <select
                      disabled={!engine.current?.network.net.isHost}
                      value={room.map}
                      onChange={(e) => pickMap(e.target.value as MapId)}
                    >
                      {maps.map((m) => (
                        <option value={m} key={m}>
                          {t(m)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("mode")}
                    <select
                      disabled={!engine.current?.network.net.isHost}
                      value={room.mode}
                      onChange={(e) =>
                        engine.current?.updateRoom(
                          e.target.value as "ffa" | "tdm",
                          room.minutes,
                        )
                      }
                    >
                      <option value="ffa">{t("ffa")} · 30</option>
                      <option value="tdm">{t("tdm")} · 50</option>
                    </select>
                  </label>
                  <label>
                    {t("duration")}
                    <select
                      disabled={!engine.current?.network.net.isHost}
                      value={room.minutes}
                      onChange={(e) =>
                        engine.current?.updateRoom(
                          room.mode,
                          Number(e.target.value),
                        )
                      }
                    >
                      {[3, 5, 10, 15, 20].map((n) => (
                        <option value={n} key={n}>
                          {n} {t("minutes")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="bf-primary"
                    disabled={!engine.current?.network.net.isHost}
                    onClick={() => engine.current?.startMatch()}
                  >
                    <Play size={17} />
                    {engine.current?.network.net.isHost
                      ? t("start")
                      : t("waiting")}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p>{t("connecting")}</p>
          )}
        </section>
      )}
      {!isGame && (
        <footer className="bf-footer">
          <span>{t("version")}</span>
          <nav>
            <button onClick={() => open("controls")}>
              <Keyboard size={16} />
              {t("controls")}
            </button>
            <button onClick={() => open("settings")}>
              <SlidersHorizontal size={16} />
              {t("settings")}
            </button>
            <button onClick={() => open("credits")}>
              <Info size={16} />
              {t("credits")}
            </button>
            <button
              onClick={() => engine.current?.input.fullscreen()}
              aria-label={t("fullscreenButton")}
            >
              <Maximize size={16} />
            </button>
          </nav>
          <span className="bf-desktop">
            <Gamepad2 size={16} />
            {t("desktop")}
          </span>
        </footer>
      )}
      {isGame && hud && (
        <>
          <div className="bf-hud-top">
            <span className="bf-hud-logo">brickfray</span>
            <div className="bf-match-info">
              {engine.current?.mode === "solo" ? (
                <>
                  <strong>
                    {t("wave")} {hud.wave || 1}
                  </strong>
                  <small>
                    {hud.enemies} {t("enemies")}
                  </small>
                </>
              ) : (
                <>
                  <strong>
                    {t(engine.current?.mode === "tdm" ? "tdm" : "ffa")}
                  </strong>
                  <small>
                    {Math.max(0, Math.floor(hud.time / 60))}:
                    {String(Math.max(0, Math.floor(hud.time % 60))).padStart(
                      2,
                      "0",
                    )}
                    {engine.current?.mode === "tdm" &&
                      ` · ${hud.teamScores.join(" : ")}`}
                  </small>
                </>
              )}
            </div>
            <button
              className="bf-hud-menu"
              aria-label={t("menu")}
              onClick={() => engine.current?.pause()}
            >
              <Settings2 size={20} />
              <kbd>ESC</kbd>
            </button>
          </div>
          {hud.hp > 0 && (
            <div
              className={"bf-crosshair " + (hud.scope ? "scope" : "")}
              style={
                {
                  "--cross": settings.crossColor,
                  "--size": settings.crossSize + "px",
                  "--gap": settings.crossGap + hud.spread + "px",
                } as CSSProperties
              }
            >
              <i />
              <i />
              <i />
              <i />
              <b />
            </div>
          )}
          {hud.scope && (
            <div className="bf-scope">
              <i />
              <b />
              <span>8×</span>
            </div>
          )}
          {hud.hit && <div className={"bf-hit " + hud.hit}>×</div>}
          {hud.damageText && (
            <div className="bf-damage-number">{hud.damageText}</div>
          )}
          <div className="bf-hurt" style={{ opacity: hud.damageFlash }} />
          <div
            className="bf-damage-arc"
            style={{
              opacity: hud.damageFlash,
              transform: `translate(-50%,-50%) rotate(${hud.damageAngle}rad)`,
            }}
          />
          <div className="bf-feed">
            {hud.feed.map((f) => (
              <div key={f.id}>
                <b>{f.killer}</b>
                {f.source === "melee" ? (
                  <Swords size={15} />
                ) : f.source === "grenade" ? (
                  <Bomb size={15} />
                ) : f.head ? (
                  <Crosshair size={15} />
                ) : (
                  <Zap size={15} />
                )}
                <span>{f.victim}</span>
                <small>
                  {f.source === "gun" ? WEAPONS[f.weapon].name : ""}
                </small>
              </div>
            ))}
          </div>
          <div className="bf-hud-bottom">
            <div className="bf-health bf-stud-panel">
              <small>{t("hp")}</small>
              <div className="bf-health-content">
                <Shield size={21} />
                <strong>{Math.ceil(hud.hp)}</strong>
                <span className="bf-health-bricks">
                  {Array.from({ length: 10 }, (_, i) => (
                    <i key={i} className={hud.hp > i * 10 ? "filled" : ""} />
                  ))}
                </span>
              </div>
            </div>
            <div className="bf-ammo bf-stud-panel">
              <div>
                <small>{WEAPONS[hud.weapon].name}</small>
                <span>
                  <strong>{hud.ammo}</strong>
                  <em>/ {WEAPONS[hud.weapon].mag}</em>
                  <i>∞</i>
                </span>
              </div>
              <div className="bf-grenades">
                {[0, 1].map((n) => (
                  <Bomb
                    key={n}
                    size={21}
                    opacity={n < hud.grenades ? 1 : 0.25}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="bf-weapon-bar">
            {WEAPONS.map((w, i) => (
              <span key={w.name} className={hud.weapon === i ? "active" : ""}>
                <kbd>{i + 1}</kbd>
                {w.name}
              </span>
            ))}
          </div>
          {hud.reload > 0 && (
            <div className="bf-reload">
              <RefreshCw size={16} />
              {t("reload")} <b>{hud.reload.toFixed(1)}s</b>
            </div>
          )}
          {hud.cook >= 0 && (
            <div className="bf-cook">
              <Bomb size={20} />
              {t("cook")} {(3 - hud.cook).toFixed(1)}s
            </div>
          )}
          {hud.breath > 0 && (
            <div className="bf-breath">
              {t("breath")} {hud.breath.toFixed(1)}s
            </div>
          )}
          {screen === "playing" &&
            !engine.current?.input.locked &&
            !engine.current?.input.pad &&
            hud.hp > 0 && (
              <button
                className="bf-capture"
                onClick={() => engine.current?.input.lock()}
              >
                <MousePointer2 size={18} />
                {t("lock")}
              </button>
            )}
          {hud.hp <= 0 && screen === "playing" && (
            <div className="bf-death">
              <span>{t("eliminated")}</span>
              <h2>{hud.killer}</h2>
              <strong>{t("replay")}</strong>
              <p>
                {t("respawn")} <b>{Math.ceil(hud.dead)}</b>
              </p>
            </div>
          )}
          {board && (
            <div className="bf-board bf-panel">
              <h2>{t("scoreboard")}</h2>
              <Scoreboard hud={hud} t={t} />
            </div>
          )}
          <button
            className="bf-chat-toggle"
            onClick={() => {
              setShowChat(!showChat);
              if (!showChat) engine.current?.pause();
            }}
          >
            <Send size={15} />
            {t("chat")}
          </button>
        </>
      )}
      {(screen === "pause" || screen === "results") && !modal && (
        <div className="bf-pause-backdrop">
          <section
            className={
              "bf-panel bf-pause" + (onlineResults ? " bf-match-results" : "")
            }
          >
            <div className="bf-pause-mark">
              {screen === "results" ? <Trophy size={30} /> : <Box size={30} />}
            </div>
            <span className="bf-eyebrow">BRICKFRAY</span>
            <h2>{t(screen === "results" ? "results" : "pause")}</h2>
            {screen === "results" && hud && !onlineResults && (
              <div className="bf-result-stats">
                <div>
                  <b>{hud.kills}</b>
                  <span>{t("kills")}</span>
                </div>
                <div>
                  <b>{hud.wave}</b>
                  <span>{t("wave")}</span>
                </div>
              </div>
            )}
            {onlineResults && hud && (
              <>
                <p>
                  {t("winner")} · {resultWinner}
                </p>
                {engine.current?.mode === "tdm" && (
                  <strong>{hud.teamScores.join(" : ")}</strong>
                )}
                <Scoreboard hud={hud} t={t} />
              </>
            )}
            {screen === "pause" && (
              <button
                className="bf-primary"
                onClick={() => engine.current?.resume()}
              >
                <Play size={18} />
                {t("resume")}
              </button>
            )}
            {screen === "results" && engine.current?.mode === "solo" && (
              <button
                className="bf-primary"
                onClick={() => engine.current?.solo()}
              >
                {t("again")}
                <ArrowRight size={18} />
              </button>
            )}
            <button className="bf-secondary" onClick={() => open("settings")}>
              <Settings2 size={17} />
              {t("settings")}
            </button>
            <button
              className="bf-secondary"
              onClick={() => engine.current?.input.fullscreen()}
            >
              <Maximize size={17} />
              {t("fullscreenButton")}
            </button>
            <button
              className="bf-text-button"
              onClick={() => engine.current?.leave()}
            >
              {t("home")}
            </button>
          </section>
        </div>
      )}
      {import.meta.env.DEV && labMap && ready && (
        <details className="bf-lab" open>
          <summary>DEVELOPER RANGE</summary>
          <div>
            {maps.map((m) => (
              <a key={m} href={"/lab/" + m}>
                {m}
              </a>
            ))}
          </div>
          <div>
            {WEAPONS.map((w, i) => (
              <button
                key={w.name}
                onClick={() => engine.current?.labWeapon(i as 0 | 1 | 2 | 3)}
              >
                {i + 1} {w.name}
              </button>
            ))}
          </div>
          <div>
            <button
              onPointerDown={() => engine.current?.labFire(true)}
              onPointerUp={() => engine.current?.labFire(false)}
              onPointerLeave={() => engine.current?.labFire(false)}
            >
              Fire
            </button>
            <button onClick={() => engine.current?.labAim()}>ADS</button>
            <button onClick={() => engine.current?.labReload()}>Reload</button>
            <button onClick={() => engine.current?.labAimPeer()}>
              Aim peer
            </button>
            <button onClick={() => engine.current?.labAimPeer(true)}>
              Aim head
            </button>
            <button onClick={() => engine.current?.labDisconnect()}>
              Disconnect
            </button>
            <button onClick={() => engine.current?.labArrange()}>
              Reset targets
            </button>
            <button onClick={() => engine.current?.leave()}>Lobby menu</button>
          </div>
          <output data-testid="lab-state">{engine.current?.labState()}</output>
        </details>
      )}
      {(settings.performance ||
        (import.meta.env.DEV &&
          new URLSearchParams(
            typeof location !== "undefined" ? location.search : "",
          ).has("perf"))) &&
        hud && (
          <div className="bf-perf" aria-label="Performance">
            <span className={hud.metrics.fps < 55 ? "warn" : ""}>
              <b>{hud.metrics.fps}</b> FPS
            </span>
            <span>
              <b>{hud.metrics.calls}</b> calls / 150
            </span>
            <span>
              <b>{hud.metrics.triangles.toLocaleString()}</b> tris / 400k
            </span>
            <span>
              <b>{hud.metrics.ping}</b> ms
            </span>
          </div>
        )}
      {notice && (
        <div className="bf-notice" role="status">
          <Info size={18} />
          <span>{t(notice as TextKey) || notice}</span>
          <button onClick={() => setNotice("")} aria-label={t("close")}>
            <X size={16} />
          </button>
        </div>
      )}
      {modal === "join" && (
        <Modal
          closeLabel={t("close")}
          title={t("join")}
          close={() => setModal("")}
        >
          <form
            className="bf-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) void connect("join");
            }}
          >
            <label>
              {t("code")}
              <input
                autoFocus
                placeholder="ABCDE"
                value={code}
                minLength={5}
                maxLength={12}
                onChange={(e) =>
                  setCode(
                    e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""),
                  )
                }
              />
            </label>
            <button className="bf-primary" disabled={code.length < 5}>
              {t("join")}
              <ArrowRight size={18} />
            </button>
          </form>
        </Modal>
      )}
      {modal === "rooms" && (
        <Modal
          closeLabel={t("close")}
          title={t("public")}
          close={() => setModal("")}
        >
          <div className="bf-room-browser">
            <button className="bf-secondary" onClick={rooms}>
              <RefreshCw size={16} />
              {t("refresh")}
            </button>
            {lobbies === null ? (
              <p>{t("loading")}</p>
            ) : lobbies.length === 0 ? (
              <p>{t("empty")}</p>
            ) : (
              lobbies.map((l) => (
                <button
                  className="bf-room-entry"
                  key={l.id}
                  disabled={l.full}
                  onClick={() => connect("join", l.code)}
                >
                  <strong>{l.hostName}</strong>
                  <span>
                    {l.map} · {l.players}/10
                  </span>
                  <small>{t(l.inMatch ? "inMatch" : "roomStatus")}</small>
                  <ArrowRight size={17} />
                </button>
              ))
            )}
            <button className="bf-primary" onClick={() => connect("public")}>
              <Plus size={18} />
              {t("openRoom")}
            </button>
          </div>
        </Modal>
      )}
      {modal === "controls" && (
        <Modal
          closeLabel={t("close")}
          title={t("controls")}
          close={() => setModal("")}
        >
          <div className="bf-tabs">
            <button
              className={controlTab === "mouse" ? "active" : ""}
              onClick={() => setControlTab("mouse")}
            >
              <Keyboard size={17} />
              {t("mouse")}
            </button>
            <button
              className={controlTab === "controller" ? "active" : ""}
              onClick={() => setControlTab("controller")}
            >
              <Gamepad2 size={17} />
              {t("controller")}
            </button>
          </div>
          <div className="bf-controls">
            {controlTab === "mouse" ? (
              <>
                {(
                  [
                    "forward",
                    "left",
                    "backward",
                    "right",
                    "fire",
                    "aim",
                    "jump",
                    "sprint",
                    "crouch",
                    "crouchAlt",
                    "reload",
                    "grenade",
                    "melee",
                    "scoreboard",
                    "menu",
                  ] as Action[]
                ).map((a) => (
                  <div key={a}>
                    <span>{t(a as TextKey)}</span>
                    <kbd>{keyLabel(settings.binds[a])}</kbd>
                  </div>
                ))}
                <p>{t("keyboardHint")}</p>
              </>
            ) : (
              <>
                <Gamepad2 size={70} />
                <p>{t("controllerHint")}</p>
              </>
            )}
          </div>
        </Modal>
      )}
      {modal === "avatar" && (
        <Modal
          closeLabel={t("close")}
          title={t("avatar")}
          close={() => setModal("")}
        >
          {profilePanel}
        </Modal>
      )}
      {modal === "credits" && (
        <Modal
          closeLabel={t("close")}
          title={t("credits")}
          close={() => setModal("")}
        >
          <div className="bf-credits">
            <Box size={40} />
            <h3>{t("creditsTitle")}</h3>
            <p>{t("creditsBody")}</p>
            <p>{t("creditsTech")}</p>
            <a href="https://layerwise.ai" target="_blank" rel="noreferrer">
              {t("build")} <ArrowRight size={15} />
            </a>
          </div>
        </Modal>
      )}
      {modal === "settings" && (
        <Modal
          closeLabel={t("close")}
          title={t("settings")}
          close={() => {
            setModal("");
            setBind(null);
          }}
          wide
        >
          <div className="bf-settings-layout">
            <nav className="bf-settings-tabs">
              {(
                [
                  "input",
                  "graphics",
                  "sound",
                  "crosshair",
                  "bindings",
                  ...(import.meta.env.DEV || networkDebug ? ["dev"] : []),
                ] as const
              ).map((k) => (
                <button
                  key={k}
                  className={tab === k ? "active" : ""}
                  onClick={() => {
                    setTab(k);
                    setBind(null);
                  }}
                >
                  {t(k as TextKey)}
                </button>
              ))}
            </nav>
            <div className="bf-settings-content">
              {tab === "input" && (
                <>
                  {range("sensitivity", 0.1, 3, 0.05)}
                  {range("adsSensitivity", 0.2, 2, 0.05)}
                  {range("fov", 80, 110, 1)}
                  {toggle("invertY")}
                  {toggle("toggleAim")}
                  {range("aimAssist", 0, 1, 0.05)}
                </>
              )}
              {tab === "graphics" && (
                <>
                  <label className="bf-setting">
                    <span>{t("quality")}</span>
                    <select
                      value={settings.quality}
                      onChange={(e) => {
                        const q = e.target.value as Settings["quality"],
                          preset = QUALITY[q];
                        const s = {
                          ...settingsRef.current,
                          quality: q,
                          resolution: preset.scale,
                          studSegments: preset.studs,
                          debris: preset.debris,
                        };
                        settingsRef.current = s;
                        setSettings(s);
                        if (engine.current) {
                          Object.assign(engine.current.settings, s);
                          engine.current.applySettings();
                        }
                      }}
                    >
                      {["low", "medium", "high"].map((q) => (
                        <option value={q} key={q}>
                          {t(q as TextKey)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {range("resolution", 0.5, 1, 0.05)}
                  {range("studSegments", 6, 16, 2)}
                  {range("debris", 32, 320, 16)}
                  {toggle("performance")}
                </>
              )}
              {tab === "sound" && (
                <>
                  {range("master", 0, 1, 0.05)}
                  {range("effects", 0, 1, 0.05)}
                  {range("music", 0, 1, 0.05)}
                  {range("ui", 0, 1, 0.05)}
                  <p className="bf-setting-note">
                    <Volume2 size={15} />
                    {t("synth")}
                  </p>
                </>
              )}
              {tab === "crosshair" && (
                <>
                  <label className="bf-setting">
                    <span>{t("crossColor")}</span>
                    <input
                      type="color"
                      aria-label={t("crossColor")}
                      value={settings.crossColor}
                      onChange={(e) => update("crossColor", e.target.value)}
                    />
                  </label>
                  {range("crossSize", 2, 16, 1)}
                  {range("crossGap", 1, 16, 1)}
                  {toggle("damageNumbers")}
                  <div className="bf-cross-preview">
                    <Crosshair
                      size={settings.crossSize * 3}
                      color={settings.crossColor}
                    />
                  </div>
                </>
              )}
              {tab === "bindings" && (
                <div
                  className="bf-bindings"
                  onKeyDown={(e) => {
                    if (bind) {
                      e.preventDefault();
                      e.stopPropagation();
                      changeBinding(e.code);
                    }
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  {(Object.keys(settings.binds) as Action[]).map((a) => (
                    <div className="bf-binding" key={a}>
                      <span>{t(a as TextKey)}</span>
                      <button
                        className={bind === a ? "listening" : ""}
                        onKeyDown={(e) => {
                          if (bind === a) {
                            e.preventDefault();
                            e.stopPropagation();
                            changeBinding(e.code);
                          }
                        }}
                        onPointerDown={(e) => {
                          if (bind === a) {
                            e.preventDefault();
                            changeBinding("Mouse" + e.button);
                          }
                        }}
                        onClick={() => {
                          if (!bind) setBind(a);
                        }}
                      >
                        {bind === a
                          ? t("pressKey")
                          : keyLabel(settings.binds[a])}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {tab === "dev" && (
                <>
                  {import.meta.env.DEV && (
                    <>
                      {range("recoil", 0.2, 2, 0.05)}
                      {range("stiffness", 60, 400, 10)}
                      {range("adsTime", 0.5, 2, 0.05)}
                    </>
                  )}
                  {range("latency", 0, 250, 5, undefined, " ms")}
                  {range("jitter", 0, 100, 5, undefined, " ms")}
                  {range("loss", 0, 25, 1, undefined, "%")}
                  <p className="bf-setting-note">{t("netHint")}</p>
                </>
              )}
              <button
                className="bf-reset"
                onClick={() => {
                  const s = {
                    ...DEFAULT_SETTINGS,
                    language: settings.language,
                    binds: { ...DEFAULT_SETTINGS.binds },
                  };
                  settingsRef.current = s;
                  setSettings(s);
                  if (engine.current) {
                    Object.assign(engine.current.settings, s);
                    engine.current.applySettings();
                  }
                }}
              >
                <RefreshCw size={14} />
                {t("reset")}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {showChat && (
        <div className="bf-chat bf-panel">
          <div>
            <strong>{t("chat")}</strong>
            <button
              className="bf-icon"
              aria-label={t("close")}
              onClick={() => setShowChat(false)}
            >
              <X size={15} />
            </button>
          </div>
          <ol>
            {chats.map((c, i) => (
              <li key={i}>
                <b>{c.name}</b> {c.text}
              </li>
            ))}
          </ol>
          <div className="bf-quick-chat">
            {(["nice", "help", "gg"] as TextKey[]).map((k) => (
              <button key={k} onClick={() => engine.current?.chat(t(k))}>
                {t(k)}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              engine.current?.chat(chat);
              setChat("");
            }}
          >
            <input
              autoFocus
              value={chat}
              maxLength={160}
              placeholder={t("chatHint")}
              onChange={(e) => setChat(e.target.value)}
            />
            <button aria-label={t("send")}>
              <Send size={17} />
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
function Scoreboard({ hud, t }: { hud: HudState; t: (k: TextKey) => string }) {
  return (
    <table className="bf-score-table">
      <thead>
        <tr>
          {(["player", "kills", "deaths", "assists", "ping"] as TextKey[]).map(
            (k) => (
              <th key={k}>{t(k)}</th>
            ),
          )}
        </tr>
      </thead>
      <tbody>
        {[...hud.scoreboard]
          .sort((a, b) => b.kills - a.kills)
          .map((p) => (
            <tr key={p.id}>
              <td>
                <i style={{ background: COLORS[p.color] }} />
                {p.name}
              </td>
              <td>{p.kills}</td>
              <td>{p.deaths}</td>
              <td>{p.assists}</td>
              <td>{p.ping} ms</td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}
