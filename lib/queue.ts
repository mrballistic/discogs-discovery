import { createClient } from 'redis';

/**
 * Row model used by the DataGrid to display label-level aggregation results.
 * Each row represents the count of releases owned for a given label and release country.
 */
export interface LabelRow {
  key: string;
  labelId: number;
  labelName: string;
  country: string;
  releaseCount: number;
}

/**
 * Lifecycle state for an analysis job.
 */
export type JobStatus = {
  id: string;
  username: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: {
    message: string;
    percent: number;
    pagesFetched: number;
    totalPages: number;
    releasesProcessed: number;
    totalReleases: number;
  };
  result?: {
    mapData: Record<string, number>;
    tableRows: LabelRow[];
  };
  error?: string;
  createdAt: number;
  isUploaded?: boolean;
  uploadedAt?: string;
  originalExportDate?: string;
};

/**
 * Persistence layer for analysis jobs using the 'redis' package.
 */
class JobQueueStore {
  private memoryMap: Map<string, JobStatus>;
  private client: ReturnType<typeof createClient> | null = null;
  private isConnecting = false;

  constructor() {
    // Survive HMR in dev
    const globalForQueue = globalThis as unknown as { jobQueueMap: Map<string, JobStatus> };
    if (!globalForQueue.jobQueueMap) {
      globalForQueue.jobQueueMap = new Map();
    }
    this.memoryMap = globalForQueue.jobQueueMap;
  }

  private async getClient() {
    const redisUrl = process.env.KV_URL || process.env.REDIS_URL;
    
    if (!redisUrl) return null;

    if (this.client) return this.client;

    if (this.isConnecting) {
      // Small wait to avoid double connection attempts
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.client;
    }

    this.isConnecting = true;
    try {
      const client = createClient({ url: redisUrl });
      client.on('error', (err) => console.error('Redis Client Error', err));
      await client.connect();
      this.client = client;
      console.log('JobQueue: Connected to Redis.');
      return this.client;
    } catch (err) {
      console.error('Redis Connection Error:', err);
      return null;
    } finally {
      this.isConnecting = false;
    }
  }

  async get(id: string): Promise<JobStatus | undefined> {
    const client = await this.getClient();
    if (client) {
      try {
        const data = await client.get(`job:${id}`);
        return data ? JSON.parse(data) : undefined;
      } catch (err) {
        console.error('Redis Error (get):', err);
        return this.memoryMap.get(id);
      }
    }
    return this.memoryMap.get(id);
  }

  async set(id: string, job: JobStatus): Promise<void> {
    this.memoryMap.set(id, job);
    const client = await this.getClient();
    if (client) {
      try {
        // Sets a 24h expiration on jobs
        await client.set(`job:${id}`, JSON.stringify(job), {
          EX: 60 * 60 * 24
        });
      } catch (err) {
        console.error('Redis Error (set):', err);
      }
    }
  }
}

export const jobQueue = new JobQueueStore();
