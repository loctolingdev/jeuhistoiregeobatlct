import { create } from "zustand";
import { ACHIEVEMENTS, GOODS, LEVELS, ZONES, type ZoneId } from "./data";

export type Phase = "menu" | "intro" | "playing";
export type Panel =
  | null
  | "dialog"
  | "good"
  | "journal"
  | "quiz"
  | "map"
  | "achievements"
  | "options"
  | "about"
  | "cargo"
  | "history"
  | "chest";
// The captain's chest also shows the ending without stopping exploration.

export type Weather = "soleil" | "nuages" | "pluie" | "brouillard";

export interface Toast {
  id: number;
  text: string;
  icon?: string;
}

export interface SavedState {
  score: number;
  zones: ZoneId[];
  npcs: string[];
  goods: string[];
  facts: string[];
  achievements: string[];
  shipParts: string[];
  cratesLoaded: number;
  cargoRound1: boolean;
  cargoRound2: boolean;
  quizBest: number;
  chestOpened: boolean;
}

export interface GameState extends SavedState {
  phase: Phase;
  panel: Panel;
  dialogNpc: string | null;
  dialogPage: number;
  activeGood: string | null;
  carrying: string | null;
  inHold: boolean;
  inCabin: boolean;
  onShip: boolean;
  timeOfDay: number; // 0..1 (0 = matin)
  weather: Weather;
  muted: boolean;
  toasts: Toast[];
  playerPos: { x: number; z: number };

  startGame: () => void;
  beginIntro: () => void;
  backToMenu: () => void;
  setPanel: (p: Panel) => void;
  openDialog: (npc: string) => void;
  nextDialogPage: () => void;
  openGood: (id: string) => void;
  addScore: (n: number) => void;
  notify: (text: string, icon?: string) => void;
  dismissToast: (id: number) => void;
  visitZone: (id: ZoneId, name: string, fact: string) => void;
  talkTo: (id: string, fact: string) => void;
  identifyGood: (id: string) => void;
  learnFact: (fact: string) => void;
  unlock: (id: string) => void;
  visitShipPart: (part: "pont" | "cabine" | "cale") => void;
  setCarrying: (id: string | null) => void;
  deliverCrate: () => void;
  setInHold: (v: boolean) => void;
  setInCabin: (v: boolean) => void;
  openChest: () => void;
  setOnShip: (v: boolean) => void;
  finishCargoRound: (round: 1 | 2) => void;
  recordQuiz: (score: number) => void;
  setTimeOfDay: (t: number) => void;
  setWeather: (w: Weather) => void;
  toggleMute: () => void;
  resetProgress: () => void;
}

const LEGACY_SAVE_KEY = "bordeaux1750:save";
const SAVE_KEY_PREFIX = "bordeaux1750:save:";
let activeSaveKey = LEGACY_SAVE_KEY;

export const EMPTY_SAVE: SavedState = {
  score: 0,
  zones: [],
  npcs: [],
  goods: [],
  facts: [],
  achievements: [],
  shipParts: [],
  cratesLoaded: 0,
  cargoRound1: false,
  cargoRound2: false,
  quizBest: 0,
  chestOpened: false,
};

export function normalizeSavedState(value: unknown): SavedState {
  const source = value && typeof value === "object" ? (value as Partial<SavedState>) : {};
  const strings = (items: unknown) =>
    Array.isArray(items)
      ? [...new Set(items.filter((item): item is string => typeof item === "string"))]
      : [];
  const finiteNumber = (item: unknown, fallback = 0) =>
    typeof item === "number" && Number.isFinite(item) ? item : fallback;
  return {
    score: finiteNumber(source.score),
    zones: strings(source.zones) as ZoneId[],
    npcs: strings(source.npcs),
    goods: strings(source.goods),
    facts: strings(source.facts),
    achievements: strings(source.achievements),
    shipParts: strings(source.shipParts),
    cratesLoaded: Math.max(0, Math.floor(finiteNumber(source.cratesLoaded))),
    cargoRound1: source.cargoRound1 === true,
    cargoRound2: source.cargoRound2 === true,
    quizBest: Math.max(0, Math.floor(finiteNumber(source.quizBest))),
    chestOpened: source.chestOpened === true,
  };
}

