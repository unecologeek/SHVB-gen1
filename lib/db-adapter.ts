
import { supabase, handleSupabaseError } from './supabase';
import { databases, APPWRITE_CONFIG, isAppwriteReady } from './appwrite';
import { getConvexClient, isConvexReady } from './convex';
import { api } from '../convex/_generated/api';
import { BackgroundImageType } from '../convex/backgroundImages';
import { AppConfig } from '../types';
import { isCORSError } from './retry';

export type DatabaseSource = 'NEON' | 'APPWRITE' | 'SUPABASE' | 'CONVEX';

function getApiBase(): string {
  return (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '';
}

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
  victory_photo_focus_x?: number | null;
  victory_photo_focus_y?: number | null;
  main_color?: string;
  visual_type?: string;
  category?: string;
  match_date?: string;
  location?: string;
}

export type BackgroundImageType = 'results' | 'preview' | 'victory';

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
  
  // Images de fond
  getBackgroundImage(type: BackgroundImageType): Promise<string | null>;
  setBackgroundImage(type: BackgroundImageType, imageData: string): Promise<void>;
  
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
      if (isCORSError(error)) {
        console.error('❌ [APPWRITE CORS] Erreur CORS détectée. Configurez les domaines autorisés dans Appwrite Dashboard.');
        console.error('💡 Solution: Ajoutez votre domaine Vercel dans Appwrite → Settings → Domains');
      }
      console.error('[APPWRITE] Erreur lors de la récupération des équipes:', error);
      throw {
        message: error.message || 'Erreur lors de la récupération des équipes',
        code: error.code || 'UNKNOWN',
        type: error.type || 'Unknown',
        isCORS: isCORSError(error)
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

  async getBackgroundImage(type: BackgroundImageType): Promise<string | null> {
    if (!isAppwriteReady()) {
      throw new Error('Configuration Appwrite incomplète');
    }

    try {
      const res = await databases.listDocuments(
        APPWRITE_CONFIG.DATABASE_ID,
        APPWRITE_CONFIG.COLLECTION_BACKGROUND_IMAGES,
        [`type=${type}`]
      );
      return res.documents[0]?.image_data || null;
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      console.error('[APPWRITE] Erreur lors de la récupération de l\'image de fond:', error);
      return null;
    }
  }

  async setBackgroundImage(type: BackgroundImageType, imageData: string): Promise<void> {
    if (!isAppwriteReady()) {
      throw new Error('Configuration Appwrite incomplète');
    }

    try {
      // Chercher l'image existante
      const res = await databases.listDocuments(
        APPWRITE_CONFIG.DATABASE_ID,
        APPWRITE_CONFIG.COLLECTION_BACKGROUND_IMAGES,
        [`type=${type}`]
      );

      if (res.documents.length > 0) {
        await databases.updateDocument(
          APPWRITE_CONFIG.DATABASE_ID,
          APPWRITE_CONFIG.COLLECTION_BACKGROUND_IMAGES,
          res.documents[0].$id,
          { image_data: imageData }
        );
      } else {
        await databases.createDocument(
          APPWRITE_CONFIG.DATABASE_ID,
          APPWRITE_CONFIG.COLLECTION_BACKGROUND_IMAGES,
          'unique()',
          { type, image_data: imageData }
        );
      }
    } catch (error: any) {
      console.error('[APPWRITE] Erreur lors de la sauvegarde de l\'image de fond:', error);
      throw {
        message: error.message || 'Erreur lors de la sauvegarde de l\'image de fond',
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
    } catch (error: any) {
      if (isCORSError(error)) {
        console.warn('⚠️ [APPWRITE] Health check échoué à cause de CORS. Configurez les domaines dans Appwrite Dashboard.');
      }
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

  async getBackgroundImage(type: BackgroundImageType): Promise<string | null> {
    this.guard();
    try {
      const { data, error } = await supabase!
        .from('background_images')
        .select('image_data')
        .eq('type', type)
        .maybeSingle();

      if (error) {
        const handledError = handleSupabaseError(error, 'getBackgroundImage');
        throw handledError || error;
      }

      return data?.image_data || null;
    } catch (error: any) {
      console.error('[SUPABASE] Erreur lors de la récupération de l\'image de fond:', error);
      return null;
    }
  }

  async setBackgroundImage(type: BackgroundImageType, imageData: string): Promise<void> {
    this.guard();
    try {
      const { error } = await supabase!
        .from('background_images')
        .upsert({ type, image_data: imageData }, { onConflict: 'type' });

      if (error) {
        const handledError = handleSupabaseError(error, 'setBackgroundImage');
        throw handledError || error;
      }
    } catch (error: any) {
      console.error('[SUPABASE] Erreur lors de la sauvegarde de l\'image de fond:', error);
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
 * Adapter pour Convex
 */
export class ConvexAdapter implements DatabaseAdapter {
  source: DatabaseSource = 'CONVEX';

  private get client() {
    const client = getConvexClient();
    if (!client || !isConvexReady()) {
      throw new Error('Convex non configuré : définissez VITE_CONVEX_URL dans .env.local (ex: https://xxx.convex.cloud)');
    }
    return client;
  }

  async getTeams(): Promise<TeamData[]> {
    const list = await this.client.query(api.teams.list, {});
    return (list || []).map((doc: { _id: string; name: string; logo: string; is_local: boolean }) => ({
      id: doc._id,
      name: doc.name,
      logo: doc.logo ?? '',
      is_local: Boolean(doc.is_local),
    }));
  }

  async createTeam(team: Omit<TeamData, 'id'>): Promise<TeamData> {
    const id = await this.client.mutation(api.teams.create, {
      name: team.name,
      logo: team.logo ?? '',
      is_local: team.is_local ?? false,
    });
    return { id: id as string, name: team.name, logo: team.logo ?? '', is_local: team.is_local ?? false };
  }

  async updateTeam(id: string, team: Partial<TeamData>): Promise<TeamData> {
    const payload: { id: string; name?: string; logo?: string; is_local?: boolean } = { id };
    if (team.name !== undefined) payload.name = team.name;
    if (team.logo !== undefined) payload.logo = team.logo;
    if (team.is_local !== undefined) payload.is_local = team.is_local;
    const doc = await this.client.mutation(api.teams.update, payload as { id: string; name?: string; logo?: string; is_local?: boolean });
    if (!doc) throw new Error('Équipe introuvable');
    return { id: doc._id, name: doc.name, logo: doc.logo ?? '', is_local: Boolean(doc.is_local) };
  }

  async deleteTeam(id: string): Promise<void> {
    await this.client.mutation(api.teams.remove, { id });
  }

  async setLocalTeam(id: string): Promise<void> {
    await this.client.mutation(api.teams.setLocal, { id });
  }

  async getSettings(): Promise<SettingsData | null> {
    const doc = await this.client.query(api.settings.get, {});
    if (!doc) return null;
    return {
      title: doc.title,
      subtitle: doc.subtitle,
      victory_photo_focus_x: (doc as any).victory_photo_focus_x,
      victory_photo_focus_y: (doc as any).victory_photo_focus_y,
      main_color: doc.main_color,
      visual_type: doc.visual_type,
      category: doc.category,
      match_date: doc.match_date,
      location: doc.location,
    };
  }

  async updateSettings(settings: Partial<SettingsData>): Promise<SettingsData> {
    await this.client.mutation(api.settings.update, settings);
    const doc = await this.client.query(api.settings.get, {});
    if (!doc) return {} as SettingsData;
    return {
      title: doc.title,
      subtitle: doc.subtitle,
      victory_photo_focus_x: (doc as any).victory_photo_focus_x,
      victory_photo_focus_y: (doc as any).victory_photo_focus_y,
      main_color: doc.main_color,
      visual_type: doc.visual_type,
      category: doc.category,
      match_date: doc.match_date,
      location: doc.location,
    };
  }

  async getBackgroundImage(type: BackgroundImageType): Promise<string | null> {
    return await this.client.query(api.backgroundImages.get, { type });
  }

  async setBackgroundImage(type: BackgroundImageType, imageData: string): Promise<void> {
    await this.client.mutation(api.backgroundImages.set, { type, image_data: imageData });
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!isConvexReady()) return false;
      await this.client.query(api.settings.get, {});
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Adapter pour Neon (API Vercel)
 */
export class NeonAdapter implements DatabaseAdapter {
  source: DatabaseSource = 'NEON';

  private api(path: string, options?: RequestInit): Promise<Response> {
    const base = getApiBase();
    return fetch(`${base}/api${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
  }

  async getTeams(): Promise<TeamData[]> {
    const res = await this.api('/teams');
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string; code?: string };
      throw { message: err.error || res.statusText, code: err.code || res.status };
    }
    const json = (await res.json()) as { data: TeamData[] };
    return (json.data || []).map(t => ({ id: t.id, name: t.name, logo: t.logo ?? '', is_local: Boolean(t.is_local) }));
  }

  async createTeam(team: Omit<TeamData, 'id'>): Promise<TeamData> {
    const res = await this.api('/teams', { method: 'POST', body: JSON.stringify({ name: team.name, logo: team.logo ?? '', is_local: team.is_local ?? false }) });
    const json = (await res.json()) as { data?: TeamData; error?: string; code?: string };
    if (!res.ok) throw { message: json.error || res.statusText, code: json.code || res.status };
    const d = json.data!;
    return { id: d.id, name: d.name, logo: d.logo ?? '', is_local: Boolean(d.is_local) };
  }

  async updateTeam(id: string, team: Partial<TeamData>): Promise<TeamData> {
    const res = await this.api(`/teams/${id}`, { method: 'PATCH', body: JSON.stringify(team) });
    const json = (await res.json()) as { data?: TeamData; error?: string; code?: string };
    if (!res.ok) throw { message: json.error || res.statusText, code: json.code || res.status };
    const d = json.data!;
    return { id: d.id, name: d.name, logo: d.logo ?? '', is_local: Boolean(d.is_local) };
  }

  async deleteTeam(id: string): Promise<void> {
    const res = await this.api(`/teams/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      const json = (await res.json()).catch(() => ({})) as { error?: string; code?: string };
      throw { message: json.error || res.statusText, code: json.code || res.status };
    }
  }

  async setLocalTeam(id: string): Promise<void> {
    const res = await this.api('/teams/set-local', { method: 'POST', body: JSON.stringify({ id }) });
    if (!res.ok && res.status !== 204) {
      const json = (await res.json()).catch(() => ({})) as { error?: string; code?: string };
      throw { message: json.error || res.statusText, code: json.code || res.status };
    }
  }

  async getSettings(): Promise<SettingsData | null> {
    const res = await this.api('/settings');
    if (res.status === 404) return null;
    const json = (await res.json()) as { data?: SettingsData; error?: string };
    if (!res.ok) throw { message: json.error || res.statusText, code: res.status };
    return json.data ?? null;
  }

  async updateSettings(settings: Partial<SettingsData>): Promise<SettingsData> {
    const res = await this.api('/settings', { method: 'PATCH', body: JSON.stringify(settings) });
    const json = (await res.json()) as { data?: SettingsData; error?: string };
    if (!res.ok) throw { message: json.error || res.statusText, code: res.status };
    return json.data!;
  }

  async getBackgroundImage(type: BackgroundImageType): Promise<string | null> {
    try {
      const res = await this.api(`/background-images/${type}`);
      if (res.status === 404) return null;
      const json = (await res.json()) as { data?: string; error?: string };
      if (!res.ok) throw { message: json.error || res.statusText, code: res.status };
      return json.data || null;
    } catch (error: any) {
      console.error('[NEON] Erreur lors de la récupération de l\'image de fond:', error);
      return null;
    }
  }

  async setBackgroundImage(type: BackgroundImageType, imageData: string): Promise<void> {
    const res = await this.api(`/background-images/${type}`, {
      method: 'PUT',
      body: JSON.stringify({ image_data: imageData })
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) throw { message: json.error || res.statusText, code: res.status };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await this.api('/teams');
      return res.ok;
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
    case 'NEON':
      return new NeonAdapter();
    case 'APPWRITE':
      return new AppwriteAdapter();
    case 'SUPABASE':
      return new SupabaseAdapter();
    case 'CONVEX':
      return new ConvexAdapter();
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
