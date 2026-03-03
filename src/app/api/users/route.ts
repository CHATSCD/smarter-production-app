import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { withAuth, apiOk, apiError, parseBody } from '@/lib/apiMiddleware';
import { hashPassword, getCompanyFromAuth } from '@/lib/auth';

// GET /api/users
export const GET = withAuth(async (req, auth) => {
  // Get company_id for filtering (null for super_admin)
  const companyId = getCompanyFromAuth(auth);

  // Super admin sees all users, regular users see only their company
  const whereClause = companyId ? 'WHERE company_id = $1' : '';
  const params = companyId ? [companyId] : [];

  const users = await query(
    `SELECT id, name, email, role, company_id, store_id, active, created_at
     FROM users ${whereClause} ORDER BY name`,
    params
  );
  return apiOk({ users });
}, 'admin', 'manager');

// POST /api/users — admin only
export const POST = withAuth(async (req, auth) => {
  const body = await parseBody<{
    name: string; email: string; password: string;
    role: 'admin' | 'manager' | 'employee'; storeId?: string;
  }>(req);
  if (!body?.name || !body?.email || !body?.password || !body?.role) {
    return apiError('name, email, password, role required');
  }

  // Get company_id from auth (required for INSERT)
  const companyId = auth.companyId;
  if (!companyId) {
    return apiError('User must be associated with a company', 400);
  }

  const existing = await queryOne('SELECT id FROM users WHERE email = $1', [body.email]);
  if (existing) return apiError('Email already in use', 409);

  // Check company employee limit
  const userCount = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM users WHERE company_id = $1 AND active = true',
    [companyId]
  );

  const company = await queryOne<{ max_employees: number }>(
    'SELECT max_employees FROM companies WHERE id = $1',
    [companyId]
  );

  if (
    company &&
    userCount &&
    parseInt(userCount.count) >= company.max_employees
  ) {
    return apiError(
      `Employee limit reached (${company.max_employees} employees). Upgrade your plan to add more.`,
      403
    );
  }

  const hash = await hashPassword(body.password);
  const user = await queryOne(
    `INSERT INTO users (company_id, name, email, password_hash, role, store_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, company_id, store_id, created_at`,
    [companyId, body.name, body.email.toLowerCase().trim(), hash, body.role, body.storeId || auth.storeId]
  );

  return apiOk({ user }, 201);
}, 'admin');
