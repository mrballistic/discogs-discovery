/**
 * Row model used by the DataGrid to display label-level aggregation results.
 * Each row represents the count of releases owned for a given label and release country.
 */
export interface LabelRow {
  /** Unique key combining label id and country bucket to make DataGrid deterministic. */
  key: string;
  /** Discogs label identifier used to build outbound links. */
  labelId: number;
  /** Human-readable label name supplied by the Discogs API. */
  labelName: string;
  /** Country bucket derived from the release country (normalized). */
  country: string;
  /** Number of releases owned for this label and country combination. */
  releaseCount: number;
}

/**
 * Lifecycle state for an analysis job. Jobs are kept in-memory per PRD to drive the map + table UX.
 */
export type JobStatus = {
  /** Server-generated id used by the client to poll `/api/status/[id]`. */
  id: string;
  /** Discogs username being analyzed (public or via OAuth). */
  username: string;
  /** State machine for progress UI. */
  status: 'pending' | 'processing' | 'completed' | 'failed';
  /** Fine-grained progress metrics used to render the thin progress bar and poller messaging. */
  progress: {
    message: string;
    percent: number;
    pagesFetched: number;
    /** Total collection pages; initialized after the first Discogs request. */
    totalPages: number;
    releasesProcessed: number;
    totalReleases: number;
  };
  /** Aggregated outputs that power the map and table views. */
  result?: {
    /** Country → release count choropleth data (unknown/unmapped included). */
    mapData: Record<string, number>;
    /** Table rows sorted by releaseCount to align with PRD requirements. */
    tableRows: LabelRow[];
  };
  /** Human-readable error string returned to the client if the job fails. */
  error?: string;
  /** Timestamp used for TTL logic or future cleanup of stale runs. */
  createdAt: number;
};

/** Use globalThis to persist queue across HMR in development. */
const globalForQueue = globalThis as unknown as {
  jobQueue: Map<string, JobStatus>;
};

/**
 * In-memory job queue backing the MVP. Keeps state between API calls and survives dev HMR by
 * storing on `globalThis`. Production deployments should replace with a shared store/queue.
 */
export const jobQueue = globalForQueue.jobQueue || new Map<string, JobStatus>();

if (process.env.NODE_ENV !== 'production') globalForQueue.jobQueue = jobQueue;
