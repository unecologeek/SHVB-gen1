
import { supabase, handleSupabaseError } from './supabase';
import { databases, APPWRITE_CONFIG, isAppwriteReady } from './appwrite';
import { AppConfig } from '../types';

export type DatabaseSource = 'APPWRITE' | 'SUPABASE';

export interface TeamData {
  id?: string;
  name: string;
  logo: string;
  is_local?: boolean;
}

export interface SettingsData {
  id?: string | number;
  title?: string;
  subtitle?: string;
  results_bg?: string;
  preview_bg?: string;
  victory_bg?: string;
  main_color?: string;
  visual_type?: string;
  category?: string;
  match_date?: string;
  location?: string;
}

export interface DatabaseAdapter {
  source: DatabaseSource;
  
  // Équipes
  getTeams(): Promise<TeamData[]>;
  createTeam(team: Omit<TeamData, 'id'>): Promise<TeamData>;
  updateTeam(id: string, team: Partial<TeamData>): Promise<TeamData>;
  deleteTeam(id: string): Promise<void>;
  setLocalTeam(id: string): Promise<void>;
  
  // Paramètres
  getSettings(): Promise<SettingsData | null>;
  updateSettings(settings: Partial<SettingsData>): Promise<SettingsData>;
  
  // Vérification de santé
  healthCheck(): Promise<boolean>;
}

/**
 * Adapter pour Appwrite
 */
export class AppwriteAdapter implements DatabaseAdapter {
  source: DatabaseSource = 'APPWRITE';

  async getTeams(): Promise<TeamData[]> {
    if (!isAppwriteReady()) {
      throw new Error('Configuration Appwrite incomplète');
    }

    try {
      const res = await databases.listDocuments(
        APPWRITE_CONFIG.DATABASE_ID,
        APPWRITE_CONFIG.COLLECTION_TEAMS
      );
      
      return res.documents.map(doc => ({
        id: doc.$id,
        name: doc.name,
        logo: doc.logo,
        is_local: doc.is_local || false
      }));
    } catch (error: any) {
      console.error('[APPWRITE] Erreur lors de la récupération des équipes:', error);
      throw {
        message: error.message || 'Erreur lors de la récupération des équipes',
        code: error.code || 'UNKNOWN',
        type: error.type || 'Unknown'
      };
    }
  }

  async createTeam(team: Omit<TeamData, 'id'>): Promise<TeamData> {
    if (!isAppwriteReady()) {
      throw new Error('Configuration Appwrite incomplète');
    }

    try {
      const res = await databases.createDocument(
        APPWRITE_CONFIG.DATABASE_ID,
        APPWRITE_CONFIG.COLLECTION_TEAMS,
        'unique()', // Appwrite génère l'ID automatiquement
        {
          name: team.name,
          logo: team.logo,
          is_local: team.is_local || false
        }
      );

      return {
        id: res.$id,
        name: res.name,
        logo: res.logo,
        is_local: res.is_local || false
      };
    } catch (error: any) {
      console.error('[APPWRITE] Erreur lors de la création de l\'équipe:', error);
      throw {
        message: error.message || 'Erreur lors de la création de l\'équipe',
        code: error.code || 'UNKNOWN'
      };
    }
  }

  async updateTeam(id: string, team: Partial<TeamData>): Promise<TeamData> {
    if (!isAppwriteReady()) {
      throw new Error('Configuration Appwrite incomplète');
    }

    try {
      const updateData: any = {};
      if (team.name !== undefined) updateData.name = team.name;
      if (team.logo !== undefined) updateData.logo = team.logo;
      if (team.is_local !== undefined) updateData.is_local = team.is_local;

      const res = await databases.updateDocument(
        APPWRITE_CONFIG.DATABASE_ID,
        APPWRITE_CONFIG.COLLECTION_TEAMS,
        id,
        updateData
      );

      return {
        id: res.$id,
        name: res.name,
        logo: res.logo,
        is_local: res.is_local || false
      };
    } catch (error: any) {
      console.error('[APPWRITE] Erreur lors de la mise à jour de l\'équipe:', error);
      throw {
        message: error.message || 'Erreur lors de la mise à jour de l\'équipe',
        code: error.code || 'UNKNOWN'
      };
    }
  }

