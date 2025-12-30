"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  TextField,
  Button,
  Container,
  Typography,
  Box,
  Paper,
  CircularProgress,
  FormControlLabel, // Added
  Checkbox, // Added
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

/**
 * Landing page where users start collection analysis. Handles username input, optional OAuth
 * connection, and passes sampling/all-label toggles to the backend so results match PRD table/map.
 */
export default function Home() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [allLabels, setAllLabels] = useState(false);
  const [samplingEnabled, setSamplingEnabled] = useState(false);
  const [user, setUser] = useState<{ isLoggedIn: boolean; username?: string } | null>(null);
  const router = useRouter();

  /**
   * Fetch the current session to prefill username and show OAuth connection state. Mirrors the
   * requirement that private collections use OAuth while keeping username-only mode available.
   */
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        setUser(data);
        if (data.username) setUsername(data.username);
      });
  }, []);

  /**
   * Kick off the analysis job by POSTing to `/api/analyze`. Accepts optional toggles for
   * sampling (fast demo mode) and allLabels counting (double counts per PRD future toggle).
   *
   * @param e Form submit event from the Analyze button.
   */
  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // If logged in and username matches self, or empty, backend handles it.
        // We explicitly send username if user typed it.
        body: JSON.stringify({ 
          username: username.trim(),
          allLabels,
          sampleSize: samplingEnabled ? 100 : undefined
        }),
      });
      
      const data = await res.json();
      if (data.runId) {
        router.push(`/run/${data.runId}`);
      } else {
        alert("Failed to start analysis: " + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  /** Redirects to the Discogs OAuth login endpoint for private collection analysis. */
  const handleLogin = () => {
    window.location.href = "/api/auth/login";
  };

  /** Disconnects the session and clears the username input. */
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser({ isLoggedIn: false });
    setUsername("");
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
          backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)), url("/background.jpg")',
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
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
              Visualize your record collection by country of origin.
            </Typography>

            {user?.isLoggedIn ? (
               <Box sx={{ width: '100%', mb: 3, textAlign: 'center' }}>
                 <Typography sx={{ color: '#10b981', mb: 2 }}>
                   Connected as <strong>{user.username}</strong>
                 </Typography>
                 <Button variant="outlined" size="small" onClick={handleLogout} sx={{ color: '#666', borderColor: '#333' }}>
                   Disconnect
                 </Button>
               </Box>
            ) : (
               <Box sx={{ width: '100%', mb: 4, display: 'flex', justifyContent: 'center' }}>
                 <Button 
                   variant="outlined" 
                   onClick={handleLogin}
                   sx={{ 
                     borderColor: '#333', 
                     color: '#fff', 
                     '&:hover': { borderColor: '#fff' } 
                   }}
                 >
                   Connect with Discogs (Optional)
                 </Button>
               </Box>
            )}

            <Box component="form" onSubmit={handleAnalyze} sx={{ width: "100%" }}>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Discogs Username (e.g., milkman)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                helperText={user?.isLoggedIn ? "You can analyze other users too, or leave simple to analyze yourself." : "Enter a public username."}
                sx={{ 
                  mb: 1,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  }
                }}
              />
              <FormControlLabel
                control={
                  <Checkbox 
                    checked={allLabels} 
                    onChange={(e) => setAllLabels(e.target.checked)} 
                    color="primary"
                    sx={{ color: '#444' }}
                  />
                }
                label={
                  <Typography variant="body2" color="text.secondary">
                    Count All Labels (Includes secondary/sub-labels)
                  </Typography>
                }
                sx={{ mb: 1, ml: 0 }}
              />
              <FormControlLabel
                control={
                  <Checkbox 
                    checked={samplingEnabled} 
                    onChange={(e) => setSamplingEnabled(e.target.checked)} 
                    color="primary"
                    sx={{ color: '#444' }}
                  />
                }
                label={
                  <Typography variant="body2" color="text.secondary">
                    Fast Sampling (Limit analyze to 100 random items)
                  </Typography>
                }
                sx={{ mb: 3, ml: 0, width: '100%' }}
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
