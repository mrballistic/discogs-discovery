# PRD — Discogs Collection Country Heatmap + Label Breakdown Table

**Document version:** v0.2 (updated)
**Last updated:** 2025-12-30
**Status:** Draft (MVP-focused)
**Primary library:** `@lionralfs/discogs-client` ([GitHub][2])

## 1. Summary

### What we’re building

A website that takes a Discogs username (and optionally Discogs OAuth login), fetches the user’s collection, and produces:

1. A **world heatmap** (choropleth) where each country’s intensity is **weighted by number of releases owned**, using each release’s **Discogs “country” field**.

2. A **table under the map (MUI X DataGrid)** listing label-level breakdown, including:

- **Label name** (clickable link to Discogs label page)
- **# releases owned**
- **Country** (release country; unknowns included)

### Why this approach (release country)

You confirmed:

- Heat map weighted by **# of releases**
- **Release country is fine**
- Unknown is fine (table can include them)

So we’re explicitly _not_ doing “label HQ location inference / geocoding” in the MVP.

## 2. Goals

### Primary goals

- **G1:** For a given Discogs user, show a country heatmap weighted by **release count**.
- **G2:** Provide a **DataGrid table** under the map with label breakdown, including **unknown** countries.
- **G3:** Support public collections with username-only, and optionally support private collections via OAuth.
- **G4:** Make it resilient to pagination, rate limits, and large collections.

### Secondary goals

- **G5:** Exports (CSV/JSON) of the aggregated dataset.
- **G6:** Click a country on the map to filter the DataGrid.

## 3. Non-goals (MVP)

- Not identifying label HQ via address parsing / geocoding.
- Not scraping Discogs pages (API-only).
- Not building marketplace pricing analytics.

## 4. Users & use cases

### Personas

- **Collector**: “Where are my records from (as releases)?”
- **Explorer**: “Show me labels I collect most, and what countries those releases tend to be from.”

### Core user stories

1. Enter a username → see map + label table.
2. Click a country → table filters to that country.
3. Sort labels by release count, search labels, export results.
4. Optional: log in with Discogs OAuth to analyze private collection.

## 5. Requirements

### 5.1 Functional requirements

#### Input & auth

- Username input field.
- Button: “Analyze public collection”
- Button: “Connect Discogs” (OAuth 1.0a)
  OAuth steps supported by `DiscogsOAuth` in `@lionralfs/discogs-client`. ([GitHub][2])

#### Collection ingestion

- Fetch releases from folder `0` (“All”) by default. `getReleases(user, folder, params)` exists and supports pagination params. ([GitHub][2])
- Paginate through entire folder:

  - Default Discogs pagination is `page=1`, `per_page=50` if omitted; max per_page up to 100 (per Discogs conventions; library references defaults explicitly). ([GitHub][2])

- Extract per collection item:

  - `releaseId` (collection item `id`)
  - `labels[]` (name + id)
  - (optional) cover image/thumb for richer UI

#### Release country resolution

- We need a `country` per release. The Discogs **release endpoint** returns `country` as part of `GetReleaseResponse`. ([jsDelivr][3])
- **Important constraint:** The collection endpoint “basic_information” typing does **not** include `country`. ([jsDelivr][1])
  Therefore MVP should:

  - Phase A: fetch all collection items (fast)
  - Phase B: fetch `database().getRelease(releaseId)` for each unique releaseId to obtain `country` ([jsDelivr][3])
  - Optimization: if `basic_information.country` is present in real payloads, use it and skip the extra call (defensive coding).

#### Aggregation outputs

We will produce two related aggregates:

**A) Map data (country → releasesOwned)**

- Each release counts once toward its `country`.
- Unknown or blank `country` → bucket `Unknown`.

**B) Table data (rows)**
You asked for: label name (linked), # releases owned, country.

Best-fit row definition:

- One row per `(labelId, labelName, releaseCountryBucket)` with:

  - `releaseCount`
  - `labelUrl` (Discogs label page)
  - `country` (release country or `Unknown`)

- This naturally includes unknowns and supports country filtering.

> Note: a release can have multiple labels. We’ll define “label assignment mode” (see below).

#### Label assignment mode (avoid confusing counts)

Two reasonable modes:

- **Mode 1 (MVP default): Primary label only**
  Use the first label in `basic_information.labels[]` as “primary” and count the release only for that one label.
  Pros: totals align nicely; simpler mental model.
- **Mode 2 (optional): All labels**
  Count the release toward every label listed.
  Pros: “identifies all labels” more literally; Cons: double-counting is possible.

PRD decision:

- **MVP:** Primary label only
- **Future setting:** Toggle to “All labels”

#### UI requirements

- World choropleth map (country-level).
- Table (MUI X DataGrid) under the map:

  - Columns:

    - Label (name, clickable)
    - Releases owned (integer)
    - Country (string)

  - Sorting by releases owned desc default.
  - Filter/search label.
  - Filter by country via map click.
  - Rows with `Unknown` country included (no special casing besides display).

