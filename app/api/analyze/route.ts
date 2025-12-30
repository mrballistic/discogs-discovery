import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { processCollection } from '@/lib/discogs';
import { jobQueue, JobStatus } from '@/lib/queue';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';

/**
 * Start a background analysis run. Validates username presence, seeds the in-memory job queue,
 * and hands execution to `processCollection`, which performs the Discogs pagination + country
 * resolution described in the PRD.
 *
 * @param request Next.js Request containing JSON body `{ username?, allLabels?, sampleSize? }`.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, allLabels, sampleSize } = body;

    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    const isLoggedIn = !!session.user;
    
    // If not logged in, username is mandatory.
    // If logged in, username is optional (defaults to self).
    if (!isLoggedIn && !username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const targetUsername = (isLoggedIn && !username) ? session.user.username : (username || session.user?.username);

    const id = uuidv4();
    const job: JobStatus = {
      id,
      username: targetUsername,
      status: 'pending',
      progress: {
        message: 'Job created',
        percent: 0,
        pagesFetched: 0,
        totalPages: 0,
        releasesProcessed: 0,
        totalReleases: 0,
      },
      createdAt: Date.now(),
    };

    await jobQueue.set(id, job);

    const tokens = isLoggedIn ? {
      accessToken: session.user.accessToken,
      accessTokenSecret: session.user.accessTokenSecret
    } : undefined;

    // Start processing
    processCollection(id, targetUsername, tokens, { allLabels, sampleSize }).catch(console.error);

    return NextResponse.json({ runId: id });
  } catch (error) {
    console.error('Error creating job:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
