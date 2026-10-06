import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAdminPlayers, runAdminAction, type AdminPlayer } from "../../auth/admin-api";
import { useAuth } from "../../auth/AuthProvider";

function playerName(player: AdminPlayer) {
  return player.email ?? player.displayName ?? `Invité · ${player.id.slice(0, 8)}`;
}

function formatDate(value: string | null) {
  if (!value) return "Jamais";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export function AdminPanel() {
  const auth = useAuth();
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [durationHours, setDurationHours] = useState("24");
  const [pointsValue, setPointsValue] = useState("0");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAdminPlayers();
      setPlayers(result);
      setSelectedId((current) =>
        current && result.some((player) => player.id === current)
          ? current
          : (result[0]?.id ?? null),
      );
      setIsError(false);
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Impossible de charger les joueurs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selected = players.find((player) => player.id === selectedId) ?? null;
  const filteredPlayers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return players;
    return players.filter((player) =>
      `${player.email ?? ""} ${player.displayName ?? ""} ${player.id}`.toLowerCase().includes(term),
    );
  }, [players, search]);

  const act = async (
    action:
      | "kick"
      | "temporary_ban"
      | "permanent_ban"
      | "unban"
      | "warn"
      | "set_points"
      | "adjust_points",
    points?: number,
  ) => {
    if (!selected) return;
    if (
      (action === "warn" || action === "temporary_ban" || action === "permanent_ban") &&
      !reason.trim()
    ) {
      setMessage(
        action === "warn"
          ? "Écrivez le texte de l'avertissement."
          : "Indiquez la raison de la sanction.",
      );
      setIsError(true);
      return;
    }
    if (
      action === "permanent_ban" &&
      !window.confirm(`Bannir définitivement ${playerName(selected)} ?`)
    )
      return;
    const parsedHours = Number(durationHours);
    if (
      action === "temporary_ban" &&
      (!Number.isInteger(parsedHours) || parsedHours < 1 || parsedHours > 87_600)
    ) {
      setMessage("La durée doit être comprise entre 1 et 87 600 heures.");
      setIsError(true);
      return;
    }
    if (
      (action === "set_points" || action === "adjust_points") &&
      (!Number.isSafeInteger(points) || points === undefined)
    ) {
      setMessage("Saisissez un nombre entier compris dans la plage sûre.");
      setIsError(true);
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      await runAdminAction({
        action,
        targetUserId: selected.id,
        reason: reason.trim() || undefined,
        durationHours: action === "temporary_ban" ? parsedHours : undefined,
        points,
      });
      setIsError(false);
      setMessage(action === "warn" ? "Avertissement envoyé au joueur." : "Action appliquée.");
      if (
        selected.id === auth.user?.id &&
        (action === "set_points" || action === "adjust_points")
      ) {
        await auth.refreshCurrentSave();
      }
      if (action === "warn") setReason("");
      await reload();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "L'action n'a pas pu être effectuée.");
    } finally {
      setBusy(false);
    }
  };

  if (!auth.isAdmin) return null;

  return (
    <div className="ui-scrim admin-scrim" onPointerDown={(event) => event.stopPropagation()}>
      <section
        className="ui-panel ui-panel--wide admin-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border pb-3">
          <div>
            <p className="menu-kicker">Administration du port</p>
            <h2 id="admin-title" className="font-display text-3xl text-foreground">
              🛡️ Joueurs & modération
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Connecté en tant que {auth.user?.email} · vos points sont illimités.
            </p>
          </div>
          <div className="flex gap-2">
            <button className="ui-btn" onClick={() => void reload()} disabled={loading || busy}>
              ↻ Actualiser
            </button>
            <button
              className="ui-icon-btn"
              onClick={auth.closeAdmin}
              aria-label="Fermer le panneau admin"
            >
              ✕
            </button>
          </div>
        </div>

        {(message || auth.storageError) && (
          <p
            className={
              isError ? "account-message account-message--error mt-3" : "account-message mt-3"
            }
            role="status"
          >
            {message ?? auth.storageError}
          </p>
        )}

        <div className="admin-layout mt-4">
          <section className="admin-roster" aria-label="Liste des joueurs">
            <div className="flex items-center justify-between gap-2">
              <h3 className="section-title mb-0">Joueurs ({players.length})</h3>
              {loading && <span className="text-xs text-muted-foreground">Chargement…</span>}
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="chat-input account-input mt-2"
              placeholder="Rechercher une adresse ou un compte invité"
              aria-label="Rechercher un joueur"
            />
            <div className="admin-player-list mt-2">
              {!loading && filteredPlayers.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">Aucun joueur trouvé.</p>
              )}
              {filteredPlayers.map((player) => (
                <button
                  type="button"
                  key={player.id}
                  className={
                    selectedId === player.id
                      ? "admin-player admin-player--selected"
                      : "admin-player"
                  }
                  onClick={() => {
                    setSelectedId(player.id);
                    setPointsValue(String(player.points));
                    setMessage(null);
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{playerName(player)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {player.isAnonymous
                        ? "Invité"
                        : player.isAdmin
                          ? "Administrateur"
                          : "Compte e-mail"}
                    </span>
                  </span>
                  <span className="text-right text-sm font-bold">
                    {player.isAdmin ? "∞" : player.points} pts
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="admin-actions" aria-label="Actions de modération">
            {!selected ? (
              <div className="fiche text-sm text-muted-foreground">
                Sélectionnez un joueur pour afficher ses actions.
              </div>
            ) : (
              <>
                <div className="fiche">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-display break-all text-2xl">{playerName(selected)}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">ID : {selected.id}</p>
                    </div>
                    {selected.permanentlyBanned ? (
                      <span className="admin-status admin-status--banned">
                        Banni définitivement
                      </span>
                    ) : selected.bannedUntil && Date.parse(selected.bannedUntil) > Date.now() ? (
                      <span className="admin-status admin-status--banned">
                        Banni jusqu'au {formatDate(selected.bannedUntil)}
                      </span>
                    ) : selected.isAdmin ? (
                      <span className="admin-status">Administrateur</span>
                    ) : (
                      <span className="admin-status">Compte actif</span>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>Inscription : {formatDate(selected.createdAt)}</span>
                    <span>Dernière connexion : {formatDate(selected.lastSignInAt)}</span>
                    <span>Points : {selected.isAdmin ? "illimités" : selected.points}</span>
                    <span>Avertissements : {selected.warningCount}</span>
                  </div>
                </div>

                {selected.isAdmin && (
                  <p className="fiche mt-3 text-sm">
                    Les comptes administrateurs sont protégés contre les expulsions, avertissements
                    et bannissements.
                  </p>
                )}

                <div className="mt-3 grid gap-3">
                  <div>
                    <label htmlFor="admin-reason" className="text-sm font-semibold">
                      Motif ou texte de l'avertissement
                    </label>
                    <textarea
                      id="admin-reason"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      maxLength={500}
                      rows={2}
                      className="chat-input account-input mt-1 min-h-20 resize-y"
                      placeholder="Message visible dans une fenêtre chez le joueur…"
                    />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      className="ui-btn"
                      disabled={busy || selected.isAdmin}
                      onClick={() => void act("kick")}
                    >
                      ⏏ Expulser maintenant
                    </button>
                    <button
                      className="ui-btn"
                      disabled={busy || selected.isAdmin}
                      onClick={() => void act("warn")}
                    >
                      ⚠ Envoyer un avertissement
                    </button>
                  </div>

                  <div className="admin-ban-row">
                    <label className="grid gap-1 text-sm font-semibold" htmlFor="admin-duration">
                      Durée du bannissement (heures)
                      <input
                        id="admin-duration"
                        type="number"
                        min={1}
                        max={87600}
                        step={1}
                        value={durationHours}
                        onChange={(event) => setDurationHours(event.target.value)}
                        className="chat-input account-input"
                      />
                    </label>
                    <button
                      className="ui-btn"
                      disabled={busy || selected.isAdmin}
                      onClick={() => void act("temporary_ban")}
                    >
                      ⏳ Bannir temporairement
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      className="ui-btn ui-btn--danger"
                      disabled={busy || selected.isAdmin}
                      onClick={() => void act("permanent_ban")}
                    >
                      🚫 Bannir définitivement
                    </button>
                    <button
                      className="ui-btn"
                      disabled={
                        busy ||
                        selected.isAdmin ||
                        (!selected.permanentlyBanned &&
                          !(selected.bannedUntil && Date.parse(selected.bannedUntil) > Date.now()))
                      }
                      onClick={() => void act("unban")}
                    >
                      ↩ Lever le bannissement
                    </button>
                  </div>

                  <div className="fiche">
                    <h4 className="section-title">⭐ Gérer les points</h4>
                    <p className="mb-2 text-xs text-muted-foreground">
                      Les nombres négatifs sont autorisés. Pour ajuster, saisissez un delta (par
                      exemple −20) ; pour remplacer le total, utilisez « Fixer ».
                    </p>
                    <label htmlFor="admin-points" className="sr-only">
                      Nombre de points ou delta
                    </label>
                    <input
                      id="admin-points"
                      type="number"
                      step={1}
                      value={pointsValue}
                      onChange={(event) => setPointsValue(event.target.value)}
                      className="chat-input account-input"
                    />
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <button
                        className="ui-btn"
                        disabled={busy || selected.isAdmin}
                        onClick={() => void act("adjust_points", Number(pointsValue))}
                      >
                        ± Ajuster les points
                      </button>
                      <button
                        className="ui-btn ui-btn--primary"
                        disabled={busy || selected.isAdmin}
                        onClick={() => void act("set_points", Number(pointsValue))}
                      >
                        ＝ Fixer le total
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
        {busy && (
          <p className="mt-3 text-center text-sm text-muted-foreground" role="status">
            Action en cours…
          </p>
        )}
      </section>
    </div>
  );
}
