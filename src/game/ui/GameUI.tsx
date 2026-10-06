import { Chat } from "./Chat";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { AccountDialog } from "./AccountDialog";
import { AdminPanel } from "./AdminPanel";
import { useGame, missionList, currentMission, levelOf, type Weather } from "../store";
import { ABOUT_TEXT, ACHIEVEMENTS, GOODS, LEVELS, NPCS, QUIZ, SHIP_NOTE, ZONES } from "../data";
import { usePrompt } from "../prompt";
import { input, pressInteract } from "../controls";
import { audio } from "../audio";
import { CargoGame } from "./CargoGame";

function Panel({
  title,
  children,
  onClose,
  wide,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="ui-scrim" onPointerDown={(e) => e.stopPropagation()}>
      <div className={wide ? "ui-panel ui-panel--wide" : "ui-panel"}>
        <div className="flex items-start justify-between gap-4 border-b border-border pb-3">
          <h2 className="font-display text-3xl text-foreground">{title}</h2>
          <button className="ui-icon-btn" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="mt-4 max-h-[65vh] overflow-y-auto pr-1">{children}</div>
      </div>
    </div>
  );
}

/* ---------------- Menu principal ---------------- */
function MainMenu() {
  const s = useGame();
  const auth = useAuth();
  const [sub, setSub] = useState<null | "history" | "map" | "achievements" | "options">(null);
  const start = () => {
    audio.init();
    audio.resume();
    s.beginIntro();
  };
  const accountLabel =
    auth.user?.email ?? (auth.user ? `Invité · ${auth.user.id.slice(0, 5)}` : "Invité local");
  return (
    <div className="menu-screen">
      <div className="menu-card">
        <p className="menu-kicker">Reconstitution pédagogique</p>
        <h1 className="font-display menu-title">Bordeaux 1750</h1>
        <p className="menu-sub font-display">Une aventure dans le port du XVIIIᵉ siècle</p>
        <div className="mt-6 mb-4 rounded-md border border-border bg-background/70 p-3">
          <div className="hud-label">Compte de jeu</div>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 truncate text-sm font-semibold" title={accountLabel}>
              {auth.isGuest ? "👤 " : "✉️ "}
              {accountLabel}
            </span>
            <button className="ui-chip" onClick={auth.openAccount}>
              {auth.isGuest ? "Connexion" : "Compte"}
            </button>
          </div>
          {auth.isAdmin && (
            <button className="ui-btn mt-2 w-full" onClick={auth.openAdmin}>
              🛡️ Panel administrateur
            </button>
          )}
          {auth.authError && <p className="mt-2 text-xs text-destructive">{auth.authError}</p>}
          {auth.storageError && (
            <p className="mt-2 text-xs text-destructive">{auth.storageError}</p>
          )}
          {!auth.isConfigured && (
            <p className="mt-2 text-xs text-muted-foreground">
              Partie locale · configurez Supabase pour les comptes et la sauvegarde cloud.
            </p>
          )}
        </div>
        <div className="mt-4 grid gap-2">
          <button
            className="ui-btn ui-btn--primary"
            onClick={start}
            disabled={!auth.ready || !auth.saveReady}
          >
            {!auth.ready || !auth.saveReady ? "⏳ Chargement de la sauvegarde…" : "▶ Commencer"}
          </button>
          <button className="ui-btn" onClick={() => setSub("history")}>
            📖 Histoire
          </button>
          <button className="ui-btn" onClick={() => setSub("map")}>
            🗺️ Carte
          </button>
          <button className="ui-btn" onClick={() => setSub("achievements")}>
            🏆 Succès
          </button>
          <button className="ui-btn" onClick={() => setSub("options")}>
            ⚙️ Options
          </button>
        </div>
        {(s.score !== 0 || auth.isAdmin) && (
          <p className="mt-4 text-sm text-muted-foreground">
            Partie sauvegardée : {auth.isAdmin ? "points illimités" : `${s.score} points`} —{" "}
            {LEVELS[auth.isAdmin ? LEVELS.length - 1 : levelOf(s.score)].name}
          </p>
        )}
      </div>
      {sub === "history" && <HistoryPanel onClose={() => setSub(null)} />}
      {sub === "map" && <MapPanel onClose={() => setSub(null)} />}
      {sub === "achievements" && <AchievementsPanel onClose={() => setSub(null)} />}
      {sub === "options" && <OptionsPanel onClose={() => setSub(null)} />}
      <WarningPopup />
      <AccountDialog />
      {auth.adminOpen && <AdminPanel />}
    </div>
  );
}

