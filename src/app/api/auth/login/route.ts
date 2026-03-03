import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { comparePassword, signToken, setAuthCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
  }

  let user: {
    id: string; name: string; email: string; password_hash: string;
    role: 'super_admin' | 'admin' | 'manager' | 'employee';
    company_id?: string;
    store_id?: string;
    active: boolean;
  } | null;
  try {
    user = await queryOne<{
      id: string; name: string; email: string; password_hash: string;
      role: 'super_admin' | 'admin' | 'manager' | 'employee';
      company_id?: string;
      store_id?: string;
      active: boolean;
    }>('SELECT * FROM users WHERE email = $1', [body.email.toLowerCase().trim()]);
  } catch {
    return NextResponse.json({ error: 'Database connection failed. Please try again.' }, { status: 503 });
  }

  if (!user || !user.active) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const valid = await comparePassword(body.password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = signToken({
    userId: user.id,
    companyId: user.company_id,
    email: user.email,
    role: user.role,
    storeId: user.store_id,
    name: user.name,
  });

  setAuthCookie(token);

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.company_id,
      storeId: user.store_id,
    },
    token,
  });
}
