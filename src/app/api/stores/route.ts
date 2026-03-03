import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getAuthFromRequest, getCompanyFromAuth, isSuperAdmin } from '@/lib/auth';
import { buildCompanyFilter, getCompanyForInsert } from '@/lib/db-helpers';
import { Store } from '@/types/scheduling';

// ============================================================
// GET /api/stores
// Get all stores for user's company (or all for super admin)
// ============================================================
export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { clause, param } = buildCompanyFilter(auth, 1);
    const params = param ? [param] : [];

    const stores = await query<Store>(
      `SELECT id, company_id, name, code, address, phone, active, created_at
       FROM stores
       ${clause}
       ORDER BY name ASC`,
      params
    );

    return NextResponse.json({ stores });
  } catch (error) {
    console.error('GET /api/stores error:', error);
    return NextResponse.json({ error: 'Failed to fetch stores' }, { status: 500 });
  }
}

// ============================================================
// POST /api/stores
// Create a new store (company scoped)
// ============================================================
export async function POST(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only admin and super_admin can create stores
  if (auth.role !== 'admin' && !isSuperAdmin(auth)) {
    return NextResponse.json(
      { error: 'Only admins can create stores' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { name, code, address, phone } = body;

    if (!name) {
      return NextResponse.json({ error: 'Store name is required' }, { status: 400 });
    }

    // Get company_id from auth
    const companyId = getCompanyForInsert(auth);

    // Generate code if not provided
    const storeCode =
      code ||
      name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '')
        .substring(0, 10);

    // Check if code already exists for this company
    const existing = await queryOne(
      'SELECT id FROM stores WHERE company_id = $1 AND code = $2',
      [companyId, storeCode]
    );

    if (existing) {
      return NextResponse.json(
        { error: 'Store code already exists for your company' },
        { status: 409 }
      );
    }

    // Check company store limit
    const storeCount = await queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM stores WHERE company_id = $1 AND active = true',
      [companyId]
    );

    const company = await queryOne<{ max_stores: number }>(
      'SELECT max_stores FROM companies WHERE id = $1',
      [companyId]
    );

    if (
      company &&
      storeCount &&
      parseInt(storeCount.count) >= company.max_stores
    ) {
      return NextResponse.json(
        {
          error: `Store limit reached (${company.max_stores} stores). Upgrade your plan to add more.`,
        },
        { status: 403 }
      );
    }

    // Create store
    const result = await query<Store>(
      `INSERT INTO stores (company_id, name, code, address, phone, active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [companyId, name, storeCode, address || null, phone || null, true]
    );

    return NextResponse.json({ store: result[0] }, { status: 201 });
  } catch (error) {
    console.error('POST /api/stores error:', error);
    return NextResponse.json({ error: 'Failed to create store' }, { status: 500 });
  }
}

// ============================================================
// PATCH /api/stores/:id
// Update a store (company scoped)
// ============================================================
export async function PATCH(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only admin and super_admin can update stores
  if (auth.role !== 'admin' && !isSuperAdmin(auth)) {
    return NextResponse.json(
      { error: 'Only admins can update stores' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.id) {
      return NextResponse.json({ error: 'Store ID required' }, { status: 400 });
    }

    const { id, name, code, address, phone, active } = body;

    // Verify store belongs to user's company
    const companyId = getCompanyFromAuth(auth);
    const store = await queryOne(
      'SELECT id FROM stores WHERE id = $1' +
        (companyId ? ' AND company_id = $2' : ''),
      companyId ? [id, companyId] : [id]
    );

    if (!store) {
      return NextResponse.json(
        { error: 'Store not found or access denied' },
        { status: 404 }
      );
    }

    // Build update query
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name);
    }
    if (code !== undefined) {
      updates.push(`code = $${paramIndex++}`);
      params.push(code);
    }
    if (address !== undefined) {
      updates.push(`address = $${paramIndex++}`);
      params.push(address);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      params.push(phone);
    }
    if (active !== undefined) {
      updates.push(`active = $${paramIndex++}`);
      params.push(active);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    params.push(id);
    if (companyId) params.push(companyId);

    const whereClause = companyId
      ? `WHERE id = $${paramIndex++} AND company_id = $${paramIndex}`
      : `WHERE id = $${paramIndex}`;

    const result = await query(
      `UPDATE stores
       SET ${updates.join(', ')}
       ${whereClause}
       RETURNING *`,
      params
    );

    if (result.length === 0) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    return NextResponse.json({ store: result[0] });
  } catch (error) {
    console.error('PATCH /api/stores error:', error);
    return NextResponse.json({ error: 'Failed to update store' }, { status: 500 });
  }
}

// ============================================================
// DELETE /api/stores/:id
// Delete a store (soft delete - set active = false)
// ============================================================
export async function DELETE(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only admin and super_admin can delete stores
  if (auth.role !== 'admin' && !isSuperAdmin(auth)) {
    return NextResponse.json(
      { error: 'Only admins can delete stores' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Store ID required' }, { status: 400 });
    }

    // Verify store belongs to user's company
    const companyId = getCompanyFromAuth(auth);
    const whereClause = companyId
      ? 'WHERE id = $1 AND company_id = $2'
      : 'WHERE id = $1';
    const params = companyId ? [id, companyId] : [id];

    // Soft delete
    const result = await query(
      `UPDATE stores
       SET active = false
       ${whereClause}
       RETURNING id, name`,
      params
    );

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Store not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Store "${result[0].name}" has been deactivated`,
    });
  } catch (error) {
    console.error('DELETE /api/stores error:', error);
    return NextResponse.json({ error: 'Failed to delete store' }, { status: 500 });
  }
}
