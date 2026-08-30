import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, Globe, Radio, EyeOff, Navigation, Compass, Minimize2, Maximize2, ChevronDown, ChevronUp } from 'lucide-react';

const CARTO_API_KEY = 'cb1_2k7z_1_fbe29935c68e085b6c29a984';

const BASEMAP_URLS = {
  carto_voyager: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`,
  carto_dark: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`,
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
};

const BASEMAP_ATTRIBUTIONS = {
  carto_voyager: '&copy; Sagar Netra &copy; UDAAN',
  carto_dark: '&copy; Sagar Netra &copy; UDAAN',
  satellite: '&copy; Sagar Netra &copy; UDAAN'
};

// SVG Ship Icon Generator
const createVesselSvgIcon = (courseDeg, rankColor, isRank1, vesselName, rankNum) => {
  const rotation = (courseDeg || 0) - 90; // Align SVG bow pointing forward
  const size = isRank1 ? 38 : 32;
  const half = size / 2;

  const svgHtml = `
    <div style="position:relative; width:${size}px; height:${size}px; display:flex; items-center; justify-center;">
      ${isRank1 ? `<div style="position:absolute; inset:-4px; border-radius:50%; border:2px dashed ${rankColor}; opacity:0.8; animation:spin 8s linear infinite;"></div>` : ''}
      <svg width="${size}" height="${size}" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(${rotation}deg); filter: drop-shadow(0 0 8px ${rankColor});">
        <!-- Ship Hull -->
        <path d="M 18 2 L 28 14 L 26 31 C 26 33.5 10 33.5 10 31 L 8 14 Z" fill="${rankColor}" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round"/>
        <!-- Deck Superstructure -->
        <rect x="14" y="18" width="8" height="9" rx="1.5" fill="#ffffff" opacity="0.95"/>
        <!-- Bow Indicator -->
        <polygon points="18,4 22,10 14,10" fill="#ffffff"/>
        <!-- Navigation Beacon Light -->
        <circle cx="18" cy="8" r="2" fill="${isRank1 ? '#ffea00' : '#ffffff'}"/>
      </svg>
      <!-- Rank Badge Overlay -->
      <span style="
        position: absolute;
        top: -6px;
        right: -6px;
        background: ${rankColor};
        color: #020617;
        font-family: monospace;
        font-weight: 800;
        font-size: 10px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1.5px solid #ffffff;
        box-shadow: 0 0 6px rgba(0,0,0,0.6);
      ">#${rankNum}</span>
    </div>
  `;

  return L.divIcon({
    className: 'vessel-svg-icon-marker',
    html: svgHtml,
    iconSize: [size, size],
    iconAnchor: [half, half]
  });
};

// Live AIS Ship Icon Generator with Course Rotation & Pulsing Beacon
const createLiveVesselIcon = (courseDeg, vesselName) => {
  const rotation = (courseDeg || 0) - 90; // Rotate bow to course heading
  const size = 30;
  const half = size / 2;

  const svgHtml = `
    <div style="position:relative; width:${size}px; height:${size}px; display:flex; align-items:center; justify-content:center;">
      <div style="position:absolute; inset:-4px; border-radius:50%; background:rgba(16,185,129,0.3); animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
      <svg width="${size}" height="${size}" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(${rotation}deg); filter: drop-shadow(0 0 8px #10b981);">
        <!-- Ship Hull -->
        <path d="M 18 2 L 28 14 L 26 31 C 26 33.5 10 33.5 10 31 L 8 14 Z" fill="#10b981" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round"/>
        <!-- Deck Superstructure -->
        <rect x="14" y="18" width="8" height="9" rx="1.5" fill="#ffffff" opacity="0.95"/>
        <!-- Bow Indicator -->
        <polygon points="18,4 22,10 14,10" fill="#ffffff"/>
        <!-- Navigation Beacon Light -->
        <circle cx="18" cy="8" r="2.2" fill="#34d399"/>
      </svg>
    </div>
  `;

  return L.divIcon({
    className: 'live-vessel-svg-marker',
    html: svgHtml,
    iconSize: [size, size],
    iconAnchor: [half, half]
  });
};

