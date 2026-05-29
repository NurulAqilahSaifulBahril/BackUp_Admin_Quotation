import { cookies } from 'next/headers';
import { decodeJwt } from 'jose';
import { db } from './db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export interface User {
  userId: string;
  phone: string;
  role: string;
  isAdmin: boolean;
  name: string;
  tags?: string[];
}

export async function getUser(): Promise<User | null> {
  if (process.env.NODE_ENV !== 'production') {
    try {
      const dbUser = await db.query.users.findFirst({
        where: eq(users.email, 'nurul@eternalgy.me')
      });
      return {
        userId: dbUser ? String(dbUser.id) : '999999',
        phone: '0199849166',
        role: 'admin',
        isAdmin: true,
        name: 'NURUL AQILAH BINTI SYARIFUL BHRIL @ SAIFUL BAHRIL',
        tags: ['admin', 'finance', 'seda', 'inventory', 'sales', 'superadmin', 'ceo', 'invoiceapprove', 'invoice editor', 'project', 'special', 'hr', 'ec']
      };
    } catch (e) {
      return {
        userId: '999999',
        phone: '0199849166',
        role: 'admin',
        isAdmin: true,
        name: 'NURUL AQILAH BINTI SYARIFUL BHRIL @ SAIFUL BAHRIL',
        tags: ['admin', 'finance', 'seda', 'inventory', 'sales', 'superadmin', 'ceo', 'invoiceapprove', 'invoice editor', 'project', 'special', 'hr', 'ec']
      };
    }
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) return null;

  try {
    // Note: We don't verify the secret here because this is for UI display.
    // The middleware already verified the token before the request reached here.
    const decoded = decodeJwt(token) as unknown as User;
    return decoded;
  } catch (err) {
    return null;
  }
}

