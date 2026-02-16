import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withCors, jsonResponse } from '../../lib/vercel-api/cors';
import { getSql } from '../../lib/vercel-api/db';

export default function handler(req: VercelRequest, res: VercelResponse) {
  return withCors(req, res, async () => {
    try {
      const sql = getSql();
      if (!sql) {
        jsonResponse(res, 503, { error: 'Database not configured', code: 'NO_DATABASE' });
        return;
      }

      if (req.method === 'GET') {
        const rows = (await sql`SELECT * FROM settings WHERE id = 1`) as Record<string, unknown>[];
        const row = rows[0];
        if (!row) {
          res.status(404).json({ error: 'Settings not found', code: 'NOT_FOUND' });
          return;
        }
        const r = row as Record<string, unknown>;
        const data = {
          id: r.id,
          title: r.title,
          subtitle: r.subtitle,
          results_bg: r.results_bg,
          preview_bg: r.preview_bg,
          victory_bg: r.victory_bg,
          main_color: r.main_color,
          visual_type: r.visual_type,
          category: r.category,
          match_date: r.match_date,
          location: r.location,
        };
        jsonResponse(res, 200, { data });
        return;
      }

      if (req.method === 'PATCH') {
        const body = (req.body as Record<string, unknown>) ?? {};
        let rows = (await sql`SELECT * FROM settings WHERE id = 1`) as Record<string, unknown>[];
        let row = rows[0];
        if (!row) {
          await sql`
            INSERT INTO settings (id, title, subtitle, results_bg, preview_bg, victory_bg, main_color, visual_type, category, match_date, location)
            VALUES (1, ${(body.title as string) ?? null}, ${(body.subtitle as string) ?? null}, ${(body.results_bg as string) ?? null}, ${(body.preview_bg as string) ?? null}, ${(body.victory_bg as string) ?? null}, ${(body.main_color as string) ?? null}, ${(body.visual_type as string) ?? null}, ${(body.category as string) ?? null}, ${(body.match_date as string) ?? null}, ${(body.location as string) ?? null})
          `;
        } else {
          const title = (body.title as string) ?? (row.title as string) ?? null;
          const subtitle = (body.subtitle as string) ?? (row.subtitle as string) ?? null;
          const results_bg = (body.results_bg as string) ?? (row.results_bg as string) ?? null;
          const preview_bg = (body.preview_bg as string) ?? (row.preview_bg as string) ?? null;
          const victory_bg = (body.victory_bg as string) ?? (row.victory_bg as string) ?? null;
          const main_color = (body.main_color as string) ?? (row.main_color as string) ?? null;
          const visual_type = (body.visual_type as string) ?? (row.visual_type as string) ?? null;
          const category = (body.category as string) ?? (row.category as string) ?? null;
          const match_date = (body.match_date as string) ?? (row.match_date as string) ?? null;
          const location = (body.location as string) ?? (row.location as string) ?? null;
          await sql`
            UPDATE settings SET title = ${title}, subtitle = ${subtitle}, results_bg = ${results_bg}, preview_bg = ${preview_bg}, victory_bg = ${victory_bg}, main_color = ${main_color}, visual_type = ${visual_type}, category = ${category}, match_date = ${match_date}, location = ${location}, updated_at = now() WHERE id = 1
          `;
        }
        rows = (await sql`SELECT id, title, subtitle, results_bg, preview_bg, victory_bg, main_color, visual_type, category, match_date, location FROM settings WHERE id = 1`) as Record<string, unknown>[];
        row = rows[0];
        const data = {
          id: row.id,
          title: row.title,
          subtitle: row.subtitle,
          results_bg: row.results_bg,
          preview_bg: row.preview_bg,
          victory_bg: row.victory_bg,
          main_color: row.main_color,
          visual_type: row.visual_type,
          category: row.category,
          match_date: row.match_date,
          location: row.location,
        };
        jsonResponse(res, 200, { data });
        return;
      }

      res.status(405).json({ error: 'Method not allowed', code: 'METHOD' });
    } catch (err) {
      console.error('[api/settings]', err);
      if (!res.headersSent) {
        jsonResponse(res, 500, { error: (err as Error)?.message || 'Internal error', code: 'INTERNAL' });
      }
    }
  });
}
