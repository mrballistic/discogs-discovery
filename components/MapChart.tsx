"use client";

import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { geoGraticule, geoNaturalEarth1, geoPath } from "d3-geo";
import { scaleLinear } from "d3-scale";
import { feature } from "topojson-client";
import { Box, Typography, Tooltip, IconButton, Stack } from "@mui/material";
import { Plus, Minus, Maximize, Target } from "lucide-react";

/** Simplified coordinate lookup for auto-focusing on common regions. */
const COUNTRY_COORDS: Record<string, [number, number]> = {
  "US": [-95, 37],
  "GB": [-2, 54],
  "Germany": [10, 51],
  "France": [2, 46],
  "Japan": [138, 36],
  "Canada": [-106, 56],
  "Australia": [133, -25],
  "Netherlands": [5, 52],
  "Italy": [12, 41],
  "Spain": [-3, 40],
  "Brazil": [-51, -14],
  "China": [104, 35],
  "Russia": [105, 61],
  "South Africa": [24, -28],
  "Mexico": [-102, 23],
  "Sweden": [18, 60],
  "Norway": [8, 60],
  "Finland": [25, 61],
};

/** Standard ISO-110m world map topojson used by react-simple-maps. */
const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

/**
 * Props for the choropleth map. Accepts normalized country buckets keyed by name/ISO code and
 * exposes callbacks so the parent page can filter the label table when a geography is selected.
 */
interface MapChartProps {
  /** Country bucket → release count used to shade the map. */
  data: Record<string, number>;
  /** Handler invoked when a country is clicked; receives ISO/name or null to clear. */
  onCountryClick: (country: string | null) => void;
  /** Current selected country (ISO/name) so the map can highlight it. */
  selectedCountry: string | null;
}

/**
 * Choropleth map rendering release density by country. Uses a forgiving lookup to reconcile Discogs
 * country strings with topojson naming, covering the US/GB aliasing noted in the PRD.
 *
 * @param data Aggregated country counts for the choropleth.
 * @param onCountryClick Callback fired when a geography is selected.
 * @param selectedCountry Currently selected country to highlight and filter.
 */
