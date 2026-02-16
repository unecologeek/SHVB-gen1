
import { createClient } from '@supabase/supabase-js';

// Configuration via variables d'environnement
// Note : Si l'erreur 522 persiste, vérifiez sur database.new si le projet n'est pas "Paused"
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Variables Supabase manquantes. Vérifiez votre fichier .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

// Helper pour gérer les erreurs RLS de manière plus explicite
export const handleSupabaseError = (error: any, operation: string) => {
  if (!error) return null;
  
  const errorMessage = error.message || 'Erreur inconnue';
  const errorCode = error.code || error.status || 'UNKNOWN';
  
  // Erreurs RLS communes
  if (errorCode === 'PGRST301' || errorMessage.includes('permission denied') || errorMessage.includes('row-level security')) {
    console.error(`❌ [SUPABASE RLS] Erreur de permissions lors de l'opération: ${operation}`);
    console.error('💡 Solution: Vérifiez que RLS est configuré correctement. Consultez SUPABASE_RLS_SETUP.md');
    return {
      message: `Erreur de permissions: ${operation}. Vérifiez la configuration RLS.`,
      code: 'RLS_ERROR',
      hint: 'Consultez SUPABASE_RLS_SETUP.md pour configurer Row Level Security'
    };
  }
  
  // Erreur 522 - Projet en pause
  if (errorCode === '522' || errorMessage.includes('522')) {
    console.error('❌ [SUPABASE] Projet peut-être en pause (erreur 522)');
    return {
      message: 'Le projet Supabase semble être en pause. Vérifiez sur database.new',
      code: 'PROJECT_PAUSED',
      hint: 'Activez le projet sur https://database.new'
    };
  }
  
  // Erreur CORS
  if (errorMessage.includes('CORS') || errorMessage.includes('fetch')) {
    console.error('❌ [SUPABASE] Erreur CORS ou réseau');
    return {
      message: 'Erreur de connexion réseau ou CORS',
      code: 'NETWORK_ERROR',
      hint: 'Vérifiez votre connexion et les paramètres CORS de Supabase'
    };
  }
  
  return {
    message: errorMessage,
    code: errorCode,
    hint: 'Consultez les logs Supabase pour plus de détails'
  };
};
