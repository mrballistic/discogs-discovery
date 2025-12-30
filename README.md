# Discogs Discovery

A visual exploration tool for Discogs collections. This application generates a world heatmap and a detailed breakdown of your record collection based on the release country of your items.

## Features

- **World Heatmap**: Visualizes collection density by release country (choropleth).
- **Label Breakdown**: Table of labels with release counts and release country buckets.
- **Interactive Filtering**: Click a country on the map to filter the table; quick search in-grid.
- **Exports**: Download results as JSON or a richer CSV (`rich-csv-v2`) that includes metadata, map data, and table rows.
- **Import CSV/JSON**: Upload a previously exported JSON/CSV to instantly recreate a completed run (skips Discogs API calls).
- **Modes & Toggles**: Public username mode by default; optional Discogs OAuth for private collections. Toggle “Count All Labels” (primary vs. all labels) and “Fast Sampling” for quick demos.
- **Dark Mode**: Premium dark UI built with MUI + MUI X DataGrid.

## Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **UI Components**: Material UI (MUI) + MUI X DataGrid
- **Mapping**: react-simple-maps + d3-scale
- **Discogs Client**: @lionralfs/discogs-client
- **Workflow Orchestration**: Upstash Workflow (for resilient background processing)
- **Storage**: Upstash KV/Redis (for job state persistence)

## Getting Started

1. **Set environment variables** (see `env.example`):
   - `DISCOGS_CONSUMER_KEY` / `DISCOGS_CONSUMER_SECRET` (needed for OAuth/private collections)
   - `SESSION_PASSWORD` (32+ chars for iron-session)
   - **Upstash KV/Redis** for job persistence:
     - `KV_URL` - Redis connection URL
     - `KV_REST_API_URL` - REST API endpoint
     - `KV_REST_API_TOKEN` - Write access token
     - `KV_REST_API_READ_ONLY_TOKEN` - Read-only token
   - **Upstash QStash** for workflow orchestration:
     - `QSTASH_URL` - QStash API URL
     - `QSTASH_TOKEN` - Authentication token
     - `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY` - Webhook verification keys
   - `NEXT_PUBLIC_BASE_URL` - Your app's public URL (for production)

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Run the development server**:

   ```bash
   npm run dev
   ```

4. **Open the app**:
   Navigate to [http://localhost:3000](http://localhost:3000).

## Architecture

### Background Processing with Upstash Workflow

The application uses Upstash Workflow for resilient background processing of collection analysis:

1. **Job Creation**: When you start an analysis, a job is created and stored in Upstash KV/Redis
2. **Workflow Trigger**: The system triggers an Upstash Workflow to handle the processing
3. **Batched Processing**: Releases are processed in batches of 10 to optimize performance
4. **Rate Limiting**: Built-in delays prevent hitting Discogs API rate limits (1.5s between requests)
5. **Progress Tracking**: Real-time progress is saved to Redis and polled by the UI
6. **Resilience**: If a serverless function times out, the workflow continues from where it left off

### Storage Layer

- **Redis/Upstash KV**: Stores job state, progress, and results with 24-hour TTL
- **Fallback**: If Redis is not available, the system falls back to in-memory storage
- **Compliance**: Data is cached for the maximum allowed 6-hour window per Discogs TOU

### Rate Limiting Strategy

- Discogs API allows ~60 requests per minute
- We implement conservative delays: 200ms between releases, 2s between batches
- The workflow automatically retries on rate limit errors with exponential backoff

## Usage

1. (Optional) Click **“Connect with Discogs”** to authorize private collections; otherwise enter a public username.
2. Choose toggles:
   - **Count All Labels**: include secondary/sub-labels (may double-count releases).
   - **Fast Sampling**: analyze a 100-item sample for quick demos.
3. Click **“Analyze Collection”**. A run is queued and polled until completion (jobs live in-memory; a server restart forgets them).
4. Optional: Click **“Import CSV/JSON”** on the home page to upload a previous export and instantly recreate a completed run.
5. Explore the dashboard: click map to filter the table, sort/search, and export CSV/JSON.

### Export formats

- **JSON**: Full-fidelity export including metadata, `mapData`, and `tableRows`.
- **CSV (`rich-csv-v2`)**: Multi-section CSV that includes metadata, a `MAPDATA` section, and a `TABLEROWS` section. This is designed to round-trip through the import flow.

### Rate limits & compliance
- Discogs API enforces strict rate limits; large collections can take time due to per-release country lookups.
- **Upstash Workflow** handles rate limiting automatically with built-in delays and retries.
- **Redis Storage**: Job progress and results are cached in Upstash KV/Redis with 24-hour TTL.
- Data attribution: "Data provided by Discogs" is shown in the UI and links back to Discogs pages.
- Freshness: cached/aggregated data is intended for use within the Discogs 6-hour freshness window.

### Development without Upstash
The app will work locally without Upstash configured:
- Jobs will run directly in the serverless function (less resilient)
- Progress is stored in memory only (lost on restart)
- Rate limiting still applies but may be less reliable

## License

MIT
