import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';

/**
 * Lightweight session check used by the frontend to show whether the user is connected to
 * Discogs and to prefill the username field for self-serve analysis.
 */
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
