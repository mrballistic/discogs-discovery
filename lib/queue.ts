export type JobStatus = {
  id: string;
  username: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: {
    message: string;
    percent: number;
    pagesFetched: number;
    totalPages: number; // Initially 0 until we fetch first page
    releasesProcessed: number;
    totalReleases: number;
  };
  result?: {
    mapData: Record<string, number>; // Country code -> count
    tableRows: any[];
  };
  error?: string;
  createdAt: number;
};

// Use globalThis to persist queue across HMR in development
const globalForQueue = globalThis as unknown as {
  jobQueue: Map<string, JobStatus>;
};

export const jobQueue = globalForQueue.jobQueue || new Map<string, JobStatus>();

if (process.env.NODE_ENV !== 'production') globalForQueue.jobQueue = jobQueue;
