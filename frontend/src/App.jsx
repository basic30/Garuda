import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import MapView from './components/MapView';
import TimelineSlider from './components/TimelineSlider';
import IncidentDetails from './components/IncidentDetails';
import VesselRanking from './components/VesselRanking';
import ForecastPanel from './components/ForecastPanel';
import UploadModal from './components/UploadModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('map');
  const [allIncidents, setAllIncidents] = useState([]);
  const [allGeometries, setAllGeometries] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);

  const [geometry, setGeometry] = useState(null);
  const [originGeojson, setOriginGeojson] = useState(null);
  const [forecastData, setForecastData] = useState(null);
  const [vessels, setVessels] = useState([]);
  const [liveVessels, setLiveVessels] = useState([]);
  const [liveStatus, setLiveStatus] = useState({ connected: false, vessel_count: 0 });

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isForwardLoading, setIsForwardLoading] = useState(false);
  const [isOriginLoading, setIsOriginLoading] = useState(false);

  // Map & Timeline States
  const [mapStyle, setMapStyle] = useState('carto_voyager'); // 'carto_voyager' | 'carto_dark' | 'satellite'
  const [timelineHour, setTimelineHour] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const [layerToggles, setLayerToggles] = useState({
    spill: true,
    origin: false,
    historicalVessels: true,
    liveVessels: true,
    forecast: false,
    forecast_6h: true,
    forecast_12h: true,
    forecast_24h: true,
    forecast_48h: true
  });

  const API_BASE = 'http://127.0.0.1:8000/api';

  // Load all global spill incidents and geometries on startup
  useEffect(() => {
    fetch(`${API_BASE}/incidents`)
      .then(res => res.json())
      .then(data => {
        setAllIncidents(data);
        if (data && data.length > 0) {
          selectIncident(data[0].incident_id);
        }
      })
      .catch(console.error);

    fetch(`${API_BASE}/incidents/all-geometry`)
      .then(res => res.json())
      .then(setAllGeometries)
      .catch(console.error);
  }, []);

  // Poll Live AISstream vessels every 3 seconds
  useEffect(() => {
    const fetchLive = () => {
      fetch(`${API_BASE}/vessels/live`)
        .then(res => res.json())
        .then(data => {
          setLiveVessels(data.vessels || []);
          setLiveStatus(data.status || { connected: false });
        })
        .catch(() => setLiveStatus({ connected: false }));
    };

    fetchLive();
    const interval = setInterval(fetchLive, 3000);
    return () => clearInterval(interval);
  }, []);

  // Function to select an incident
  const selectIncident = (incidentId) => {
    // 1. Auto-switch map to Satellite view & keep camera focused strictly on selected spill
    setMapStyle('satellite');
    setLayerToggles(prev => ({
      ...prev,
      liveVessels: false,
      origin: false,
      forecast: false
    }));
    setOriginGeojson(null);
    setForecastData(null);
    setTimelineHour(0);
    setIsPlaying(false);

    fetch(`${API_BASE}/incidents/${incidentId}`)
      .then(res => res.json())
      .then(inc => {
        setSelectedIncident(inc);

        fetch(`${API_BASE}/incidents/${incidentId}/geometry`)
          .then(r => r.json())
          .then(setGeometry)
          .catch(console.error);

        fetch(`${API_BASE}/incidents/${incidentId}/vessels`)
          .then(r => r.json())
          .then(d => setVessels(d.candidate_vessels || []))
          .catch(console.error);
      })
      .catch(console.error);
  };

  // Run Forward Drift Forecast on demand
  const handleRunForwardDrift = () => {
    if (!selectedIncident) return;
    setIsForwardLoading(true);

    fetch(`${API_BASE}/incidents/${selectedIncident.incident_id}/forecast`)
      .then(r => r.json())
      .then(data => {
        setForecastData(data);
        setIsForwardLoading(false);
        setLayerToggles(prev => ({ ...prev, forecast: true, forecast_6h: true, forecast_12h: true, forecast_24h: true, forecast_48h: true }));
        setIsPlaying(true);
      })
      .catch(() => setIsForwardLoading(false));
  };

  // Run Backward Origin Tracing on demand
  const handleRunBackwardOrigin = () => {
    if (!selectedIncident) return;
    setIsOriginLoading(true);

    fetch(`${API_BASE}/incidents/${selectedIncident.incident_id}/origin`)
      .then(r => r.json())
      .then(data => {
        setOriginGeojson(data);
        setIsOriginLoading(false);
        setLayerToggles(prev => ({ ...prev, origin: true }));
      })
      .catch(() => setIsOriginLoading(false));
  };

  // Handle successful SAR upload
  const handleUploadSuccess = (uploadData) => {
    if (uploadData && uploadData.incident) {
      const newInc = uploadData.incident;
      setAllIncidents(prev => [newInc, ...prev]);

      // Re-fetch all geometries
      fetch(`${API_BASE}/incidents/all-geometry`)
        .then(res => res.json())
        .then(setAllGeometries)
        .catch(console.error);

      selectIncident(newInc.incident_id);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      <Navbar liveStatus={liveStatus} activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 p-4 grid grid-cols-12 gap-4 max-w-[1920px] mx-auto w-full h-[calc(100vh-65px)] overflow-hidden">
        {/* Left Side GIS Map (8 cols in 'map' tab, 7 cols in 'vessels' tab) */}
        <div className={`${activeTab === 'map' ? 'col-span-8' : 'col-span-7'} flex flex-col gap-3 h-full overflow-hidden transition-all duration-300`}>
          <div className="flex-1 relative min-h-0">
            <MapView
              incident={selectedIncident}
              allGeometries={allGeometries}
              geometry={geometry}
              originGeojson={originGeojson}
              forecastData={forecastData}
              vessels={vessels}
              liveVessels={liveVessels}
              layerToggles={layerToggles}
              setLayerToggles={setLayerToggles}
              onSelectIncident={selectIncident}
              mapStyle={mapStyle}
              setMapStyle={setMapStyle}
              timelineHour={timelineHour}
              activeTab={activeTab}
            />
          </div>

          {/* Interactive Timeline Animation Slider (Only in 'map' tab) */}
          {activeTab === 'map' && (
            <div className="shrink-0">
              <TimelineSlider
                timelineHour={timelineHour}
                setTimelineHour={setTimelineHour}
                isPlaying={isPlaying}
                setIsPlaying={setIsPlaying}
                playbackSpeed={playbackSpeed}
                setPlaybackSpeed={setPlaybackSpeed}
                forecastData={forecastData}
                originGeojson={originGeojson}
                selectedIncident={selectedIncident}
              />
            </div>
          )}
        </div>

        {/* Right Side Panel (4 cols in 'map' tab) */}
        {activeTab === 'map' && (
          <div className="col-span-4 flex flex-col gap-4 overflow-y-auto h-full pr-1.5 pb-6">
            <IncidentDetails
              incident={selectedIncident}
              allIncidents={allIncidents}
              onSelectIncident={selectIncident}
              onRunForwardDrift={handleRunForwardDrift}
              onRunBackwardOrigin={handleRunBackwardOrigin}
              onOpenUploadModal={() => setIsUploadOpen(true)}
              isForwardLoading={isForwardLoading}
              isOriginLoading={isOriginLoading}
            />
            <ForecastPanel forecastData={forecastData} originGeojson={originGeojson} />
            <VesselRanking vessels={vessels} />
          </div>
        )}

        {/* Dedicated Vessel Attribution & AIS Dataset Search Workstation (5 cols in 'vessels' tab) */}
        {activeTab === 'vessels' && (
          <div className="col-span-5 flex flex-col gap-4 overflow-y-auto h-full pr-1.5 pb-6">
            <VesselRanking vessels={vessels} />
          </div>
        )}
      </main>

      {/* Upload SAR Image Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />
    </div>
  );
}