export function mergeSavedStates(primary: SavedState, secondary: SavedState): SavedState {
  const mergeLists = (a: string[], b: string[]) => [...new Set([...a, ...b])];
  return {
    score: Math.max(primary.score, secondary.score),
    zones: mergeLists(primary.zones, secondary.zones) as ZoneId[],
    npcs: mergeLists(primary.npcs, secondary.npcs),
    goods: mergeLists(primary.goods, secondary.goods),
    facts: mergeLists(primary.facts, secondary.facts),
    achievements: mergeLists(primary.achievements, secondary.achievements),
    shipParts: mergeLists(primary.shipParts, secondary.shipParts),
    cratesLoaded: Math.max(primary.cratesLoaded, secondary.cratesLoaded),
    cargoRound1: primary.cargoRound1 || secondary.cargoRound1,
    cargoRound2: primary.cargoRound2 || secondary.cargoRound2,
    quizBest: Math.max(primary.quizBest, secondary.quizBest),
    chestOpened: primary.chestOpened || secondary.chestOpened,
  };
}

function readStoredSave(key: string): { save: SavedState; updatedAt: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { save?: unknown; updatedAt?: unknown } | unknown;
    if (parsed && typeof parsed === "object" && "save" in parsed) {
      const envelope = parsed as { save: unknown; updatedAt?: unknown };
      return {
        save: normalizeSavedState(envelope.save),
        updatedAt:
          typeof envelope.updatedAt === "string" ? envelope.updatedAt : new Date(0).toISOString(),
      };
    }
    return { save: normalizeSavedState(parsed), updatedAt: new Date(0).toISOString() };
  } catch {
    return null;
  }
}

function loadSave(): SavedState {
  return readStoredSave(LEGACY_SAVE_KEY)?.save ?? EMPTY_SAVE;
}

function persist(s: GameState) {
  if (typeof window === "undefined") return;
  const data = getSavedState(s);
  try {
    localStorage.setItem(
      activeSaveKey,
      JSON.stringify({ save: data, updatedAt: new Date().toISOString() }),
    );
  } catch {
    /* stockage local indisponible : la synchronisation distante reste indépendante. */
  }
}

export function setSaveOwner(ownerId: string | null) {
  activeSaveKey = `${SAVE_KEY_PREFIX}${ownerId ?? "offline"}`;
}

export function readLocalSave(ownerId: string, includeLegacy = false) {
  return (
    readStoredSave(`${SAVE_KEY_PREFIX}${ownerId}`) ??
    (includeLegacy ? readStoredSave(LEGACY_SAVE_KEY) : null)
  );
}

export function readLegacySave() {
  return readStoredSave(LEGACY_SAVE_KEY);
}

