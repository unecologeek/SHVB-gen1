import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
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
    console.error('[API]', err);
    if (!res.headersSent) res.status(500).json({ error: (err as Error)?.message || 'Internal error', code: 'INTERNAL' });
  });
}

export function jsonResponse(res: VercelResponse, status: number, data: unknown): void {
  res.status(status).json(data);
}

export type PostgresSource = 'neon' | 'aiven';

/** Convertit des lignes BDD en objets sérialisables (évite XrayWrapper / cross-origin sur Vercel). */
function toPlainRows(rows: unknown[]): Record<string, unknown>[] {
  return rows.map((r) => (typeof r === 'object' && r !== null && !Array.isArray(r) ? { ...(r as Record<string, unknown>) } : r as Record<string, unknown>));
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
  const url = process.env.AIVEN_DATABASE_URL ?? process.env.shvb_AIVEN_DATABASE_URL;
  if (!url || typeof url !== 'string' || !url.trim()) return null;
  if (!aivenPool) {
    aivenPool = new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: true },
    });
  }
  return aivenPool;
}

/**
 * Retourne une fonction "tag" sql pour Neon ou Aiven.
 * - Neon : @neondatabase/serverless (protocole Neon).
 * - Aiven : pg (PostgreSQL standard, SSL). Réponses toujours en objets sérialisables.
 */
export function getSql(source: PostgresSource = 'neon'): SqlTag | null {
  if (source === 'aiven') {
    const pool = getAivenPool();
    if (!pool) return null;
    return async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const { text, values: params } = buildQuery(strings, values);
      const result = await pool.query(text, params);
      return toPlainRows(result.rows);
    };
  }
  const url = process.env.shvb_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url || typeof url !== 'string' || !url.trim()) return null;
  const neonSql = neon(url);
  return async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const rows = await neonSql(strings as unknown as TemplateStringsArray, ...values);
    return toPlainRows(rows as unknown[]);
  };
}
