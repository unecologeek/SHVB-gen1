
import { Client, Databases, Account } from 'appwrite';

// Configuration via variables d'environnement
// Note: Pour l'authentification utilisateur, utilisez Account API au lieu de la clé API
// La clé API est utilisée pour les opérations serveur/admin, l'authentification utilisateur pour les opérations client
export const APPWRITE_CONFIG = {
  ENDPOINT: import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1',
  PROJECT_ID: import.meta.env.VITE_APPWRITE_PROJECT_ID || '',
  API_KEY: import.meta.env.VITE_APPWRITE_API_KEY || '',
  DATABASE_ID: import.meta.env.VITE_APPWRITE_DATABASE_ID || 'main',
  COLLECTION_TEAMS: import.meta.env.VITE_APPWRITE_COLLECTION_TEAMS || 'teams',
  COLLECTION_SETTINGS: import.meta.env.VITE_APPWRITE_COLLECTION_SETTINGS || 'settings'
};

// Client Appwrite pour les opérations de base de données
const client = new Client()
  .setEndpoint(APPWRITE_CONFIG.ENDPOINT)
  .setProject(APPWRITE_CONFIG.PROJECT_ID);

// Ajouter la clé API si elle est fournie (pour les opérations serveur/admin)
// Si aucune clé API n'est fournie, les opérations nécessiteront une authentification utilisateur
if (APPWRITE_CONFIG.API_KEY) {
  client.setKey(APPWRITE_CONFIG.API_KEY);
  console.log('✅ Clé API Appwrite configurée');
} else {
  console.warn('⚠️ Aucune clé API Appwrite fournie. Les opérations nécessiteront une authentification utilisateur.');
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
  
  // Avertir si aucune méthode d'authentification n'est configurée
  if (!APPWRITE_CONFIG.API_KEY) {
    console.warn('⚠️ Aucune clé API Appwrite configurée. Assurez-vous que les permissions de collection permettent l\'accès anonyme ou configurez l\'authentification utilisateur.');
  }
  
  return true;
};
