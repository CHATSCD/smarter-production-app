import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const COOKIE_NAME = 'keiths_token';
const TOKEN_TTL = '8h';

export interface JWTPayload {
  userId: string;
  companyId?: string; // NULL for super_admin
  email: string;
  role: 'super_admin' | 'admin' | 'manager' | 'employee';
  storeId?: string; // Optional for super_admin
  name: string;
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function getTokenFromRequest(req: NextRequest): string | null {
  // Check Authorization header
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  // Check cookie
  const cookie = req.cookies.get(COOKIE_NAME);
  return cookie?.value ?? null;
}

export function getAuthFromRequest(req: NextRequest): JWTPayload | null {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  return verifyToken(token);
}

export function requireRole(
  auth: JWTPayload | null,
  ...roles: Array<'super_admin' | 'admin' | 'manager' | 'employee'>
): boolean {
  if (!auth) return false;
  return roles.includes(auth.role);
}

export function setAuthCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8, // 8 hours
    path: '/',
  });
}

export function clearAuthCookie() {
  cookies().set(COOKIE_NAME, '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
  });
}

export const COOKIE_NAME_EXPORT = COOKIE_NAME;

// ============================================================
// COMPANY ACCESS HELPERS (Multi-Tenancy)
// ============================================================

/**
 * Extract company ID from JWT payload
 * Returns null for super_admin (they can access any company)
 */
export function getCompanyFromAuth(auth: JWTPayload | null): string | null {
  if (!auth) return null;
  if (auth.role === 'super_admin') return null; // super_admin has no company restriction
  return auth.companyId || null;
}

/**
 * Check if user can access data for a specific company
 * @param userCompanyId - Company ID from user's JWT (null for super_admin)
 * @param requestedCompanyId - Company ID being accessed
 * @returns true if access is allowed
 */
export function canAccessCompany(
  userCompanyId: string | null,
  requestedCompanyId: string
): boolean {
  // super_admin (null companyId) can access any company
  if (userCompanyId === null) return true;
  // Regular users can only access their own company
  return userCompanyId === requestedCompanyId;
}

/**
 * Enforce company access - throws error if access denied
 */
export function enforceCompanyAccess(
  auth: JWTPayload | null,
  requestedCompanyId: string
): void {
  if (!auth) {
    throw new Error('Unauthorized');
  }
  const userCompanyId = getCompanyFromAuth(auth);
  if (!canAccessCompany(userCompanyId, requestedCompanyId)) {
    throw new Error('Access denied: cannot access other company data');
  }
}

/**
 * Check if user is super admin
 */
export function isSuperAdmin(auth: JWTPayload | null): boolean {
  return auth?.role === 'super_admin';
}
