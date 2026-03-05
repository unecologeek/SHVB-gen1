import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withCors, jsonResponse, getSql } from './settings/shared.js';

/** Health check léger : une requête SQL minimale pour vérifier la connexion sans charger de données. */
export default function handler(req: VercelRequest, res: VercelResponse) {
  return withCors(req, res, async () => {
    if (req.method !== 'GET') {
      jsonResponse(res, 405, { error: 'Method not allowed', code: 'METHOD' });
      return;
    }
    const sql = getSql();
    if (!sql) {
      jsonResponse(res, 503, { error: 'Database not configured', code: 'NO_DATABASE' });
      return;
    }
    try {
      await sql`SELECT 1`;
      jsonResponse(res, 200, { ok: true });
    } catch (err) {
      const msg = String((err as Error)?.message || 'Internal error');
      console.error('[api/health]', msg, err);
      jsonResponse(res, 500, { error: msg, code: 'INTERNAL' });
    }
  });
}
