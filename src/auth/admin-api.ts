import { supabase } from "../lib/supabase";

export interface AdminPlayer {
  id: string;
  email: string | null;
  displayName: string | null;
  isAnonymous: boolean;
  isAdmin: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  points: number;
  bannedUntil: string | null;
  permanentlyBanned: boolean;
  warningCount: number;
}

export type AdminAction =
  "kick" | "temporary_ban" | "permanent_ban" | "unban" | "warn" | "set_points" | "adjust_points";

export async function fetchAdminPlayers(): Promise<AdminPlayer[]> {
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  const { data, error } = await supabase.functions.invoke("admin-moderation", {
    body: { action: "list_players" },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return Array.isArray(data?.players) ? (data.players as AdminPlayer[]) : [];
}

export async function runAdminAction(input: {
  action: AdminAction;
  targetUserId: string;
  reason?: string;
  durationHours?: number;
  points?: number;
}) {
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  const { data, error } = await supabase.functions.invoke("admin-moderation", { body: input });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data;
}
