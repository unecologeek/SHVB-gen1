import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

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

export function getSql(): ReturnType<typeof neon> | null {
  const url = process.env.shvb_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url || typeof url !== 'string' || !url.trim()) return null;
  return neon(url);
}
