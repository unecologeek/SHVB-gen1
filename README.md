# SHVB – Générateur de visuels et résultats

## Description

**Studio SHVB** est une application web de création et d’export de visuels pour le club **Saint-Herblain Volley-Ball** (SHVB). Elle permet de générer des images prêtes à publier pour les résultats de matchs, les affiches de rencontre et les visuels « victoire », avec personnalisation des textes, couleurs et fonds. Les données (équipes, logos, paramètres d’affichage) sont synchronisées avec une base de données cloud ou utilisées en local selon la configuration.

## Fonctionnalités

- **Trois types de visuels** : **Résultats** (écran de scores), **Affiche** (avant-match avec catégorie, date, lieu), **Victoire** (visuel de fin de match avec photo optionnelle).
- **Gestion des équipes et logos** : import de clubs (nom + logo), désignation du club « local », recherche et sélection dans les listes pour composer les matchs affichés.
- **Personnalisation** : titres, sous-titres, couleurs principales, images de fond par type de visuel (résultats, affiche, victoire), date et lieu du match.
- **Export** : téléchargement du visuel en PNG haute qualité (résolution adaptée au type : 1080×1080 ou 1080×1920 pour la victoire).
- **Multi-sources de données** : connexion automatique à **Aiven** (PostgreSQL), **Convex**, **Neon** (PostgreSQL via API), **Appwrite** ou **Supabase** ; à défaut, utilisation du cache navigateur ou du fichier local `teams.json`. L’ordre de tentative est : Aiven → Convex → Neon → Appwrite → Supabase → cache local (chaque option n’est testée que si les précédentes ont échoué).
- **Synchronisation** : les modifications (paramètres, équipes) sont enregistrées sur la source active et mises en cache local.

## Lancer en local

**Prérequis :** Node.js (v18+)

1. Cloner le dépôt et installer les dépendances :
   ```bash
   npm install
   ```
2. Copier les variables d’environnement :
   ```bash
   cp .env.example .env.local
   ```
