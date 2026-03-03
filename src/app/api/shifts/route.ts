import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { withAuth, apiOk, apiError, parseBody } from '@/lib/apiMiddleware';
import { getCompanyFromAuth } from '@/lib/auth';

// GET /api/shifts?date=YYYY-MM-DD&storeId=...
export const GET = withAuth(async (req, auth) => {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const storeId = auth.role === 'admin' ? (searchParams.get('storeId') || auth.storeId) : auth.storeId;
  const weekStart = searchParams.get('weekStart');
  const weekEnd = searchParams.get('weekEnd');

  // Get company_id for filtering (null for super_admin)
  const companyId = getCompanyFromAuth(auth);

  let q = `
    SELECT s.*,
      u.name AS assigned_name,
      u.email AS assigned_email,
      cu.name AS claimed_name
    FROM shifts s
    LEFT JOIN users u ON u.id = s.assigned_user_id
    LEFT JOIN users cu ON cu.id = s.claimed_by
    WHERE s.store_id = $1
  `;
  const params: unknown[] = [storeId];

  // Add company filter (unless super_admin)
  if (companyId) {
    params.push(companyId);
    q += ` AND s.company_id = $${params.length}`;
  }

  if (date) {
    params.push(date);
    q += ` AND s.date = $${params.length}`;
  } else if (weekStart) {
    params.push(weekStart);
    q += ` AND s.date >= $${params.length}`;
    if (weekEnd) {
      params.push(weekEnd);
      q += ` AND s.date <= $${params.length}`;
    } else {
      // Default to 35 days (5 weeks) so the calendar can navigate forward
      params.push(weekStart);
      q += ` AND s.date < ($${params.length}::date + interval '35 days')`;
    }
  }

  // Employees only see own shifts + unassigned
  if (auth.role === 'employee') {
    q += ` AND (s.assigned_user_id = '${auth.userId}' OR s.status = 'unassigned')`;
  }

  q += ' ORDER BY s.date, s.start_time';
  const shifts = await query(q, params);
  return apiOk({ shifts });
}, 'admin', 'manager', 'employee');

// POST /api/shifts
export const POST = withAuth(async (req, auth) => {
  const body = await parseBody<{
    date: string; startTime: string; endTime: string;
    roleRequired?: string; station?: string; notes?: string;
    approvalRequired?: boolean; eventFlag?: boolean; eventNote?: string;
  }>(req);

  if (!body?.date || !body?.startTime || !body?.endTime) {
    return apiError('date, startTime, endTime required');
  }

  const settings = await queryOne<{ require_approval: boolean }>(
    'SELECT require_approval FROM scheduling_settings WHERE store_id = $1',
    [auth.storeId]
  );

  // Get company_id from auth (required for INSERT)
  const companyId = auth.companyId;
  if (!companyId) {
    return apiError('User must be associated with a company', 400);
  }

  const shift = await queryOne(
    `INSERT INTO shifts
      (company_id, store_id, date, start_time, end_time, role_required, station, notes,
       approval_required, event_flag, event_note, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      companyId, auth.storeId, body.date, body.startTime, body.endTime,
      body.roleRequired || null, body.station || null, body.notes || null,
      body.approvalRequired ?? settings?.require_approval ?? true,
      body.eventFlag ?? false, body.eventNote || null,
      auth.userId,
    ]
  );

  return apiOk({ shift }, 201);
}, 'admin', 'manager');
