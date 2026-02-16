
import { useCallback } from 'react';
import { AppConfig } from '../types';

interface TeamData {
  id?: string;
  name: string;
  logo: string;
  is_local?: boolean;
}

const CACHE_KEYS = {
  CONFIG: 'shvb_config',
  TEAMS: 'shvb_teams'
} as const;

export const useLocalCache = () => {
  /**
   * Sauvegarde la configuration dans le cache
   */
  const saveConfig = useCallback((config: AppConfig) => {
    try {
      localStorage.setItem(CACHE_KEYS.CONFIG, JSON.stringify(config));
    } catch (error) {
      console.warn('⚠️ Impossible de sauvegarder la configuration dans le cache:', error);
    }
  }, []);

  /**
   * Charge la configuration depuis le cache
   */
  const loadConfig = useCallback((): AppConfig | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEYS.CONFIG);
      if (!cached) return null;
      return JSON.parse(cached) as AppConfig;
    } catch (error) {
      console.warn('⚠️ Impossible de charger la configuration depuis le cache:', error);
      return null;
    }
  }, []);

  /**
   * Sauvegarde les équipes dans le cache
   */
  const saveTeams = useCallback((teams: TeamData[]) => {
    try {
      if (teams.length > 0) {
        localStorage.setItem(CACHE_KEYS.TEAMS, JSON.stringify(teams));
      }
    } catch (error) {
      console.warn('⚠️ Impossible de sauvegarder les équipes dans le cache:', error);
    }
  }, []);

  /**
   * Charge les équipes depuis le cache
   */
  const loadTeams = useCallback((): TeamData[] | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEYS.TEAMS);
      if (!cached) return null;
      return JSON.parse(cached) as TeamData[];
    } catch (error) {
      console.warn('⚠️ Impossible de charger les équipes depuis le cache:', error);
      return null;
    }
  }, []);

  /**
   * Sauvegarde la configuration et les équipes ensemble
   */
  const saveAll = useCallback((config: AppConfig, teams: TeamData[]) => {
    saveConfig(config);
    saveTeams(teams);
  }, [saveConfig, saveTeams]);

  /**
   * Charge la configuration et les équipes depuis le cache
   */
  const loadAll = useCallback((): { config: AppConfig | null; teams: TeamData[] | null } => {
    return {
      config: loadConfig(),
      teams: loadTeams()
    };
  }, [loadConfig, loadTeams]);

  /**
   * Efface tout le cache
   */
  const clearCache = useCallback(() => {
    try {
      localStorage.removeItem(CACHE_KEYS.CONFIG);
      localStorage.removeItem(CACHE_KEYS.TEAMS);
    } catch (error) {
      console.warn('⚠️ Impossible d\'effacer le cache:', error);
    }
  }, []);

  /**
   * Vérifie si le cache existe
   */
  const hasCache = useCallback((): boolean => {
    return !!localStorage.getItem(CACHE_KEYS.CONFIG) || !!localStorage.getItem(CACHE_KEYS.TEAMS);
  }, []);

  return {
    saveConfig,
    loadConfig,
    saveTeams,
    loadTeams,
    saveAll,
    loadAll,
    clearCache,
    hasCache
  };
};
