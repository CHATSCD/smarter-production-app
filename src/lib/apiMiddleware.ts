import { NextRequest, NextResponse } from 'next/server';
import { getAuthFromRequest, JWTPayload } from './auth';

export type Role = 'super_admin' | 'admin' | 'manager' | 'employee';

export type AuthedHandler = (
  req: NextRequest,
  auth: JWTPayload,
  context?: { params: Record<string, string> }
) => Promise<NextResponse>;

export function withAuth(
  handler: AuthedHandler,
  ...allowedRoles: Role[]
) {
  return async (
    req: NextRequest,
    context?: { params: Record<string, string> }
  ) => {
    const auth = getAuthFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return handler(req, auth, context);
  };
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export async function parseBody<T>(req: NextRequest): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
