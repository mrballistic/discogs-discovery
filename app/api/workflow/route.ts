import { serve } from "@upstash/workflow/nextjs";
import { DiscogsClient } from '@lionralfs/discogs-client';
import { jobQueue } from '@/lib/queue';
import { normalizeCountry } from '@/lib/discogs';

const globalClient = new DiscogsClient({
  userAgent: 'DiscogsDiscoveryMVP/0.1',
});

interface WorkflowInput {
  jobId: string;
  username: string;
  tokens?: { accessToken: string; accessTokenSecret: string };
  options?: { allLabels?: boolean; sampleSize?: number };
}

export const { POST } = serve<WorkflowInput>(async (context) => {
  const { jobId, username, tokens, options } = context.requestPayload;

  // 1. Get Initial Job State
  const job = await context.run("get-job", async () => {
    const j = await jobQueue.get(jobId);
    if (!j) throw new Error("Job not found");
    return j;
  });

  const allLabelsMode = !!options?.allLabels;
  const sampleSize = options?.sampleSize;

  // 2. Auth Setup
  const client = tokens ? new DiscogsClient({
    auth: {
      method: 'oauth',
      level: 2,
      consumerKey: process.env.DISCOGS_CONSUMER_KEY!,
      consumerSecret: process.env.DISCOGS_CONSUMER_SECRET!,
      accessToken: tokens.accessToken,
      accessTokenSecret: tokens.accessTokenSecret,
    },
    userAgent: 'DiscogsDiscoveryMVP/0.1',
  }) : globalClient;

  // 3. Update Progress
  await context.run("start-processing", async () => {
    job.status = 'processing';
    job.progress.message = 'Fetching collection list...';
    await jobQueue.set(jobId, job);
  });

  // 4. Fetch All Releases
  const allReleases = await context.run("fetch-all-releases", async () => {
    const firstPageRes = await client.user().collection().getReleases(username, 0, { page: 1, per_page: 50 });
    const firstPage = firstPageRes.data;
    const totalPages = firstPage.pagination.pages;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let releases: any[] = [...firstPage.releases];
    
    for (let p = 2; p <= totalPages; p++) {
      const pageRes = await client.user().collection().getReleases(username, 0, { page: p, per_page: 50 });
      releases = releases.concat(pageRes.data.releases);
      
      job.progress.pagesFetched = p;
      job.progress.percent = 5 + (p / totalPages) * 10;
      job.progress.message = `Fetching page ${p} of ${totalPages}`;
      await jobQueue.set(jobId, job);
    }
    return releases;
  });

  // 5. Sampling
  const releasesToAnalyze = await context.run("apply-sampling", async () => {
    if (sampleSize && sampleSize < allReleases.length) {
      job.progress.message = `Sampling ${sampleSize} items...`;
      await jobQueue.set(jobId, job);
      return [...allReleases].sort(() => Math.random() - 0.5).slice(0, sampleSize);
    }
    return allReleases;
  });

  // 6. Detailed Analysis Loop (Batched for efficiency)
  // Note: We process releases in batches to avoid hitting Upstash workflow step limits
  const countryCounts: Record<string, number> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tableRowsMap = new Map<string, any>();
  const totalToProcess = releasesToAnalyze.length;
  const BATCH_SIZE = 10; // Process 10 releases per workflow step

  for (let i = 0; i < totalToProcess; i += BATCH_SIZE) {
    const batch = releasesToAnalyze.slice(i, Math.min(i + BATCH_SIZE, totalToProcess));
    
    // Process batch as a single step
    const batchResults = await context.run(`analyze-batch-${Math.floor(i / BATCH_SIZE)}`, async () => {
      const results: { country: string; labelsToAdd: { key: string; labelId: number; labelName: string; country: string }[] }[] = [];
      
      for (const item of batch) {
        let country = 'Unknown';
        try {
          // Add small delay within batch to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
          const dbReleaseRes = await client.database().getRelease(item.id);
          country = normalizeCountry(dbReleaseRes.data.country);
        } catch (err) {
          console.error(`Failed to fetch release ${item.id}`, err);
        }

        const labelsToAdd: { key: string; labelId: number; labelName: string; country: string }[] = [];
        const basicInfo = item.basic_information;
        const labelsToProcess = allLabelsMode ? (basicInfo.labels || []) : [basicInfo.labels?.[0]].filter(Boolean);
        
        for (const label of labelsToProcess) {
          labelsToAdd.push({
            key: `${label.id}::${country}`,
            labelId: label.id,
            labelName: label.name,
            country
          });
        }

        results.push({ country, labelsToAdd });
      }
      
      return results;
    });

    // Update Aggregates (Local state in workflow persists between runs)
    for (const stats of batchResults) {
      countryCounts[stats.country] = (countryCounts[stats.country] || 0) + 1;
      for (const l of stats.labelsToAdd) {
        const existing = tableRowsMap.get(l.key);
        if (existing) {
          existing.releaseCount++;
        } else {
          tableRowsMap.set(l.key, { ...l, releaseCount: 1 });
        }
      }
    }

    // Update Progress after each batch
    const processedCount = Math.min(i + BATCH_SIZE, totalToProcess);
    await context.run(`update-progress-${Math.floor(i / BATCH_SIZE)}`, async () => {
      job.progress.releasesProcessed = processedCount;
      job.progress.percent = 15 + (processedCount / totalToProcess) * 85;
      job.progress.message = `Analyzing ${processedCount} of ${totalToProcess}`;
      await jobQueue.set(jobId, job);
    });

    // Rate limiting: Wait between batches (serverless function dies, Upstash waits)
    if (i + BATCH_SIZE < totalToProcess) {
      await context.sleep(`sleep-batch-${Math.floor(i / BATCH_SIZE)}`, 2);
    }
  }

  // 7. Finalize
  await context.run("finalize", async () => {
    job.result = {
      mapData: countryCounts,
      tableRows: Array.from(tableRowsMap.values()).sort((a, b) => b.releaseCount - a.releaseCount)
    };
    job.status = 'completed';
    job.progress.percent = 100;
    job.progress.message = 'Complete';
    await jobQueue.set(jobId, job);
  });
});