/* ---------------- Introduction ---------------- */
const INTRO_LINES = [
  "Bordeaux, XVIIIᵉ siècle.",
  "Le port est au cœur d'une activité commerciale intense.",
  "À vous de découvrir comment fonctionne ce monde.",
];

function Intro() {
  const startGame = useGame((s) => s.startGame);
  const [i, setI] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setI(1), 3700);
    const t2 = setTimeout(() => setI(2), 7400);
    const t3 = setTimeout(() => startGame(), 11500);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, [startGame]);
  return (
    <div className="intro-screen">
      <p key={i} className="intro-line font-display">
        {INTRO_LINES[i]}
      </p>
      <button className="ui-btn intro-skip" onClick={startGame}>
        Passer ▸
      </button>
    </div>
  );
}

/* ---------------- HUD ---------------- */
function Hud() {
  const s = useGame();
  const auth = useAuth();
  const prompt = usePrompt((p) => p.text);
  const lvl = auth.isAdmin ? LEVELS.length - 1 : levelOf(s.score);
  const next = auth.isAdmin ? undefined : LEVELS[lvl + 1];
  const pct = auth.isAdmin
    ? 100
    : next
      ? Math.max(
          0,
          Math.min(100, ((s.score - LEVELS[lvl].min) / (next.min - LEVELS[lvl].min)) * 100),
        )
      : 100;
  const accountLabel =
    auth.user?.email ?? (auth.user ? `Invité · ${auth.user.id.slice(0, 5)}` : "Invité local");
  const mission = currentMission(s);
  const tod = s.timeOfDay;
  const todLabel =
    tod < 0.15 ? "Matin" : tod < 0.42 ? "Journée" : tod < 0.6 ? "Coucher du soleil" : "Soirée";
  const weatherIcon: Record<Weather, string> = {
    soleil: "☀️",
    nuages: "☁️",
    pluie: "🌧️",
    brouillard: "🌫️",
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-10">
      {/* Haut */}
      <div className="hud-top">
        <div className="hud-chip">
          <div className="hud-label">Rang</div>
          <div className="font-display text-xl leading-none">{LEVELS[lvl].name}</div>
          <div className="hud-bar">
            <div className="hud-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="hud-label mt-1">
            {auth.isAdmin ? "∞ pts" : `${s.score} pts`}
            {next ? ` · prochain rang à ${next.min}` : ""}
          </div>
        </div>
        <div className="hud-chip hud-mission">
          <div className="hud-label">Mission {mission ? mission.id : "✓"}</div>
          <div className="font-display text-lg leading-tight">
            {mission ? mission.title : "Toutes les missions réussies !"}
          </div>
          {mission && (
            <div className="text-xs text-muted-foreground">
              {mission.goal} — {mission.progress}
            </div>
          )}
        </div>
        <div className="flex items-start gap-2">
          <div className="hud-chip text-center">
            <div className="text-lg leading-none">{weatherIcon[s.weather]}</div>
            <div className="hud-label">{todLabel}</div>
          </div>
          <button
            className="ui-icon-btn pointer-events-auto"
            onClick={auth.openAccount}
            aria-label={`Compte : ${accountLabel}`}
            title={accountLabel}
          >
            👤
          </button>
          {auth.isAdmin && (
            <button
              className="ui-icon-btn pointer-events-auto"
              onClick={auth.openAdmin}
              aria-label="Panel administrateur"
              title="Panel administrateur"
            >
              🛡️
            </button>
          )}
          <button
            className="ui-icon-btn pointer-events-auto"
            onClick={() => s.toggleMute()}
            aria-label="Son"
          >
            {s.muted ? "🔇" : "🔊"}
          </button>
          <button
            className="ui-icon-btn pointer-events-auto"
            onClick={() => s.setPanel("map")}
            aria-label="Carte"
          >
            🗺️
          </button>
          <button
            className="ui-icon-btn pointer-events-auto"
            onClick={() => s.setPanel("options")}
            aria-label="Menu"
          >
            ☰
          </button>
        </div>
      </div>

      <MiniMap />

      {/* Invite d'interaction */}
      {prompt && !s.panel && (
        <div className="hud-prompt">
          <kbd className="hud-key">E</kbd> {prompt}
        </div>
      )}
      {s.carrying && !s.panel && (
        <div className="hud-carry">📦 Vous portez un colis — direction la passerelle du navire</div>
      )}

      {/* Bas */}
      <div className="hud-bottom">
        <button className="ui-btn pointer-events-auto" onClick={() => pressInteract()}>
          ✋ Interagir
        </button>
        <button className="ui-btn pointer-events-auto" onClick={() => s.setPanel("cargo")}>
          📦 Inventaire & cargaison
        </button>
        <button className="ui-btn pointer-events-auto" onClick={() => s.setPanel("journal")}>
          📜 Journal
        </button>
        <button
          className="ui-btn ui-btn--primary pointer-events-auto"
          onClick={() => s.setPanel("quiz")}
        >
          ❓ Quiz
        </button>
      </div>
      <TouchControls />
    </div>
  );
}

