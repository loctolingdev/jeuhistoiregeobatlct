import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import {
  EMPTY_SAVE,
  getSavedState,
  hydrateSavedState,
  mergeSavedStates,
  normalizeSavedState,
  readLegacySave,
  readLocalSave,
  setSaveOwner,
  writeLocalSave,
  useGame,
  type SavedState,
} from "../game/store";
import { isGameAdmin, isReservedAdminEmail, isScvEmail, normalizeEmail } from "./auth-utils";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { useMp } from "../game/multiplayer";

export interface PlayerWarning {
  id: string;
  message: string;
  created_at: string;
}

export interface AccessBlock {
  kind: "ban" | "kick";
  reason?: string | null;
  bannedUntil?: string | null;
}

interface AuthResult {
  error?: string;
  notice?: string;
}

interface AuthContextValue {
  user: User | null;
  ready: boolean;
  saveReady: boolean;
  isGuest: boolean;
  isAdmin: boolean;
  isConfigured: boolean;
  profileName: string;
  avatarUrl: string | null;
  accountOpen: boolean;
  adminOpen: boolean;
  authError: string | null;
  storageError: string | null;
  warnings: PlayerWarning[];
  accessBlock: AccessBlock | null;
  openAccount: () => void;
  closeAccount: () => void;
  openAdmin: () => void;
  closeAdmin: () => void;
  dismissWarning: (id: string) => void;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  updateProfile: (
    displayName: string,
    avatarFile?: File | null,
    removeAvatar?: boolean,
  ) => Promise<AuthResult>;
  continueAsGuest: () => Promise<AuthResult>;
  refreshCurrentSave: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const SAVE_TABLE = "game_saves";
const PENDING_TRANSFER_PREFIX = "bordeaux1750:pending-transfer:";
const SAVE_SYNC_DELAY_MS = 650;

interface PendingTransfer {
  save: SavedState;
  updatedAt: string;
}

interface LocalSave {
  save: SavedState;
  updatedAt: string;
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Une erreur inattendue est survenue.";
}

function transferKey(email: string) {
  return `${PENDING_TRANSFER_PREFIX}${encodeURIComponent(normalizeEmail(email))}`;
}

function readPendingTransfer(email: string | undefined): PendingTransfer | null {
  if (!email || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(transferKey(email));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingTransfer>;
    if (!parsed.save || typeof parsed.updatedAt !== "string") return null;
    return { save: mergeSavedStates(EMPTY_SAVE, parsed.save), updatedAt: parsed.updatedAt };
  } catch {
    return null;
  }
}

function removePendingTransfer(email: string | undefined) {
  if (!email || typeof window === "undefined") return;
  try {
    localStorage.removeItem(transferKey(email));
  } catch {
    // Le transfert reste sauvegardé sur le compte invité dans Supabase.
  }
}

function isNewer(first: string, second: string) {
  const firstTime = Date.parse(first);
  const secondTime = Date.parse(second);
  return Number.isFinite(firstTime) && Number.isFinite(secondTime) && firstTime > secondTime;
}

function latestTimestamp(...timestamps: Array<string | null | undefined>) {
  const valid = timestamps.filter((item): item is string =>
    Boolean(item && Number.isFinite(Date.parse(item))),
  );
  if (!valid.length) return new Date().toISOString();
  return valid.reduce((latest, current) => (isNewer(current, latest) ? current : latest));
}

async function writeCloudSave(userId: string, save: SavedState, updatedAt: string) {
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  const { error } = await supabase
    .from(SAVE_TABLE)
    .upsert({ user_id: userId, save_data: save, updated_at: updatedAt }, { onConflict: "user_id" });
  if (error) throw error;
}

const AVATAR_BUCKET = "player-avatars";
const AVATAR_PATH = (userId: string) => `${userId}/avatar`;

function profileNameForUser(user: User) {
  const metadataName = user.user_metadata?.display_name;
  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim().replace(/\s+/g, " ").slice(0, 20);
  }
  const emailName = user.email?.split("@")[0]?.trim();
  return (emailName || `Matelot ${user.id.slice(0, 4)}`).slice(0, 20);
}

