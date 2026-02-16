import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withCors, jsonResponse } from '../_lib/cors';
import { getSql } from '../_lib/db';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const id = (req.query?.id as string)?.trim();
  if (!id) {
    return withCors(req, res, () => {
      jsonResponse(res, 400, { error: 'id required', code: 'VALIDATION' });
    });
  }

  return withCors(req, res, async () => {
    try {
      const sql = getSql();
      if (!sql) {
        jsonResponse(res, 503, { error: 'Database not configured', code: 'NO_DATABASE' });
        return;
      }

      if (req.method === 'GET') {
        const rows = await sql`SELECT id, name, logo, is_local FROM teams WHERE id = ${id}::uuid`;
        const row = rows[0];
        if (!row) {
          jsonResponse(res, 404, { error: 'Team not found', code: 'NOT_FOUND' });
          return;
        }
        const data = {
          id: String((row as { id: string }).id),
          name: (row as { name: string }).name,
          logo: (row as { logo: string }).logo ?? '',
          is_local: Boolean((row as { is_local: boolean }).is_local),
        };
        jsonResponse(res, 200, { data });
        return;
      }

      if (req.method === 'PATCH') {
        const body = (req.body as Record<string, unknown>) ?? {};
        const rows = await sql`SELECT id, name, logo, is_local FROM teams WHERE id = ${id}::uuid`;
        const current = rows[0];
        if (!current) {
          jsonResponse(res, 404, { error: 'Team not found', code: 'NOT_FOUND' });
          return;
        }
        const c = current as { name: string; logo: string; is_local: boolean };
        const name = body.name !== undefined ? String(body.name).trim() : c.name;
        const logo = body.logo !== undefined ? String(body.logo) : c.logo;
        const is_local = body.is_local !== undefined ? Boolean(body.is_local) : c.is_local;
        const updated = await sql`
          UPDATE teams SET name = ${name}, logo = ${logo}, is_local = ${is_local}
          WHERE id = ${id}::uuid
          RETURNING id, name, logo, is_local
        `;
        const r = updated[0];
        if (!r) {
          jsonResponse(res, 404, { error: 'Team not found', code: 'NOT_FOUND' });
          return;
        }
        const data = {
          id: String((r as { id: string }).id),
          name: (r as { name: string }).name,
          logo: (r as { logo: string }).logo ?? '',
          is_local: Boolean((r as { is_local: boolean }).is_local),
        };
        jsonResponse(res, 200, { data });
        return;
      }

      if (req.method === 'DELETE') {
        const result = await sql`DELETE FROM teams WHERE id = ${id}::uuid RETURNING id`;
        if (result.length === 0) {
          jsonResponse(res, 404, { error: 'Team not found', code: 'NOT_FOUND' });
          return;
        }
        res.status(204).end();
        return;
      }

      res.status(405).json({ error: 'Method not allowed', code: 'METHOD' });
    } catch (err) {
      console.error('[api/teams/[id]]', err);
      if (!res.headersSent) {
        jsonResponse(res, 500, { error: (err as Error)?.message || 'Internal error', code: 'INTERNAL' });
      }
    }
  });
}
