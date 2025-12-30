import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { jobQueue, JobStatus } from '@/lib/queue';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';
import { Client as WorkflowClient } from '@upstash/workflow';

/**
 * Start a background analysis run using Upstash Workflow. Validates username presence, seeds the job queue,
 * and triggers the workflow endpoint for resilient processing.
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

    // Trigger the Upstash workflow
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    const workflowUrl = baseUrl ? `${baseUrl}/api/workflow` : undefined;

    if (!workflowUrl || !process.env.QSTASH_TOKEN) {
      console.warn('QStash not configured (missing NEXT_PUBLIC_BASE_URL or QSTASH_TOKEN). Falling back to direct processing.');
      const { processCollection } = await import('@/lib/discogs');
      processCollection(id, targetUsername, tokens, { allLabels, sampleSize }).catch(console.error);
    } else {
      try {
        const client = new WorkflowClient({ token: process.env.QSTASH_TOKEN });
        await client.trigger({
          url: workflowUrl,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            jobId: id,
            username: targetUsername,
            tokens,
            options: { allLabels, sampleSize }
          },
          keepTriggerConfig: true,
        });
      } catch (workflowError) {
        console.error('Failed to publish workflow to QStash:', workflowError);
        const { processCollection } = await import('@/lib/discogs');
        processCollection(id, targetUsername, tokens, { allLabels, sampleSize }).catch(console.error);
      }
    }

    return NextResponse.json({ runId: id });
  } catch (error) {
    console.error('Error creating job:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
