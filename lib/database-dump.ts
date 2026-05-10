/**
 * Module d'export/import de la base de données.
 *
 * Contraintes :
 * - 100 % côté client : aucun envoi de données vers un serveur, uniquement
 *   des lectures (GET) sur les sources existantes et l'API File/Blob du
 *   navigateur.
 * - L'import écrit uniquement dans `localStorage` (jamais dans Aiven/Supabase).
 */

import { AppConfig } from '../types';
import {
  DatabaseAdapter,
  DatabaseSource,
  SettingsData,
  TeamData,
  createDatabaseAdapter,
} from './db-adapter';
import type { useLocalCache } from '../hooks/useLocalCache';

export const DUMP_FORMAT_VERSION = 1;

export type DumpSource = DatabaseSource | 'CACHE' | 'LOCAL';

export interface DumpFile {
  version: number;
  exportedAt: string;
  source: DumpSource;
  teams?: TeamData[];
  settings?: SettingsData;
  backgroundImages?: {
    results?: string | null;
    preview?: string | null;
    victory?: string | null;
  };
}

export interface ImportSummary {
  teamsCount: number;
  hasSettings: boolean;
  hasBackgrounds: boolean;
  degraded?: boolean;
}

type LocalCache = ReturnType<typeof useLocalCache>;

const nowIsoStamp = (): string => new Date().toISOString();

const buildFilename = (source: DumpSource): string => {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `shvb-dump-${source}-${stamp}.json`;
};

/**
 * Convertit un AppConfig (camelCase) en SettingsData (snake_case) tel
 * qu'attendu par la base de données / le format de dump.
 */
const configToSettings = (config: AppConfig): SettingsData => ({
  title: config.title,
  subtitle: config.subtitle,
  victory_photo_focus_x: config.victoryPhotoFocus?.x ?? null,
  victory_photo_focus_y: config.victoryPhotoFocus?.y ?? null,
  main_color: config.mainColor,
  visual_type: config.visualType,
  category: config.category,
  match_date: config.matchDate,
  location: config.location,
});

/**
 * Convertit un SettingsData (snake_case, format BDD/dump) en partial AppConfig
 * (camelCase) prêt à être fusionné avec une AppConfig existante.
 *
 * Mirroir de `database-helpers.ts:loadSettingsFromSource`.
 */
const settingsToConfigPartial = (settings: SettingsData): Partial<AppConfig> => {
  const partial: Partial<AppConfig> = {};
  if (settings.title !== undefined && settings.title !== null) partial.title = settings.title;
  if (settings.subtitle !== undefined && settings.subtitle !== null) partial.subtitle = settings.subtitle;
  if (settings.main_color !== undefined && settings.main_color !== null) partial.mainColor = settings.main_color;
  if (settings.visual_type !== undefined && settings.visual_type !== null) {
    partial.visualType = settings.visual_type as AppConfig['visualType'];
  }
  if (settings.category !== undefined && settings.category !== null) partial.category = settings.category;
  if (settings.match_date !== undefined && settings.match_date !== null) partial.matchDate = settings.match_date;
  if (settings.location !== undefined && settings.location !== null) partial.location = settings.location;
  if (settings.victory_photo_focus_x !== undefined && settings.victory_photo_focus_x !== null
      && settings.victory_photo_focus_y !== undefined && settings.victory_photo_focus_y !== null) {
    partial.victoryPhotoFocus = {
      x: Number(settings.victory_photo_focus_x),
      y: Number(settings.victory_photo_focus_y),
    };
  }
  return partial;
};

// =============================================================================
// EXPORT
// =============================================================================

/**
 * Construit un dump à partir d'un adapter Aiven/Supabase.
 * Utilise uniquement des lectures GET, aucune écriture distante.
 */