function MiniMap() {
  const pos = useGame((s) => s.playerPos);
  const inHold = useGame((s) => s.inHold);
  const inCabin = useGame((s) => s.inCabin);
  const zones = useGame((s) => s.zones);
  const sx = (x: number) => ((x + 70) / 135) * 180;
  const sz = (z: number) => ((z + 32) / 74) * 110;
  return (
    <div className="minimap">
      <svg viewBox="0 0 180 110" className="h-full w-full">
        <rect x="0" y="0" width="180" height={sz(-8)} className="fill-[var(--map-water)]" />
        <rect
          x="0"
          y={sz(-8)}
          width="180"
          height={110 - sz(-8)}
          className="fill-[var(--map-land)]"
        />
        <rect
          x={sx(-6.5)}
          y={sz(-25.4)}
          width={sx(18.5) - sx(-6.5)}
          height={sz(-18.6) - sz(-25.4)}
          rx="3"
          className="fill-[var(--map-ship)]"
        />
        {ZONES.filter((z) => z.id === "entrepot" || z.id === "maison").map((z) => (
          <rect
            key={z.id}
            x={sx(z.x) - 10}
            y={sz(z.z) - 7}
            width="20"
            height="14"
            className="fill-[var(--map-building)]"
          />
        ))}
        {NPCS.map((n) => (
          <circle key={n.id} cx={sx(n.x)} cy={sz(n.z)} r="2.4" className="fill-[var(--map-npc)]" />
        ))}
        {ZONES.filter((z) => !zones.includes(z.id)).map((z) => (
          <text
            key={z.id}
            x={sx(z.x)}
            y={sz(z.z) + 3}
            textAnchor="middle"
            fontSize="9"
            className="fill-[var(--map-objective)]"
          >
            ★
          </text>
        ))}
        {!inHold && !inCabin && (
          <circle
            cx={sx(pos.x)}
            cy={sz(pos.z)}
            r="3.6"
            className="fill-[var(--map-player)] stroke-[var(--map-land)]"
            strokeWidth="1.2"
          />
        )}
      </svg>
      <div className="hud-label text-center">
        {inHold ? "Dans la cale" : inCabin ? "Dans la cabine" : "Mini-carte"}
      </div>
    </div>
  );
}

function TouchControls() {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const origin = useRef<{ x: number; y: number } | null>(null);
  const update = (cx: number, cy: number) => {
    if (!origin.current) return;
    let dx = (cx - origin.current.x) / 50;
    let dy = (cy - origin.current.y) / 50;
    const l = Math.hypot(dx, dy);
    if (l > 1) {
      dx /= l;
      dy /= l;
    }
    input.joy.x = dx;
    input.joy.y = dy;
    setKnob({ x: dx * 36, y: dy * 36 });
  };
  return (
    <div className="touch-only">
      <div
        ref={base}
        className="joystick pointer-events-auto"
        onPointerDown={(e) => {
          e.stopPropagation();
          const r = base.current!.getBoundingClientRect();
          origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          update(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          e.stopPropagation();
          update(e.clientX, e.clientY);
        }}
        onPointerUp={() => {
          origin.current = null;
          input.joy.x = input.joy.y = 0;
          setKnob({ x: 0, y: 0 });
        }}
      >
        <div
          className="joystick-knob"
          style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
        />
      </div>
      <button
        className="touch-action pointer-events-auto"
        onPointerDown={(e) => {
          e.stopPropagation();
          pressInteract();
        }}
      >
        E
      </button>
    </div>
  );
}

function Toasts() {
  const toasts = useGame((s) => s.toasts);
  const dismiss = useGame((s) => s.dismissToast);
  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => dismiss(toasts[0].id), 3200);
    return () => clearTimeout(t);
  }, [toasts, dismiss]);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <span className="text-xl">{t.icon}</span> {t.text}
        </div>
      ))}
    </div>
  );
}

