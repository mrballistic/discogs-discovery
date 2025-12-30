# Upstash Workflow Integration

This document describes the Upstash Workflow integration that makes the Discogs collection analysis more robust and resilient.

## Overview

The application uses Upstash Workflow to handle long-running collection analysis tasks. This provides several benefits:

- **Resilience**: If a serverless function times out or fails, the workflow continues from where it left off
- **Rate Limiting**: Built-in sleep functions prevent hitting Discogs API rate limits
- **Progress Tracking**: Real-time progress updates stored in Upstash KV/Redis
- **Batching**: Releases are processed in batches to optimize performance and avoid workflow step limits

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Frontend  │────▶│  /api/analyze│────▶│ Upstash     │
│             │     │   (trigger)  │     │ Workflow    │
└─────────────┘     └──────────────┘     └─────────────┘
                                                 │
                                                 ▼
                                          ┌─────────────┐
                                          │  /api/workflow│
                                          │  (execution) │
                                          └─────────────┘
                                                 │
                                                 ▼
                                          ┌─────────────┐
                                          │ Upstash KV  │
                                          │ (job state) │
                                          └─────────────┘
```

## Environment Variables

Add these to your `.env.local` file:

```bash
# Upstash KV/Redis for job queue persistence
KV_URL="https://xxx.kv.upstash.io"
KV_REST_API_URL="https://xxx.kv.upstash.io"
KV_REST_API_TOKEN="xxx"
KV_REST_API_READ_ONLY_TOKEN="xxx"

# Upstash QStash for workflow orchestration
QSTASH_URL="https://qstash.upstash.io"
QSTASH_TOKEN="xxx"
QSTASH_CURRENT_SIGNING_KEY="xxx"
QSTASH_NEXT_SIGNING_KEY="xxx"

# Frontend URL (for production)
NEXT_PUBLIC_BASE_URL="https://your-app.vercel.app"
```

## How It Works

1. **Trigger**: When a user starts an analysis, `/api/analyze` creates a job and triggers the workflow
2. **Workflow Execution**: The workflow endpoint (`/api/workflow`) processes the collection in batches
3. **Progress Updates**: After each batch, progress is saved to Upstash KV
4. **Rate Limiting**: Built-in delays prevent hitting Discogs API limits
5. **Fallback**: If the workflow fails, the system falls back to direct processing

## Batching Strategy

Releases are processed in batches of 10 to:
- Avoid Upstash workflow step limits (default: 10,000 steps)
- Reduce API call overhead
- Maintain responsive progress updates

Each batch includes:
- 10 releases processed sequentially
- 200ms delay between releases (rate limiting)
- 2s delay between batches

## Monitoring

You can monitor workflow execution by:
1. Checking the job status via `/api/status/[id]`
2. Viewing logs in your Vercel dashboard
3. Monitoring Upstash KV for job state changes

## Troubleshooting

### Workflow Not Starting
- Verify QSTASH_TOKEN is correct
- Check that QSTASH_URL is accessible
- Ensure the workflow endpoint is deployed

### Jobs Not Progressing
- Check KV_URL and KV_REST_API_TOKEN
- Verify Redis/KV connectivity
- Look for rate limit errors in logs

### Performance Issues
- Adjust BATCH_SIZE in `/app/api/workflow/route.ts`
- Modify delay times based on your rate limit tier
- Consider using sampling for large collections

## Local Development

For local development, you can:
1. Use the fallback processing (works without Upstash)
2. Set up a local Redis instance
3. Use Upstash's free tier for testing

The system automatically falls back to direct processing if Upstash is not configured.