3. Renseigner dans `.env.local` les variables selon le fournisseur BDD souhaité (voir section [Variables d’environnement](#variables-denvironnement-par-fournisseur-bdd) et [.env.example](.env.example)).
4. Lancer l’app :
   ```bash
   npm run dev
   ```

## Variables d’environnement par fournisseur BDD

Le programme tente de se connecter aux sources **en cascade** : Aiven d’abord ; en cas d’échec, Convex, puis Neon, Appwrite, Supabase ; enfin cache local. Dès qu’une source répond, les suivantes ne sont pas testées. Toutes les variables listées sont optionnelles selon la source que vous utilisez ; le fichier [.env.example](.env.example) et ce README font référence pour l’ensemble des variables utilisables.

### Aiven – API PostgreSQL (priorité 1)

Première option testée. Même API que Neon : les routes utilisent le paramètre `?db=aiven` et la variable `AIVEN_DATABASE_URL` (ou `shvb_AIVEN_DATABASE_URL` sur Vercel). La connexion Aiven utilise SSL (`sslmode=require`). Appliquer le schéma une fois sur la base Aiven : [scripts/aiven-schema.sql](scripts/aiven-schema.sql) (même structure que Neon : tables `teams`, `settings`, `background_images`).

| Variable | Côté | Description | Requis |
|----------|------|--------------|--------|
| `AIVEN_DATABASE_URL` | Serveur/API | URI de connexion PostgreSQL (ex. `postgres://user:pass@host:port/defaultdb?sslmode=require`). | Oui, pour l’API Aiven |
| `shvb_AIVEN_DATABASE_URL` | Serveur/API (Vercel) | Même usage que `AIVEN_DATABASE_URL` (priorité sur Vercel). | Optionnel |

### Convex (priorité 2)

| Variable | Description | Requis |
|----------|--------------|--------|
| `VITE_CONVEX_URL` | URL du déploiement Convex pour le client frontend (ex. `https://xxx.convex.cloud`). | Oui, pour utiliser Convex |
| `CONVEX_DEPLOYMENT` | Nom du déploiement (écrit par `npx convex dev` dans `.env.local`). Utilisé par le CLI. | Optionnel |

### Neon – API PostgreSQL (priorité 3)

| Variable | Côté | Description | Requis |
|----------|------|--------------|--------|
| `DATABASE_URL` | Serveur/API (Vercel, etc.) | URL de connexion PostgreSQL (pooled pour le serverless). | Oui, pour l’API Neon |
| `shvb_DATABASE_URL` | Serveur/API (Vercel avec préfixe) | Même usage que `DATABASE_URL` (priorité sur Vercel). | Optionnel |
| `VITE_API_URL` | Frontend | Base URL de l’API si elle tourne ailleurs (ex. `http://localhost:3000`). | Optionnel |

### Appwrite (priorité 4)

| Variable | Description | Requis |
|----------|--------------|--------|
| `VITE_APPWRITE_ENDPOINT` | URL de l’API Appwrite (défaut doc : `https://fra.cloud.appwrite.io/v1`). | Optionnel |
| `VITE_APPWRITE_PROJECT_ID` | ID du projet Appwrite. | Oui, pour utiliser Appwrite |
| `VITE_APPWRITE_API_KEY` | Clé API (selon usage). | Optionnel |
| `VITE_APPWRITE_DATABASE_ID` | ID de la base de données. | Oui, pour utiliser Appwrite |
| `VITE_APPWRITE_COLLECTION_TEAMS` | Nom de la collection des équipes. | Optionnel (défaut possible) |
| `VITE_APPWRITE_COLLECTION_SETTINGS` | Nom de la collection des paramètres. | Optionnel (défaut possible) |

### Supabase (priorité 5)

| Variable | Description | Requis |
|----------|--------------|--------|
| `VITE_SUPABASE_URL` | URL du projet Supabase. | Oui, pour utiliser Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clé anonyme (publique) du projet. | Oui, pour utiliser Supabase |

---

## Créer les tables (Neon / Aiven / PostgreSQL)

Exécuter le script SQL suivant **une fois** dans le **SQL Editor** de votre projet Neon ou Aiven (ou toute base PostgreSQL utilisée par l’API).

- **Neon** : [scripts/neon-schema.sql](scripts/neon-schema.sql)
- **Aiven** : [scripts/aiven-schema.sql](scripts/aiven-schema.sql) (même structure ; connexion avec `sslmode=require`)

Ou coller le contenu ci‑dessous :

```sql
-- Table des équipes
CREATE TABLE IF NOT EXISTS teams (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  logo       TEXT NOT NULL DEFAULT '',
  is_local   BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teams_name ON teams (name);
CREATE INDEX IF NOT EXISTS idx_teams_is_local ON teams (is_local) WHERE is_local = true;

-- Table des paramètres (un seul enregistrement, id = 1)
CREATE TABLE IF NOT EXISTS settings (
  id          INTEGER PRIMARY KEY DEFAULT 1,
  title       TEXT,
  subtitle    TEXT,
  results_bg   TEXT,
  preview_bg   TEXT,
  victory_bg   TEXT,
  main_color   TEXT,
  visual_type  TEXT,
  category     TEXT,
  match_date   TEXT,
  location     TEXT,
  updated_at   TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'settings_single_row') THEN
    ALTER TABLE settings ADD CONSTRAINT settings_single_row CHECK (id = 1);
  END IF;
END $$;
```

Pour que l’API **settings** ne renvoie pas 404 au premier GET, insérer une ligne par défaut :

```sql
INSERT INTO settings (id, title, subtitle) VALUES (1, NULL, NULL) ON CONFLICT (id) DO NOTHING;
```

## Déploiement

- **Netlify** : le projet contient un [netlify.toml](netlify.toml) (build `npm run build`, répertoire de publication `dist`). Connecter le dépôt à Netlify pour déployer le front.
- **Vercel** : dans [vercel.json](vercel.json), la commande de build est **`npm run build`** uniquement. **Convex ne se déploie pas sur Vercel** : il faut déployer Convex à part depuis ta machine avec `npx convex deploy`. Voir [CONVEX_DEPLOY.md](CONVEX_DEPLOY.md) pour les instructions.
- **API (Neon)** : si vous utilisez l’API Vercel pour Neon, déployer les routes sous `api/` sur Vercel et configurer `shvb_DATABASE_URL` (ou `DATABASE_URL`) dans les variables d’environnement du projet.

## Références

- Variables d’environnement : [.env.example](.env.example) et section [Variables d’environnement par fournisseur BDD](#variables-denvironnement-par-fournisseur-bdd) ci‑dessus
- Déploiement Convex (hors Vercel) : [CONVEX_DEPLOY.md](CONVEX_DEPLOY.md)
- Schéma Neon complet : [scripts/neon-schema.sql](scripts/neon-schema.sql)
- Configuration RLS Supabase : [SUPABASE_RLS_SETUP.md](SUPABASE_RLS_SETUP.md) (si vous utilisez Supabase)
