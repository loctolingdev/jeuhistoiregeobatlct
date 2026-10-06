import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ADMIN_EMAILS = new Set(["lucas.kerouault@scv.bzh", "sportzonefr@proton.me"]);
const ALLOWED_ACTIONS = new Set([
  "kick",
  "temporary_ban",
  "permanent_ban",
  "unban",
  "warn",
  "set_points",
  "adjust_points",
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isVerifiedAdmin(user: User | null) {
  return Boolean(
    user?.email && user.email_confirmed_at && ADMIN_EMAILS.has(user.email.trim().toLowerCase()),
  );
}

function asFiniteNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = request.headers.get("Authorization") ?? "";
  const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return json({ error: "Connexion requise." }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !serviceRoleKey || !publicKey) {
    return json({ error: "Configuration des fonctions Supabase incomplète." }, 500);
  }

  const callerClient = createClient(url, publicKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerData, error: callerError } = await callerClient.auth.getUser(accessToken);
  if (callerError || !isVerifiedAdmin(callerData.user)) {
    return json({ error: "Accès réservé aux deux comptes administrateurs vérifiés." }, 403);
  }

  const serviceClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Requête JSON invalide." }, 400);
  }

  if (body.action === "list_players") {
    try {
      const users: User[] = [];
      for (let page = 1; ; page += 1) {
        const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        users.push(...data.users);
        if (data.users.length < 1000) break;
      }

      const [savesResult, moderationResult, warningsResult] = await Promise.all([
        serviceClient.from("game_saves").select("user_id, save_data"),
        serviceClient.from("player_moderation").select("user_id, banned_until, permanent_ban"),
        serviceClient.from("player_warnings").select("user_id"),
      ]);
      if (savesResult.error) throw savesResult.error;
      if (moderationResult.error) throw moderationResult.error;
      if (warningsResult.error) throw warningsResult.error;

      const saves = new Map<string, Record<string, unknown>>(
        (savesResult.data ?? []).map((row) => [
          row.user_id,
          (row.save_data ?? {}) as Record<string, unknown>,
        ]),
      );
      const moderation = new Map<string, { banned_until: string | null; permanent_ban: boolean }>(
        (moderationResult.data ?? []).map((row) => [row.user_id, row]),
      );
      const warningCounts = new Map<string, number>();
      for (const warning of warningsResult.data ?? []) {
        warningCounts.set(warning.user_id, (warningCounts.get(warning.user_id) ?? 0) + 1);
      }

      const players = users.map((player) => {
        const status = moderation.get(player.id);
        const metadata = player.user_metadata ?? {};
        const isAdmin = Boolean(
          player.email && player.email_confirmed_at && ADMIN_EMAILS.has(player.email.toLowerCase()),
        );
        return {
          id: player.id,
          email: player.email ?? null,
          displayName:
            typeof metadata.display_name === "string"
              ? metadata.display_name
              : typeof metadata.full_name === "string"
                ? metadata.full_name
                : null,
          isAnonymous: player.is_anonymous === true,
          isAdmin,
          createdAt: player.created_at,
          lastSignInAt: player.last_sign_in_at ?? null,
          points: asFiniteNumber(saves.get(player.id)?.score),
          bannedUntil: status?.banned_until ?? null,
          permanentlyBanned: status?.permanent_ban ?? false,
          warningCount: warningCounts.get(player.id) ?? 0,
        };
      });
      players.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return json({ players });
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "Impossible de charger les joueurs." },
        500,
      );
    }
  }

  const action = typeof body.action === "string" ? body.action : "";
  const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId : "";
  if (!ALLOWED_ACTIONS.has(action) || !targetUserId) {
    return json({ error: "Action ou joueur invalide." }, 400);
  }

  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : null;
  const durationHours = Number(body.durationHours);
  const points = Number(body.points);
  if (
    action === "temporary_ban" &&
    (!Number.isInteger(durationHours) || durationHours < 1 || durationHours > 87600)
  ) {
    return json({ error: "La durée doit être comprise entre 1 et 87 600 heures." }, 400);
  }
  if ((action === "set_points" || action === "adjust_points") && !Number.isSafeInteger(points)) {
    return json({ error: "Le nombre de points doit être un entier dans la plage sûre." }, 400);
  }
  if (["warn", "temporary_ban", "permanent_ban"].includes(action) && !reason) {
    return json({ error: "Un message ou un motif est obligatoire." }, 400);
  }

  const { error: actionError } = await callerClient.rpc("admin_manage_player", {
    p_action: action,
    p_target_user_id: targetUserId,
    p_reason: reason,
    p_duration_hours: action === "temporary_ban" ? durationHours : null,
    p_points: action === "set_points" || action === "adjust_points" ? points : null,
  });
  if (actionError) return json({ error: actionError.message }, 400);

  if (action === "temporary_ban" || action === "permanent_ban" || action === "unban") {
    const banDuration =
      action === "temporary_ban"
        ? `${durationHours}h`
        : action === "permanent_ban"
          ? "876000h"
          : "none";
    const { error } = await serviceClient.auth.admin.updateUserById(targetUserId, {
      ban_duration: banDuration,
    });
    if (error) {
      return json(
        {
          error: `L'action est enregistrée dans le jeu, mais le verrouillage Auth a échoué : ${error.message}`,
        },
        502,
      );
    }
  }

  return json({ ok: true });
});
