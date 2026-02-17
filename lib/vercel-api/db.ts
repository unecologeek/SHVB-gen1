import { neon } from '@neondatabase/serverless';

// #region agent log
try { console.log('[DEBUG] lib/vercel-api/db.ts loaded'); } catch (_) {}
// #endregion

export type TeamRow = { id: string; name: string; logo: string; is_local: boolean };

export function getSql(): ReturnType<typeof neon> | null {
  const url = process.env.shvb_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url || typeof url !== 'string' || !url.trim()) {
    return null;
  }
  return neon(url);
}
