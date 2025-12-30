import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies, headers } from 'next/headers';

/**
 * Initiates the Discogs OAuth 1.0a flow by requesting a request token directly from Discogs.
 * Stores the temporary secret in the session and redirects the user to Discogs' authorize page.
 */
export async function GET() {
  const host = (await headers()).get('host');
  const protocol = host?.includes('localhost') || host?.includes('127.0.0.1') ? 'http' : 'https';
  const callbackUrl = `${protocol}://${host}/api/auth/callback`;

  console.log('Initiating OAuth with callback:', callbackUrl);

  const consumerKey = process.env.DISCOGS_CONSUMER_KEY?.trim();
  const consumerSecret = process.env.DISCOGS_CONSUMER_SECRET?.trim();

  if (!consumerKey || !consumerSecret) {
      console.error('Missing Discogs Consumer Key or Secret in environment');
      return NextResponse.json({ error: 'OAuth not configured on server' }, { status: 500 });
  }

  // Manual Request Token fetch to be 100% sure about POST and headers
  const timestamp = Date.now();
  const nonce = Math.random().toString(36).substring(2);

  try {
    const session = await getIronSession<SessionData & { requestTokenSecret?: string }>(await cookies(), sessionOptions);

    const authHeader = `OAuth oauth_consumer_key="${consumerKey}", oauth_nonce="${nonce}", oauth_signature="${consumerSecret}&", oauth_signature_method="PLAINTEXT", oauth_timestamp="${timestamp}", oauth_callback="${encodeURIComponent(callbackUrl)}"`;

    const resp = await fetch('https://api.discogs.com/oauth/request_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': authHeader,
        'User-Agent': 'DiscogsDiscoveryMVP/0.1',
      },
    });

    if (!resp.ok) {
        const errText = await resp.text();
        console.error('Discogs Request Token Error:', resp.status, errText);
        return NextResponse.json({ error: 'Failed to get request token from Discogs', details: errText }, { status: resp.status });
    }

    const responseBody = await resp.text();
    const result = new URLSearchParams(responseBody);
    const oauthToken = result.get('oauth_token');
    const oauthTokenSecret = result.get('oauth_token_secret');

    if (!oauthToken || !oauthTokenSecret) {
        return NextResponse.json({ error: 'Discogs returned malformed token response' }, { status: 500 });
    }

    session.requestTokenSecret = oauthTokenSecret;
    await session.save();

    const authorizeUrl = `https://www.discogs.com/oauth/authorize?oauth_token=${oauthToken}`;
    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    console.error('OAuth Init Error:', error);
    return NextResponse.json({ error: 'Failed to initialize OAuth' }, { status: 500 });
  }
}
