import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withCors, jsonResponse } from '../../lib/vercel-api/cors';
import { getSql, type TeamRow } from '../../lib/vercel-api/db';

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
        const rows = (await sql`SELECT id, name, logo, is_local FROM teams WHERE id = ${id}::uuid`) as TeamRow[];
        const row = rows[0];
        if (!row) {
          jsonResponse(res, 404, { error: 'Team not found', code: 'NOT_FOUND' });
          return;
        }
        const data = {
          id: String(row.id),
          name: row.name,
          logo: row.logo ?? '',
          is_local: Boolean(row.is_local),
        };
        jsonResponse(res, 200, { data });
        return;
      }

      if (req.method === 'PATCH') {
        const body = (req.body as Record<string, unknown>) ?? {};
        const rows = (await sql`SELECT id, name, logo, is_local FROM teams WHERE id = ${id}::uuid`) as TeamRow[];
        const current = rows[0];
        if (!current) {
          jsonResponse(res, 404, { error: 'Team not found', code: 'NOT_FOUND' });
          return;
        }
        const name = body.name !== undefined ? String(body.name).trim() : current.name;
        const logo = body.logo !== undefined ? String(body.logo) : current.logo;
        const is_local = body.is_local !== undefined ? Boolean(body.is_local) : current.is_local;
        const updated = (await sql`
          UPDATE teams SET name = ${name}, logo = ${logo}, is_local = ${is_local}
          WHERE id = ${id}::uuid
          RETURNING id, name, logo, is_local
        `) as TeamRow[];
        const r = updated[0];
        if (!r) {
          jsonResponse(res, 404, { error: 'Team not found', code: 'NOT_FOUND' });
          return;
        }
        const data = {
          id: String(r.id),
          name: r.name,
          logo: r.logo ?? '',
          is_local: Boolean(r.is_local),
        };
        jsonResponse(res, 200, { data });
        return;
      }

      if (req.method === 'DELETE') {
        const result = (await sql`DELETE FROM teams WHERE id = ${id}::uuid RETURNING id`) as TeamRow[];
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
