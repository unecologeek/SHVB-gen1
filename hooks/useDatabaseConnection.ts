
import { useState, useCallback, useEffect } from 'react';
import { DatabaseAdapter, DatabaseSource, tryConnectDatabase, createDatabaseAdapter, TeamData, SettingsData } from '../lib/db-adapter';
import { AppConfig } from '../types';
import { withRetry, isRetryableError } from '../lib/retry';

export type ConnectionSource = DatabaseSource | 'CACHE' | 'LOCAL';

interface UseDatabaseConnectionResult {
  adapter: DatabaseAdapter | null;
  activeSource: ConnectionSource;
  loading: boolean;
  error: string | null;
  loadSettings: () => Promise<AppConfig | null>;
  loadTeams: () => Promise<TeamData[]>;
  connect: (source: DatabaseSource) => Promise<boolean>;
}

export const useDatabaseConnection = (
  defaultConfig: AppConfig,
  onConfigLoaded: (config: AppConfig) => void,
  onTeamsLoaded: (teams: TeamData[]) => void
): UseDatabaseConnectionResult => {
  const [adapter, setAdapter] = useState<DatabaseAdapter | null>(null);
  const [activeSource, setActiveSource] = useState<ConnectionSource>('LOCAL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async (source: DatabaseSource): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const connectedAdapter = await withRetry(
        () => tryConnectDatabase(source),
        {
          maxRetries: 2,
          initialDelay: 1000,
          retryable: isRetryableError
        }
      );

      if (connectedAdapter) {
        setAdapter(connectedAdapter);
        setActiveSource(source);
        return true;
      }

      return false;
    } catch (err: any) {
      console.warn(`⚠️ [${source}] Échec de connexion:`, err);
      setError(err.message || `Impossible de se connecter à ${source}`);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSettings = useCallback(async (): Promise<AppConfig | null> => {
    if (!adapter) return null;

    try {
      const settings = await withRetry(
        () => adapter.getSettings(),
        {
          maxRetries: 2,
          initialDelay: 1000,
          retryable: isRetryableError
        }
      );

      if (settings) {
        // Charger les images de fond séparément
        const [resultsBg, previewBg, victoryBg] = await Promise.all([
          adapter.getBackgroundImage('results'),
          adapter.getBackgroundImage('preview'),
          adapter.getBackgroundImage('victory')
        ]);

        const newConfig: AppConfig = {
          ...defaultConfig,
          title: settings.title || defaultConfig.title,
          subtitle: settings.subtitle || defaultConfig.subtitle,
          resultsBg: resultsBg || defaultConfig.resultsBg,
          previewBg: previewBg || defaultConfig.previewBg,
          victoryBg: victoryBg || defaultConfig.victoryBg,
          mainColor: settings.main_color || defaultConfig.mainColor,
          visualType: (settings.visual_type as any) || defaultConfig.visualType,
          category: settings.category || defaultConfig.category,
          matchDate: settings.match_date || defaultConfig.matchDate,
          location: settings.location || defaultConfig.location
        };
        return newConfig;
      }

      return null;
    } catch (err: any) {
      console.error(`❌ Erreur lors du chargement des paramètres (${adapter.source}):`, err);
      throw err;
    }
  }, [adapter, defaultConfig]);

  const loadTeams = useCallback(async (): Promise<TeamData[]> => {
    if (!adapter) return [];

    try {
      const teams = await withRetry(
        () => adapter.getTeams(),
        {
          maxRetries: 2,
          initialDelay: 1000,
          retryable: isRetryableError
        }
      );

      return teams;
    } catch (err: any) {
      console.error(`❌ Erreur lors du chargement des équipes (${adapter.source}):`, err);
      throw err;
    }
  }, [adapter]);

  // Tentative de connexion automatique au démarrage
  useEffect(() => {
    const initializeConnection = async () => {
      setLoading(true);

      // 1. Tenter Appwrite
      if (await connect('APPWRITE')) {
        try {
          const config = await loadSettings();
          if (config) {
            onConfigLoaded(config);
          }
          const teams = await loadTeams();
          onTeamsLoaded(teams);
          return;
        } catch (err) {
          console.warn('⚠️ Erreur lors du chargement depuis Appwrite, basculement vers Supabase...');
        }
      }

      // 2. Tenter Supabase
      if (await connect('SUPABASE')) {
        try {
          const config = await loadSettings();
          if (config) {
            onConfigLoaded(config);
          }
          const teams = await loadTeams();
          onTeamsLoaded(teams);
          return;
        } catch (err) {
          console.warn('⚠️ Erreur lors du chargement depuis Supabase, basculement vers cache local...');
        }
      }

      // 3. Fallback vers cache/local
      setAdapter(null);
      setActiveSource('LOCAL');
      setLoading(false);
    };

    initializeConnection();
  }, []); // Exécuter une seule fois au montage

  return {
    adapter,
    activeSource,
    loading,
    error,
    loadSettings,
    loadTeams,
    connect
  };
};
