# Discogs Discovery

A visual exploration tool for Discogs collections. This application generates a world heatmap and a detailed breakdown of your record collection based on the release country of your items.

## Features

- **World Heatmap**: Visualizes the density of your collection across the globe.
- **Label Breakdown**: See which labels you collect the most, and where those releases come from.
- **Interactive Filtering**: Click on any country in the map to filter the label table.
- **Exports**: Download your aggregated data as CSV or JSON.
- **Dark Mode**: A premium, dark-themed UI built with Material UI.

## Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **UI Components**: Material UI (MUI) + MUI X DataGrid
- **Mapping**: react-simple-maps + d3-scale
- **Discogs Client**: @lionralfs/discogs-client

## Getting Started

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Run the development server**:

   ```bash
   npm run dev
   ```

3. **Open the app**:
   Navigate to [http://localhost:3000](http://localhost:3000).

## Usage

1. Enter your Discogs username (e.g., `milkman` or your own).
2. Click "Analyze Collection".
3. Wait for the analysis to complete. Consider that Discogs API rate limits are strict (60 requests/minute), so large collections may take some time.
4. Explore your dashboard!

## License

MIT
