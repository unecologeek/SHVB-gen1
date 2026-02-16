import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withCors, jsonResponse } from '../../lib/vercel-api/cors';
import { getSql } from '../../lib/vercel-api/db';

export default function handler(req: VercelRequest, res: VercelResponse) {
  return withCors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed', code: 'METHOD' });
        return;
      }
      const body = req.body as { id?: string };
      const id = typeof body?.id === 'string' ? body.id.trim() : '';
      if (!id) {
        jsonResponse(res, 400, { error: 'id is required', code: 'VALIDATION' });
        return;
      }

      const sql = getSql();
      if (!sql) {
        jsonResponse(res, 503, { error: 'Database not configured', code: 'NO_DATABASE' });
        return;
      }
      await sql`UPDATE teams SET is_local = false WHERE is_local = true`;
      const rows = await sql`
        UPDATE teams SET is_local = true WHERE id = ${id}::uuid
        RETURNING id, name, logo, is_local
      `;
      if (rows.length === 0) {
        jsonResponse(res, 404, { error: 'Team not found', code: 'NOT_FOUND' });
        return;
      }
      res.status(204).end();
    } catch (err) {
      console.error('[api/teams/set-local]', err);
      if (!res.headersSent) {
        jsonResponse(res, 500, { error: (err as Error)?.message || 'Internal error', code: 'INTERNAL' });
      }
    }
  });
}