function WarningPopup() {
  const auth = useAuth();
  const warning = auth.warnings[0];
  if (!warning) return null;
  return (
    <Panel
      title="⚠️ Avertissement de l'administration"
      onClose={() => auth.dismissWarning(warning.id)}
    >
      <p className="text-base leading-relaxed">{warning.message}</p>
      <p className="mt-3 text-xs text-muted-foreground">
        Reçu le {new Date(warning.created_at).toLocaleString("fr-FR")}.
      </p>
      <button
        className="ui-btn ui-btn--primary mt-4 w-full"
        onClick={() => auth.dismissWarning(warning.id)}
      >
        J'ai compris
      </button>
    </Panel>
  );
}

function AccessBlockedScreen() {
  const auth = useAuth();
  const block = auth.accessBlock;
  if (!block) return null;
  const permanent = block.kind === "ban" && !block.bannedUntil;
  const title =
    block.kind === "kick"
      ? "Session interrompue"
      : permanent
        ? "Compte banni définitivement"
        : "Compte temporairement banni";
  return (
    <div className="access-block-screen">
      <section
        className="ui-panel access-block-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="access-block-title"
      >
        <div className="text-5xl">{block.kind === "kick" ? "⏏️" : "🚫"}</div>
        <p className="menu-kicker mt-3">Bordeaux 1750</p>
        <h1 id="access-block-title" className="font-display mt-1 text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {block.kind === "kick"
            ? "Un administrateur a interrompu votre session. Vous pouvez vous reconnecter si vous pensez qu'il s'agit d'une erreur."
            : permanent
              ? "L'accès à ce compte est bloqué. Contactez un administrateur pour demander un réexamen."
              : `L'accès à ce compte est suspendu${block.bannedUntil ? ` jusqu'au ${new Date(block.bannedUntil).toLocaleString("fr-FR")}` : ""}.`}
        </p>
        {block.reason && (
          <div className="fiche mt-4 text-left">
            <span className="fiche-tag">Motif</span>
            {block.reason}
          </div>
        )}
        <button className="ui-btn ui-btn--primary mt-5 w-full" onClick={auth.openAccount}>
          Se connecter avec un autre compte
        </button>
        <button className="ui-btn mt-2 w-full" onClick={() => window.location.reload()}>
          Vérifier à nouveau
        </button>
      </section>
      <AccountDialog />
    </div>
  );
}

