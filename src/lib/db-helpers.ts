import { JWTPayload, getCompanyFromAuth, isSuperAdmin } from './auth';

/**
 * Database Query Helpers for Multi-Tenant Company Isolation
 *
 * These helpers ensure all database queries are properly scoped to the user's company.
 * Super admins can access all companies, regular users only their own.
 */

// ============================================================
// QUERY BUILDING HELPERS
// ============================================================

/**
 * Build WHERE clause for company filtering
 * @param auth - JWT payload from authenticated user
 * @param paramIndex - Starting parameter index (e.g., $1, $2, etc.)
 * @returns Object with WHERE clause and parameter value
 *
 * @example
 * const { clause, param } = buildCompanyFilter(auth, 1);
 * const query = `SELECT * FROM shifts ${clause}`;
 * const { rows } = await pool.query(query, param ? [param] : []);
 */
export function buildCompanyFilter(
  auth: JWTPayload | null,
  paramIndex: number = 1
): { clause: string; param: string | null } {
  const companyId = getCompanyFromAuth(auth);

  // Super admin - no filter
  if (companyId === null) {
    return { clause: '', param: null };
  }

  // Regular user - filter by company
  return {
    clause: `WHERE company_id = $${paramIndex}`,
    param: companyId,
  };
}

/**
 * Build AND condition for company filtering (when WHERE already exists)
 * @param auth - JWT payload from authenticated user
 * @param paramIndex - Starting parameter index
 * @returns Object with AND clause and parameter value
 *
 * @example
 * const { clause, param } = buildCompanyAndFilter(auth, 2);
 * const query = `SELECT * FROM shifts WHERE store_id = $1 ${clause}`;
 * const { rows } = await pool.query(query, [storeId, ...(param ? [param] : [])]);
 */
export function buildCompanyAndFilter(
  auth: JWTPayload | null,
  paramIndex: number = 1
): { clause: string; param: string | null } {
  const companyId = getCompanyFromAuth(auth);

  // Super admin - no filter
  if (companyId === null) {
    return { clause: '', param: null };
  }

  // Regular user - add AND condition
  return {
    clause: `AND company_id = $${paramIndex}`,
    param: companyId,
  };
}

/**
 * Get company ID for INSERT queries
 * @param auth - JWT payload from authenticated user
 * @returns Company ID to use in INSERT
 * @throws Error if user is not authenticated or has no company
 *
 * @example
 * const companyId = getCompanyForInsert(auth);
 * await pool.query(
 *   'INSERT INTO shifts (company_id, store_id, ...) VALUES ($1, $2, ...)',
 *   [companyId, storeId, ...]
 * );
 */
export function getCompanyForInsert(auth: JWTPayload | null): string {
  if (!auth) {
    throw new Error('Unauthorized: No authentication provided');
  }

  if (isSuperAdmin(auth)) {
    throw new Error('Super admin cannot create records without specifying company_id');
  }

  const companyId = auth.companyId;
  if (!companyId) {
    throw new Error('Invalid user: No company_id in token');
  }

  return companyId;
}

// ============================================================
// VALIDATION HELPERS
// ============================================================

/**
 * Validate that a user can access a specific store
 * Checks both company ownership and store existence
 */
export async function validateStoreAccess(
  pool: any,
  auth: JWTPayload | null,
  storeId: string
): Promise<boolean> {
  const companyId = getCompanyFromAuth(auth);

  // Super admin can access any store
  if (companyId === null) return true;

  // Check if store belongs to user's company
  const { rows } = await pool.query(
    'SELECT id FROM stores WHERE id = $1 AND company_id = $2',
    [storeId, companyId]
  );

  return rows.length > 0;
}

/**
 * Validate that a user can access a specific employee/user
 */
export async function validateUserAccess(
  pool: any,
  auth: JWTPayload | null,
  targetUserId: string
): Promise<boolean> {
  const companyId = getCompanyFromAuth(auth);

  // Super admin can access any user
  if (companyId === null) return true;

  // Check if user belongs to same company
  const { rows } = await pool.query(
    'SELECT id FROM users WHERE id = $1 AND company_id = $2',
    [targetUserId, companyId]
  );

  return rows.length > 0;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Safely build parameter array, excluding null values
 * @param params - Array of parameters (may include nulls from filters)
 * @returns Clean parameter array
 *
 * @example
 * const { clause, param } = buildCompanyFilter(auth, 2);
 * const params = buildParamArray([storeId, param, date]);
 * const { rows } = await pool.query(query, params);
 */
export function buildParamArray(...params: (string | number | null)[]): (string | number)[] {
  return params.filter((p): p is string | number => p !== null);
}

/**
 * Get company ID from auth, or throw error if missing
 * Convenience function for API routes
 */
export function requireCompanyId(auth: JWTPayload | null): string {
  if (!auth) {
    throw new Error('Unauthorized');
  }

  const companyId = auth.companyId;
  if (!companyId && !isSuperAdmin(auth)) {
    throw new Error('Invalid user: No company_id');
  }

  // For super admin, they should specify company_id in request
  if (isSuperAdmin(auth)) {
    throw new Error('Super admin must specify company_id in request');
  }

  return companyId;
}
