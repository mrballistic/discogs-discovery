"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Box, 
  Container, 
  Typography, 
  CircularProgress, 
  Button, 
  Alert,
  Link as MuiLink,
  Chip
} from "@mui/material";
import { ArrowLeft, Download, RefreshCw } from "lucide-react";
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import { MapChart } from "@/components/MapChart";
import { LabelTable } from "@/components/LabelTable";
import { JobStatus } from "@/lib/queue";

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6366f1',
    },
    background: {
      default: '#0a0a0a',
      paper: '#171717',
    },
  },
  typography: {
    fontFamily: 'Inter, sans-serif',
  },
});

type DashboardProps = {
  params: Promise<{ id: string }>;
};

export default function Dashboard({ params }: DashboardProps) {
  const router = useRouter();
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);
  
  // Unwrap params
  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  // Polling
  useEffect(() => {
    if (!resolvedParams) return;
    
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/status/${resolvedParams.id}`);
            if (res.status === 404) {
              // Job might have been lost on server restart (in-memory)
              setStatus({ status: 'failed', error: 'Job not found (server may have restarted)' } as JobStatus);
              return;
            }
        const data = await res.json();
        setStatus(data);
        
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(interval);
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);

    return () => clearInterval(interval);
  }, [resolvedParams]);

  const handleExport = (format: 'csv' | 'json') => {
    if (!status?.result?.tableRows) return;
    
    const rows = status.result.tableRows;
    let content = "";
    const filename = `discogs-export-${status.username}.${format}`;
    let type = "";

    if (format === 'json') {
      content = JSON.stringify(rows, null, 2);
      type = "application/json";
    } else {
      // CSV
      const headers = ["Label", "Label ID", "Country", "Releases Owned"];
      const csvRows = rows.map((r: { labelName: string; labelId: number; country: string; releaseCount: number }) => [
        `"${r.labelName.replace(/"/g, '""')}"`,
        r.labelId,
        r.country,
        r.releaseCount
      ]);
      content = [headers.join(","), ...csvRows.map((r: (string | number)[]) => r.join(","))].join("\n");
      type = "text/csv";
    }

    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!status) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', color: '#fff' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Calculate filtered rows
  const filteredRows = selectedCountry 
    ? (status.result?.tableRows || []).filter((r: { country: string }) => {
        if (selectedCountry === "US") return r.country === "US" || r.country === "United States";
        if (selectedCountry === "GB") return r.country === "GB" || r.country === "UK";
        return r.country === selectedCountry;
      })
    : status.result?.tableRows || [];

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh' }}>
        {/* Full-width Header Image */}
        <Box 
          sx={{ 
            width: '100%', 
            height: '50px', 
            backgroundImage: 'url("/header.jpg")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            mb: 0
          }} 
        />
        <Container maxWidth="xl" sx={{ mt: 4 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button 
                startIcon={<ArrowLeft />} 
                onClick={() => router.push('/')}
                sx={{ color: '#a1a1aa' }}
              >
                Back
              </Button>
              <Typography variant="h4" fontWeight="bold">
                {status.username}
                <Typography component="span" variant="h4" sx={{ color: '#666', mx: 1 }}>/</Typography>
                <Typography component="span" variant="h5" sx={{ color: '#a1a1aa' }}>Collection Analysis</Typography>
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              {status.status === 'completed' && (
                <>
                  <Button variant="outlined" startIcon={<Download />} onClick={() => handleExport('csv')}>
                    CSV
                  </Button>
                  <Button variant="outlined" startIcon={<Download />} onClick={() => handleExport('json')}>
                    JSON
                  </Button>
                </>
              )}
            </Box>
          </Box>

          {/* Progress / Status */}
          {status.status !== 'completed' && status.status !== 'failed' && (
             <Alert severity="info" icon={<CircularProgress size={20} />} sx={{ mb: 4, background: '#1c1c1c', color: '#fff' }}>
               {status.progress.message} ({Math.round(status.progress.percent)}%)
             </Alert>
          )}

          {status.status === 'failed' && (
            <Alert severity="error" sx={{ mb: 4 }}>
              Analysis failed: {status.error}
              <Button size="small" startIcon={<RefreshCw />} sx={{ ml: 2 }} onClick={() => router.push('/')}>Try Again</Button>
            </Alert>
          )}

          {/* Main Content */}
          {status.result && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              
              {/* Map Section */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6" fontWeight="bold">Global Distribution</Typography>
                  {selectedCountry && (
                    <Chip 
                      label={`Wait filtering by: ${selectedCountry}`} 
                      onDelete={() => setSelectedCountry(null)} 
                      color="primary"
                    />
                  )}
                </Box>
                <MapChart 
                  data={status.result.mapData} 
                  onCountryClick={setSelectedCountry}
                  selectedCountry={selectedCountry}
                />
                 <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#666' }}>
                  Data provided by Discogs. <MuiLink href={`https://www.discogs.com/user/${status.username}/collection`} target="_blank">View on Discogs</MuiLink>
                </Typography>
              </Box>

              {/* Table Section */}
              <Box>
                <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>Label Breakdown</Typography>
                <LabelTable rows={filteredRows} />
              </Box>
            </Box>
          )}
        </Container>
      </Box>
    </ThemeProvider>
  );
}
