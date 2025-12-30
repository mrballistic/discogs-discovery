import { SessionOptions } from 'iron-session';

/**
 * Iron Session configuration used by all API routes that require OAuth-backed Discogs calls.
 * Uses secure cookies in production to protect OAuth tokens and user identity.
 */
export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_PASSWORD || 'complex_password_at_least_32_characters_long',
  cookieName: 'discogs_discovery_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
  },
};

/**
 * Shape of the session payload we store server-side. Tokens stay in the session and never reach
 * the browser beyond fetch calls initiated on behalf of the user.
 */
export interface SessionData {
  user: {
    username: string;
    accessToken: string;
    accessTokenSecret: string;
  };
}