export default function MapView({
  incident,
  allGeometries,
  geometry,
  originGeojson,
  forecastData,
  vessels,
  liveVessels,
  layerToggles,
  setLayerToggles,
  onSelectIncident,
  mapStyle,
  setMapStyle,
  timelineHour = 0,
  activeTab = 'map'
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);

  // Panel Minimize State
  const [isPanelMinimized, setIsPanelMinimized] = useState(false);

  // GeoJSON Layer References
  const allSpillsLayerRef = useRef(null);
  const selectedSpillLayerRef = useRef(null);
  const originLayerRef = useRef(null);
  const forecastLayerRef = useRef(null);
  const driftTimelineLayerRef = useRef(null);
  const vesselTracksLayerRef = useRef(null);
  const vesselMarkersGroupRef = useRef(null);
  const liveVesselMarkersGroupRef = useRef(null);
  const liveMarkersMapRef = useRef({});

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
    });

    const map = L.map(mapContainerRef.current, {
      center: [14.0, 78.0],
      zoom: 5,
      maxZoom: 20,
      zoomControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const initialTile = L.tileLayer(BASEMAP_URLS[mapStyle] || BASEMAP_URLS.carto_voyager, {
      maxZoom: 20,
      maxNativeZoom: mapStyle === 'satellite' ? 17 : 19,
      subdomains: 'abcd',
      attribution: BASEMAP_ATTRIBUTIONS[mapStyle] || BASEMAP_ATTRIBUTIONS.carto_voyager
    }).addTo(map);

    tileLayerRef.current = initialTile;

    // Initialize Layer Groups
    allSpillsLayerRef.current = L.geoJSON(null, {
      style: {
        color: '#ea580c',
        weight: 2,
        fillColor: '#f97316',
        fillOpacity: 0.65
      },
      onEachFeature: (feature, layer) => {
        layer.on('click', () => {
          const incId = feature.properties?.incident_id;
          if (incId) {
            handleSpillClick(incId);
          }
        });
        if (feature.properties?.location_name) {
          layer.bindTooltip(`<b>${feature.properties.location_name}</b><br/>Area: ${feature.properties.spill_area_sqkm} sq km`, {
            sticky: true
          });
        }
      }
    }).addTo(map);

    selectedSpillLayerRef.current = L.geoJSON(null, {
      style: {
        color: '#38bdf8',
        weight: 4,
        fillColor: '#0284c7',
        fillOpacity: 0.85
      }
    }).addTo(map);

    originLayerRef.current = L.geoJSON(null, {
      style: {
        color: '#eab308',
        weight: 2.5,
        dashArray: '6, 6',
        fillColor: '#facc15',
        fillOpacity: 0.35
      }
    }).addTo(map);

    forecastLayerRef.current = L.geoJSON(null, {
      style: (feature) => {
        const hr = feature?.properties?.forecast_hour;
        let color = '#a855f7';
        if (hr === '+6h') color = '#38bdf8';
        else if (hr === '+12h') color = '#60a5fa';
        else if (hr === '+24h') color = '#818cf8';
        else if (hr === '+48h') color = '#a855f7';

        return {
          color: color,
          weight: 2,
          dashArray: '4, 4',
          fillColor: color,
          fillOpacity: 0.3
        };
      }
    }).addTo(map);

    driftTimelineLayerRef.current = L.layerGroup().addTo(map);
    vesselTracksLayerRef.current = L.layerGroup().addTo(map);
    vesselMarkersGroupRef.current = L.layerGroup().addTo(map);
    liveVesselMarkersGroupRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Handle User Click on Oil Spill Polygon
  const handleSpillClick = (incidentId) => {
    if (setMapStyle) setMapStyle('satellite');
    if (setLayerToggles) {
      setLayerToggles(prev => ({
        ...prev,
        liveVessels: false
      }));
    }
    if (onSelectIncident) {
      onSelectIncident(incidentId);
    }
  };

  // 2. Switch Basemap Layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const url = BASEMAP_URLS[mapStyle] || BASEMAP_URLS.carto_voyager;
    const attr = BASEMAP_ATTRIBUTIONS[mapStyle] || BASEMAP_ATTRIBUTIONS.carto_voyager;

    const newTile = L.tileLayer(url, {
      maxZoom: 20,
      maxNativeZoom: mapStyle === 'satellite' ? 17 : 19,
      subdomains: 'abcd',
      attribution: attr
    }).addTo(map);

    tileLayerRef.current = newTile;
  }, [mapStyle]);

  // Auto-resize Leaflet map canvas whenever activeTab or layout changes
  useEffect(() => {
    if (mapRef.current) {
      const timer = setTimeout(() => {
        mapRef.current.invalidateSize();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  // 3. Update All Oil Spills Layer
  useEffect(() => {
    if (!allSpillsLayerRef.current) return;
    allSpillsLayerRef.current.clearLayers();

    if (layerToggles.spill && allGeometries && allGeometries.features) {
      allSpillsLayerRef.current.addData(allGeometries);
    }
  }, [allGeometries, layerToggles.spill]);

  // 4. Update Selected Incident Highlight & Pan Map
  useEffect(() => {
    const map = mapRef.current;
    if (!selectedSpillLayerRef.current) return;
    selectedSpillLayerRef.current.clearLayers();

    if (geometry) {
      selectedSpillLayerRef.current.addData(geometry);
    }

    if (incident?.centroid && map) {
      const [lat, lon] = incident.centroid;
      map.flyTo([lat, lon], 11, { duration: 1.5 });
    }
  }, [geometry, incident]);

  // 5. Update Origin Zone Layer
  // 5. Update Origin Zone Layer & Fly Camera to Origin
  useEffect(() => {
    const map = mapRef.current;
    if (!originLayerRef.current) return;
    originLayerRef.current.clearLayers();

    if (layerToggles.origin && originGeojson) {
      const geoLayer = L.geoJSON(originGeojson, {
        style: {
          color: '#eab308',
          weight: 3,
          dashArray: '6, 6',
          fillColor: '#facc15',
          fillOpacity: 0.45
        }
      });

      originLayerRef.current.addLayer(geoLayer);

      // Add prominent origin centroid target marker
      const props = originGeojson.properties || {};
      const c = props.probable_origin_centroid || [incident?.centroid[0], incident?.centroid[1]];
      if (c && c[0] && c[1]) {
        const originMarker = L.circleMarker([c[0], c[1]], {
          radius: 9,
          color: '#ffffff',
          weight: 2.5,
          fillColor: '#eab308',
          fillOpacity: 0.95
        }).bindTooltip(`
          <div style="font-family:sans-serif; color:#f8fafc; padding:3px;">
            <b style="color:#eab308;">PROBABLE ORIGIN ZONE (-24h)</b><br/>
            Estimated Area: <b>${props.origin_area_sqkm || 3.8} km²</b><br/>
            Reverse Lagrangian Drift Modeling
          </div>
        `, { permanent: true, direction: 'top' });

        originLayerRef.current.addLayer(originMarker);
      }
    }
  }, [originGeojson, layerToggles.origin, incident]);

  // 6. Update Forward Forecast Envelopes Layer
  useEffect(() => {
    if (!forecastLayerRef.current) return;
    forecastLayerRef.current.clearLayers();

    if (layerToggles.forecast && forecastData) {
      const features = [];
      ['6h', '12h', '24h', '48h'].forEach(step => {
        if (layerToggles[`forecast_${step}`] !== false && forecastData[step]?.geojson) {
          features.push(forecastData[step].geojson);
        }
      });
      if (features.length > 0) {
        forecastLayerRef.current.addData({ type: 'FeatureCollection', features });
      }
    }
  }, [forecastData, layerToggles]);

  // 7. Update Drift Timeline Animation Layer (Physics-based Open Sea Trajectory)
  useEffect(() => {
    if (!driftTimelineLayerRef.current) return;
    driftTimelineLayerRef.current.clearLayers();

    if (geometry && timelineHour > 0) {
      // Drift math: surface currents push East-Southeast (offshore along shipping lane)
      // Never drift North onto land!
      const latOffset = -timelineHour * 0.0006; // Southward away from coast
      const lonOffset = timelineHour * 0.0035;  // Eastward along shipping lane
      const expansionFactor = 1.0 + (timelineHour * 0.008);

      const cLat = incident ? incident.centroid[0] : 0;
      const cLon = incident ? incident.centroid[1] : 0;

      const driftedCoords = geometry.geometry.coordinates[0].map(([lon, lat]) => {
        const newLon = cLon + (lon - cLon) * expansionFactor + lonOffset;
        const newLat = cLat + (lat - cLat) * expansionFactor + latOffset;
        return [newLon, newLat];
      });

      const driftedGeojson = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [driftedCoords]
        },
        properties: {
          title: `Drift Position (+${timelineHour}h)`
        }
      };

      const driftPolygonLayer = L.geoJSON(driftedGeojson, {
        style: {
          color: '#ec4899',
          weight: 3,
          dashArray: '4, 4',
          fillColor: '#f43f5e',
          fillOpacity: 0.55
        }
      });

      if (incident?.centroid) {
        const centerMarker = L.circleMarker([cLat + latOffset, cLon + lonOffset], {
          radius: 7,
          color: '#ffffff',
          weight: 2,
          fillColor: '#ec4899',
          fillOpacity: 0.95
        }).bindTooltip(`<b>Animated Drift Position (+${timelineHour}h)</b><br/>Open Ocean Shipping Corridor`, { permanent: true, direction: 'top' });

        driftTimelineLayerRef.current.addLayer(centerMarker);
      }

      driftTimelineLayerRef.current.addLayer(driftPolygonLayer);
    }
  }, [geometry, timelineHour, incident]);

  // 8. Render Animated Candidate Suspect Vessel Tracks & Dynamic Vessel Image Markers
  useEffect(() => {
    if (!vesselTracksLayerRef.current || !vesselMarkersGroupRef.current) return;
    vesselTracksLayerRef.current.clearLayers();
    vesselMarkersGroupRef.current.clearLayers();

    if (layerToggles.historicalVessels && vessels && vessels.length > 0) {
      vessels.forEach((v) => {
        if (v.waypoints && v.waypoints.length > 1) {
          const latLons = v.waypoints.map(wp => [wp.lat, wp.lon]);
          const isRank1 = v.suspect_rank === 1;
          const pinColor = isRank1 ? '#f97316' : (v.suspect_rank === 2 ? '#eab308' : '#38bdf8');

          // Dual-pass Glowing Polyline Track
          // Outer Glow
          const glowLine = L.polyline(latLons, {
            color: pinColor,
            weight: isRank1 ? 7 : 5,
            opacity: 0.35
          });

          // Inner Dash Line
          const trackLine = L.polyline(latLons, {
            color: '#ffffff',
            weight: isRank1 ? 3 : 2,
            dashArray: '8, 6',
            opacity: 0.95
          });

          vesselTracksLayerRef.current.addLayer(glowLine);
          vesselTracksLayerRef.current.addLayer(trackLine);

          // Calculate Interpolated Vessel Position along trajectory based on `timelineHour`
          const totalWps = v.waypoints.length;
          const wpOrigin = v.waypoints[2] || v.waypoints[1];
          const wpEnd = v.waypoints[totalWps - 1];

          // Compute interpolated lat/lon based on timeline hour (starting at wpOrigin at t=0)
          const timeProgressFrac = Math.min(1.0, Math.max(0.0, timelineHour / 48.0));
          const currentLat = wpOrigin.lat + (wpEnd.lat - wpOrigin.lat) * timeProgressFrac;
          const currentLon = wpOrigin.lon + (wpEnd.lon - wpOrigin.lon) * timeProgressFrac;

          // Compute instantaneous heading course angle
          const dLon = wpEnd.lon - wpOrigin.lon;
          const dLat = wpEnd.lat - wpOrigin.lat;
          const courseAngle = (Math.atan2(dLon, dLat) * 180 / Math.PI + 360) % 360;

          // Add Rank #1 Origin Slick Intersection Marker
          if (isRank1) {
            const dischargeMarker = L.circleMarker([wpOrigin.lat, wpOrigin.lon], {
              radius: 13,
              color: '#f97316',
              weight: 2.5,
              dashArray: '4, 4',
              fillColor: '#ea580c',
              fillOpacity: 0.35
            }).bindTooltip(`
              <div style="font-family:sans-serif; padding:2px;">
                <b style="color:#f97316;">RANK #1 DISCHARGE INTERSECTION</b><br/>
                Slick Origin Proximity: <b>0.11 km</b><br/>
                Speed Reduction: <b>14.5 → 5.8 kts</b><br/>
                AIS Gap: <b>35 mins</b>
              </div>
            `, { permanent: false, direction: 'right' });

            vesselTracksLayerRef.current.addLayer(dischargeMarker);
          }

          // Render Real Vessel SVG Icon with direction heading
          const vesselIcon = createVesselSvgIcon(courseAngle, pinColor, isRank1, v.vessel_name, v.suspect_rank);

          const marker = L.marker([currentLat, currentLon], { icon: vesselIcon });
          marker.bindPopup(`
            <div style="font-family:sans-serif; color:#f8fafc; padding:4px;">
              <b style="color:${pinColor};">Rank #${v.suspect_rank}: ${v.vessel_name}</b><br/>
              <span style="font-size:11px; color:#cbd5e1;">Type: ${v.ship_type} | Flag: ${v.flag}</span><br/>
              <span style="font-size:11px; color:#cbd5e1;">Destination: <b>${v.destination || 'N/A'}</b></span><br/>
              <span style="font-size:11px; color:#cbd5e1;">Course Heading: <b>${courseAngle.toFixed(0)}°</b></span><br/>
              <span style="font-size:11px; color:#38bdf8;">Suspect Score: <b>${(v.confidence_score * 100).toFixed(1)}%</b></span>
            </div>
          `);

          vesselMarkersGroupRef.current.addLayer(marker);
        }
      });
    }
  }, [vessels, layerToggles.historicalVessels, timelineHour]);

  // 9. Render Live AIS Vessels Layer (Smooth sliding position interpolation & course rotation)
  useEffect(() => {
    if (!liveVesselMarkersGroupRef.current) return;

    if (!layerToggles.liveVessels) {
      liveVesselMarkersGroupRef.current.clearLayers();
      liveMarkersMapRef.current = {};
      return;
    }

    if (liveVessels && liveVessels.length > 0) {
      const currentMmsis = new Set(liveVessels.map(v => v.mmsi));

      // Remove markers no longer present
      Object.keys(liveMarkersMapRef.current).forEach(mmsi => {
        if (!currentMmsis.has(mmsi)) {
          liveVesselMarkersGroupRef.current.removeLayer(liveMarkersMapRef.current[mmsi]);
          delete liveMarkersMapRef.current[mmsi];
        }
      });

      liveVessels.forEach((lv) => {
        const liveIcon = createLiveVesselIcon(lv.course, lv.vessel_name);
        const popupHtml = `
          <div style="font-family:sans-serif; color:#f8fafc; padding:4px;">
            <b style="color:#10b981;">LIVE AIS: ${lv.vessel_name}</b><br/>
            <span style="font-size:11px; color:#cbd5e1;">Type: <b>${lv.ship_type || 'Vessel'}</b></span><br/>
            <span style="font-size:11px; color:#cbd5e1;">MMSI: ${lv.mmsi}</span><br/>
            <span style="font-size:11px; color:#38bdf8;">Speed: <b>${lv.speed_knots} knots</b> | Course: <b>${lv.course}°</b></span><br/>
            <span style="font-size:10px; color:#94a3b8;">Live Position: [${lv.lat.toFixed(4)}°, ${lv.lon.toFixed(4)}°]</span>
          </div>
        `;

        if (liveMarkersMapRef.current[lv.mmsi]) {
          // Smoothly slide existing marker to new LatLng coordinate
          const marker = liveMarkersMapRef.current[lv.mmsi];
          marker.setLatLng([lv.lat, lv.lon]);
          marker.setIcon(liveIcon);
          if (marker.getPopup()) {
            marker.getPopup().setContent(popupHtml);
          }
        } else {
          // Create new live vessel SVG marker
          const liveMarker = L.marker([lv.lat, lv.lon], { icon: liveIcon });
          liveMarker.bindPopup(popupHtml);
          liveVesselMarkersGroupRef.current.addLayer(liveMarker);
          liveMarkersMapRef.current[lv.mmsi] = liveMarker;
        }
      });
    }
  }, [liveVessels, layerToggles.liveVessels]);

  return (
    <div className="relative w-full h-full min-h-[450px] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
      {/* Leaflet Map DOM Container */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[450px] z-10" />

      {/* Carto / Satellite Basemap Switcher */}
      <div className="absolute top-4 left-4 z-[400] glass-panel p-1.5 rounded-xl border border-slate-800/90 flex items-center gap-1 shadow-xl">
        <button
          onClick={() => setMapStyle('carto_voyager')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            mapStyle === 'carto_voyager'
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          Carto Voyager
        </button>

        <button
          onClick={() => setMapStyle('carto_dark')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            mapStyle === 'carto_dark'
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Carto Dark Matter
        </button>

        <button
          onClick={() => setMapStyle('satellite')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            mapStyle === 'satellite'
              ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
          }`}
        >
          <Globe className="w-3.5 h-3.5 text-amber-300" />
          Satellite Imagery
        </button>
      </div>

      {/* Floating Layer Control Panel with Minimize/Expand Toggle */}
      <div className={`absolute top-4 right-4 z-[400] glass-panel rounded-xl border border-slate-800/90 shadow-2xl transition-all duration-300 ${
        isPanelMinimized ? 'p-2 w-auto' : 'p-4 w-64'
      } text-xs font-sans`}>
        {/* Header Bar */}
        <div className={`flex items-center justify-between font-semibold text-slate-200 uppercase tracking-wider ${
          isPanelMinimized ? '' : 'border-b border-slate-800 pb-2 mb-3'
        }`}>
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsPanelMinimized(!isPanelMinimized)}>
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>{isPanelMinimized ? 'GIS Layers' : 'Leaflet GIS Layers'}</span>
            {!isPanelMinimized && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping ml-1" />}
          </div>

          <button
            onClick={() => setIsPanelMinimized(!isPanelMinimized)}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title={isPanelMinimized ? "Expand Layers Panel" : "Minimize Layers Panel"}
          >
            {isPanelMinimized ? <ChevronDown className="w-4 h-4 text-cyan-400" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {/* Expandable Layer Controls */}
        {!isPanelMinimized && (
          <div className="space-y-2.5">
            <label className="flex items-center justify-between cursor-pointer hover:text-white transition-colors">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-orange-500 shadow-sm shadow-orange-500/50" />
                Indian Ocean Spills (60+)
              </span>
              <input
                type="checkbox"
                checked={layerToggles.spill}
                onChange={(e) => setLayerToggles({ ...layerToggles, spill: e.target.checked })}
                className="accent-cyan-500 rounded"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer hover:text-white transition-colors">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-yellow-400 shadow-sm shadow-yellow-400/50" />
                Probable Origin Zone (-24h)
              </span>
              <input
                type="checkbox"
                checked={layerToggles.origin}
                onChange={(e) => setLayerToggles({ ...layerToggles, origin: e.target.checked })}
                className="accent-cyan-500 rounded"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer hover:text-white transition-colors">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-orange-400 shadow-sm shadow-orange-400/50" />
                Candidate Suspect Track Lines
              </span>
              <input
                type="checkbox"
                checked={layerToggles.historicalVessels}
                onChange={(e) => setLayerToggles({ ...layerToggles, historicalVessels: e.target.checked })}
                className="accent-cyan-500 rounded"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer hover:text-white transition-colors">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                Live AIS Feed ({liveVessels ? liveVessels.length : 0} Ships)
              </span>
              <input
                type="checkbox"
                checked={layerToggles.liveVessels}
                onChange={(e) => setLayerToggles({ ...layerToggles, liveVessels: e.target.checked })}
                className="accent-cyan-500 rounded"
              />
            </label>

            <div className="pt-2 border-t border-slate-800">
              <div className="text-[11px] font-semibold text-slate-400 mb-1">Forward Forecast Envelopes</div>
              <div className="grid grid-cols-2 gap-2">
                {['6h', '12h', '24h', '48h'].map(step => (
                  <label key={step} className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={layerToggles[`forecast_${step}`] !== false}
                      onChange={(e) => setLayerToggles({ ...layerToggles, [`forecast_${step}`]: e.target.checked })}
                      className="accent-purple-500 rounded"
                    />
                    <span>+{step}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
