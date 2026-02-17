-- Schéma Neon pour le projet SHVB (à exécuter une fois dans le SQL Editor Neon)
-- Tables : teams (équipes), settings (paramètres unique id=1)

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

-- Table des images de fond (une par type)
CREATE TABLE IF NOT EXISTS background_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL UNIQUE CHECK (type IN ('results', 'preview', 'victory')),
  image_data  TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_background_images_type ON background_images (type);