#### Export

- Export the DataGrid rows to CSV and JSON.

### 5.2 Non-functional requirements

#### Rate limiting / throttling

- The Discogs API enforces rate limits; the client surfaces a `rateLimit` object per response and supports throttling/backoff configuration. ([GitHub][2])
- Our backend must:

  - throttle requests
  - use exponential backoff on `429 Too Many Requests` ([GitHub][2])
  - coordinate concurrency across background jobs

#### Compliance (Discogs API Terms)

We must implement these requirements in the UI and caching strategy:

- Show prominent notice:
  “This application uses Discogs’ API but is not affiliated with, sponsored or endorsed by Discogs…” ([Discogs][4])
- Display “Data provided by Discogs” next to data with a link back to Discogs pages; link must not be `nofollow`. ([Discogs][4])
- Do not display API content if it’s more than **6 hours** older than Discogs; do not cache/store longer than necessary. ([Discogs][4])

#### Performance

- Large collections require many `getRelease` calls. We must:

  - run as background job
  - show progress
  - cache release-country lookups for up to the allowed window

#### Privacy & security

- OAuth tokens (if used) must never be exposed to the browser except via secure server session.
- Provide “disconnect” (clear session / delete tokens stored by us).

## 6. Success criteria (acceptance)

- Given username, system renders:

  - heatmap with at least one country shaded (if any countries present)
  - DataGrid with label rows (including Unknown rows where needed)

- Clicking a country filters the table.
- Label links navigate to Discogs label pages.
- Exports download.

## 7. Risks

- **R1:** Many API calls for country resolution (per release)
  Mitigation: job queue, throttling, caching (<= 6 hours), partial rendering.
- **R2:** Country strings aren’t always ISO country names (e.g., “UK”, “Europe”)
  Mitigation: normalization layer + “Unmapped/Unknown” bucket.

## 8. Rollout

- MVP: public username mode + map + DataGrid + export.
- Add OAuth: private collections.
- Add “All labels” counting mode toggle.

---

# Design doc — Updated architecture (release country + DataGrid)

## 1. Architecture overview

**Frontend:** Next.js (App Router) + MUI + MUI X DataGrid
**Backend:** Next.js route handlers (Node runtime) + worker queue
**Discogs API client:** `@lionralfs/discogs-client` ([GitHub][2])

### Why Node runtime (not Edge)

OAuth signing and high-volume API calling are more reliable in Node than Edge. Also, Discogs OAuth 1.0a is explicitly supported by the library. ([GitHub][2])

## 2. Data flow

### 2.1 Public flow (username)

1. User enters username → `POST /api/runs { username }`
2. Server creates `runId`, enqueues job
3. Worker:

   - fetches collection folder 0 pages via `user().collection().getReleases(username, 0, { page, per_page })` ([GitHub][2])
   - extracts release IDs + primary labels
   - resolves release countries (see below)
   - produces aggregates for map + DataGrid

4. UI polls `GET /api/runs/{runId}` for status + partial results
5. UI renders map + DataGrid

### 2.2 OAuth flow (optional)

- Implement OAuth handshake using `DiscogsOAuth.getRequestToken()` and `getAccessToken()` from the library. ([GitHub][2])
- Use OAuth-authenticated `DiscogsClient` when calling collection endpoints.

## 3. Release country resolution strategy

### 3.1 Why we need a second pass

- Collection “basic_information” includes labels/artists/formats/etc. but not `country` in the library type. ([jsDelivr][1])
- Release endpoint includes `country`. ([jsDelivr][3])

### 3.2 Algorithm

Inputs:

- `releaseIds[]` from collection pages
- `labelByRelease[releaseId] = primaryLabel { id, name }`

Process:

1. For each `releaseId`:

   - If collection payload includes `basic_information.country` (defensive check), use it.
   - Else call `client.database().getRelease(releaseId)` and read `data.country`. ([jsDelivr][3])

2. Normalize country string → `countryBucket` (ISO2 if possible, else Unknown/Unmapped)
3. Emit:

   - map increment: `countryBucket += 1`
   - table increment: `(labelId,labelName,countryBucket) += 1`

### 3.3 Normalization rules

We’ll implement `normalizeCountry(raw: string | null)`:

- Trim, collapse whitespace
- Common aliases mapping:

  - `UK`, `U.K.` → `GB`
  - `USA`, `U.S.A.`, `US` → `US`

- If raw is empty/null → `Unknown`
- If raw is a region like `Europe`, `Worldwide` → `Unmapped` (still in table, excluded or grouped on map)
- Otherwise attempt ISO conversion from name

Design choice: show `Unknown` and `Unmapped` in the DataGrid; on the map we can either:

- omit them, and/or
- show an “Unknown” chip above the map with count

## 4. Storage & caching (within TOU constraints)

Discogs TOU says:

- don’t display content older than **6 hours**
- don’t cache/store longer than necessary ([Discogs][4])

So:

