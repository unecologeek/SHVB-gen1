
import { DatabaseAdapter, DatabaseSource, tryConnectDatabase, createDatabaseAdapter, TeamData, SettingsData } from './db-adapter';
import { AppConfig } from '../types';
import { withRetry, isRetryableError } from './retry';
import { isConvexReady } from './convex';

/**
 * Tente de charger les paramètres depuis une source de base de données
 */
export const loadSettingsFromSource = async (
  source: DatabaseSource,
  defaultConfig: AppConfig
): Promise<{ config: AppConfig; adapter: DatabaseAdapter } | null> => {
  try {
    const adapter = await withRetry(
      () => tryConnectDatabase(source),
      {
        maxRetries: 2,
        initialDelay: 1000,
        retryable: isRetryableError
      }
    );

    if (!adapter) {
      return null;
    }

    const settings = await withRetry(
      () => adapter.getSettings(),
      {
        maxRetries: 2,
        initialDelay: 1000,
        retryable: isRetryableError
      }
    );

    if (!settings) {
      return { config: defaultConfig, adapter };
    }

    const config: AppConfig = {
      ...defaultConfig,
      title: settings.title || defaultConfig.title,
      subtitle: settings.subtitle || defaultConfig.subtitle,
      resultsBg: settings.results_bg || defaultConfig.resultsBg,
      previewBg: settings.preview_bg || defaultConfig.previewBg,
      victoryBg: settings.victory_bg || defaultConfig.victoryBg,
      mainColor: settings.main_color || defaultConfig.mainColor,
      visualType: (settings.visual_type as any) || defaultConfig.visualType,
      category: settings.category || defaultConfig.category,
      matchDate: settings.match_date || defaultConfig.matchDate,
      location: settings.location || defaultConfig.location
    };

    return { config, adapter };
  } catch (error: any) {
    console.warn(`⚠️ [${source}] Erreur lors du chargement des paramètres:`, error);
    return null;
  }
};

/**
 * Charge les équipes depuis une source de base de données
 */
export const loadTeamsFromSource = async (
  adapter: DatabaseAdapter
): Promise<TeamData[]> => {
  try {
    return await withRetry(
      () => adapter.getTeams(),
      {
        maxRetries: 2,
        initialDelay: 1000,
        retryable: isRetryableError
      }
    );
  } catch (error: any) {
    console.error(`❌ Erreur lors du chargement des équipes (${adapter.source}):`, error);
    return [];
  }
};

/**
 * Tente de se connecter à Appwrite et charger les données
 */
export const tryConnectAppwrite = async (
  defaultConfig: AppConfig
): Promise<{ config: AppConfig; teams: TeamData[]; adapter: DatabaseAdapter } | null> => {
  const result = await loadSettingsFromSource('APPWRITE', defaultConfig);
  if (!result) return null;

  const teams = await loadTeamsFromSource(result.adapter);
  return {
    config: result.config,
    teams,
    adapter: result.adapter
  };
};

/**
 * Tente de se connecter à Supabase et charger les données
 */
export const tryConnectSupabase = async (
  defaultConfig: AppConfig
): Promise<{ config: AppConfig; teams: TeamData[]; adapter: DatabaseAdapter } | null> => {
  const result = await loadSettingsFromSource('SUPABASE', defaultConfig);
  if (!result) return null;

  const teams = await loadTeamsFromSource(result.adapter);
  return {
    config: result.config,
    teams,
    adapter: result.adapter
  };
};

/**
 * Tente de se connecter à Convex et charger les données
 */
export const tryConnectConvex = async (
  defaultConfig: AppConfig
): Promise<{ config: AppConfig; teams: TeamData[]; adapter: DatabaseAdapter } | null> => {
  if (!isConvexReady()) {
    console.warn("⚠️ [CONVEX] VITE_CONVEX_URL non définie dans .env.local - passage à la source suivante");
    return null;
  }
  
  try {
    const result = await loadSettingsFromSource('CONVEX', defaultConfig);
    if (!result) return null;

    const teams = await loadTeamsFromSource(result.adapter);
    return {
      config: result.config,
      teams,
      adapter: result.adapter
    };
  } catch (error: any) {
    console.error("❌ [CONVEX] Erreur de connexion:", error?.message || error);
    return null;
  }
};

/**
 * Tente de se connecter à Neon (API) et charger les données
 */
export const tryConnectNeon = async (
  defaultConfig: AppConfig
): Promise<{ config: AppConfig; teams: TeamData[]; adapter: DatabaseAdapter } | null> => {
  const result = await loadSettingsFromSource('NEON', defaultConfig);
  if (!result) return null;

  const teams = await loadTeamsFromSource(result.adapter);
  return {
    config: result.config,
    teams,
    adapter: result.adapter
  };
};