function avatarUrlForUser(user: User | null) {
  if (!user || !supabase || user.user_metadata?.avatar_path !== AVATAR_PATH(user.id)) return null;
  const publicUrl = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(AVATAR_PATH(user.id))
    .data.publicUrl;
  const version = user.user_metadata?.avatar_version;
  if (typeof version !== "string" && typeof version !== "number") return publicUrl;
  return `${publicUrl}${publicUrl.includes("?") ? "&" : "?"}v=${encodeURIComponent(String(version))}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const profileName = useMp((state) => state.name);
  const avatarUrl = useMp((state) => state.avatarUrl);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<PlayerWarning[]>([]);
  const [accessBlock, setAccessBlock] = useState<AccessBlock | null>(null);
  const kickVersions = useRef(new Map<string, number>());
  const pendingTransferRef = useRef<PendingTransfer | null>(null);
  const legacySaveRef = useRef<LocalSave | null>(readLegacySave());
  const loadingUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) {
      setSaveOwner("offline");
      setReady(true);
      return;
    }

    let alive = true;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      setUser(session?.user ?? null);
      setReady(true);
      if (event === "SIGNED_IN") setAccessBlock(null);
      if (!session) setHydratedUserId(null);
    });

    void (async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (!alive) return;
      if (sessionError) {
        setAuthError(sessionError.message);
      }
      if (sessionData.session?.user) {
        setUser(sessionData.session.user);
        setReady(true);
        return;
      }

      const { data: guestData, error: guestError } = await supabase.auth.signInAnonymously();
      if (!alive) return;
      if (guestError) {
        setSaveOwner("offline");
        setAuthError(
          `Le compte invité Supabase n'a pas pu être créé. Activez les connexions anonymes dans Supabase Auth. ${guestError.message}`,
        );
      } else if (guestData.user) {
        setUser(guestData.user);
        setAccessBlock(null);
      }
      setReady(true);
    })().catch((error: unknown) => {
      if (!alive) return;
      setSaveOwner("offline");
      setAuthError(toErrorMessage(error));
      setReady(true);
    });

    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    useMp.getState().setProfile(profileNameForUser(user), avatarUrlForUser(user));
  }, [user]);

  const checkPlayerStatus = useCallback(async (userId: string, firstCheck: boolean) => {
    if (!supabase) return;
    const { data, error } = await supabase.rpc("get_my_moderation_status");
    if (error || !data || typeof data !== "object") return;

    const status = data as {
      banned?: boolean;
      permanent_ban?: boolean;
      banned_until?: string | null;
      ban_reason?: string | null;
      kick_version?: number;
      warnings?: PlayerWarning[];
    };
    const version = Number(status.kick_version ?? 0);
    const previousVersion = kickVersions.current.get(userId);
    kickVersions.current.set(userId, version);

    const incomingWarnings = Array.isArray(status.warnings) ? status.warnings : [];
    if (incomingWarnings.length) {
      setWarnings((current) => {
        const known = new Set(current.map((warning) => warning.id));
        return [...current, ...incomingWarnings.filter((warning) => !known.has(warning.id))];
      });
    }

    if (status.banned) {
      setAccessBlock({
        kind: "ban",
        reason: status.ban_reason,
        bannedUntil: status.permanent_ban ? null : status.banned_until,
      });
      setAdminOpen(false);
      setAccountOpen(false);
      void supabase.auth.signOut({ scope: "local" });
      return;
    }

    if (!firstCheck && previousVersion !== undefined && version > previousVersion) {
      setAccessBlock({ kind: "kick", reason: status.ban_reason });
      setAdminOpen(false);
      setAccountOpen(false);
      void supabase.auth.signOut({ scope: "local" });
    }
  }, []);

  useEffect(() => {
    if (!user || !supabase || !isSupabaseConfigured) {
      setHydratedUserId(null);
      return;
    }

    const userId = user.id;
    let alive = true;
    setSaveOwner(userId);
    setHydratedUserId(null);
    setStorageError(null);
    if (loadingUserId.current === userId) return;
    loadingUserId.current = userId;

    void (async () => {
      const localSave = readLocalSave(userId);
      const offlineSave = user.is_anonymous ? readLocalSave("offline") : null;
      const pendingTransfer =
        readPendingTransfer(user.email ?? undefined) ?? pendingTransferRef.current;
      const { data: remoteRow, error: remoteError } = await supabase
        .from(SAVE_TABLE)
        .select("save_data, updated_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (!alive) return;

      let selectedSave = EMPTY_SAVE;
      let selectedAt = new Date(0).toISOString();
      let shouldWriteCloud = false;

      if (remoteError) {
        setStorageError(`La sauvegarde Supabase est indisponible : ${remoteError.message}`);
        if (localSave) {
          selectedSave = localSave.save;
          selectedAt = localSave.updatedAt;
        } else if (user.is_anonymous && (offlineSave || legacySaveRef.current)) {
          const oldSave = offlineSave ?? legacySaveRef.current!;
          selectedSave = oldSave.save;
          selectedAt = oldSave.updatedAt;
        }
      } else if (remoteRow) {
        selectedSave = mergeSavedStates(EMPTY_SAVE, remoteRow.save_data as SavedState);
        selectedAt = remoteRow.updated_at ?? selectedAt;
        if (localSave && isNewer(localSave.updatedAt, selectedAt)) {
          selectedSave = mergeSavedStates(selectedSave, localSave.save);
          selectedAt = localSave.updatedAt;
          shouldWriteCloud = true;
        }
      } else if (localSave) {
        selectedSave = localSave.save;
        selectedAt = localSave.updatedAt;
        shouldWriteCloud = true;
      } else if (user.is_anonymous && (offlineSave || legacySaveRef.current)) {
        const oldSave = offlineSave ?? legacySaveRef.current!;
        selectedSave = oldSave.save;
        selectedAt = oldSave.updatedAt;
        shouldWriteCloud = true;
        legacySaveRef.current = null;
      }

      if (pendingTransfer) {
        selectedSave = mergeSavedStates(selectedSave, pendingTransfer.save);
        selectedAt = latestTimestamp(
          selectedAt,
          pendingTransfer.updatedAt,
          new Date().toISOString(),
        );
        shouldWriteCloud = true;
      }

      hydrateSavedState(selectedSave);
      writeLocalSave(userId, selectedSave, selectedAt);
      setHydratedUserId(userId);
      loadingUserId.current = null;

      if (shouldWriteCloud && !remoteError) {
        try {
          const updatedAt = new Date().toISOString();
          await writeCloudSave(userId, selectedSave, updatedAt);
          writeLocalSave(userId, selectedSave, updatedAt);
          if (pendingTransfer) {
            removePendingTransfer(user.email ?? undefined);
            pendingTransferRef.current = null;
          }
        } catch (error) {
          setStorageError(
            `La progression reste sur cet appareil, mais la copie Supabase a échoué : ${toErrorMessage(error)}`,
          );
        }
      } else if (pendingTransfer && remoteError) {
        setStorageError(
          `Le transfert du compte invité attend la base de données : ${remoteError.message}`,
        );
      } else if (pendingTransfer) {
        removePendingTransfer(user.email ?? undefined);
        pendingTransferRef.current = null;
      }

      await checkPlayerStatus(userId, true);
    })().catch((error: unknown) => {
      if (!alive) return;
      loadingUserId.current = null;
      setStorageError(toErrorMessage(error));
      setHydratedUserId(userId);
    });

    return () => {
      alive = false;
      if (loadingUserId.current === userId) loadingUserId.current = null;
    };
  }, [user?.id, user?.email, user?.is_anonymous, checkPlayerStatus]);

  useEffect(() => {
    if (!user || !supabase || hydratedUserId !== user.id) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let latestSave = getSavedState(useGame.getState());
    let latestAt = new Date().toISOString();
    const unsubscribe = useGame.subscribe((state, previousState) => {
      const nextSave = getSavedState(state);
      const previousSave = getSavedState(previousState);
      if (JSON.stringify(nextSave) === JSON.stringify(previousSave)) return;
      latestSave = nextSave;
      latestAt = new Date().toISOString();
      writeLocalSave(user.id, nextSave, latestAt);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void writeCloudSave(user.id, latestSave, latestAt)
          .then(() => setStorageError(null))
          .catch((error: unknown) => {
            setStorageError(
              `Sauvegarde locale conservée ; synchronisation Supabase en attente. ${toErrorMessage(error)}`,
            );
          });
      }, SAVE_SYNC_DELAY_MS);
    });

    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [user?.id, hydratedUserId]);

  useEffect(() => {
    if (!user || !supabase || hydratedUserId !== user.id) return;
    const channel = supabase
      .channel(`game-save-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: SAVE_TABLE,
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as { save_data?: unknown; updated_at?: string };
          if (!row.save_data || typeof row.save_data !== "object") return;
          const remoteSave = normalizeSavedState(row.save_data);
          const localSave = getSavedState(useGame.getState());
          const mergedSave = mergeSavedStates(localSave, remoteSave);
          // Admins can intentionally lower a score, including below zero; keep the
          // database value authoritative while merging the rest of the progress.
          mergedSave.score = remoteSave.score;
          if (JSON.stringify(mergedSave) === JSON.stringify(localSave)) return;
          hydrateSavedState(mergedSave);
          writeLocalSave(user.id, mergedSave, row.updated_at ?? new Date().toISOString());
        },
      )
      .subscribe();

    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [user?.id, hydratedUserId]);

  useEffect(() => {
    if (!user || !supabase || hydratedUserId !== user.id) return;
    let active = true;
    const poll = () => {
      if (active) void checkPlayerStatus(user.id, false);
    };
    const interval = window.setInterval(poll, 10_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user?.id, hydratedUserId, checkPlayerStatus]);

  const preserveGuestSave = useCallback(
    async (email: string) => {
      if (user && !user.is_anonymous) return null;
      if (!user && !isSupabaseConfigured) return null;
      const transfer: PendingTransfer = {
        save: getSavedState(useGame.getState()),
        updatedAt: new Date().toISOString(),
      };
      pendingTransferRef.current = transfer;
      try {
        if (user?.is_anonymous) {
          writeLocalSave(user.id, transfer.save, transfer.updatedAt);
          if (supabase) await writeCloudSave(user.id, transfer.save, transfer.updatedAt);
        } else {
          writeLocalSave("offline", transfer.save, transfer.updatedAt);
        }
      } catch (error) {
        setStorageError(
          `La progression invitée reste sauvegardée localement. ${toErrorMessage(error)}`,
        );
      }
      try {
        localStorage.setItem(transferKey(email), JSON.stringify(transfer));
      } catch {
        // La copie du compte invité est déjà dans son stockage local/Supabase.
      }
      return transfer;
    },
    [user?.id, user?.is_anonymous],
  );

  const signIn = useCallback(
    async (rawEmail: string, password: string): Promise<AuthResult> => {
      if (!supabase)
        return {
          error: "Configurez VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY dans .env.",
        };
      const email = normalizeEmail(rawEmail);
      setAuthError(null);
      await preserveGuestSave(email);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthError(error.message);
        return { error: error.message };
      }
      setAccessBlock(null);
      setAccountOpen(false);
      return {};
    },
    [preserveGuestSave],
  );

  const signUp = useCallback(
    async (rawEmail: string, password: string): Promise<AuthResult> => {
      if (!supabase)
        return {
          error: "Configurez VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY dans .env.",
        };
      const email = normalizeEmail(rawEmail);
      setAuthError(null);
      if (isReservedAdminEmail(email)) {
        const message =
          "Cette adresse est réservée à l'administration. Créez ou confirmez le compte depuis Supabase Auth, puis connectez-vous ici.";
        setAuthError(message);
        return { error: message };
      }
      await preserveGuestSave(email);

      if (isScvEmail(email)) {
        const { data, error } = await supabase.functions.invoke("register-scv-user", {
          body: { email, password },
        });
        if (error) {
          const message = `Inscription SCV impossible. Vérifiez que la fonction Supabase register-scv-user est déployée. ${error.message}`;
          setAuthError(message);
          return { error: message };
        }
        if (data?.error) {
          const message = String(data.error);
          setAuthError(message);
          return { error: message };
        }
        const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
        if (loginError) {
          setAuthError(loginError.message);
          return { error: loginError.message };
        }
        setAccountOpen(false);
        setAccessBlock(null);
        return { notice: "Compte SCV créé et confirmé sans envoi d'e-mail." };
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: typeof window === "undefined" ? undefined : window.location.origin,
        },
      });
      if (error) {
        setAuthError(error.message);
        return { error: error.message };
      }
      if (data.session) {
        setAccountOpen(false);
        setAccessBlock(null);
        return { notice: "Compte créé et connecté." };
      }
      return {
        notice:
          "Compte créé. Consultez votre boîte mail pour confirmer l'adresse avant la première connexion.",
      };
    },
    [preserveGuestSave],
  );

  const updateProfile = useCallback(
    async (
      displayName: string,
      avatarFile?: File | null,
      removeAvatar = false,
    ): Promise<AuthResult> => {
      const normalizedName = displayName.trim().replace(/\s+/g, " ").slice(0, 20);
      if (normalizedName.length < 2) {
        return { error: "Le pseudo doit contenir au moins 2 caractères." };
      }
      if (avatarFile) {
        const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];
        if (!acceptedTypes.includes(avatarFile.type)) {
          return { error: "Choisissez une image au format JPEG, PNG ou WebP." };
        }
        if (avatarFile.size > 3 * 1024 * 1024) {
          return { error: "La photo de profil doit faire 3 Mo ou moins." };
        }
      }
      if (avatarFile && removeAvatar) {
        return { error: "Choisissez une photo ou sa suppression, pas les deux." };
      }

      setAuthError(null);
      if (!supabase || !isSupabaseConfigured || !user) {
        if (avatarFile || removeAvatar) {
          return { error: "Connectez-vous à Supabase pour enregistrer une photo de profil." };
        }
        useMp.getState().setProfile(normalizedName);
        return { notice: "Pseudo enregistré sur cet appareil." };
      }

      try {
        const avatarPath = AVATAR_PATH(user.id);
        if (avatarFile) {
          const { error: uploadError } = await supabase.storage
            .from(AVATAR_BUCKET)
            .upload(avatarPath, avatarFile, {
              cacheControl: "3600",
              contentType: avatarFile.type,
              upsert: true,
            });
          if (uploadError) throw uploadError;
        }
        if (removeAvatar && user.user_metadata?.avatar_path === avatarPath) {
          const { error: removeError } = await supabase.storage
            .from(AVATAR_BUCKET)
            .remove([avatarPath]);
          if (removeError) throw removeError;
        }

        const version = Date.now();
        const metadata = {
          ...(user.user_metadata ?? {}),
          display_name: normalizedName,
          ...(avatarFile ? { avatar_path: avatarPath, avatar_version: version } : {}),
          ...(removeAvatar ? { avatar_path: null, avatar_version: null } : {}),
        };
        const { data, error } = await supabase.auth.updateUser({ data: metadata });
        if (error) throw error;
        const updatedUser = data.user ?? user;
        setUser(updatedUser);
        useMp.getState().setProfile(normalizedName, avatarUrlForUser(updatedUser));
        return { notice: "Profil enregistré." };
      } catch (error) {
        const message = `Impossible d'enregistrer le profil. ${toErrorMessage(error)}`;
        setAuthError(message);
        return { error: message };
      }
    },
    [user],
  );

  const continueAsGuest = useCallback(async (): Promise<AuthResult> => {
    if (accessBlock) {
      const message =
        "Cette session est bloquée. Connectez-vous avec un autre compte ou contactez un administrateur.";
      setAuthError(message);
      return { error: message };
    }
    setAuthError(null);
    setWarnings([]);
    setAdminOpen(false);
    if (user?.is_anonymous) {
      setAccountOpen(false);
      return {};
    }
    if (!supabase || !isSupabaseConfigured) {
      setSaveOwner("offline");
      setAccountOpen(false);
      return {
        notice: "Vous jouez en invité local ; configurez Supabase pour la sauvegarde cloud.",
      };
    }

    try {
      if (user && !user.is_anonymous) {
        const currentSave = getSavedState(useGame.getState());
        const updatedAt = new Date().toISOString();
        writeLocalSave(user.id, currentSave, updatedAt);
        try {
          await writeCloudSave(user.id, currentSave, updatedAt);
        } catch {
          // La sauvegarde locale du compte est conservée.
        }
        await supabase.auth.signOut();
      }
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      if (data.user) setUser(data.user);
      setAccountOpen(false);
      return {};
    } catch (error) {
      const message = `Impossible de créer le compte invité Supabase. Activez les connexions anonymes dans Auth > Sign In / Providers. ${toErrorMessage(error)}`;
      setAuthError(message);
      return { error: message };
    }
  }, [user?.id, user?.is_anonymous, accessBlock]);

  const refreshCurrentSave = useCallback(async () => {
    if (!user || !supabase) return;
    const { data, error } = await supabase
      .from(SAVE_TABLE)
      .select("save_data, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      setStorageError(error.message);
      return;
    }
    if (!data) return;
    hydrateSavedState(data.save_data);
    writeLocalSave(user.id, data.save_data as SavedState, data.updated_at);
  }, [user?.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      saveReady: !isSupabaseConfigured || !user || hydratedUserId === user.id,
      isGuest: !user || user.is_anonymous === true,
      isAdmin: isGameAdmin(user),
      isConfigured: isSupabaseConfigured,
      profileName,
      avatarUrl,
      accountOpen,
      adminOpen,
      authError,
      storageError,
      warnings,
      accessBlock,
      openAccount: () => setAccountOpen(true),
      closeAccount: () => setAccountOpen(false),
      openAdmin: () => {
        if (isGameAdmin(user)) setAdminOpen(true);
      },
      closeAdmin: () => setAdminOpen(false),
      dismissWarning: (id) =>
        setWarnings((current) => current.filter((warning) => warning.id !== id)),
      signIn,
      signUp,
      updateProfile,
      continueAsGuest,
      refreshCurrentSave,
    }),
    [
      user,
      ready,
      hydratedUserId,
      profileName,
      avatarUrl,
      accountOpen,
      adminOpen,
      authError,
      storageError,
      warnings,
      accessBlock,
      signIn,
      signUp,
      updateProfile,
      continueAsGuest,
      refreshCurrentSave,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth doit être utilisé dans AuthProvider.");
  return value;
}
