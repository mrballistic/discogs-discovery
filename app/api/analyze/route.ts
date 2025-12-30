import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { processCollection } from '@/lib/discogs';
import { jobQueue, JobStatus } from '@/lib/queue';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username } = body;

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const id = uuidv4();
    const job: JobStatus = {
      id,
      username,
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

    jobQueue.set(id, job);

    // Start processing in background (fire and forget)
    // In a real serverless env (Vercel), this might be killed. 
    // For MVP/Node runtime, this works but isn't robust.
    // Ideally we'd use a real worker or Vercel Functions with long timeout, 
    // but the recursive / iterative nature needs a persistent process or step function.
    // For local dev/MVP, this async call works fine.
    processCollection(id, username).catch(console.error);

    return NextResponse.json({ runId: id });
  } catch (error) {
    console.error('Error creating job:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
