import { create } from "zustand";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

// Le multijoueur reste facultatif, mais réutilise la session et le client public
// partagés avec Auth et PostgreSQL.

export interface RemoteInfo {
  name: string;
  model: string;
  avatarUrl: string | null;
}
export interface RemotePos {
  x: number;
  y: number;
  z: number;
  yaw: number;
  clip: string;
}
export interface ChatMessage {
  id: string;
  from: string;
  name: string;
  text: string;
  at: number;
  system?: boolean;
}

const MODELS = [
  "character-female-a",
  "character-female-c",
  "character-male-a",
  "character-male-c",
  "character-male-d",
  "character-male-e",
  "character-male-f",
];
const NAME_KEY = "bordeaux1750:pseudo";

function initialName() {
  if (typeof window === "undefined") return "Matelot";
  return localStorage.getItem(NAME_KEY) || `Matelot ${Math.floor(100 + Math.random() * 900)}`;
}

/** Positions des autres joueurs (mutables, lues à chaque image). */
export const remotePositions = new Map<string, RemotePos>();

interface MpState {
  myId: string;
  name: string;
  avatarUrl: string | null;
  model: string;
  connected: boolean;
  players: Record<string, RemoteInfo>;
  messages: ChatMessage[];
  unread: number;
  chatOpen: boolean;
  setName: (n: string) => void;
  setProfile: (n: string, avatarUrl?: string | null) => void;
  setChatOpen: (v: boolean) => void;
  connect: () => void;
  disconnect: () => void;
  sendPos: (p: RemotePos) => void;
  sendChat: (text: string) => void;
}

let channel: RealtimeChannel | null = null;

export const useMp = create<MpState>((set, get) => ({
  myId:
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : String(Math.random()),
  name: initialName(),
  avatarUrl: null,
  model: MODELS[Math.floor(Math.random() * MODELS.length)],
  connected: false,
  players: {},
  messages: [],
  unread: 0,
  chatOpen: false,

  setName: (n) => get().setProfile(n),
  setProfile: (n, avatarUrl) => {
    const name = n.trim().replace(/\s+/g, " ").slice(0, 20) || get().name;
    const nextAvatarUrl = avatarUrl === undefined ? get().avatarUrl : avatarUrl;
    set({ name, avatarUrl: nextAvatarUrl });
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch {
      /* ignore */
    }
    channel?.track({ name, model: get().model, avatarUrl: nextAvatarUrl });
  },
  setChatOpen: (v) => set({ chatOpen: v, unread: v ? 0 : get().unread }),

  connect: () => {
    if (channel || !supabase) return;
    const { myId } = get();
    const ch = supabase.channel("port-bordeaux-1750", {
      config: { presence: { key: myId }, broadcast: { self: false } },
    });
    channel = ch;

    const pushMsg = (m: ChatMessage) =>
      set((s) => ({
        messages: [...s.messages, m].slice(-80),
        unread: s.chatOpen || m.from === myId ? s.unread : s.unread + 1,
      }));

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<RemoteInfo>();
      const players: Record<string, RemoteInfo> = {};
      for (const [id, metas] of Object.entries(state)) {
        if (id === myId || !metas[0]) continue;
        players[id] = {
          name: metas[0].name || "Matelot",
          model: metas[0].model || "character-male-a",
          avatarUrl: metas[0].avatarUrl ?? null,
        };
      }
      for (const id of remotePositions.keys()) if (!players[id]) remotePositions.delete(id);
      set({ players });
    });
    ch.on("presence", { event: "join" }, ({ key, newPresences }) => {
      if (key === myId) return;
      const n = (newPresences[0] as unknown as RemoteInfo | undefined)?.name ?? "Un marin";
      pushMsg({
        id: `j-${key}-${Date.now()}`,
        from: "",
        name: "",
        text: `${n} arrive au port`,
        at: Date.now(),
        system: true,
      });
    });
    ch.on("presence", { event: "leave" }, ({ key, leftPresences }) => {
      if (key === myId) return;
      const n = (leftPresences[0] as unknown as RemoteInfo | undefined)?.name ?? "Un marin";
      pushMsg({
        id: `l-${key}-${Date.now()}`,
        from: "",
        name: "",
        text: `${n} a quitté le port`,
        at: Date.now(),
        system: true,
      });
    });
    ch.on("broadcast", { event: "pos" }, ({ payload }) => {
      const p = payload as RemotePos & { id: string };
      remotePositions.set(p.id, p);
    });
    ch.on("broadcast", { event: "chat" }, ({ payload }) => pushMsg(payload as ChatMessage));

    ch.subscribe(async (status) => {
      if (channel !== ch) return;
      if (status === "SUBSCRIBED") {
        set({ connected: true });
        const { name, model, avatarUrl } = get();
        await ch.track({ name, model, avatarUrl });
      } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
        set({ connected: false });
      }
    });
  },

  disconnect: () => {
    if (!channel) return;
    supabase?.removeChannel(channel);
    channel = null;
    remotePositions.clear();
    set({ connected: false, players: {} });
  },

  sendPos: (p) => {
    channel?.send({ type: "broadcast", event: "pos", payload: { ...p, id: get().myId } });
  },

  sendChat: (raw) => {
    const text = raw.trim().slice(0, 200);
    if (!text || !channel) return;
    const { myId, name } = get();
    const msg: ChatMessage = {
      id: `${myId}-${Date.now()}`,
      from: myId,
      name,
      text,
      at: Date.now(),
    };
    channel.send({ type: "broadcast", event: "chat", payload: msg });
    set((s) => ({ messages: [...s.messages, msg].slice(-80) }));
  },
}));
