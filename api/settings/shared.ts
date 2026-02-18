import type { VercelRequest, VercelResponse } from '@vercel/node';
import pg from 'pg';

const { Pool } = pg;

function getOrigin(req: VercelRequest): string {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && ['http://localhost:5173', 'http://localhost:3000', 'https://shvb-gen1.vercel.app'].includes(origin)) return origin;
  return 'https://shvb-gen1.vercel.app';
}

export function withCors(
  req: VercelRequest,
  res: VercelResponse,
  handler: () => void | Promise<void>
): void | Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', getOrigin(req));
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  return Promise.resolve(handler()).catch((err) => {
    const msg = String((err as Error)?.message || 'Internal error');
    console.error('[API]', msg, err);
    if (!res.headersSent) jsonResponse(res, 500, { error: msg, code: 'INTERNAL' });
  });
}

/** Réponse JSON avec payload forcé sérialisable (évite XrayWrapper / cross-origin sur Vercel). */
export function jsonResponse(res: VercelResponse, status: number, data: unknown): void {
  try {
    const payload = JSON.parse(JSON.stringify(data));
    const body = JSON.stringify(payload);
    res.setHeader('Content-Type', 'application/json');
    res.status(status).end(body);
  } catch (e) {
    console.error('[API] jsonResponse serialize error:', String((e as Error)?.message));
    res.setHeader('Content-Type', 'application/json');
    res.status(status).end(JSON.stringify({ error: 'Serialization error', code: 'INTERNAL' }));
  }
}

/** Convertit des lignes BDD en objets 100 % sérialisables (évite XrayWrapper sur Vercel). */
function toPlainRows(rows: unknown[]): Record<string, unknown>[] {
  try {
    return JSON.parse(JSON.stringify(rows)) as Record<string, unknown>[];
  } catch {
    return rows.map((r) => (typeof r === 'object' && r !== null && !Array.isArray(r) ? { ...(r as Record<string, unknown>) } : r as Record<string, unknown>));
  }
}

/** Construit une requête SQL avec $1, $2... à partir du template tag. */
function buildQuery(strings: TemplateStringsArray, values: unknown[]): { text: string; values: unknown[] } {
  let text = strings[0] ?? '';
  for (let i = 0; i < values.length; i++) {
    text += `$${i + 1}` + (strings[i + 1] ?? '');
  }
  return { text, values };
}

export type SqlTag = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Record<string, unknown>[]>;

let aivenPool: pg.Pool | null = null;

function getAivenPool(): pg.Pool | null {
  // Priorité : variables Aiven, puis fallback sur anciennes variables (ex. DATABASE_URL sur Vercel)
  const url =
    process.env.AIVEN_DATABASE_URL ??
    process.env.shvb_AIVEN_DATABASE_URL ??
    process.env.DATABASE_URL ??
    process.env.shvb_DATABASE_URL;
  const source = process.env.AIVEN_DATABASE_URL ? 'AIVEN_DATABASE_URL' : process.env.shvb_AIVEN_DATABASE_URL ? 'shvb_AIVEN_DATABASE_URL' : process.env.DATABASE_URL ? 'DATABASE_URL' : process.env.shvb_DATABASE_URL ? 'shvb_DATABASE_URL' : 'none';
  console.log('[Aiven] getAivenPool: source=', source, 'urlPresent=', !!url, 'urlLength=', typeof url === 'string' ? url.length : 0);
  if (!url || typeof url !== 'string' || !url.trim()) {
    console.log('[Aiven] getAivenPool: no URL, returning null');
    return null;
  }
  if (!aivenPool) {
    console.log('[Aiven] getAivenPool: creating new Pool');
    aivenPool = new Pool({
      connectionString: url,
      // Aiven utilise un certificat que Node ne truste pas par défaut en serverless ; connexion toujours chiffrée (TLS).
      ssl: { rejectUnauthorized: false },
    });
  }
  return aivenPool;
}

/** Infos debug 100 % sérialisables (pour affichage dans la réponse API / Network). */
export function getDatabaseDebugInfo(): { envSource: string; urlPresent: boolean } {
  const url =
    process.env.AIVEN_DATABASE_URL ??
    process.env.shvb_AIVEN_DATABASE_URL ??
    process.env.DATABASE_URL ??
    process.env.shvb_DATABASE_URL;
  const envSource = process.env.AIVEN_DATABASE_URL ? 'AIVEN_DATABASE_URL' : process.env.shvb_AIVEN_DATABASE_URL ? 'shvb_AIVEN_DATABASE_URL' : process.env.DATABASE_URL ? 'DATABASE_URL' : process.env.shvb_DATABASE_URL ? 'shvb_DATABASE_URL' : 'none';
  return { envSource, urlPresent: !!(url && typeof url === 'string' && url.trim()) };
}

/**
 * Retourne une fonction "tag" sql pour Aiven (pg, PostgreSQL standard, SSL).
 * Lit AIVEN_DATABASE_URL ou shvb_AIVEN_DATABASE_URL ; en fallback DATABASE_URL ou shvb_DATABASE_URL (ancienne config).
 */
export function getSql(): SqlTag | null {
  const pool = getAivenPool();
  console.log('[Aiven] getSql: pool=', !!pool);
  if (!pool) return null;
  return async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const { text, values: params } = buildQuery(strings, values);
    console.log('[Aiven] query: text (first 80 chars)=', text.slice(0, 80));
    try {
      const result = await pool.query(text, params);
      console.log('[Aiven] query ok, rowCount=', result?.rowCount ?? result?.rows?.length ?? 0);
      return toPlainRows(result.rows);
    } catch (queryErr: unknown) {
      const qMsg = String((queryErr as Error)?.message);
      console.error('[Aiven] query error:', qMsg);
      throw queryErr;
    }
  };
}