export function MapChart({ data, onCountryClick, selectedCountry }: MapChartProps) {
  const width = 800;
  const height = 400;

  const [position, setPosition] = useState({ zoom: 1, offset: [0, 0] as [number, number] });
  const [geographies, setGeographies] = useState<Array<{ geometry: unknown; properties: { name: string } }>>([]);
  const hasFocused = useRef(false);
  const dragState = useRef<{
    dragging: boolean;
    startX: number;
    startY: number;
    startOffset: [number, number];
  }>({ dragging: false, startX: 0, startY: 0, startOffset: [0, 0] });

  const projection = useMemo(() => {
    return geoNaturalEarth1()
      .translate([width / 2, height / 2])
      .scale(147);
  }, [width, height]);

  const path = useMemo(() => {
    return geoPath(projection);
  }, [projection]);

  const spherePath = useMemo(() => {
    return path({ type: "Sphere" } as never) || "";
  }, [path]);

  const graticulePath = useMemo(() => {
    const g = geoGraticule()();
    return path(g as never) || "";
  }, [path]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(GEO_URL);
        const topo = await res.json();
        const countries = feature(topo, topo.objects.countries);
        const feats = (countries as { features?: Array<{ geometry: unknown; properties: { name: string } }> }).features || [];
        if (!cancelled) setGeographies(feats);
      } catch (err) {
        console.error("Failed to load map data", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Determine max value for color scale
  const maxValue = useMemo(() => {
    return Math.max(0, ...Object.values(data));
  }, [data]);

  const colorScale = useMemo(() => {
    return scaleLinear<string>()
      .domain([0, maxValue || 1])
      .range(["#27272a", "#6366f1"]); // zinc-800 to primary color
  }, [maxValue]);

  const handleReset = useCallback(() => {
    setPosition({ zoom: 1, offset: [0, 0] });
  }, []);

  const handleFocus = useCallback(() => {
    let totalLon = 0;
    let totalLat = 0;
    let totalWeight = 0;

    Object.entries(data).forEach(([name, count]) => {
      // Use coordinate lookup for standard codes or the name itself if it's in our map
      const coords = COUNTRY_COORDS[name];
      if (count > 0 && coords) {
        totalLon += coords[0] * count;
        totalLat += coords[1] * count;
        totalWeight += count;
      }
    });

    if (totalWeight > 0) {
      const lon = totalLon / totalWeight;
      const lat = totalLat / totalWeight;
      const newZoom = 2.5;
      const projected = projection([lon, lat]);
      if (!projected) {
        handleReset();
        return;
      }
      setPosition({
        zoom: newZoom,
        offset: [width / 2 / newZoom - projected[0], height / 2 / newZoom - projected[1]],
      });
    } else {
      handleReset();
    }
  }, [data, handleReset, height, projection, width]);

  const handleZoomIn = () => {
    setPosition((pos) => {
      if (pos.zoom >= 4) return pos;
      const nextZoom = Math.min(4, pos.zoom * 1.5);
      const dx = (width / 2) * (1 / nextZoom - 1 / pos.zoom);
      const dy = (height / 2) * (1 / nextZoom - 1 / pos.zoom);
      return { zoom: nextZoom, offset: [pos.offset[0] + dx, pos.offset[1] + dy] };
    });
  };

  const handleZoomOut = () => {
    setPosition((pos) => {
      if (pos.zoom <= 1) return pos;
      const nextZoom = Math.max(1, pos.zoom / 1.5);
      const dx = (width / 2) * (1 / nextZoom - 1 / pos.zoom);
      const dy = (height / 2) * (1 / nextZoom - 1 / pos.zoom);
      return { zoom: nextZoom, offset: [pos.offset[0] + dx, pos.offset[1] + dy] };
    });
  };

  /** Auto-focus on first data load to 'only show relevant countries' per user request. */
  useEffect(() => {
    if (maxValue > 0 && !hasFocused.current) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        handleFocus();
        hasFocused.current = true;
    }
  }, [maxValue, handleFocus]);

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    dragState.current.dragging = true;
    dragState.current.startX = event.clientX;
    dragState.current.startY = event.clientY;
    dragState.current.startOffset = position.offset;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragState.current.dragging) return;
    const dx = event.clientX - dragState.current.startX;
    const dy = event.clientY - dragState.current.startY;
    setPosition((pos) => ({
      ...pos,
      offset: [dragState.current.startOffset[0] + dx / pos.zoom, dragState.current.startOffset[1] + dy / pos.zoom],
    }));
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    dragState.current.dragging = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <Box sx={{ width: "100%", height: "500px", background: "#171717", borderRadius: 4, overflow: "hidden", position: "relative" }}>
      {/* Zoom Controls */}
      <Stack 
        sx={{ 
          position: "absolute", 
          top: 16, 
          right: 16, 
          zIndex: 10, 
          bgcolor: "rgba(0,0,0,0.6)", 
          borderRadius: 2,
          p: 0.5
        }}
      >
        <IconButton onClick={handleZoomIn} size="small" sx={{ color: "#fff" }} title="Zoom In">
          <Plus size={18} />
        </IconButton>
        <IconButton onClick={handleZoomOut} size="small" sx={{ color: "#fff" }} title="Zoom Out">
          <Minus size={18} />
        </IconButton>
        <IconButton onClick={handleReset} size="small" sx={{ color: "#fff" }} title="Zoom to World">
          <Maximize size={18} />
        </IconButton>
        <IconButton onClick={handleFocus} size="small" sx={{ color: "#fff" }} title="Focus on Collection">
          <Target size={18} />
        </IconButton>
      </Stack>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: "100%", touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <g transform={`translate(${position.offset[0]}, ${position.offset[1]}) scale(${position.zoom})`}>
          <path d={spherePath} stroke="#3f3f46" strokeWidth={0.5} fill="transparent" />
          <path d={graticulePath} stroke="#3f3f46" strokeWidth={0.5} fill="transparent" />
          {geographies.map((geo, idx) => {
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
                <Tooltip key={`${countryName}-${idx}`} title={`${countryName}: ${matchCount} releases`}>
                  <path
                    d={path(geo as never) || ""}
                    onClick={() => {
                        // Return the standardized code if possible, or the name
                        if (countryName === "United States of America") onCountryClick("US");
                        else if (countryName === "United Kingdom") onCountryClick("GB");
                        else onCountryClick(countryName);
                    }}
                    fill={matchCount > 0 ? colorScale(matchCount) : "#27272a"}
                    stroke={isSelected ? "#fff" : "#52525b"}
                    strokeWidth={isSelected ? 2 : 0.5}
                    style={{ outline: "none" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.cursor = "pointer";
                      e.currentTarget.style.fill = "#4f46e5";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.cursor = "default";
                      e.currentTarget.style.fill = matchCount > 0 ? colorScale(matchCount) : "#27272a";
                    }}
                  />
                </Tooltip>
              );
            })}
        </g>
      </svg>
      
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
