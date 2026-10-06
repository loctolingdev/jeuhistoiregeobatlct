# Bordeaux 1750

Jeu éducatif 3D sur le port de Bordeaux au XVIIIᵉ siècle. Le projet est autonome : Vite, React, TanStack Start et Supabase, sans service ni paquet Lovable.

## Démarrer en local

Prérequis : Node.js 22.12+ (ou 20.19+) et npm.

```sh
cp .env.example .env
# Remplacez la valeur d'exemple par la clé publishable publique de votre projet Supabase.
npm install
npm run dev
```

Le jeu solo reste jouable en mode local si les variables Supabase ne sont pas renseignées. Pour les comptes, le multijoueur et la sauvegarde cloud, renseignez ces deux variables dans `.env` :

```dotenv
VITE_SUPABASE_URL=https://wiconhcbkuuzgsrfgvyp.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=votre_cle_publishable_supabase
```

La clé publishable est la seule clé utilisée par le navigateur. Ne mettez jamais une clé `service_role`, `secret` ou autre clé privilégiée dans `.env` côté Vite, une variable `VITE_*`, le code source ou GitHub. `.env` est ignoré par Git ; seul `.env.example` est versionné.

Commandes disponibles : `npm run dev`, `npm run build`, `npm run preview`, `npm test` et `npm run lint`.

## Configurer le projet Supabase externe

Le projet est prévu pour `https://wiconhcbkuuzgsrfgvyp.supabase.co`.

1. Dans **Project Settings → API**, copiez la clé **publishable** (`sb_publishable_…`) dans `VITE_SUPABASE_PUBLISHABLE_KEY` de votre `.env` local. Ne partagez pas de clé secrète.
2. Dans **Authentication → Providers / Sign In**, activez les connexions par e-mail et les connexions anonymes. Gardez la confirmation des e-mails activée pour les inscriptions ordinaires.
3. Dans **Authentication → URL Configuration**, ajoutez les URL de développement et de production aux URL de redirection autorisées (par exemple `http://localhost:5173` et votre URL de déploiement).
4. Appliquez les migrations SQL dans l'ordre : `202610060001_game_auth_and_moderation.sql`, puis `202610060002_player_profile_avatars.sql`. Vous pouvez les exécuter dans **SQL Editor** ou utiliser `supabase db push` après avoir lié le projet. Elles créent les sauvegardes et la modération RLS, puis le stockage des photos de profil avec des écritures limitées au propriétaire.
5. Avec la CLI Supabase connectée à ce projet, déployez les fonctions :

   ```sh
   supabase link --project-ref wiconhcbkuuzgsrfgvyp
   supabase db push
   supabase functions deploy register-scv-user --no-verify-jwt
   supabase functions deploy admin-moderation
   ```

   Les fonctions Edge utilisent les variables serveur gérées par Supabase (`SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY`). Elles ne sont jamais envoyées au navigateur. Si votre environnement Supabase ne les injecte pas automatiquement, renseignez les secrets dans **Supabase → Edge Functions → Secrets** ; ne les ajoutez pas au dépôt ni au `.env` Vite.

### Connexion et sauvegarde

- Les joueurs peuvent créer un compte ou se connecter avec e-mail et mot de passe.
- Une inscription avec une adresse `@scv.bzh` ordinaire est confirmée automatiquement sans e-mail de confirmation. Le mot de passe reste obligatoire : une adresse seule ne permet pas d'authentifier une personne en sécurité. Cette option ne prouve pas que le joueur possède l'adresse ; ne l'utilisez pas pour protéger des données sensibles.
- Les autres adresses utilisent la confirmation e-mail standard de Supabase.
- Sans compte, l'application crée une session Supabase anonyme (invité) et sauvegarde sa progression dans PostgreSQL. La progression invitée est transférée lors d'une connexion ou d'une inscription. Si Supabase n'est pas configuré ou si l'authentification anonyme n'est pas activée, le mode local reste disponible, mais la sauvegarde cloud ne l'est pas.
- Les sauvegardes sont stockées dans `public.game_saves`, avec des règles RLS limitées à l'utilisateur propriétaire. Les données de modération ne sont accessibles ni aux autres joueurs ni au client direct ; les fonctions vérifient l'identité administrateur.
- Chaque joueur choisit un pseudo et peut téléverser une photo JPEG, PNG ou WebP de 3 Mo maximum depuis le panneau **Compte & sauvegarde**. Les images sont servies publiquement afin d'apparaître au-dessus des personnages ; les règles Storage n'autorisent l'écriture et la suppression que dans le dossier de l'utilisateur connecté. La photo est optionnelle. Sans Supabase, le pseudo reste local et l'envoi d'image est désactivé.

### Réseau officiel du jeu

Le chat multijoueur classique reste relié à Supabase Realtime. Une mini-bannière au-dessus du chat invite à rejoindre le réseau officiel sur `https://novaexe.lovable.app/` et ouvre le site dans un nouvel onglet. Il s'agit d'un lien externe, pas d'un appel API : le jeu reste autonome et ne dépend pas de l'API ou des paquets Lovable.

### Comptes administrateurs

Le panneau admin est réservé aux adresses vérifiées `Lucas.kerouault@scv.bzh` et `sportzonefr@proton.me`. Les protections serveur contrôlent l'adresse vérifiée : le simple fait de modifier le navigateur ne donne pas les droits admin. Pour éviter l'usurpation d'une adresse privilégiée, l'inscription publique de ces deux comptes est bloquée. Créez/confirmez-les dans **Supabase Auth** (ou faites confirmer l'adresse par son propriétaire), puis connectez-vous au jeu.

Le panneau permet de consulter les comptes et les comptes invités, expulser une session, appliquer un bannissement temporaire ou permanent, lever un bannissement, envoyer un avertissement affiché en popup et fixer ou ajuster les points (y compris avec un nombre négatif). Les deux comptes admin affichent des points illimités. Les fonctions Edge et les fonctions PostgreSQL vérifient les droits côté serveur ; la clé publishable seule ne confère aucun droit administrateur.

## Vérifications avant export

```sh
npm install
npm test
npm run build
```

L'application peut être clonée ou exportée en ZIP et démarrée avec `npm install` puis `npm run dev`. Aucun paquet Lovable ni API du site n'est requis pour faire tourner le jeu. Le schéma Supabase et le code des fonctions sont inclus dans `supabase/` ; appliquez la migration et déployez les fonctions sur votre projet pour activer l'authentification, les sauvegardes cloud et la modération.
