"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  TextField, 
  Button, 
  Container, 
  Typography, 
  Box, 
  Paper, 
  CircularProgress 
} from "@mui/material";
import { Search } from "lucide-react";
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6366f1',
    },
    secondary: {
      main: '#10b981',
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

export default function Home() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      
      const data = await res.json();
      if (data.runId) {
        router.push(`/run/${data.runId}`);
      } else {
        alert("Failed to start analysis");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at 50% 10%, #1a1a1a 0%, #0a0a0a 100%)",
          p: 2,
        }}
      >
        <Container maxWidth="sm">
          <Paper
            elevation={24}
            sx={{
              p: 6,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              borderRadius: 4,
              border: '1px solid #333',
              background: 'rgba(23, 23, 23, 0.8)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <Typography variant="h3" fontWeight="bold" gutterBottom sx={{ background: 'linear-gradient(45deg, #fff, #888)', backgroundClip: 'text', textFillColor: 'transparent', color: 'transparent' }}>
              Discogs Discovery
            </Typography>
            <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 4 }}>
              Visualize your record collection by country of origin. Enter your Discogs username to begin.
            </Typography>

            <Box component="form" onSubmit={handleAnalyze} sx={{ width: "100%" }}>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Discogs Username (e.g., milkman)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                sx={{ 
                  mb: 3,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  }
                }}
              />
              <Button
                fullWidth
                variant="contained"
                size="large"
                type="submit"
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Search />}
                sx={{
                  py: 1.5,
                  borderRadius: 2,
                  fontSize: '1.1rem',
                  textTransform: 'none',
                  boxShadow: '0 4px 14px 0 rgba(99, 102, 241, 0.39)',
                }}
              >
                {loading ? "Initializing..." : "Analyze Collection"}
              </Button>
            </Box>
          </Paper>
        </Container>
      </Box>
    </ThemeProvider>
  );
}