/* ---------------- Panneaux ---------------- */
function DialogPanel() {
  const s = useGame();
  const npc = NPCS.find((n) => n.id === s.dialogNpc);
  if (!npc) return null;
  const done = s.dialogPage >= npc.lines.length - 1;
  return (
    <div className="dialog-wrap" onPointerDown={(e) => e.stopPropagation()}>
      <div className="dialog-box">
        <div className="flex items-center gap-3">
          <div className="dialog-avatar">{npc.name[0]}</div>
          <div>
            <div className="font-display text-2xl leading-none">{npc.name}</div>
            <div className="hud-label">{npc.job}</div>
          </div>
        </div>
        <p className="mt-3 text-lg leading-relaxed">
          « {npc.lines[Math.min(s.dialogPage, npc.lines.length - 1)]} »
        </p>
        <div className="fiche">
          <span className="fiche-tag">Fiche métier</span> {npc.fact}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          {!done ? (
            <button className="ui-btn ui-btn--primary" onClick={() => s.nextDialogPage()}>
              Suite ▸ <span className="opacity-60">(E)</span>
            </button>
          ) : (
            <button className="ui-btn ui-btn--primary" onClick={() => s.setPanel(null)}>
              Au revoir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function GoodPanel() {
  const s = useGame();
  const g = GOODS.find((x) => x.id === s.activeGood);
  if (!g) return null;
  return (
    <Panel title={`${g.emoji} ${g.name}`} onClose={() => s.setPanel(null)}>
      <dl className="grid gap-3">
        {[
          ["Origine", g.origin],
          ["Utilisation", g.usage],
          ["Transport", g.transport],
          ["Importance commerciale", g.importance],
        ].map(([k, v]) => (
          <div key={k} className="fiche">
            <dt className="hud-label">{k}</dt>
            <dd className="text-base">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">
        Informations simplifiées, à vocation pédagogique.
      </p>
    </Panel>
  );
}

function JournalPanel() {
  const s = useGame();
  const missions = missionList(s);
  return (
    <Panel title="📜 Journal" onClose={() => s.setPanel(null)} wide>
      <h3 className="section-title">Missions</h3>
      <ul className="grid gap-2">
        {missions.map((m) => (
          <li key={m.id} className={m.done ? "mission mission--done" : "mission"}>
            <span className="font-display text-lg">
              {m.done ? "✓" : m.id}. {m.title}
            </span>
            <span className="text-sm text-muted-foreground">
              {m.goal} — {m.progress}
              {m.reward ? ` · Récompense : ${m.reward}` : ""}
            </span>
          </li>
        ))}
      </ul>
      <h3 className="section-title mt-6">Ce que j'ai appris</h3>
      {s.facts.length === 0 && (
        <p className="text-muted-foreground">
          Explorez le port et parlez aux habitants pour remplir votre journal.
        </p>
      )}
      <ul className="grid gap-2">
        {s.facts.map((f) => (
          <li key={f} className="fiche">
            <span className="fiche-tag">Fait historique</span> {f}
          </li>
        ))}
      </ul>
      <h3 className="section-title mt-6">
        Marchandises identifiées ({s.goods.length}/{GOODS.length})
      </h3>
      <div className="flex flex-wrap gap-2">
        {GOODS.map((g) => (
          <button
            key={g.id}
            disabled={!s.goods.includes(g.id)}
            className="ui-chip"
            onClick={() => s.openGood(g.id)}
          >
            {s.goods.includes(g.id) ? `${g.emoji} ${g.name}` : "？"}
          </button>
        ))}
      </div>
      <div className="fiche fiche--reco mt-6">
        <span className="fiche-tag">Reconstitué pour le jeu</span> Les personnages (sauf François
        Bonnaffé), leurs dialogues, le navire et la disposition du port sont imaginés. {SHIP_NOTE}
      </div>
    </Panel>
  );
}

function QuizPanel() {
  const s = useGame();
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const q = QUIZ[i];
  const finished = i >= QUIZ.length;
  return (
    <Panel title="❓ Quiz historique" onClose={() => s.setPanel(null)}>
      {finished ? (
        <div className="text-center">
          <p className="font-display text-4xl">
            {score} / {QUIZ.length}
          </p>
          <p className="mt-2 text-muted-foreground">
            {score >= 6
              ? "Bravo, historien du port ! (+ succès « Historien »)"
              : "Rejouez pour obtenir au moins 6 bonnes réponses."}
          </p>
          <button
            className="ui-btn ui-btn--primary mt-4"
            onClick={() => {
              setI(0);
              setScore(0);
              setPicked(null);
            }}
          >
            Recommencer
          </button>
        </div>
      ) : (
        <div>
          <div className="hud-label">
            Question {i + 1} / {QUIZ.length}
          </div>
          <p className="font-display mt-1 text-2xl">{q.q}</p>
          <div className="mt-4 grid gap-2">
            {q.options.map((o, k) => {
              const state =
                picked === null
                  ? ""
                  : k === q.answer
                    ? "quiz-opt--good"
                    : k === picked
                      ? "quiz-opt--bad"
                      : "";
              return (
                <button
                  key={o}
                  disabled={picked !== null}
                  className={`quiz-opt ${state}`}
                  onClick={() => {
                    setPicked(k);
                    if (k === q.answer) {
                      setScore((x) => x + 1);
                      audio.blip(784);
                    } else audio.blip(220);
                  }}
                >
                  {String.fromCharCode(65 + k)}. {o}
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <div className="fiche mt-4">
              <strong>
                {picked === q.answer ? "Bonne réponse ! +10 points" : "Pas tout à fait."}
              </strong>{" "}
              {q.explain}
              <div className="mt-3 text-right">
                <button
                  className="ui-btn ui-btn--primary"
                  onClick={() => {
                    const ni = i + 1;
                    if (ni >= QUIZ.length) s.recordQuiz(score);
                    setI(ni);
                    setPicked(null);
                  }}
                >
                  {i + 1 >= QUIZ.length ? "Voir le résultat" : "Question suivante ▸"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function MapPanel({ onClose }: { onClose?: () => void }) {
  const s = useGame();
  const close = onClose ?? (() => s.setPanel(null));
  return (
    <Panel title="🗺️ Carte du port" onClose={close} wide>
      <div className="grid gap-2 sm:grid-cols-2">
        {ZONES.map((z) => (
          <div key={z.id} className={s.zones.includes(z.id) ? "mission mission--done" : "mission"}>
            <span className="font-display text-lg">
              {s.zones.includes(z.id) ? "✓" : "★"} {z.name}
            </span>
            <span className="text-sm text-muted-foreground">
              {s.zones.includes(z.id) ? z.fact : "Lieu encore à découvrir."}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Le navire « François Bonnaffé » est amarré au centre du quai : sa passerelle se trouve face
        à la grue.
      </p>
    </Panel>
  );
}

function AchievementsPanel({ onClose }: { onClose?: () => void }) {
  const s = useGame();
  return (
    <Panel title="🏆 Succès" onClose={onClose ?? (() => s.setPanel(null))}>
      <ul className="grid gap-2">
        {ACHIEVEMENTS.map((a) => {
          const got = s.achievements.includes(a.id);
          return (
            <li key={a.id} className={got ? "mission mission--done" : "mission opacity-60"}>
              <span className="font-display text-lg">
                {a.icon} {a.name}
              </span>
              <span className="text-sm text-muted-foreground">{a.desc}</span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function HistoryPanel({ onClose }: { onClose: () => void }) {
  return (
    <Panel title="📖 Histoire" onClose={onClose}>
      <div className="grid gap-3 text-base leading-relaxed">
        <p>
          Au XVIIIᵉ siècle, Bordeaux est l'un des grands ports du royaume de France. Les quais de la
          Garonne voient passer des navires venus d'Europe et d'outre-mer.
        </p>
        <p>
          Le vin de la région, les produits dits « coloniaux » (sucre, café, indigo, cacao) et de
          nombreuses marchandises y sont chargés, déchargés, pesés et revendus.
        </p>
        <p>
          Des négociants-armateurs, comme François Bonnaffé, organisent et financent ces
          expéditions. Une partie de ce commerce atlantique reposait aussi, selon les sources
          historiques, sur l'économie esclavagiste des colonies — une réalité à connaître pour
          comprendre cette époque.
        </p>
        <div className="fiche fiche--reco">
          <span className="fiche-tag">À propos</span> {ABOUT_TEXT}
        </div>
      </div>
    </Panel>
  );
}

function OptionsPanel({ onClose }: { onClose?: () => void }) {
  const s = useGame();
  const close = onClose ?? (() => s.setPanel(null));
  const weathers: { id: Weather; label: string }[] = [
    { id: "soleil", label: "☀️ Soleil" },
    { id: "nuages", label: "☁️ Nuages" },
    { id: "pluie", label: "🌧️ Pluie légère" },
    { id: "brouillard", label: "🌫️ Brouillard" },
  ];
  const times = [
    { t: 0.05, label: "Matin" },
    { t: 0.25, label: "Journée" },
    { t: 0.5, label: "Coucher" },
    { t: 0.75, label: "Soirée" },
  ];
  return (
    <Panel title="⚙️ Menu" onClose={close}>
      <h3 className="section-title">Météo</h3>
      <div className="flex flex-wrap gap-2">
        {weathers.map((w) => (
          <button
            key={w.id}
            className={s.weather === w.id ? "ui-chip ui-chip--on" : "ui-chip"}
            onClick={() => s.setWeather(w.id)}
          >
            {w.label}
          </button>
        ))}
      </div>
      <h3 className="section-title mt-4">Moment de la journée</h3>
      <div className="flex flex-wrap gap-2">
        {times.map((t) => (
          <button key={t.label} className="ui-chip" onClick={() => s.setTimeOfDay(t.t)}>
            {t.label}
          </button>
        ))}
      </div>
      <h3 className="section-title mt-4">Son</h3>
      <button className="ui-chip" onClick={() => s.toggleMute()}>
        {s.muted ? "🔇 Son coupé" : "🔊 Son activé"}
      </button>
      <h3 className="section-title mt-4">Commandes</h3>
      <p className="text-sm text-muted-foreground">
        Z/W avancer · S reculer · Q/A gauche · D droite · Maj courir · Souris (glisser) caméra ·
        Molette zoom · E interagir · J journal · M carte · Échap menu
      </p>
      {s.phase === "playing" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="ui-btn" onClick={() => s.setPanel("achievements")}>
            🏆 Succès
          </button>
          <button className="ui-btn" onClick={() => s.setPanel("about")}>
            ℹ️ À propos
          </button>
          <button className="ui-btn" onClick={() => s.backToMenu()}>
            Menu principal
          </button>
        </div>
      )}
      <button
        className="ui-btn mt-4 w-full"
        onClick={() => {
          if (confirm("Effacer toute la progression ?")) s.resetProgress();
        }}
      >
        Réinitialiser la sauvegarde
      </button>
    </Panel>
  );
}

function AboutPanel() {
  const s = useGame();
  return (
    <Panel title="ℹ️ À propos" onClose={() => s.setPanel(null)}>
      <p className="text-lg leading-relaxed">{ABOUT_TEXT}</p>
      <p className="mt-3 text-sm text-muted-foreground">{SHIP_NOTE}</p>
      <p className="mt-3 text-sm text-muted-foreground">
        Modèles 3D : Kenney (licence CC0, domaine public).
      </p>
    </Panel>
  );
}

function ChestPanel() {
  const s = useGame();
  const auth = useAuth();
  const missions = missionList(s);
  const done = missions.every((m) => m.done);
  return (
    <Panel title="🏆 Le coffre du capitaine" onClose={() => s.setPanel(null)}>
      {done ? (
        <div className="text-center">
          <div className="text-6xl">🎉</div>
          <h3 className="font-display mt-3 text-4xl">Voyage terminé !</h3>
          <p className="mt-3 text-lg leading-relaxed">
            Vous avez exploré le port, découvert ses métiers, chargé le navire et réussi les
            épreuves commerciales. Le coffre du capitaine marque la fin de l'aventure.
          </p>
          <div className="fiche mt-5 text-left">
            <span className="fiche-tag">Récompense</span> Succès « Négociant » débloqué ·{" "}
            {auth.isAdmin ? "points illimités" : `${s.score} points`} · rang{" "}
            {LEVELS[auth.isAdmin ? LEVELS.length - 1 : levelOf(s.score)].name}.
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button className="ui-btn ui-btn--primary" onClick={() => s.setPanel(null)}>
              Continuer l'exploration
            </button>
            <button className="ui-btn" onClick={() => s.backToMenu()}>
              Menu principal
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="text-center text-5xl">🔒</div>
          <h3 className="font-display mt-3 text-3xl">Le coffre est verrouillé</h3>
          <p className="mt-2 text-muted-foreground">
            Terminez les cinq premières missions avant de pouvoir l'ouvrir.
          </p>
          <ul className="mt-4 grid gap-2">
            {missions.slice(0, 5).map((m) => (
              <li key={m.id} className={m.done ? "mission mission--done" : "mission"}>
                <span className="font-display text-lg">
                  {m.done ? "✓" : m.id}. {m.title}
                </span>
                <span className="text-sm text-muted-foreground">{m.progress}</span>
              </li>
            ))}
          </ul>
          <button className="ui-btn mt-5 w-full" onClick={() => s.setPanel(null)}>
            Retour à la cabine
          </button>
        </div>
      )}
    </Panel>
  );
}

export function GameUI() {
  const phase = useGame((s) => s.phase);
  const panel = useGame((s) => s.panel);
  const setPanel = useGame((s) => s.setPanel);
  const auth = useAuth();
  if (auth.accessBlock) return <AccessBlockedScreen />;
  if (phase === "menu") return <MainMenu />;
  if (phase === "intro") return <Intro />;
  return (
    <>
      <Hud />
      <Toasts />
      <WarningPopup />
      <div className="pointer-events-none fixed inset-0 z-20">
        <Chat />
      </div>
      {panel === "dialog" && <DialogPanel />}
      {panel === "good" && <GoodPanel />}
      {panel === "journal" && <JournalPanel />}
      {panel === "quiz" && <QuizPanel />}
      {panel === "map" && <MapPanel />}
      {panel === "achievements" && <AchievementsPanel />}
      {panel === "options" && <OptionsPanel />}
      {panel === "about" && <AboutPanel />}
      {panel === "cargo" && <CargoGame onClose={() => setPanel(null)} />}
      {panel === "chest" && <ChestPanel />}
      <AccountDialog />
      {auth.adminOpen && <AdminPanel />}
    </>
  );
}
