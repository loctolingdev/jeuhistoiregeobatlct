import { useEffect, useRef, useState, type FormEvent } from "react";
import { isReservedAdminEmail, isScvEmail } from "../../auth/auth-utils";
import { useAuth } from "../../auth/AuthProvider";

export function AccountDialog() {
  const auth = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [profileName, setProfileName] = useState(auth.profileName);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(auth.avatarUrl);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileIsError, setProfileIsError] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProfileName(auth.profileName);
    setAvatarFile(null);
    setRemoveAvatar(false);
    setProfileMessage(null);
  }, [auth.profileName, auth.avatarUrl, auth.user?.id]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(removeAvatar ? null : auth.avatarUrl);
      return;
    }
    const preview = URL.createObjectURL(avatarFile);
    setAvatarPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [avatarFile, auth.avatarUrl, removeAvatar]);

  if (!auth.accountOpen) return null;

  const normalizedEmail = email.trim().toLowerCase();
  const automaticScv = isScvEmail(normalizedEmail) && !isReservedAdminEmail(normalizedEmail);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setIsError(false);
    setBusy(true);
    try {
      const result =
        mode === "login" ? await auth.signIn(email, password) : await auth.signUp(email, password);
      if (result.error) {
        setMessage(result.error);
        setIsError(true);
      } else if (result.notice) {
        setMessage(result.notice);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Une erreur est survenue.");
      setIsError(true);
    } finally {
      setBusy(false);
    }
  };

  const handleGuest = async () => {
    setBusy(true);
    setMessage(null);
    const result = await auth.continueAsGuest();
    if (result.error) {
      setMessage(result.error);
      setIsError(true);
    } else if (result.notice) {
      setMessage(result.notice);
    }
    setBusy(false);
  };

  const saveProfile = async () => {
    setProfileBusy(true);
    setProfileMessage(null);
    setProfileIsError(false);
    const result = await auth.updateProfile(profileName, avatarFile, removeAvatar);
    if (result.error) {
      setProfileMessage(result.error);
      setProfileIsError(true);
    } else {
      setProfileMessage(result.notice ?? "Profil enregistré.");
      setAvatarFile(null);
      setRemoveAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
    setProfileBusy(false);
  };

  return (
    <div className="ui-scrim account-scrim" onPointerDown={(event) => event.stopPropagation()}>
      <section
        className="ui-panel account-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border pb-3">
          <div>
            <p className="menu-kicker">Équipage du port</p>
            <h2 id="account-title" className="font-display text-3xl text-foreground">
              Compte & sauvegarde
            </h2>
          </div>
          <button className="ui-icon-btn" onClick={auth.closeAccount} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="mt-4 grid gap-4">
          <div className="fiche">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-display text-xl">
                {auth.isGuest ? "👤 Compte invité" : `✉️ ${auth.user?.email ?? "Compte joueur"}`}
              </span>
              {auth.isAdmin && <span className="fiche-tag">Administration</span>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {auth.isGuest
                ? auth.user
                  ? "Votre compte invité Supabase sauvegarde automatiquement votre partie. Vous pourrez la transférer en créant un compte."
                  : "Mode invité local : la partie reste sur cet appareil tant que Supabase n'est pas configuré."
                : "Votre progression est synchronisée avec votre compte Supabase."}
            </p>
          </div>

          <section className="fiche profile-editor" aria-labelledby="profile-title">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 id="profile-title" className="font-display text-xl text-foreground">
                  Profil du joueur
                </h3>
                <p className="text-xs text-muted-foreground">
                  Votre pseudo et votre photo apparaissent au-dessus de votre personnage.
                </p>
              </div>
              <div className="profile-avatar-preview" aria-label="Aperçu de la photo de profil">
                {avatarPreview ? <img src={avatarPreview} alt="" /> : <span>👤</span>}
              </div>
            </div>
            <div className="mt-3 grid gap-3">
              <label className="grid gap-1 text-sm font-semibold" htmlFor="player-display-name">
                Pseudo (2 à 20 caractères)
                <input
                  id="player-display-name"
                  type="text"
                  autoComplete="nickname"
                  minLength={2}
                  maxLength={20}
                  required
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  className="chat-input account-input"
                  placeholder="Votre pseudo"
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold" htmlFor="player-avatar">
                Photo de profil
                <input
                  ref={avatarInputRef}
                  id="player-avatar"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={!auth.isConfigured || profileBusy}
                  onChange={(event) => {
                    const selected = event.target.files?.[0] ?? null;
                    setProfileMessage(null);
                    setProfileIsError(false);
                    setAvatarFile(selected);
                    setRemoveAvatar(false);
                  }}
                  className="chat-input account-input profile-file-input"
                />
              </label>
              <p className="text-xs text-muted-foreground">
                JPEG, PNG ou WebP, 3 Mo maximum. La photo est stockée dans votre espace Supabase et
                visible par les autres joueurs.
              </p>
              {auth.avatarUrl && (
                <button
                  type="button"
                  className="ui-btn justify-self-start"
                  onClick={() => {
                    setAvatarFile(null);
                    setRemoveAvatar((current) => !current);
                    setProfileMessage(null);
                  }}
                  disabled={profileBusy}
                >
                  {removeAvatar ? "Annuler la suppression de la photo" : "Supprimer la photo"}
                </button>
              )}
              <button
                type="button"
                className="ui-btn ui-btn--primary w-full"
                onClick={() => void saveProfile()}
                disabled={profileBusy || !auth.ready || (auth.isConfigured && !auth.saveReady)}
              >
                {profileBusy ? "Enregistrement…" : "Enregistrer le profil"}
              </button>
              {profileMessage && (
                <p
                  className={
                    profileIsError ? "account-message account-message--error" : "account-message"
                  }
                  role="status"
                >
                  {profileMessage}
                </p>
              )}
            </div>
          </section>

          {!auth.saveReady && (
            <p className="account-message" role="status">
              Chargement de la sauvegarde du compte en cours…
            </p>
          )}

          {auth.isConfigured ? (
            <>
              <div className="flex gap-2" role="tablist" aria-label="Connexion ou inscription">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "login"}
                  className={mode === "login" ? "ui-chip ui-chip--on" : "ui-chip"}
                  onClick={() => {
                    setMode("login");
                    setMessage(null);
                  }}
                >
                  Connexion
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "signup"}
                  className={mode === "signup" ? "ui-chip ui-chip--on" : "ui-chip"}
                  onClick={() => {
                    setMode("signup");
                    setMessage(null);
                  }}
                >
                  Créer un compte
                </button>
              </div>

              <form className="grid gap-3" onSubmit={submit}>
                <label className="grid gap-1 text-sm font-semibold" htmlFor="account-email">
                  Adresse e-mail
                  <input
                    id="account-email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="chat-input account-input"
                    placeholder="nom@exemple.fr"
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold" htmlFor="account-password">
                  Mot de passe
                  <input
                    id="account-password"
                    type="password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    required
                    minLength={mode === "signup" ? 8 : 1}
                    maxLength={72}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="chat-input account-input"
                    placeholder="8 caractères minimum"
                  />
                </label>
                {mode === "signup" && automaticScv && (
                  <p className="fiche text-sm">
                    <span className="fiche-tag">Domaine SCV</span>
                    L'inscription est acceptée sans e-mail de confirmation. Un mot de passe reste
                    nécessaire pour protéger le compte.
                  </p>
                )}
                {mode === "signup" && isReservedAdminEmail(normalizedEmail) && (
                  <p className="fiche text-sm">
                    Les comptes administrateurs doivent être vérifiés ou créés depuis le tableau de
                    bord Supabase ; ils ne passent pas par l'inscription automatique.
                  </p>
                )}
                <button
                  className="ui-btn ui-btn--primary w-full"
                  type="submit"
                  disabled={busy || !auth.ready || !auth.saveReady}
                >
                  {busy ? "Connexion…" : mode === "login" ? "Se connecter" : "Créer mon compte"}
                </button>
              </form>
            </>
          ) : (
            <div className="fiche text-sm">
              <strong>Supabase n'est pas configuré sur cet appareil.</strong>
              <p className="mt-1">
                Copiez <code>.env.example</code> vers <code>.env</code>, ajoutez la clé publique du
                projet puis relancez <code>npm run dev</code>.
              </p>
            </div>
          )}

          {(message || auth.authError) && (
            <p
              className={isError ? "account-message account-message--error" : "account-message"}
              role="status"
            >
              {message ?? auth.authError}
            </p>
          )}
          {auth.storageError && (
            <p className="account-message account-message--error" role="status">
              {auth.storageError}
            </p>
          )}

          <div className="border-t border-border pt-3">
            <button
              type="button"
              className="ui-btn w-full"
              onClick={() => void handleGuest()}
              disabled={busy || !auth.ready || !auth.saveReady || Boolean(auth.accessBlock)}
            >
              {auth.isGuest ? "Continuer comme invité" : "Se déconnecter et passer en invité"}
            </button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Les comptes invités utilisent l'authentification anonyme Supabase ; ils n'ont pas
              d'adresse e-mail.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
