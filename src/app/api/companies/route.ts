import { NextRequest, NextResponse } from 'next/server';
import { pool, query, queryOne } from '@/lib/db';
import { getAuthFromRequest, isSuperAdmin, getCompanyFromAuth, hashPassword } from '@/lib/auth';
import { Company } from '@/types/scheduling';

// ============================================================
// GET /api/companies
// - Super admin: Get all companies
// - Regular user: Get their company info
// ============================================================
export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Super admin - get all companies
    if (isSuperAdmin(auth)) {
      const companies = await query<Company>(
        `SELECT id, name, slug, subdomain, plan, status, max_stores, max_employees,
                trial_ends_at, settings, created_at, updated_at
         FROM companies
         ORDER BY created_at DESC`
      );

      return NextResponse.json({ companies });
    }

    // Regular user - get their company only
    const companyId = getCompanyFromAuth(auth);
    if (!companyId) {
      return NextResponse.json({ error: 'No company associated with user' }, { status: 400 });
    }

    const company = await queryOne<Company>(
      `SELECT id, name, slug, subdomain, plan, status, max_stores, max_employees,
              trial_ends_at, settings, created_at, updated_at
       FROM companies
       WHERE id = $1`,
      [companyId]
    );

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    return NextResponse.json({ company });
  } catch (error) {
    console.error('GET /api/companies error:', error);
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 });
  }
}

// ============================================================
// POST /api/companies
// Create a new company (public endpoint for registration)
// ============================================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { companyName, adminName, adminEmail, adminPassword, storeName } = body;

    // Validate required fields
    if (!companyName || !adminName || !adminEmail || !adminPassword) {
      return NextResponse.json(
        { error: 'Company name, admin name, email, and password are required' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await queryOne(
      'SELECT id FROM users WHERE email = $1',
      [adminEmail.toLowerCase().trim()]
    );

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Generate slug from company name
    const slug = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Check if slug already exists
    const existingCompany = await queryOne(
      'SELECT id FROM companies WHERE slug = $1',
      [slug]
    );

    if (existingCompany) {
      return NextResponse.json(
        { error: 'Company name already taken. Please choose a different name.' },
        { status: 409 }
      );
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Create company (14-day trial)
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      const companyResult = await client.query<{ id: string }>(
        `INSERT INTO companies (name, slug, plan, status, max_stores, max_employees, trial_ends_at, settings)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          companyName,
          slug,
          'free',
          'trial',
          1, // free plan: 1 store
          5, // free plan: 5 employees
          trialEndsAt.toISOString(),
          JSON.stringify({}),
        ]
      );

      const companyId = companyResult.rows[0].id;

      // 2. Create admin user
      const passwordHash = await hashPassword(adminPassword);

      const userResult = await client.query<{ id: string }>(
        `INSERT INTO users (company_id, name, email, password_hash, role, active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [companyId, adminName, adminEmail.toLowerCase().trim(), passwordHash, 'admin', true]
      );

      const adminUserId = userResult.rows[0].id;

      // 3. Create first store (if provided)
      let storeId: string | null = null;
      if (storeName) {
        const storeCode = storeName
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, '')
          .substring(0, 10);

        const storeResult = await client.query<{ id: string }>(
          `INSERT INTO stores (company_id, name, code, active)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [companyId, storeName, storeCode, true]
        );

        storeId = storeResult.rows[0].id;

        // Assign admin to first store
        await client.query(
          'UPDATE users SET store_id = $1 WHERE id = $2',
          [storeId, adminUserId]
        );
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        company: {
          id: companyId,
          name: companyName,
          slug,
        },
        admin: {
          id: adminUserId,
          email: adminEmail.toLowerCase().trim(),
        },
        store: storeId ? { id: storeId } : null,
        message: 'Company created successfully! You can now log in.',
      }, { status: 201 });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('POST /api/companies error:', error);
    return NextResponse.json(
      { error: 'Failed to create company. Please try again.' },
      { status: 500 }
    );
  }
}

// ============================================================
// PATCH /api/companies/:id
// Update company settings (admin or super_admin only)
// ============================================================
export async function PATCH(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
    }

    const { companyId, name, plan, status, maxStores, maxEmployees } = body;

    // Check permissions
    const userCompanyId = getCompanyFromAuth(auth);
    const isSuper = isSuperAdmin(auth);

    // Only super admin or company admin can update
    if (!isSuper && userCompanyId !== companyId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Regular admins can only update name, super admin can update everything
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name);
    }

    // Only super admin can change plan, status, limits
    if (isSuper) {
      if (plan !== undefined) {
        updates.push(`plan = $${paramIndex++}`);
        params.push(plan);
      }
      if (status !== undefined) {
        updates.push(`status = $${paramIndex++}`);
        params.push(status);
      }
      if (maxStores !== undefined) {
        updates.push(`max_stores = $${paramIndex++}`);
        params.push(maxStores);
      }
      if (maxEmployees !== undefined) {
        updates.push(`max_employees = $${paramIndex++}`);
        params.push(maxEmployees);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    updates.push(`updated_at = NOW()`);
    params.push(companyId);

    const result = await query(
      `UPDATE companies
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    if (result.length === 0) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    return NextResponse.json({ company: result[0] });

  } catch (error) {
    console.error('PATCH /api/companies error:', error);
    return NextResponse.json({ error: 'Failed to update company' }, { status: 500 });
  }
}

// ============================================================
// DELETE /api/companies/:id
// Suspend/delete company (super_admin only)
// ============================================================
export async function DELETE(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth || !isSuperAdmin(auth)) {
    return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('id');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
    }

    // Soft delete: mark as suspended
    const result = await query(
      `UPDATE companies
       SET status = 'suspended', updated_at = NOW()
       WHERE id = $1
       RETURNING id, name`,
      [companyId]
    );

    if (result.length === 0) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Company "${result[0].name}" has been suspended`,
    });

  } catch (error) {
    console.error('DELETE /api/companies error:', error);
    return NextResponse.json({ error: 'Failed to suspend company' }, { status: 500 });
  }
}
