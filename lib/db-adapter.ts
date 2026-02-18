import { supabase, handleSupabaseError } from './supabase';

export type DatabaseSource = 'AIVEN' | 'SUPABASE';

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
  pagination_margin_top?: number | null;
  pagination_margin_bottom?: number | null;
  pagination_padding_top?: number | null;
  pagination_padding_bottom?: number | null;
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
  /** Récupère les 3 images en une requête (réduit les connexions DB). */
  getAllBackgroundImages(): Promise<{ results: string | null; preview: string | null; victory: string | null }>;
  setBackgroundImage(type: BackgroundImageType, imageData: string): Promise<void>;
  
  // Vérification de santé
  healthCheck(): Promise<boolean>;
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

  async getAllBackgroundImages(): Promise<{ results: string | null; preview: string | null; victory: string | null }> {
    return {
      results: await this.getBackgroundImage('results'),
      preview: await this.getBackgroundImage('preview'),
      victory: await this.getBackgroundImage('victory')
    };
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
 * Adapter pour Aiven PostgreSQL (API Vercel, routes /api/teams, /api/settings, etc.)
 */
export class AivenAdapter implements DatabaseAdapter {
  source: DatabaseSource = 'AIVEN';

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
      const json = await res.json().catch(() => ({})) as { error?: string; code?: string };
      throw { message: json.error || res.statusText, code: json.code || res.status };
    }
  }

  async setLocalTeam(id: string): Promise<void> {
    const res = await this.api('/teams/set-local', { method: 'POST', body: JSON.stringify({ id }) });
    if (!res.ok && res.status !== 204) {
      const json = await res.json().catch(() => ({})) as { error?: string; code?: string };
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
      const json = await res.json().catch(() => ({})) as { data?: string; error?: string };
      if (!res.ok) throw { message: json.error || res.statusText, code: res.status };
      return json.data || null;
    } catch (error: any) {
      console.error('[AIVEN] Erreur lors de la récupération de l\'image de fond:', error);
      return null;
    }
  }

  async getAllBackgroundImages(): Promise<{ results: string | null; preview: string | null; victory: string | null }> {
    try {
      const res = await this.api('/background-images');
      const json = await res.json().catch(() => ({})) as { data?: Record<string, string | null>; error?: string };
      if (!res.ok) throw { message: json.error || res.statusText, code: res.status };
      const d = json.data ?? {};
      return {
        results: typeof d.results === 'string' ? d.results : null,
        preview: typeof d.preview === 'string' ? d.preview : null,
        victory: typeof d.victory === 'string' ? d.victory : null
      };
    } catch (error: any) {
      console.error('[AIVEN] Erreur getAllBackgroundImages:', error);
      return { results: null, preview: null, victory: null };
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
    case 'AIVEN':
      return new AivenAdapter();
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
