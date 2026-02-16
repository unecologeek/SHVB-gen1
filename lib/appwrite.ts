
import { Client, Databases, Account } from 'appwrite';

// Configuration via variables d'environnement
// Endpoint et Project ID suffisent pour l'accès client (selon les permissions des collections).
// La clé API est optionnelle, pour un usage serveur/admin.
export const APPWRITE_CONFIG = {
  ENDPOINT: import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1',
  PROJECT_ID: import.meta.env.VITE_APPWRITE_PROJECT_ID || '699355c300394ef69de9',
  API_KEY: import.meta.env.VITE_APPWRITE_API_KEY || '',
  DATABASE_ID: import.meta.env.VITE_APPWRITE_DATABASE_ID || 'SHVBdb',
  COLLECTION_TEAMS: import.meta.env.VITE_APPWRITE_COLLECTION_TEAMS || 'teams',
  COLLECTION_SETTINGS: import.meta.env.VITE_APPWRITE_COLLECTION_SETTINGS || 'settings'
};

// Client Appwrite (endpoint et project du projet SHVB)
const client = new Client()
  .setEndpoint(APPWRITE_CONFIG.ENDPOINT)
  .setProject(APPWRITE_CONFIG.PROJECT_ID);

export { client };

// Ajouter la clé API si elle est fournie (optionnel, pour usage serveur/admin)
if (APPWRITE_CONFIG.API_KEY) {
  client.setKey(APPWRITE_CONFIG.API_KEY);
  console.log('✅ Clé API Appwrite configurée');
}

export const databases = new Databases(client);

// API Account pour l'authentification utilisateur (si nécessaire)
export const account = new Account(client);

// Vérifie si la configuration est prête à l'emploi
export const isAppwriteReady = () => {
  if (!APPWRITE_CONFIG.PROJECT_ID || !APPWRITE_CONFIG.DATABASE_ID) {
    console.warn('⚠️ Configuration Appwrite incomplète. Vérifiez votre fichier .env.local');
    return false;
  }

  return true;
};