- Cache `releaseId → country` with TTL ≤ 6 hours.
- Cache run results (map + table) with TTL ≤ 6 hours.
- If user opens an old run, force refresh (re-run job) before showing results.

Implementation options:

- Redis (best for TTL caches)
- Postgres tables with `expiresAt` + cleanup job

## 5. API endpoints (internal)

- `POST /api/runs`

  - body: `{ username, mode?: "public" | "oauth" }`
  - returns: `{ runId }`

- `GET /api/runs/{runId}`

  - returns: `{ status, progress, mapData, tableRows }`

- `GET /api/export/{runId}?format=csv|json`
- OAuth:

  - `GET /api/auth/discogs/start`
  - `GET /api/auth/discogs/callback`

## 6. UI design

### Page layout

- Header: username + “refresh” + “export”
- **Map**: choropleth (country shading by release count)
- **DataGrid** under map (full dataset)

### DataGrid columns

- **Label**: render cell as `<Link href={https://www.discogs.com/label/{id}} />`
- **Releases owned**: integer
- **Country**: string (ISO2 or display name; unknown/unmapped allowed)

### Interaction

- Click country on map:

  - set `countryFilter = ISO2`
  - DataGrid filters to rows with that country

- Clear filter: “All countries”

## 7. Compliance UI requirements (explicit)

We must show:

- Footer disclaimer text required by Discogs ([Discogs][4])
- “Data provided by Discogs” label with a link:

  - For table: each label link already points to Discogs label page (good)
  - For map/aggregates: add a “Data provided by Discogs” caption linking to the user’s Discogs collection page (web UI), and avoid `nofollow` ([Discogs][4])

---

# Implementation plan — Updated (no disconnect, release country, DataGrid)

## Phase 1 — Project scaffold

- Next.js + TypeScript + MUI + MUI X DataGrid
- Basic pages:

  - `/` (input + start run)
  - `/run/[runId]` (progress + results)

## Phase 2 — Discogs integration (public)

- Add `@lionralfs/discogs-client` ([GitHub][2])
- Implement `getReleases(username, folder=0)` pagination fetcher ([GitHub][2])
- Parse releases → `{ releaseId, primaryLabel }`

## Phase 3 — Country resolver (release endpoint)

- Implement `getReleaseCountry(releaseId)` using `database().getRelease(releaseId)` and `data.country` ([jsDelivr][3])
- Implement throttling/backoff:

  - respect `rateLimit` returned by the client ([GitHub][2])
  - exponential backoff on 429 per library config ([GitHub][2])

- Add `normalizeCountry()` + “Unknown/Unmapped” rules

## Phase 4 — Aggregation + results API

- Build aggregates:

  - `countryCounts` for map
  - `rows` for DataGrid: `{ labelId, labelName, country, releaseCount }`

- Add export endpoints (CSV/JSON)

## Phase 5 — Job system + progress

Because country resolution can be many calls:

- Add queue/worker (BullMQ+Redis or DB-backed queue)
- Store run progress:

  - pages fetched
  - releases processed
  - countries resolved

- UI polling + partial rendering:

  - show map/table progressively as counts accumulate

## Phase 6 — Map component

- Choose mapping library (e.g., `react-simple-maps` or `d3-geo`)
- Render choropleth from `countryCounts`
- On click, set DataGrid filter

## Phase 7 — OAuth (optional but recommended)

- Implement Discogs OAuth using `DiscogsOAuth` from `@lionralfs/discogs-client` ([GitHub][2])
- Use OAuth-authenticated client for collection access
- Secure session storage; no tokens in client JS

## Phase 8 — Compliance hardening

- Add required notices + attribution
- Enforce ≤ 6-hour cache/display window (invalidate old runs) ([Discogs][4])

## Phase 9 — Quality + edge cases

- Handle:

  - empty collections
  - missing country
  - “Europe”/regions
  - rate limit exhaustion

- Add “sampling mode” (optional) for huge collections (first N releases) to preview faster

---

## One key callout (so you’re not surprised)

Your choice “release country is fine” is totally workable, but it _may_ require **one Discogs API call per release** to fetch `country` from `database.getRelease`, because the collection endpoint’s `basic_information` type does not include `country`. ([jsDelivr][1])

That’s why the design leans heavily on:

- background jobs
- throttling/backoff
- caching results for ≤ 6 hours (per TOU) ([Discogs][4])

[1]: https://cdn.jsdelivr.net/npm/%40lionralfs/discogs-client%404.1.4/types/collection.d.ts "cdn.jsdelivr.net"
[2]: https://github.com/lionralfs/discogs-client "GitHub - lionralfs/discogs-client: A JavaScript Discogs Client for browsers and Node.js (ESM and CommonJS)"
[3]: https://cdn.jsdelivr.net/npm/%40lionralfs/discogs-client%404.1.4/types/types.d.ts "cdn.jsdelivr.net"
[4]: https://support.discogs.com/hc/en-us/articles/360009334593-API-Terms-of-Use "API Terms of Use – Discogs"
