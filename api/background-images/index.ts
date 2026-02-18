import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withCors, jsonResponse, getSql } from '../settings/shared.js';

type BgType = 'results' | 'preview' | 'victory';

/** GET : retourne les 3 images de fond en une seule requête (1 connexion DB). */
export default function handler(req: VercelRequest, res: VercelResponse) {
  return withCors(req, res, async () => {
    try {
      if (req.method !== 'GET') {
        jsonResponse(res, 405, { error: 'Method not allowed', code: 'METHOD' });
        return;
      }

      const sql = getSql();
      if (!sql) {
        jsonResponse(res, 503, { error: 'Database not configured', code: 'NO_DATABASE' });
        return;
      }

      const rows = (await sql`
        SELECT type, image_data
        FROM background_images
        WHERE type IN ('results', 'preview', 'victory')
      `) as { type: string; image_data: string | null }[];

      const data: Record<BgType, string | null> = {
        results: null,
        preview: null,
        victory: null
      };
      for (const row of rows) {
        const t = row.type as BgType;
        if (t in data) {
          data[t] = typeof row.image_data === 'string' ? row.image_data : null;
        }
      }

      jsonResponse(res, 200, { data });
    } catch (err) {
      console.error('[api/background-images]', err);
      if (!res.headersSent) {
        const msg = (err as Error)?.message || 'Internal error';
        jsonResponse(res, 500, { error: String(msg), code: 'INTERNAL' });
      }
    }
  });
}
