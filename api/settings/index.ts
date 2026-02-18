import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withCors, jsonResponse, getSql } from './shared.js';

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
        const allowed = ['title', 'subtitle', 'main_color', 'visual_type', 'category', 'match_date', 'location'] as const;
        const updates = allowed.filter((k) => body[k] !== undefined);
        if (updates.length === 0) {
          const rows = (await sql`SELECT id, title, subtitle, main_color, visual_type, category, match_date, location FROM settings WHERE id = 1`) as Record<string, unknown>[];
          const row = rows[0];
          if (!row) return jsonResponse(res, 404, { error: 'Settings not found', code: 'NOT_FOUND' });
          return jsonResponse(res, 200, { data: row });
        }
        let rows = (await sql`SELECT id FROM settings WHERE id = 1`) as Record<string, unknown>[];
        if (!rows[0]) {
          await sql`
            INSERT INTO settings (id, title, subtitle, main_color, visual_type, category, match_date, location)
            VALUES (1, ${(body.title as string) ?? null}, ${(body.subtitle as string) ?? null}, ${(body.main_color as string) ?? null}, ${(body.visual_type as string) ?? null}, ${(body.category as string) ?? null}, ${(body.match_date as string) ?? null}, ${(body.location as string) ?? null})
          `;
        } else {
          if (body.title !== undefined) await sql`UPDATE settings SET title = ${body.title as string}, updated_at = now() WHERE id = 1`;
          if (body.subtitle !== undefined) await sql`UPDATE settings SET subtitle = ${body.subtitle as string}, updated_at = now() WHERE id = 1`;
          if (body.main_color !== undefined) await sql`UPDATE settings SET main_color = ${body.main_color as string}, updated_at = now() WHERE id = 1`;
          if (body.visual_type !== undefined) await sql`UPDATE settings SET visual_type = ${body.visual_type as string}, updated_at = now() WHERE id = 1`;
          if (body.category !== undefined) await sql`UPDATE settings SET category = ${body.category as string}, updated_at = now() WHERE id = 1`;
          if (body.match_date !== undefined) await sql`UPDATE settings SET match_date = ${body.match_date as string}, updated_at = now() WHERE id = 1`;
          if (body.location !== undefined) await sql`UPDATE settings SET location = ${body.location as string}, updated_at = now() WHERE id = 1`;
        }
        rows = (await sql`SELECT id, title, subtitle, main_color, visual_type, category, match_date, location FROM settings WHERE id = 1`) as Record<string, unknown>[];
        const row = rows[0];
        jsonResponse(res, 200, { data: row });
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
