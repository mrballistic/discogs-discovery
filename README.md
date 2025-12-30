# Discogs Discovery

A visual exploration tool for Discogs collections. This application generates a world heatmap and a detailed breakdown of your record collection based on the release country of your items.

## Features

- **World Heatmap**: Visualizes collection density by release country (choropleth).
- **Label Breakdown**: Table of labels with release counts and release country buckets.
- **Interactive Filtering**: Click a country on the map to filter the table; quick search in-grid.
- **Exports**: Download the aggregated table as CSV or JSON.
- **Modes & Toggles**: Public username mode by default; optional Discogs OAuth for private collections. Toggle “Count All Labels” (primary vs. all labels) and “Fast Sampling” for quick demos.
- **Dark Mode**: Premium dark UI built with MUI + MUI X DataGrid.

## Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **UI Components**: Material UI (MUI) + MUI X DataGrid
- **Mapping**: react-simple-maps + d3-scale
- **Discogs Client**: @lionralfs/discogs-client

## Getting Started

1. **Set environment variables** (see `env.example`):
   - `DISCOGS_CONSUMER_KEY` / `DISCOGS_CONSUMER_SECRET` (needed for OAuth/private collections)
   - `SESSION_PASSWORD` (32+ chars for iron-session)

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

## Usage

1. (Optional) Click **“Connect with Discogs”** to authorize private collections; otherwise enter a public username.
2. Choose toggles:
   - **Count All Labels**: include secondary/sub-labels (may double-count releases).
   - **Fast Sampling**: analyze a 100-item sample for quick demos.
3. Click **“Analyze Collection”**. A run is queued and polled until completion (jobs live in-memory; a server restart forgets them).
4. Explore the dashboard: click map to filter the table, sort/search, and export CSV/JSON.

### Rate limits & compliance
- Discogs API enforces strict rate limits; large collections can take time due to per-release country lookups.
- Data attribution: “Data provided by Discogs” is shown in the UI and links back to Discogs pages.
- Freshness: cached/aggregated data is intended for use within the Discogs 6-hour freshness window.

## License

MIT
