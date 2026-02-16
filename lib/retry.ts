
export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryable?: (error: any) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryable: () => true
};

/**
 * Calcule le délai d'attente avec backoff exponentiel
 */
const calculateDelay = (
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  backoffMultiplier: number
): number => {
  const delay = initialDelay * Math.pow(backoffMultiplier, attempt);
  return Math.min(delay, maxDelay);
};

/**
 * Exécute une fonction avec retry automatique et backoff exponentiel
 */
export const withRetry = async <T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Ne pas retry si l'erreur n'est pas retryable
      if (opts.retryable && !opts.retryable(error)) {
        throw error;
      }

      // Ne pas retry si c'est la dernière tentative
      if (attempt === opts.maxRetries) {
        break;
      }

      // Calculer le délai d'attente
      const delay = calculateDelay(
        attempt,
        opts.initialDelay,
        opts.maxDelay,
        opts.backoffMultiplier
      );

      console.log(`⚠️ Tentative ${attempt + 1}/${opts.maxRetries + 1} échouée. Nouvelle tentative dans ${delay}ms...`);

      // Attendre avant de réessayer
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

/**
 * Vérifie si une erreur est une erreur CORS
 */
export const isCORSError = (error: any): boolean => {
  const message = (error.message || '').toLowerCase();
  const type = (error.type || '').toLowerCase();
  
  return (
    message.includes('cors') ||
    message.includes('access-control-allow-origin') ||
    message.includes('cross-origin') ||
    message.includes('same origin') ||
    type === 'cors_error' ||
    (error.code === 403 && message.includes('origin'))
  );
};

/**
 * Détermine si une erreur est retryable
 */
export const isRetryableError = (error: any): boolean => {
  // Les erreurs CORS ne sont PAS retryables - elles nécessitent une configuration serveur
  if (isCORSError(error)) {
    return false;
  }

  // Erreurs réseau (mais pas CORS)
  if (error.message?.includes('fetch') || error.message?.includes('network')) {
    return true;
  }

  // Erreurs de timeout
  if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
    return true;
  }

  // Erreurs 5xx (erreurs serveur)
  if (error.code >= 500 && error.code < 600) {
    return true;
  }

  // Erreurs 429 (rate limiting)
  if (error.code === 429) {
    return true;
  }

  // Erreurs spécifiques Appwrite (mais pas CORS)
  if (error.type === 'network_error' || error.type === 'timeout') {
    return true;
  }

  // Erreurs spécifiques Supabase
  if (error.code === 'PGRST301' && error.message?.includes('connection')) {
    return true;
  }

  // Ne pas retry les erreurs 4xx (sauf 429)
  if (error.code >= 400 && error.code < 500 && error.code !== 429) {
    return false;
  }

  // Par défaut, ne pas retry
  return false;
};
