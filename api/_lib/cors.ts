import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOW_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://shvb-gen1.vercel.app',
];

function getOrigin(req: VercelRequest): string {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && ALLOW_ORIGINS.includes(origin)) return origin;
  return ALLOW_ORIGINS[0];
}

export function withCors(
  req: VercelRequest,
  res: VercelResponse,
  handler: () => void | Promise<void>
): void | Promise<void> {
  const origin = getOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  return Promise.resolve(handler()).catch((err) => {
    console.error('[API]', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err?.message || 'Internal error', code: 'INTERNAL' });
    }
  });
}

export function jsonResponse(res: VercelResponse, status: number, data: unknown): void {
  res.status(status).json(data);
}
