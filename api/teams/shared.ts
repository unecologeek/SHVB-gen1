import type { VercelRequest, VercelResponse } from '@vercel/node';
import { jsonResponse } from '../settings/shared.js';

export type TeamRow = { id: string; name: string; logo: string; is_local: boolean };

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

export { getSql, jsonResponse } from '../settings/shared.js';
