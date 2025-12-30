import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { jobQueue, JobStatus, LabelRow } from '@/lib/queue';

interface ExportMetadata {
  username?: string;
  exportedAt?: string;
  totalReleases?: number;
  totalCountries?: number;
  totalLabels?: number;
}

interface UploadedData {
  mapData: Record<string, number>;
  tableRows: LabelRow[];
  metadata?: ExportMetadata;
}

function parseInteger(value: string): number | undefined {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === ',' && !inQuotes) {
      out.push(current);
      current = '';
      continue;
    }

    current += ch;
  }

  out.push(current);
  return out.map((v) => v.trim());
}

function parseMetadataLine(line: string): { key: string; value: string } | null {
  const match = line.match(/^#\s*([^:]+):\s*(.+)$/);
  if (!match) return null;
  return { key: match[1].trim(), value: match[2].trim() };
}

/**
 * Parse CSV with metadata headers
 */
function parseCSV(content: string): UploadedData {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.replace(/\r$/, ''))
    .filter((line) => line.trim());

  const isRich = lines.some((l) => l.startsWith('# SECTION:'));

  if (isRich) {
    const metadata: ExportMetadata = {};
    const mapData: Record<string, number> = {};
    const tableRows: LabelRow[] = [];

    type Section = 'none' | 'map' | 'rows';
    let section: Section = 'none';
    let sawMapHeader = false;
    let sawRowsHeader = false;

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();

      if (line.startsWith('# SECTION:')) {
        const sectionName = line.replace('# SECTION:', '').trim().toUpperCase();
        if (sectionName === 'MAPDATA') {
          section = 'map';
          sawMapHeader = false;
          continue;
        }
        if (sectionName === 'TABLEROWS') {
          section = 'rows';
          sawRowsHeader = false;
          continue;
        }
        section = 'none';
        continue;
      }

      if (line.startsWith('#')) {
        const parsed = parseMetadataLine(line);
        if (parsed) {
          const k = parsed.key;
          const v = parsed.value;
          if (/^username$/i.test(k)) metadata.username = v;
          else if (/^exportedat$/i.test(k) || /^exported$/i.test(k)) metadata.exportedAt = v;
          else if (/^totalreleases$/i.test(k) || /^total releases$/i.test(k)) metadata.totalReleases = parseInteger(v);
          else if (/^totalcountries$/i.test(k) || /^total countries$/i.test(k)) metadata.totalCountries = parseInteger(v);
          else if (/^totallabels$/i.test(k) || /^total labels$/i.test(k)) metadata.totalLabels = parseInteger(v);
        }
        continue;
      }

      if (section === 'map') {
        const cols = parseCSVLine(line);
        if (!sawMapHeader) {
          sawMapHeader = true;
          continue;
        }
        if (cols.length < 2) continue;
        const country = cols[0];
        const count = parseInteger(cols[1]);
        if (!country || count === undefined) continue;
        mapData[country] = count;
        continue;
      }

      if (section === 'rows') {
        const cols = parseCSVLine(line);
        if (!sawRowsHeader) {
          sawRowsHeader = true;
          continue;
        }
        if (cols.length < 5) continue;

        const [key, labelName, labelId, country, releaseCount] = cols;
        const parsedLabelId = parseInteger(labelId);
        const parsedReleaseCount = parseInteger(releaseCount);
        if (parsedLabelId === undefined || parsedReleaseCount === undefined) continue;

        const row: LabelRow = {
          key: key || `${parsedLabelId}::${country}`,
          labelId: parsedLabelId,
          labelName,
          country,
          releaseCount: parsedReleaseCount,
        };
        tableRows.push(row);
        continue;
      }
    }

    return { metadata, mapData, tableRows };
  }
  
  // Extract metadata from header comments
  const metadata: ExportMetadata = {};
  let dataStartIndex = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('#')) {
      const parsed = parseMetadataLine(line);
      if (parsed) {
        const k = parsed.key;
        const v = parsed.value;
        if (k === 'Username') metadata.username = v;
        if (k === 'Exported') metadata.exportedAt = v;
        if (k === 'Total Releases') metadata.totalReleases = parseInteger(v);
        if (k === 'Total Labels') metadata.totalLabels = parseInteger(v);
      }
    } else {
      dataStartIndex = i;
      break;
    }
  }
  
  // Parse CSV data
  const tableRows: LabelRow[] = [];
  const mapData: Record<string, number> = {};
  
  for (let i = dataStartIndex + 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length >= 4) {
      const [labelName, labelId, country, releaseCount] = values;

      const parsedLabelId = parseInteger(labelId);
      const parsedReleaseCount = parseInteger(releaseCount);
      if (parsedLabelId === undefined || parsedReleaseCount === undefined) continue;

      const row: LabelRow = {
        key: `${labelId}::${country}`,
        labelId: parsedLabelId,
        labelName,
        country,
        releaseCount: parsedReleaseCount
      };
      tableRows.push(row);
      
      // Aggregate country counts
      mapData[country] = (mapData[country] || 0) + row.releaseCount;
    }
  }
  
  return { metadata, mapData, tableRows };
}

