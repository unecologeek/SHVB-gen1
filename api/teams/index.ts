import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withCors, jsonResponse, getSql, getDatabaseDebugInfo, type TeamRow } from './shared.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // #region agent log
  try { console.log('[DEBUG] api/teams handler entry', { method: req.method }); } catch (_) {}
  // #endregion
  return withCors(req, res, async () => {
    try {
      console.log('[api/teams] GET: getSql()...');
      const sql = getSql();
      if (!sql) {
        const debug = getDatabaseDebugInfo();
        console.log('[api/teams] getSql()=null → 503', debug);
        jsonResponse(res, 503, { error: 'Database not configured', code: 'NO_DATABASE', debug });
        return;
      }
      console.log('[api/teams] getSql() ok, running SELECT teams...');

      if (req.method === 'GET') {
        const noLogos = req.query?.no_logos === '1' || req.query?.no_logos === 'true';
        const rows = noLogos
          ? ((await sql`SELECT id, name, is_local FROM teams ORDER BY name`) as Pick<TeamRow, 'id' | 'name' | 'is_local'>[])
          : ((await sql`SELECT id, name, logo, is_local FROM teams ORDER BY name`) as TeamRow[]);
        console.log('[api/teams] SELECT ok, rows=', rows?.length ?? 0, 'no_logos=', noLogos);
        const data = rows.map((r) => ({
          id: String(r.id),
          name: r.name,
          logo: noLogos || !('logo' in r) ? '' : (r as TeamRow).logo ?? '',
          is_local: Boolean(r.is_local),
        }));
        console.log('[api/teams] sending 200 data.length=', data.length);
        jsonResponse(res, 200, { data });
        return;
      }

      if (req.method === 'POST') {
        const body = req.body as { name?: string; logo?: string; is_local?: boolean };
        const name = typeof body?.name === 'string' ? body.name.trim() : '';
        if (!name) {
          jsonResponse(res, 400, { error: 'name is required', code: 'VALIDATION' });
          return;
        }
        const logo = typeof body?.logo === 'string' ? body.logo : '';
        const is_local = Boolean(body?.is_local);

        const insertResult = (await sql`
          INSERT INTO teams (name, logo, is_local)
          VALUES (${name}, ${logo}, ${is_local})
          RETURNING id, name, logo, is_local
        `) as TeamRow[];
        const row = insertResult[0];
        const data = {
          id: String(row.id),
          name: row.name,
          logo: row.logo ?? '',
          is_local: Boolean(row.is_local),
        };
        jsonResponse(res, 201, { data });
        return;
      }

      jsonResponse(res, 405, { error: 'Method not allowed', code: 'METHOD' });
    } catch (err) {
      const msg = String((err as Error)?.message || 'Internal error');
      console.error('[api/teams] catch:', msg, err);
      if (!res.headersSent) {
        const debug = getDatabaseDebugInfo();
        jsonResponse(res, 500, { error: msg, code: 'INTERNAL', debug: { ...debug, step: 'catch' } });
      }
    }
  });
}
