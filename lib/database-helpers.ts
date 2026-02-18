import { DatabaseAdapter, DatabaseSource, tryConnectDatabase, TeamData, SettingsData } from './db-adapter';
import { AppConfig } from '../types';
import { withRetry, isRetryableError } from './retry';

/**
 * Tente de charger les paramètres et les équipes depuis une source (un seul getTeams pour optimiser).
 */
export const loadSettingsFromSource = async (
  source: DatabaseSource,
  defaultConfig: AppConfig
): Promise<{ config: AppConfig; adapter: DatabaseAdapter; teams: TeamData[] } | null> => {
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

    const [resultsBg, previewBg, victoryBg, teams] = await Promise.all([
      adapter.getBackgroundImage('results'),
      adapter.getBackgroundImage('preview'),
      adapter.getBackgroundImage('victory'),
      withRetry(() => adapter.getTeams(), { maxRetries: 2, initialDelay: 1000, retryable: isRetryableError })
    ]);

    const config: AppConfig = {
      ...defaultConfig,
      title: settings?.title || defaultConfig.title,
      subtitle: settings?.subtitle || defaultConfig.subtitle,
      resultsBg: resultsBg || defaultConfig.resultsBg,
      previewBg: previewBg || defaultConfig.previewBg,
      victoryBg: victoryBg || defaultConfig.victoryBg,
      victoryPhotoFocus: (settings?.victory_photo_focus_x !== undefined && settings?.victory_photo_focus_y !== undefined)
        ? { x: Number(settings.victory_photo_focus_x), y: Number(settings.victory_photo_focus_y) }
        : defaultConfig.victoryPhotoFocus,
      mainColor: settings?.main_color || defaultConfig.mainColor,
      visualType: (settings?.visual_type as any) || defaultConfig.visualType,
      category: settings?.category || defaultConfig.category,
      matchDate: settings?.match_date || defaultConfig.matchDate,
      location: settings?.location || defaultConfig.location
    };

    return { config, adapter, teams: teams || [] };
  } catch (error: any) {
    console.warn(`⚠️ [${source}] Erreur lors du chargement:`, error);
    return null;
  }
};

/**
 * Tente de se connecter à Aiven PostgreSQL (API) et charger les données
 */
export const tryConnectAiven = async (
  defaultConfig: AppConfig
): Promise<{ config: AppConfig; teams: TeamData[]; adapter: DatabaseAdapter } | null> => {
  const result = await loadSettingsFromSource('AIVEN', defaultConfig);
  if (!result) return null;
  return {
    config: result.config,
    teams: result.teams,
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
  return {
    config: result.config,
    teams: result.teams,
    adapter: result.adapter
  };
};