export const buildDumpFromAdapter = async (
  source: DatabaseSource,
  adapter: DatabaseAdapter,
): Promise<DumpFile> => {
  const teams = await adapter.getTeams({ noLogos: false });
  const settings = await adapter.getSettings();
  const backgroundImages = await adapter.getAllBackgroundImages();

  return {
    version: DUMP_FORMAT_VERSION,
    exportedAt: nowIsoStamp(),
    source,
    teams,
    settings: settings ?? undefined,
    backgroundImages: {
      results: backgroundImages.results,
      preview: backgroundImages.preview,
      victory: backgroundImages.victory,
    },
  };
};

/**
 * Construit un dump à partir du cache local (localStorage) et de la
 * configuration courante.
 */
export const buildDumpFromCache = (
  config: AppConfig,
  teams: TeamData[],
): DumpFile => ({
  version: DUMP_FORMAT_VERSION,
  exportedAt: nowIsoStamp(),
  source: 'CACHE',
  teams,
  settings: configToSettings(config),
  backgroundImages: {
    results: config.resultsBg || null,
    preview: config.previewBg || null,
    victory: config.victoryBg || null,
  },
});

/**
 * Construit un dump à partir du fichier statique `teams.json`.
 * Ne contient que les équipes (les paramètres et images de fond ne sont pas
 * disponibles dans cette source).
 */
export const buildDumpFromLocalJson = async (): Promise<DumpFile> => {
  const res = await fetch('teams.json').catch(() => null);
  if (!res?.ok) {
    throw new Error('Impossible de charger teams.json');
  }
  const teams = (await res.json()) as TeamData[];
  return {
    version: DUMP_FORMAT_VERSION,
    exportedAt: nowIsoStamp(),
    source: 'LOCAL',
    teams,
  };
};

/**
 * Déclenche le téléchargement d'un dump JSON via l'API Blob du navigateur.
 * Aucun appel réseau n'est effectué : tout reste côté client.
 */
export const triggerJsonDownload = (dump: DumpFile): void => {
  const json = JSON.stringify(dump, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = buildFilename(dump.source);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(url);
  }
};

interface DumpContext {
  config: AppConfig;
  cache: LocalCache;
}

/**
 * Orchestrateur principal : construit le dump selon la source active et
 * déclenche le téléchargement.
 */
export const dumpCurrentDatabase = async (
  source: DumpSource,
  ctx: DumpContext,
): Promise<DumpFile> => {
  let dump: DumpFile;

  if (source === 'AIVEN' || source === 'SUPABASE') {
    const adapter = createDatabaseAdapter(source);
    dump = await buildDumpFromAdapter(source, adapter);
  } else if (source === 'CACHE') {
    const teams = ctx.cache.loadTeams() ?? [];
    if (teams.length === 0 && !ctx.cache.loadConfig()) {
      throw new Error('Le cache local est vide : rien à exporter.');
    }
    dump = buildDumpFromCache(ctx.config, teams);
  } else {
    dump = await buildDumpFromLocalJson();
  }

  triggerJsonDownload(dump);
  return dump;
};

// =============================================================================
// IMPORT
// =============================================================================

/**
 * Lit un fichier sélectionné par l'utilisateur et parse son contenu JSON.
 * Utilise FileReader (API navigateur) : aucun upload réseau.
 */
export const parseDumpFile = (file: File): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '');
        resolve(JSON.parse(text));
      } catch (err) {
        reject(new Error('Le fichier n\'est pas un JSON valide.'));
      }
    };
    reader.readAsText(file);
  });

export type ValidateResult =
  | { ok: true; dump: DumpFile }
  | { ok: false; error: string };

/**
 * Valide la structure d'un dump. Tous les champs de contenu (`teams`,
 * `settings`, `backgroundImages`) sont optionnels mais au moins l'un d'eux
 * doit être présent et non vide pour qu'un import ait du sens.
 */