export function writeLocalSave(
  ownerId: string,
  save: SavedState,
  updatedAt = new Date().toISOString(),
) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${SAVE_KEY_PREFIX}${ownerId}`,
      JSON.stringify({ save: normalizeSavedState(save), updatedAt }),
    );
  } catch {
    /* stockage local indisponible */
  }
}

export function getSavedState(state: Pick<GameState, keyof SavedState>): SavedState {
  return normalizeSavedState({
    score: state.score,
    zones: state.zones,
    npcs: state.npcs,
    goods: state.goods,
    facts: state.facts,
    achievements: state.achievements,
    shipParts: state.shipParts,
    cratesLoaded: state.cratesLoaded,
    cargoRound1: state.cargoRound1,
    cargoRound2: state.cargoRound2,
    quizBest: state.quizBest,
    chestOpened: state.chestOpened,
  });
}

let toastId = 0;

export const useGame = create<GameState>((set, get) => ({
  ...loadSave(),
  phase: "menu",
  panel: null,
  dialogNpc: null,
  dialogPage: 0,
  activeGood: null,
  carrying: null,
  inHold: false,
  inCabin: false,
  onShip: false,
  timeOfDay: 0.25,
  weather: "soleil",
  muted: false,
  toasts: [],
  playerPos: { x: 0, z: 0 },

  beginIntro: () => set({ phase: "intro", panel: null }),
  startGame: () => {
    set({ phase: "playing", panel: null });
    get().unlock("premier-pas");
  },
  backToMenu: () => set({ phase: "menu", panel: null }),
  setPanel: (p) => set({ panel: p }),
  openDialog: (npc) => set({ panel: "dialog", dialogNpc: npc, dialogPage: 0 }),
  nextDialogPage: () => set((s) => ({ dialogPage: s.dialogPage + 1 })),
  openGood: (id) => set({ panel: "good", activeGood: id }),

  addScore: (n) =>
    set((s) => {
      const score = s.score + n;
      const before = levelOf(s.score);
      const after = levelOf(score);
      const next = { ...s, score };
      persist(next);
      if (after !== before) {
        setTimeout(() => get().notify(`Nouveau rang : ${LEVELS[after].name}`, "⭐"), 400);
      }
      return { score };
    }),

  notify: (text, icon) =>
    set((s) => ({ toasts: [...s.toasts, { id: ++toastId, text, icon }].slice(-4) })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  visitZone: (id, name, fact) => {
    const s = get();
    if (s.zones.includes(id)) return;
    set({ zones: [...s.zones, id] });
    persist(get());
    get().addScore(25);
    get().notify(`Lieu découvert : ${name}`, "🗺️");
    get().learnFact(fact);
    if (get().zones.length >= ZONES.length) get().unlock("explorateur");
    checkAllMissions(get);
  },

  talkTo: (id, fact) => {
    const s = get();
    if (!s.npcs.includes(id)) {
      set({ npcs: [...s.npcs, id] });
      persist(get());
      get().addScore(20);
      get().notify("Métier découvert", "👤");
      get().learnFact(fact);
      checkAllMissions(get);
    }
  },

  identifyGood: (id) => {
    const s = get();
    if (s.goods.includes(id)) return;
    set({ goods: [...s.goods, id] });
    persist(get());
    get().addScore(15);
    const good = GOODS.find((g) => g.id === id);
    if (good) get().notify(`Marchandise identifiée : ${good.name}`, good.emoji);
    if (get().goods.length >= 5) get().unlock("marchand");
    checkAllMissions(get);
  },

  learnFact: (fact) => {
    const s = get();
    if (s.facts.includes(fact)) return;
    set({ facts: [...s.facts, fact] });
    persist(get());
  },

  unlock: (id) => {
    const s = get();
    if (s.achievements.includes(id)) return;
    set({ achievements: [...s.achievements, id] });
    persist(get());
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    get().addScore(30);
    if (a) get().notify(`Succès : ${a.name}`, a.icon);
  },

  visitShipPart: (part) => {
    const s = get();
    if (s.shipParts.includes(part)) {
      return;
    }
    set({ shipParts: [...s.shipParts, part] });
    persist(get());
    get().addScore(20);
    get().notify(`Partie du navire visitée : ${part}`, "⚓");
    if (part === "pont") get().unlock("marin");
    checkAllMissions(get);
  },

  setCarrying: (id) => set({ carrying: id }),
  deliverCrate: () => {
    set((s) => ({ cratesLoaded: s.cratesLoaded + 1, carrying: null }));
    persist(get());
    get().addScore(20);
    const n = get().cratesLoaded;
    get().notify(n >= 3 ? "Chargement terminé !" : `Colis chargé (${n}/3)`, "📦");
    checkAllMissions(get);
  },
  setInHold: (v) => set({ inHold: v }),
  setInCabin: (v) => set({ inCabin: v, inHold: false }),
  openChest: () => {
    const s = get();
    if (!s.inCabin) return;
    const prerequisitesDone = missionList(s)
      .filter((m) => m.id !== 6)
      .every((m) => m.done);
    if (!prerequisitesDone) {
      const next = missionList(s).find((m) => m.id !== 6 && !m.done);
      get().notify(next ? `Coffre verrouillé : ${next.title}` : "Le coffre est verrouillé.", "🔒");
      return;
    }
    if (!s.chestOpened) {
      set({ chestOpened: true });
      persist(get());
      get().notify("Le coffre du capitaine est ouvert !", "🏆");
      checkAllMissions(get);
    }
    get().setPanel("chest");
  },
  setOnShip: (v) => set({ onShip: v }),

  finishCargoRound: (round) => {
    set(round === 1 ? { cargoRound1: true } : { cargoRound2: true });
    persist(get());
    get().addScore(50);
    checkAllMissions(get);
  },

  recordQuiz: (score) => {
    set((s) => ({ quizBest: Math.max(s.quizBest, score) }));
    persist(get());
    get().addScore(score * 10);
    if (score >= 6) get().unlock("historien");
    checkAllMissions(get);
  },

  setTimeOfDay: (t) => set({ timeOfDay: t }),
  setWeather: (w) => set({ weather: w }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),

  resetProgress: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(activeSaveKey);
      localStorage.removeItem(LEGACY_SAVE_KEY);
    }
    set({
      score: 0,
      zones: [],
      npcs: [],
      goods: [],
      facts: [],
      achievements: [],
      shipParts: [],
      cratesLoaded: 0,
      cargoRound1: false,
      cargoRound2: false,
      quizBest: 0,
      chestOpened: false,
      inCabin: false,
      inHold: false,
      phase: "menu",
      panel: null,
    });
  },
}));

export function hydrateSavedState(save: unknown) {
  useGame.setState(normalizeSavedState(save));
}

export function levelOf(score: number) {
  let i = 0;
  LEVELS.forEach((l, idx) => {
    if (score >= l.min) i = idx;
  });
  return i;
}

export interface MissionStatus {
  id: number;
  title: string;
  goal: string;
  progress: string;
  done: boolean;
  reward?: string;
}

export function missionList(s: GameState): MissionStatus[] {
  return [
    {
      id: 1,
      title: "Découvrir le port",
      goal: "Explorer les 5 lieux du port",
      progress: `${s.zones.length}/${ZONES.length} lieux`,
      done: s.zones.length >= ZONES.length,
      reward: "Badge « Explorateur du port »",
    },
    {
      id: 2,
      title: "Identifier les métiers",
      goal: "Parler à au moins 4 personnages",
      progress: `${s.npcs.length}/4 métiers`,
      done: s.npcs.length >= 4,
    },
    {
      id: 3,
      title: "Charger un navire",
      goal: "Porter 3 colis jusqu'à la passerelle du navire",
      progress: `${Math.min(s.cratesLoaded, 3)}/3 colis`,
      done: s.cratesLoaded >= 3,
    },
    {
      id: 4,
      title: "Visiter un navire",
      goal: "Explorer le pont, la cabine et la cale",
      progress: `${s.shipParts.length}/3 parties`,
      done: s.shipParts.length >= 3,
    },
    {
      id: 5,
      title: "Le commerce",
      goal: "Réussir le mini-jeu commercial (rangement et origines)",
      progress: `${(s.cargoRound1 ? 1 : 0) + (s.cargoRound2 ? 1 : 0)}/2 épreuves`,
      done: s.cargoRound1 && s.cargoRound2,
    },
    {
      id: 6,
      title: "Le coffre du capitaine",
      goal: "Après les cinq missions, ouvrir le coffre dans la cabine",
      progress: s.chestOpened ? "Coffre ouvert" : "Coffre fermé",
      done: s.chestOpened,
    },
  ];
}

export function currentMission(s: GameState) {
  return missionList(s).find((m) => !m.done);
}

function checkAllMissions(get: () => GameState) {
  const s = get();
  if (missionList(s).every((m) => m.done)) get().unlock("negociant");
}
