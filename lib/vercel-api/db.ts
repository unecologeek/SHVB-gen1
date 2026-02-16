import { neon } from '@neondatabase/serverless';

export function getSql(): ReturnType<typeof neon> | null {
  const url = process.env.shvb_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url || typeof url !== 'string' || !url.trim()) {
    return null;
  }
  return neon(url);
}
