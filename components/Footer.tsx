import React from 'react';
import { Box, Typography, Container, Link } from '@mui/material';

/**
 * Footer component providing data attribution and developer credits.
 * Aligns with Discogs API requirements for data attribution.
 */
export function Footer() {
  return (
    <Box 
      component="footer" 
      sx={{ 
        py: 4, 
        mt: 'auto', 
        borderTop: '1px solid #27272a',
        bgcolor: '#0a0a0a',
        width: '100%'
      }}
    >
      <Container maxWidth="xl">
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', sm: 'row' }, 
            justifyContent: 'space-between', 
            alignItems: 'center',
            gap: 2
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Data provided by <Link href="https://www.discogs.com" target="_blank" rel="noopener" sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>Discogs</Link>
          </Typography>
          
          <Typography variant="body2" color="text.secondary">
            ©2026 <Link href="https://github.com/mrballistic" target="_blank" rel="noopener" sx={{ color: '#fff', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>mrBallistic</Link>
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
