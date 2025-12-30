import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';

export async function GET() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  if (session.user) {
    return NextResponse.json({
      isLoggedIn: true,
      username: session.user.username,
    });
  }

  return NextResponse.json({
    isLoggedIn: false,
  });
}
