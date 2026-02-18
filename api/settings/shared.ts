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
    console.error('[API]', err);
    if (!res.headersSent) res.status(500).json({ error: (err as Error)?.message || 'Internal error', code: 'INTERNAL' });
  });
}

/** Réponse JSON avec payload forcé sérialisable (évite XrayWrapper / cross-origin sur Vercel). */
export function jsonResponse(res: VercelResponse, status: number, data: unknown): void {
  try {
    const payload = JSON.parse(JSON.stringify(data));
    res.status(status).json(payload);
  } catch {
    res.status(status).json(data);
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
  const url = process.env.AIVEN_DATABASE_URL ?? process.env.shvb_AIVEN_DATABASE_URL;
  if (!url || typeof url !== 'string' || !url.trim()) return null;
  if (!aivenPool) {
    aivenPool = new Pool({
      connectionString: url,
      // Aiven utilise un certificat que Node ne truste pas par défaut en serverless ; connexion toujours chiffrée (TLS).
      ssl: { rejectUnauthorized: false },
    });
  }
  return aivenPool;
}

/**
 * Retourne une fonction "tag" sql pour Aiven (pg, PostgreSQL standard, SSL).
 * Retourne null si AIVEN_DATABASE_URL / shvb_AIVEN_DATABASE_URL est absent.
 */
export function getSql(): SqlTag | null {
  const pool = getAivenPool();
  if (!pool) return null;
  return async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const { text, values: params } = buildQuery(strings, values);
    const result = await pool.query(text, params);
    return toPlainRows(result.rows);
  };
}