  async deleteTeam(id: string): Promise<void> {
    if (!isAppwriteReady()) {
      throw new Error('Configuration Appwrite incomplète');
    }

    try {
      await databases.deleteDocument(
        APPWRITE_CONFIG.DATABASE_ID,
        APPWRITE_CONFIG.COLLECTION_TEAMS,
        id
      );
    } catch (error: any) {
      console.error('[APPWRITE] Erreur lors de la suppression de l\'équipe:', error);
      throw {
        message: error.message || 'Erreur lors de la suppression de l\'équipe',
        code: error.code || 'UNKNOWN'
      };
    }
  }

  async setLocalTeam(id: string): Promise<void> {
    if (!isAppwriteReady()) {
      throw new Error('Configuration Appwrite incomplète');
    }

    try {
      // D'abord, réinitialiser toutes les équipes
      const teams = await this.getTeams();
      for (const team of teams) {
        if (team.id && team.is_local) {
          await this.updateTeam(team.id, { is_local: false });
        }
      }
      
      // Ensuite, définir la nouvelle équipe locale
      await this.updateTeam(id, { is_local: true });
    } catch (error: any) {
      console.error('[APPWRITE] Erreur lors de la définition de l\'équipe locale:', error);
      throw {
        message: error.message || 'Erreur lors de la définition de l\'équipe locale',
        code: error.code || 'UNKNOWN'
      };
    }
  }

  async getSettings(): Promise<SettingsData | null> {
    if (!isAppwriteReady()) {
      throw new Error('Configuration Appwrite incomplète');
    }

    try {
      const doc = await databases.getDocument(
        APPWRITE_CONFIG.DATABASE_ID,
        APPWRITE_CONFIG.COLLECTION_SETTINGS,
        'default'
      );

      return {
        id: doc.$id,
        title: doc.title,
        subtitle: doc.subtitle,
        results_bg: doc.results_bg,
        preview_bg: doc.preview_bg,
        victory_bg: doc.victory_bg,
        main_color: doc.main_color,
        visual_type: doc.visual_type,
        category: doc.category,
        match_date: doc.match_date,
        location: doc.location
      };
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      console.error('[APPWRITE] Erreur lors de la récupération des paramètres:', error);
      throw {
        message: error.message || 'Erreur lors de la récupération des paramètres',
        code: error.code || 'UNKNOWN'
      };
    }
  }

