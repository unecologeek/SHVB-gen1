import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withCors, jsonResponse } from '../_lib/cors';
import { getSql } from '../_lib/db';

export default function handler(req: VercelRequest, res: VercelResponse) {
  withCors(req, res, async () => {
    if (req.method === 'GET') {
      const sql = getSql();
      const rows = await sql`SELECT id, name, logo, is_local FROM teams ORDER BY name`;
      const data = rows.map((r: { id: string; name: string; logo: string; is_local: boolean }) => ({
        id: String(r.id),
        name: r.name,
        logo: r.logo ?? '',
        is_local: Boolean(r.is_local),
      }));
      return jsonResponse(res, 200, { data });
    }

    if (req.method === 'POST') {
      const body = req.body as { name?: string; logo?: string; is_local?: boolean };
      const name = typeof body?.name === 'string' ? body.name.trim() : '';
      if (!name) {
        return jsonResponse(res, 400, { error: 'name is required', code: 'VALIDATION' });
      }
      const logo = typeof body?.logo === 'string' ? body.logo : '';
      const is_local = Boolean(body?.is_local);

      const sql = getSql();
      const [row] = await sql`
        INSERT INTO teams (name, logo, is_local)
        VALUES (${name}, ${logo}, ${is_local})
        RETURNING id, name, logo, is_local
      `;
      const data = {
        id: String((row as { id: string }).id),
        name: (row as { name: string }).name,
        logo: (row as { logo: string }).logo ?? '',
        is_local: Boolean((row as { is_local: boolean }).is_local),
      };
      return jsonResponse(res, 201, { data });
    }

    res.status(405).json({ error: 'Method not allowed', code: 'METHOD' });
  });
}
