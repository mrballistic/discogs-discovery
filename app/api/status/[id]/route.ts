import { NextResponse } from 'next/server';
import { jobQueue } from '@/lib/queue';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> } // In Next.js 15, params is a Promise
) {
  const { id } = await params;
  const job = jobQueue.get(id);

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json(job);
}