  async updateSettings(settings: Partial<SettingsData>): Promise<SettingsData> {
    if (!isAppwriteReady()) {
      throw new Error('Configuration Appwrite incomplète');
    }

    try {
      const updateData: any = {};
      Object.keys(settings).forEach(key => {
        if (settings[key as keyof SettingsData] !== undefined) {
          updateData[key] = settings[key as keyof SettingsData];
        }
      });

      const res = await databases.updateDocument(
        APPWRITE_CONFIG.DATABASE_ID,
        APPWRITE_CONFIG.COLLECTION_SETTINGS,
        'default',
        updateData
      );

      return {
        id: res.$id,
        title: res.title,
        subtitle: res.subtitle,
        results_bg: res.results_bg,
        preview_bg: res.preview_bg,
        victory_bg: res.victory_bg,
        main_color: res.main_color,
        visual_type: res.visual_type,
        category: res.category,
        match_date: res.match_date,
        location: res.location
      };
    } catch (error: any) {
      console.error('[APPWRITE] Erreur lors de la mise à jour des paramètres:', error);
      throw {
        message: error.message || 'Erreur lors de la mise à jour des paramètres',
        code: error.code || 'UNKNOWN'
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!isAppwriteReady()) {
      return false;
    }

    try {
      await databases.listDocuments(
        APPWRITE_CONFIG.DATABASE_ID,
        APPWRITE_CONFIG.COLLECTION_TEAMS,
        [],
        1 // Limiter à 1 document pour un health check rapide
      );
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Adapter pour Supabase
 */
export class SupabaseAdapter implements DatabaseAdapter {
  source: DatabaseSource = 'SUPABASE';

  private guard() {
    if (!supabase) throw new Error('Supabase non configuré (variables d\'environnement manquantes)');
  }

  async getTeams(): Promise<TeamData[]> {
    this.guard();
    try {
      const { data, error } = await supabase!
        .from('teams')
        .select('*')
        .order('name');

      if (error) {
        const handledError = handleSupabaseError(error, 'getTeams');
        throw handledError || error;
      }

      return (data || []).map(team => ({
        id: team.id?.toString(),
        name: team.name,
        logo: team.logo,
        is_local: team.is_local || false
      }));
    } catch (error: any) {
      console.error('[SUPABASE] Erreur lors de la récupération des équipes:', error);
      throw error;
    }
  }

  async createTeam(team: Omit<TeamData, 'id'>): Promise<TeamData> {
    this.guard();
    try {
      const { data, error } = await supabase!
        .from('teams')
        .insert({
          name: team.name,
          logo: team.logo,
          is_local: team.is_local || false
        })
        .select()
        .single();

      if (error) {
        const handledError = handleSupabaseError(error, 'createTeam');
        throw handledError || error;
      }

      return {
        id: data.id?.toString(),
        name: data.name,
        logo: data.logo,
        is_local: data.is_local || false
      };
    } catch (error: any) {
      console.error('[SUPABASE] Erreur lors de la création de l\'équipe:', error);
      throw error;
    }
  }

  async updateTeam(id: string, team: Partial<TeamData>): Promise<TeamData> {
    this.guard();
    try {
      const updateData: any = {};
      if (team.name !== undefined) updateData.name = team.name;
      if (team.logo !== undefined) updateData.logo = team.logo;
      if (team.is_local !== undefined) updateData.is_local = team.is_local;

      const { data, error } = await supabase!
        .from('teams')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        const handledError = handleSupabaseError(error, 'updateTeam');
        throw handledError || error;
      }

      return {
        id: data.id?.toString(),
        name: data.name,
        logo: data.logo,
        is_local: data.is_local || false
      };
    } catch (error: any) {
      console.error('[SUPABASE] Erreur lors de la mise à jour de l\'équipe:', error);
      throw error;
    }
  }

  async deleteTeam(id: string): Promise<void> {
    this.guard();
    try {
      const { error } = await supabase!
        .from('teams')
        .delete()
        .eq('id', id);

      if (error) {
        const handledError = handleSupabaseError(error, 'deleteTeam');
        throw handledError || error;
      }
    } catch (error: any) {
      console.error('[SUPABASE] Erreur lors de la suppression de l\'équipe:', error);
      throw error;
    }
  }

  async setLocalTeam(id: string): Promise<void> {
    this.guard();
    try {
      // D'abord, réinitialiser toutes les équipes
      const { error: resetError } = await supabase!
        .from('teams')
        .update({ is_local: false })
        .not('id', 'is', null);

      if (resetError) {
        const handledError = handleSupabaseError(resetError, 'setLocalTeam (reset)');
        throw handledError || resetError;
      }

      // Ensuite, définir la nouvelle équipe locale
      const { error: updateError } = await supabase!
        .from('teams')
        .update({ is_local: true })
        .eq('id', id);

      if (updateError) {
        const handledError = handleSupabaseError(updateError, 'setLocalTeam (update)');
        throw handledError || updateError;
      }
    } catch (error: any) {
      console.error('[SUPABASE] Erreur lors de la définition de l\'équipe locale:', error);
      throw error;
    }
  }

  async getSettings(): Promise<SettingsData | null> {
    this.guard();
    try {
      const { data, error } = await supabase!
        .from('settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (error) {
        const handledError = handleSupabaseError(error, 'getSettings');
        throw handledError || error;
      }

      return data || null;
    } catch (error: any) {
      console.error('[SUPABASE] Erreur lors de la récupération des paramètres:', error);
      throw error;
    }
  }

  async updateSettings(settings: Partial<SettingsData>): Promise<SettingsData> {
    this.guard();
    try {
      const { data, error } = await supabase!
        .from('settings')
        .upsert({ id: 1, ...settings })
        .select()
        .single();

      if (error) {
        const handledError = handleSupabaseError(error, 'updateSettings');
        throw handledError || error;
      }

      return data;
    } catch (error: any) {
      console.error('[SUPABASE] Erreur lors de la mise à jour des paramètres:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!supabase) return false;
    try {
      const { error } = await supabase
        .from('teams')
        .select('id')
        .limit(1);
      
      return !error;
    } catch {
      return false;
    }
  }
}

/**
 * Factory pour créer l'adapter approprié
 */
export const createDatabaseAdapter = (source: DatabaseSource): DatabaseAdapter => {
  switch (source) {
    case 'APPWRITE':
      return new AppwriteAdapter();
    case 'SUPABASE':
      return new SupabaseAdapter();
    default:
      throw new Error(`Source de base de données non supportée: ${source}`);
  }
};

/**
 * Tente de se connecter à une source et retourne l'adapter si réussi
 */
export const tryConnectDatabase = async (source: DatabaseSource): Promise<DatabaseAdapter | null> => {
  try {
    const adapter = createDatabaseAdapter(source);
    const isHealthy = await adapter.healthCheck();
    return isHealthy ? adapter : null;
  } catch {
    return null;
  }
};
