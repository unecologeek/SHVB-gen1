-- Migration Supabase : Créer la table background_images et retirer les colonnes d'images de settings
-- À exécuter dans le SQL Editor de Supabase

-- 1. Créer la table background_images
CREATE TABLE IF NOT EXISTS background_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL UNIQUE CHECK (type IN ('results', 'preview', 'victory')),
  image_data TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Créer un index sur le type pour des recherches rapides
CREATE INDEX IF NOT EXISTS idx_background_images_type ON background_images (type);

-- 3. Migrer les données existantes depuis settings vers background_images (si elles existent)
INSERT INTO background_images (type, image_data)
SELECT 'results', results_bg FROM settings WHERE id = 1 AND results_bg IS NOT NULL AND results_bg != ''
ON CONFLICT (type) DO NOTHING;

INSERT INTO background_images (type, image_data)
SELECT 'preview', preview_bg FROM settings WHERE id = 1 AND preview_bg IS NOT NULL AND preview_bg != ''
ON CONFLICT (type) DO NOTHING;

INSERT INTO background_images (type, image_data)
SELECT 'victory', victory_bg FROM settings WHERE id = 1 AND victory_bg IS NOT NULL AND victory_bg != ''
ON CONFLICT (type) DO NOTHING;

-- 4. Retirer les colonnes d'images de la table settings
ALTER TABLE settings DROP COLUMN IF EXISTS results_bg;
ALTER TABLE settings DROP COLUMN IF EXISTS preview_bg;
ALTER TABLE settings DROP COLUMN IF EXISTS victory_bg;

-- 5. Activer RLS sur background_images (optionnel mais recommandé)
ALTER TABLE background_images ENABLE ROW LEVEL SECURITY;

-- 6. Créer une politique pour permettre la lecture publique (ajustez selon vos besoins)
CREATE POLICY "Allow public read access" ON background_images
  FOR SELECT
  USING (true);

-- 7. Créer une politique pour permettre l'insertion/mise à jour publique (ajustez selon vos besoins)
CREATE POLICY "Allow public insert/update" ON background_images
  FOR ALL
  USING (true)
  WITH CHECK (true);
