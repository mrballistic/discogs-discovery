import { NextResponse } from 'next/server';
import { jobQueue } from '@/lib/queue';

/**
 * Return the current state of an analysis run so the frontend can render progress, the map, and
 * the label table without holding server connections open.
 *
 * @param request Next.js Request (unused).
 * @param params Route params promise containing the job id.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> } // In Next.js 15, params is a Promise
) {
  const { id } = await params;
  const job = await jobQueue.get(id);

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json(job);
}
