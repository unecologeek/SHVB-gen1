import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withCors, jsonResponse, getSql } from '../settings/shared.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  return withCors(req, res, async () => {
    try {
      const db = (req.query as { db?: string })?.db === 'aiven' ? 'aiven' : 'neon';
      const sql = getSql(db);
      if (!sql) {
        jsonResponse(res, 503, { error: 'Database not configured', code: 'NO_DATABASE' });
        return;
      }

      const { type } = req.query;

      if (!type || typeof type !== 'string' || !['results', 'preview', 'victory'].includes(type)) {
        jsonResponse(res, 400, { error: 'Type invalide. Doit être: results, preview ou victory', code: 'INVALID_TYPE' });
        return;
      }

      if (req.method === 'GET') {
        const rows = (await sql`SELECT image_data FROM background_images WHERE type = ${type} LIMIT 1`) as Record<string, unknown>[];
        
        if (rows.length === 0) {
          jsonResponse(res, 404, { error: 'Image non trouvée', code: 'NOT_FOUND' });
          return;
        }

        jsonResponse(res, 200, { data: rows[0].image_data });
        return;
      }

      if (req.method === 'PUT') {
        const body = (req.body as Record<string, unknown>) ?? {};
        const image_data = body.image_data;

        if (!image_data || typeof image_data !== 'string') {
          jsonResponse(res, 400, { error: 'image_data est requis (string)', code: 'INVALID_DATA' });
          return;
        }

        await sql`
          INSERT INTO background_images (type, image_data, updated_at)
          VALUES (${type}, ${image_data}, now())
          ON CONFLICT (type) DO UPDATE SET image_data = ${image_data}, updated_at = now()
        `;

        jsonResponse(res, 200, { success: true });
        return;
      }

      jsonResponse(res, 405, { error: 'Méthode non autorisée', code: 'METHOD' });
    } catch (err) {
      console.error('[api/background-images]', err);
      if (!res.headersSent) {
        jsonResponse(res, 500, { error: (err as Error)?.message || 'Internal error', code: 'INTERNAL' });
      }
    }
  });
}
