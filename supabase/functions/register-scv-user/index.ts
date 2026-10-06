import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const RESERVED_ADMINS = new Set(["lucas.kerouault@scv.bzh", "sportzonefr@proton.me"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Requête JSON invalide." }, 400);
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^[^\s@]+@scv\.bzh$/i.test(email)) {
    return json(
      { error: "Cette inscription automatique est réservée aux adresses @scv.bzh." },
      400,
    );
  }
  if (RESERVED_ADMINS.has(email)) {
    return json(
      { error: "Les comptes administrateurs doivent être créés ou vérifiés séparément." },
      403,
    );
  }
  if (password.length < 8 || password.length > 72) {
    return json({ error: "Le mot de passe doit contenir entre 8 et 72 caractères." }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    return json({ error: "Configuration serveur Supabase incomplète." }, 500);
  }

  // The service-role key is only read by this server-side function and must be
  // configured in Supabase's Function secrets, never in Vite or the repository.
  const adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    // Do not reveal whether a specific address already has an account.
    return json(
      {
        error:
          "Création impossible. Cette adresse possède peut-être déjà un compte ; essayez Connexion.",
      },
      400,
    );
  }

  return json({ created: true, confirmationEmailSent: false }, 201);
});
