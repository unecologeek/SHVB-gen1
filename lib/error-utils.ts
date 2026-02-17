
import { isCORSError, isRetryableError } from './retry';

/**
 * Détermine si une erreur est une erreur de connexion (réseau, timeout, serveur)
 * vs une erreur de validation/contrainte (champ trop long, valeur inadaptée, etc.)
 */
export const isConnectionError = (error: any): boolean => {
  if (!error) return false;

  const message = (error.message || '').toLowerCase();
  const code = error.code || error.status;
  const type = (error.type || '').toLowerCase();

  // Erreurs CORS sont des erreurs de connexion
  if (isCORSError(error)) {
    return true;
  }

  // Erreurs réseau
  if (message.includes('fetch') || message.includes('network') || message.includes('failed to fetch')) {
    return true;
  }

  // Erreurs de timeout
  if (code === 'ETIMEDOUT' || message.includes('timeout') || type === 'timeout') {
    return true;
  }

  // Erreurs serveur (5xx)
  if (code >= 500 && code < 600) {
    return true;
  }

  // Erreurs de rate limiting (429)
  if (code === 429) {
    return true;
  }

  // Erreurs spécifiques de connexion Supabase
  if (code === 'PGRST301' && message.includes('connection')) {
    return true;
  }

  // Erreurs spécifiques Appwrite de connexion
  if (type === 'network_error' || type === 'timeout') {
    return true;
  }

  // Erreurs de connexion Convex
  if (message.includes('convex') && (message.includes('connection') || message.includes('network'))) {
    return true;
  }

  // Si l'erreur est retryable, c'est probablement une erreur de connexion
  if (isRetryableError(error)) {
    return true;
  }

  // Par défaut, si c'est une erreur 4xx mais pas de validation explicite, considérer comme connexion
  // (certaines erreurs 4xx peuvent être des erreurs de configuration/proxy)
  if (code >= 400 && code < 500) {
    // Mais si le message contient des indices de validation, ce n'est PAS une erreur de connexion
    const validationKeywords = [
      'too long',
      'trop long',
      'constraint',
      'contrainte',
      'violation',
      'invalid',
      'invalide',
      'required',
      'requis',
      'max length',
      'max_length',
      'value too large',
      'valeur trop grande',
      'format',
      'type',
      'length',
      'longueur',
      'size',
      'taille'
    ];
    
    const hasValidationKeyword = validationKeywords.some(keyword => message.includes(keyword));
    return !hasValidationKeyword;
  }

  return false;
};

/**
 * Extrait le message d'erreur lisible depuis une erreur
 */
export const extractErrorMessage = (error: any): string => {
  if (!error) return 'Erreur inconnue';

  // Si c'est un objet avec un message
  if (error.message) {
    return error.message;
  }

  // Si c'est une chaîne
  if (typeof error === 'string') {
    return error;
  }

  // Si c'est un objet avec un hint
  if (error.hint) {
    return error.hint;
  }

  // Si c'est un objet avec un error
  if (error.error) {
    return typeof error.error === 'string' ? error.error : error.error.message || 'Erreur inconnue';
  }

  // Dernier recours
  return JSON.stringify(error);
};