export const validateDump = (raw: unknown): ValidateResult => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Format invalide : objet JSON attendu.' };
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.version !== 'number') {
    return { ok: false, error: "Champ 'version' manquant ou invalide." };
  }
  if (obj.version !== DUMP_FORMAT_VERSION) {
    return { ok: false, error: `Version du dump non supportée (attendu ${DUMP_FORMAT_VERSION}, reçu ${obj.version}).` };
  }

  if (obj.teams !== undefined) {
    if (!Array.isArray(obj.teams)) return { ok: false, error: "Champ 'teams' invalide (tableau attendu)." };
    for (const t of obj.teams) {
      if (!t || typeof t !== 'object' || typeof (t as TeamData).name !== 'string') {
        return { ok: false, error: "Une entrée 'teams' est mal formée (name manquant)." };
      }
    }
  }

  if (obj.settings !== undefined && (typeof obj.settings !== 'object' || Array.isArray(obj.settings))) {
    return { ok: false, error: "Champ 'settings' invalide (objet attendu)." };
  }

  if (obj.backgroundImages !== undefined && (typeof obj.backgroundImages !== 'object' || Array.isArray(obj.backgroundImages))) {
    return { ok: false, error: "Champ 'backgroundImages' invalide (objet attendu)." };
  }

  const hasTeams = Array.isArray(obj.teams) && (obj.teams as TeamData[]).length > 0;
  const hasSettings = obj.settings !== undefined && obj.settings !== null;
  const hasBgs = obj.backgroundImages !== undefined && obj.backgroundImages !== null;
  if (!hasTeams && !hasSettings && !hasBgs) {
    return { ok: false, error: 'Le dump ne contient aucune donnée à importer.' };
  }

  return { ok: true, dump: obj as unknown as DumpFile };
};

const APPROX_QUOTA_WARNING_BYTES = 4 * 1024 * 1024; // ~4 Mo

/**
 * Applique un dump validé dans le cache local (localStorage uniquement).
 * Aucune donnée n'est envoyée à un serveur.
 *
 * En cas de QuotaExceededError, retente une fois sans les images de fond
 * (mode dégradé), pour préserver au minimum les équipes et paramètres.
 */
export const importDumpToLocalCache = (
  dump: DumpFile,
  currentConfig: AppConfig,
  cache: LocalCache,
): ImportSummary => {
  const settingsPartial = dump.settings ? settingsToConfigPartial(dump.settings) : {};
  const bgs = dump.backgroundImages ?? {};

  const buildMergedConfig = (includeBackgrounds: boolean): AppConfig => ({
    ...currentConfig,
    ...settingsPartial,
    resultsBg: includeBackgrounds ? (bgs.results ?? currentConfig.resultsBg) : currentConfig.resultsBg,
    previewBg: includeBackgrounds ? (bgs.preview ?? currentConfig.previewBg) : currentConfig.previewBg,
    victoryBg: includeBackgrounds ? (bgs.victory ?? currentConfig.victoryBg) : currentConfig.victoryBg,
  });

  const teams = dump.teams ?? [];
  const fullConfig = buildMergedConfig(true);

  // Avertissement informatif si le cache approche la limite navigateur
  const approxSize = new Blob([JSON.stringify({ config: fullConfig, teams })]).size;
  if (approxSize > APPROX_QUOTA_WARNING_BYTES) {
    console.warn(`⚠️ Dump volumineux (~${Math.round(approxSize / 1024 / 1024)} Mo). localStorage peut refuser le stockage.`);
  }

  try {
    cache.saveAll(fullConfig, teams);
    return {
      teamsCount: teams.length,
      hasSettings: !!dump.settings,
      hasBackgrounds: !!(bgs.results || bgs.preview || bgs.victory),
    };
  } catch (err: any) {
    const isQuota =
      err?.name === 'QuotaExceededError' ||
      err?.code === 22 ||
      err?.code === 1014;

    if (!isQuota) throw err;

    console.warn('⚠️ QuotaExceededError : nouvelle tentative sans les images de fond.');
    const degradedConfig = buildMergedConfig(false);
    cache.saveAll(degradedConfig, teams);
    return {
      teamsCount: teams.length,
      hasSettings: !!dump.settings,
      hasBackgrounds: false,
      degraded: true,
    };
  }
};
