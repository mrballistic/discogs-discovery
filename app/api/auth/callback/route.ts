import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';

/**
 * Completes the Discogs OAuth handshake: exchanges the request token for an access token, fetches
 * the user identity, and persists tokens in the session so backend analysis calls can access
 * private collections without exposing secrets to the client.
 *
 * @param request Callback request from Discogs containing oauth_token and oauth_verifier.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const oauthToken = searchParams.get('oauth_token');
  const oauthVerifier = searchParams.get('oauth_verifier');

  if (!oauthToken || !oauthVerifier) {
    return NextResponse.json({ error: 'Missing OAuth parameters' }, { status: 400 });
  }

  try {
    const session = await getIronSession<SessionData & { requestTokenSecret?: string }>(await cookies(), sessionOptions);
    const requestTokenSecret = session.requestTokenSecret;

    if (!requestTokenSecret) {
         console.warn('OAuth Callback: Missing requestTokenSecret in session');
         return NextResponse.json({ error: 'Session expired or invalid' }, { status: 400 });
    }

    const consumerKey = process.env.DISCOGS_CONSUMER_KEY?.trim() || '';
    const consumerSecret = process.env.DISCOGS_CONSUMER_SECRET?.trim() || '';

    // Manual Access Token fetch
    const timestamp = Date.now();
    const nonce = Math.random().toString(36).substring(2);

    const authHeader = `OAuth oauth_consumer_key="${consumerKey}", oauth_nonce="${nonce}", oauth_token="${oauthToken}", oauth_signature="${consumerSecret}&${requestTokenSecret}", oauth_signature_method="PLAINTEXT", oauth_timestamp="${timestamp}", oauth_verifier="${oauthVerifier}"`;

    const resp = await fetch('https://api.discogs.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': authHeader,
        'User-Agent': 'DiscogsDiscoveryMVP/0.1',
      },
    });

    if (!resp.ok) {
        const errText = await resp.text();
        console.error('Discogs Access Token Error:', resp.status, errText);
        return NextResponse.json({ error: 'Failed to exchange for access token', details: errText }, { status: resp.status });
    }

    const responseBody = await resp.text();
    const result = new URLSearchParams(responseBody);
    const accessToken = result.get('oauth_token');
    const accessTokenSecret = result.get('oauth_token_secret');

    if (!accessToken || !accessTokenSecret) {
        return NextResponse.json({ error: 'Discogs returned malformed access token response' }, { status: 500 });
    }

    // Get User Identity manually to avoid library header issues
    const idTimestamp = Date.now();
    const idNonce = Math.random().toString(36).substring(2);
    const idAuthHeader = `OAuth oauth_consumer_key="${consumerKey}", oauth_nonce="${idNonce}", oauth_token="${accessToken}", oauth_signature="${consumerSecret}&${accessTokenSecret}", oauth_signature_method="PLAINTEXT", oauth_timestamp="${idTimestamp}"`;

    const idResp = await fetch('https://api.discogs.com/oauth/identity', {
        headers: {
            'Authorization': idAuthHeader,
            'User-Agent': 'DiscogsDiscoveryMVP/0.1',
        },
    });

    if (!idResp.ok) {
        const idErrText = await idResp.text();
        console.error('Identity Fetch Failed:', idResp.status, idErrText);
        return NextResponse.json({ error: 'Failed to fetch identity', details: idErrText }, { status: idResp.status });
    }

    const identity = await idResp.json();

    // Save to session
    session.user = {
        username: identity.username,
        accessToken: accessToken,
        accessTokenSecret: accessTokenSecret,
    };
    delete session.requestTokenSecret;
    await session.save();

    console.log('OAuth successful for user:', identity.username);
    return NextResponse.redirect(`${new URL(request.url).origin}/`);
  } catch (error: unknown) {
    console.error('OAuth Callback Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
        error: 'OAuth Callback Failed', 
        details: message
    }, { status: 500 });
  }
}
