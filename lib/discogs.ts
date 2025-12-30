import { DiscogsClient } from '@lionralfs/discogs-client';
import { jobQueue } from './queue';

const client = new DiscogsClient({
  userAgent: 'DiscogsDiscoveryMVP/0.1',
});

// Country buckets
const COUNTRY_MAPPINGS: Record<string, string> = {
  'UK': 'GB',
  'U.K.': 'GB',
  'United Kingdom': 'GB',
  'USA': 'US',
  'U.S.A.': 'US',
  'United States': 'US',
  'Europe': 'Unmapped',
  'Worldwide': 'Unmapped',
};

function normalizeCountry(raw: string | undefined | null): string {
  if (!raw || raw.trim() === '') return 'Unknown';
  const clean = raw.trim();
  if (COUNTRY_MAPPINGS[clean]) return COUNTRY_MAPPINGS[clean];
  // Simple check: if it looks like a valid name, keep it. 
  // Ideally we map to ISO codes, but for MVP keeping the name is fine per PRD ("Release country is fine").
  // "Unknown is fine (table can include them)"
  return clean;
}

const RATE_LIMIT_DELAY = 1500; // Increased to 1.5s to be safer

// Helper for Robust Retries
async function fetchWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = RATE_LIMIT_DELAY): Promise<T> {
  try {
    // Always wait the base delay before a call to space them out
    await new Promise(r => setTimeout(r, delay));
    return await fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    if (retries > 0 && err.statusCode === 429) {
      console.warn(`Rate limit hit. Retrying in 60s... (${retries} left)`);
      // Wait 60s if rate limited (standard usually), or parse header if we had access to it.
      // Discogs often wants 60s lockout.
      await new Promise(r => setTimeout(r, 60000));
      return fetchWithRetry(fn, retries - 1, delay);
    }
    throw err;
  }
}

export async function processCollection(
  jobId: string, 
  username: string, 
  tokens?: { accessToken: string; accessTokenSecret: string },
  options?: { allLabels?: boolean; sampleSize?: number }
) {
  const job = jobQueue.get(jobId);
  if (!job) return;

  // Initializing Client...
  let jobClient = client;
  if (tokens) {
      jobClient = new DiscogsClient({
          auth: {
              method: 'oauth',
              level: 2,
              consumerKey: process.env.DISCOGS_CONSUMER_KEY!,
              consumerSecret: process.env.DISCOGS_CONSUMER_SECRET!,
              accessToken: tokens.accessToken,
              accessTokenSecret: tokens.accessTokenSecret,
          },
          userAgent: 'DiscogsDiscoveryMVP/0.1',
      });
  }

  const allLabelsMode = !!options?.allLabels;
  const sampleSize = options?.sampleSize;

  try {
    job.status = 'processing';
    job.progress.message = 'Fetching collection list...';
    
    const firstPageRes = await fetchWithRetry(() => 
      jobClient.user().collection().getReleases(username, 0, { page: 1, per_page: 50 })
    );
    const firstPage = firstPageRes.data;
    const totalPages = firstPage.pagination.pages;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let allReleases: any[] = [...firstPage.releases];
    
    // Fetch remaining pages (this part is relatively fast)
    for (let p = 2; p <= totalPages; p++) {
      const pageRes = await fetchWithRetry(() => 
        jobClient.user().collection().getReleases(username, 0, { page: p, per_page: 50 })
      );
      allReleases = allReleases.concat(pageRes.data.releases);
      
      job.progress.pagesFetched = p;
      job.progress.percent = 5 + (p / totalPages) * 10; // First 15% is fetching list
      job.progress.message = `Fetching page ${p} of ${totalPages}`;
    }

    // 3. APPLY SAMPLING
    let releasesToAnalyze = allReleases;
    if (sampleSize && sampleSize < allReleases.length) {
        job.progress.message = `Sampling ${sampleSize} random items from ${allReleases.length}...`;
        // Simple shuffle
        releasesToAnalyze = [...allReleases]
            .sort(() => Math.random() - 0.5)
            .slice(0, sampleSize);
    }

    const totalToProcess = releasesToAnalyze.length;
    job.progress.totalReleases = totalToProcess;

    const countryCounts: Record<string, number> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tableRowsMap = new Map<string, any>();
    
    let processed = 0;
    
    for (const item of releasesToAnalyze) {
      const releaseId = item.id;
      
      let country = 'Unknown';
      try {
        const dbReleaseRes = await fetchWithRetry(() => 
          jobClient.database().getRelease(releaseId)
        );
        country = normalizeCountry(dbReleaseRes.data.country);
      } catch (err: unknown) {
        console.error(`Failed to fetch release ${releaseId}`, err);
      }
      
      countryCounts[country] = (countryCounts[country] || 0) + 1;
      
      const basicInfo = item.basic_information;
      const labelsToProcess = allLabelsMode ? (basicInfo.labels || []) : [basicInfo.labels?.[0]].filter(Boolean);
      
      for (const label of labelsToProcess) {
        const key = `${label.id}::${country}`;
        const existing = tableRowsMap.get(key);
        if (existing) {
          existing.releaseCount++;
        } else {
          tableRowsMap.set(key, {
            key,
            labelId: label.id,
            labelName: label.name,
            country,
            releaseCount: 1
          });
        }
      }

      processed++;
      job.progress.releasesProcessed = processed;
      job.progress.percent = 15 + (processed / totalToProcess) * 85;
      job.progress.message = `Analyzing ${processed} of ${totalToProcess} (Sampling enabled: ${!!sampleSize})`;
    }

    job.result = {
      mapData: countryCounts,
      tableRows: Array.from(tableRowsMap.values()).sort((a, b) => b.releaseCount - a.releaseCount)
    };
    job.status = 'completed';
    job.progress.percent = 100;
    job.progress.message = 'Complete';
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Job failed", error);
    job.status = 'failed';
    job.error = error.message || "Unknown Error";
  }
}
