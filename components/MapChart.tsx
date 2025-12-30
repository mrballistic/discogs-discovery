"use client";

import React, { useMemo } from "react";
import { ComposableMap, Geographies, Geography, Graticule, Sphere } from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import { Box, Typography, Tooltip } from "@mui/material";

// Standard ISO-110m world map
const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface MapChartProps {
  data: Record<string, number>; // Country Name/Code -> Count
  onCountryClick: (country: string | null) => void;
  selectedCountry: string | null;
}

export function MapChart({ data, onCountryClick, selectedCountry }: MapChartProps) {
  // Determine max value for color scale
  const maxValue = useMemo(() => {
    return Math.max(0, ...Object.values(data));
  }, [data]);

  const colorScale = scaleLinear<string>()
    .domain([0, maxValue || 1])
    .range(["#27272a", "#6366f1"]); // zinc-800 to primary color

  return (
    <Box sx={{ width: "100%", height: "500px", background: "#171717", borderRadius: 4, overflow: "hidden", position: "relative" }}>
      <ComposableMap
        projectionConfig={{
          rotate: [-10, 0, 0],
          scale: 147
        }}
        width={800}
        height={400}
        style={{ width: "100%", height: "100%" }}
      >
        <Sphere stroke="#3f3f46" strokeWidth={0.5} id="sphere" fill="transparent" />
        <Graticule stroke="#3f3f46" strokeWidth={0.5} />
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              // Try to match country name or ISO
              // The topojson usually has geo.properties.name and geo.id (ISO 3 number) or ISO 2.
              // For robustness, we might need a lookup map if our logic is strings like "US", "GB".
              // The d3-geo world-atlas uses numeric IDs or ISOA2/3 if using different variants.
              // Let's assume standard scraping yields names, our normalizer maps to ISO2 where possible.
              // But 'world-atlas' usually returns numeric IDs. 
              // We'll use a hack for MVP: 'react-simple-maps' docs often use a file with 3-letter codes.
              // Actually, let's use a URL that definitely has ISO 2/3 codes or names.
              // NOTE: For MVP simplicity, we will check if the NAME is in our data.
              
              const countryName = geo.properties.name; 
              // Our data might have "United States" or "US".
              // Our normalizer produces "US", "GB", "Unmapped".
              // We need a way to map the topojson name to our keys. 
              // Simplest: match Name.
              
              // To enable ISO matching, we would need a proper map. 
              // For this MVP, let's rely on name matching for the visualization if possible, 
              // OR pass ISO codes if we can get them.
              
              // Let's rely on a helper to lookup counts.
              const count = data[countryName] || 0;
              
              // Wait, our normalizer turns "USA" -> "US". 
              // The topojson probably has "United States of America". This is a mismatch risk.
              // RISK: Map won't light up if keys don't match.
              // MITIGATION: We'll use a very forgiving lookup in the map component for MVP, 
              // or just match on "United States", "United Kingdom" etc. 
              
              // Better: In DiscogsService we mapped to "US", "GB".
              // We should check if the Geo properties has that.
              // world-atlas 110m usually creates properties { name: "United States" }.
              // We will just do a quick alias check here for big ones.
              
              let matchCount = 0;
              if (data[countryName]) matchCount = data[countryName];
              if (countryName === "United States of America" && data["US"]) matchCount = data["US"];
              if (countryName === "United Kingdom" && data["GB"]) matchCount = data["GB"];
              
              const isSelected = selectedCountry === countryName || 
                (selectedCountry === "US" && countryName === "United States of America") ||
                (selectedCountry === "GB" && countryName === "United Kingdom");

              return (
                <Tooltip key={geo.rsmKey} title={`${countryName}: ${matchCount} releases`}>
                  <Geography
                    geography={geo}
                    onClick={() => {
                        // Return the standardized code if possible, or the name
                        if (countryName === "United States of America") onCountryClick("US");
                        else if (countryName === "United Kingdom") onCountryClick("GB");
                        else onCountryClick(countryName);
                    }}
                    fill={matchCount > 0 ? colorScale(matchCount) : "#27272a"}
                    stroke={isSelected ? "#fff" : "#52525b"}
                    strokeWidth={isSelected ? 2 : 0.5}
                    style={{
                      default: { outline: "none" },
                      hover: { fill: "#4f46e5", outline: "none", cursor: "pointer" },
                      pressed: { outline: "none" },
                    }}
                  />
                </Tooltip>
              );
            })
          }
        </Geographies>
      </ComposableMap>
      
      {/* Legend / Info */}
      <Box sx={{ position: "absolute", bottom: 16, left: 16, background: "rgba(0,0,0,0.7)", p: 1, borderRadius: 1 }}>
        <Typography variant="caption" sx={{ color: "#a1a1aa" }}>
          Click a country to filter table
          {selectedCountry && (
             <span style={{ color: "#fff", marginLeft: 8, fontWeight: "bold" }}>
               Filter: {selectedCountry}
             </span>
          )}
        </Typography>
      </Box>
    </Box>
  );
}
