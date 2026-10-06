import type { User } from "@supabase/supabase-js";

export const GAME_ADMIN_EMAILS = ["lucas.kerouault@scv.bzh", "sportzonefr@proton.me"] as const;

const adminEmailSet = new Set<string>(GAME_ADMIN_EMAILS);

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isScvEmail(email: string) {
  return /^[^\s@]+@scv\.bzh$/i.test(email.trim());
}

export function isReservedAdminEmail(email: string) {
  return adminEmailSet.has(normalizeEmail(email));
}

export function isGameAdmin(user: Pick<User, "email" | "email_confirmed_at"> | null | undefined) {
  return Boolean(
    user?.email && user.email_confirmed_at && adminEmailSet.has(normalizeEmail(user.email)),
  );
}