/**
 * Upload a previously exported analysis result to skip the API processing.
 * Accepts JSON or CSV files in the same format as the export endpoint.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const fileContent = await file.text();
    let uploadedData: UploadedData;

    if (file.name.endsWith('.json')) {
      try {
        uploadedData = JSON.parse(fileContent);
      } catch (err) {
        return NextResponse.json({ error: 'Invalid JSON format' }, { status: 400 });
      }
    } else if (file.name.endsWith('.csv')) {
      try {
        uploadedData = parseCSV(fileContent);
      } catch (err) {
        return NextResponse.json({ error: 'Invalid CSV format' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'Only JSON and CSV files are supported' }, { status: 400 });
    }

    // Validate the data structure
    if (!uploadedData.mapData || typeof uploadedData.mapData !== 'object') {
      return NextResponse.json({ error: 'Invalid data: missing or invalid mapData' }, { status: 400 });
    }

    if (!Array.isArray(uploadedData.tableRows)) {
      return NextResponse.json({ error: 'Invalid data: missing or invalid tableRows' }, { status: 400 });
    }

    // Validate table rows structure
    for (const row of uploadedData.tableRows) {
      if (
        typeof row.key !== 'string' ||
        typeof row.labelId !== 'number' ||
        typeof row.labelName !== 'string' ||
        typeof row.country !== 'string' ||
        typeof row.releaseCount !== 'number'
      ) {
        return NextResponse.json({ error: 'Invalid data: table rows missing required fields' }, { status: 400 });
      }
    }

    // Create a job with the uploaded data
    const id = uuidv4();
    const username = uploadedData.metadata?.username || 'uploaded-data';
    
    const job: JobStatus = {
      id,
      username,
      status: 'completed',
      progress: {
        message: 'Data loaded from uploaded file',
        percent: 100,
        pagesFetched: 0,
        totalPages: 0,
        releasesProcessed: uploadedData.tableRows.reduce((sum, row) => sum + row.releaseCount, 0),
        totalReleases: uploadedData.tableRows.reduce((sum, row) => sum + row.releaseCount, 0),
      },
      result: {
        mapData: uploadedData.mapData,
        tableRows: uploadedData.tableRows,
      },
      createdAt: Date.now(),
    };

    // Add metadata to indicate this is uploaded data
    job.isUploaded = true;
    job.uploadedAt = new Date().toISOString();
    job.originalExportDate = uploadedData.metadata?.exportedAt;

    await jobQueue.set(id, job);

    return NextResponse.json({ 
      runId: id,
      message: 'Data uploaded successfully',
      username,
      totalReleases: job.progress.totalReleases,
      totalCountries: Object.keys(uploadedData.mapData).length,
      totalLabels: uploadedData.tableRows.length
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
