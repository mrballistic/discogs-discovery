"use client";

import React from 'react';
import { DataGrid, GridColDef, GridToolbar, GridRenderCellParams } from '@mui/x-data-grid';
import { Box, Paper, Link as MuiLink } from '@mui/material';
import { ExternalLink } from 'lucide-react';

/**
 * Props for the LabelTable. Rows are the aggregated label breakdown defined in `lib/queue`,
 * wired to the DataGrid to satisfy the PRD requirement for sortable, filterable label details.
 */
interface LabelTableProps {
  /** Array of label rows returned by the backend; accepts unknown to keep the component generic. */
  rows: unknown[];
  /** Optional loading flag to show skeleton state while the job runs. */
  loading?: boolean;
}

/** Columns shown in the MUI DataGrid, aligned with PRD table requirements. */
const columns: GridColDef[] = [
  { 
    field: 'labelName', 
    headerName: 'Label', 
    flex: 2, 
    minWidth: 200,
    renderCell: (params: GridRenderCellParams) => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <MuiLink 
          href={`https://www.discogs.com/label/${params.row.labelId}`} 
          target="_blank" 
          rel="noopener noreferrer"
          sx={{ color: '#fff', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
        >
          {params.value}
        </MuiLink>
        <ExternalLink size={14} color="#666" />
      </Box>
    )
  },
  { 
    field: 'releaseCount', 
    headerName: 'Releases Owned', 
    type: 'number', 
    flex: 1, 
    minWidth: 120,
    align: 'left',
    headerAlign: 'left'
  },
  { 
    field: 'country', 
    headerName: 'Release Country', 
    flex: 1, 
    minWidth: 150 
  },
];

/**
 * DataGrid wrapper that renders the label breakdown table beneath the choropleth map. The grid
 * includes quick filter, sorting, and stable IDs so that clicking a country in the map can filter
 * the rows without re-fetching data.
 *
 * @param rows Label aggregation rows returned by the analysis job.
 * @param loading Whether the table should display the built-in loading overlay.
 */
export function LabelTable({ rows, loading = false }: LabelTableProps) {
  return (
    <Paper sx={{ height: 600, width: '100%', background: '#171717', border: '1px solid #333' }}>
      <DataGrid
        rows={rows}
        columns={columns}
        getRowId={(row) => row.key}
        loading={loading}
        density="comfortable"
        slots={{ toolbar: GridToolbar }}
        slotProps={{
          toolbar: {
            showQuickFilter: true,
            quickFilterProps: { debounceMs: 500 },
          },
        }}
        sx={{
          border: 'none',
          color: '#ededed',
          '& .MuiDataGrid-cell': {
            borderColor: '#333',
          },
          '& .MuiDataGrid-columnHeaders': {
            borderColor: '#333',
            background: '#262626',
            color: '#a1a1aa',
            textTransform: 'uppercase',
            fontSize: '0.75rem',
            fontWeight: 600,
          },
          '& .MuiDataGrid-footerContainer': {
            borderColor: '#333',
            background: '#262626',
          },
          '& .MuiTablePagination-root': {
            color: '#a1a1aa',
          },
          '& .MuiButton-root': {
            color: '#a1a1aa',
          },
          '& .MuiInputBase-root': {
            color: '#ededed',
            background: '#0a0a0a',
            border: '1px solid #333',
            borderRadius: 1,
            padding: '4px 8px',
          },
          '& .MuiSvgIcon-root': {
            color: '#a1a1aa',
          },
        }}
      />
    </Paper>
  );
}
