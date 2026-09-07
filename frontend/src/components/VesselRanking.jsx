import React, { useState, useEffect } from 'react';
import { Anchor, Search, Filter, AlertTriangle, ShieldAlert, Navigation, Compass, Globe, MapPin, Radio, ChevronRight, CheckCircle, Crosshair } from 'lucide-react';

export default function VesselRanking({
  vessels,
  incident,
  allIncidents,
  onSelectIncident,
  onRunBackwardOrigin,
  isOriginLoading,
  isDedicatedTab = false,
  focusedVesselMmsi,
  setFocusedVesselMmsi
}) {
  const [viewMode, setViewMode] = useState('spill_candidates'); // 'spill_candidates' | 'full_dataset'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [fullDataset, setFullDataset] = useState([]);
  const [loadingDataset, setLoadingDataset] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

  // Fetch full AIS dataset when user switches to 'full_dataset' tab or searches
  useEffect(() => {
    if (viewMode === 'full_dataset') {
      setLoadingDataset(true);
      let url = `${API_BASE}/vessels/dataset?`;
      if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}&`;
      if (selectedType !== 'All') url += `ship_type=${encodeURIComponent(selectedType)}`;

      fetch(url)
        .then(res => res.json())
        .then(data => {
          setFullDataset(data.vessels || []);
          setLoadingDataset(false);
        })
        .catch(err => {
          console.error('Error loading AIS dataset:', err);
          setLoadingDataset(false);
        });
    }
  }, [viewMode, searchQuery, selectedType]);

  // Filter local candidate vessels if searching inside spill_candidates view
  const filteredCandidateVessels = (vessels || []).filter(v => {
    const matchesSearch = !searchQuery || (
      v.vessel_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.mmsi?.includes(searchQuery) ||
      v.imo?.includes(searchQuery) ||
      v.flag?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.destination?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const matchesType = selectedType === 'All' || v.ship_type?.toLowerCase().includes(selectedType.toLowerCase());
    return matchesSearch && matchesType;
  });

  return (
    <div className="glass-panel p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-800 space-y-3.5 sm:space-y-4 font-sans">
      {/* 1. Dedicated Tab Incident Context Banner (Visible in dedicated 'vessels' view) */}
      {isDedicatedTab && (
        <div className="p-3 sm:p-3.5 rounded-xl bg-slate-900/90 border border-slate-800/90 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 uppercase flex items-center gap-1.5">
                <ShieldAlert className="w-3 h-3 text-orange-400" />
                Active Spill Incident
              </span>
              <span className="text-xs text-slate-300 font-mono font-semibold">ID: {incident?.incident_id || 'N/A'}</span>
            </div>

            {allIncidents && allIncidents.length > 0 && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={incident?.incident_id || ''}
                  onChange={(e) => onSelectIncident && onSelectIncident(e.target.value)}
                  className="w-full sm:max-w-[300px] bg-slate-950 border border-slate-700 text-slate-100 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-cyan-500 cursor-pointer shadow-inner"
                  title="Switch target oil spill incident"
                >
                  {allIncidents.map(inc => (
                    <option key={inc.incident_id} value={inc.incident_id}>
                      {inc.incident_id} - {inc.location_name} ({inc.spill_area_sqkm} km²)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
            <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-orange-400 shrink-0" />
                Centroid GPS
              </div>
              <div className="text-slate-200 font-semibold truncate text-[11px] mt-0.5">
                {incident?.centroid ? `${incident.centroid[0].toFixed(4)}°, ${incident.centroid[1].toFixed(4)}°` : '5.8500°, 80.5000°'}
              </div>
            </div>

            <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
              <div className="text-[10px] text-slate-400">Spill Area</div>
              <div className="text-cyan-400 font-bold text-[11px] mt-0.5">
                {incident?.spill_area_sqkm ? `${incident.spill_area_sqkm} km²` : '2.45 km²'}
              </div>
            </div>

            <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
              <div className="text-[10px] text-slate-400">Correlated Vessels</div>
              <div className="text-orange-400 font-bold text-[11px] mt-0.5">
                {vessels ? `${vessels.length} Candidates` : '0 Candidates'}
              </div>
            </div>

            <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-400">Origin Window</div>
                <div className="text-amber-400 font-semibold text-[11px] mt-0.5">-24h Lagrangian</div>
              </div>
              {onRunBackwardOrigin && (
                <button
                  onClick={onRunBackwardOrigin}
                  disabled={isOriginLoading}
                  className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[10px] font-semibold transition-all cursor-pointer disabled:opacity-50"
                  title="Recalculate Backward Origin Zone"
                >
                  {isOriginLoading ? 'Tracing...' : 'Retrace'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Anchor className="w-5 h-5 text-orange-400 shrink-0" />
            <span>Vessel Attribution & AIS Corroboration</span>
          </h3>
          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
            Physics-inverted drift intersection & spatio-temporal vessel matching
          </p>
        </div>

        <div className="w-full sm:w-auto grid grid-cols-2 sm:flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setViewMode('spill_candidates')}
            className={`px-3 py-1.5 rounded-lg font-medium text-center transition-all ${
              viewMode === 'spill_candidates'
                ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Spill Suspects ({vessels ? vessels.length : 0})
          </button>
          <button
            onClick={() => setViewMode('full_dataset')}
            className={`px-3 py-1.5 rounded-lg font-medium text-center transition-all ${
              viewMode === 'full_dataset'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            AIS Dataset Search
          </button>
        </div>
      </div>

      {/* 3. Search & Filter Controls */}
      <div className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          {/* Search Bar */}
          <div className="col-span-1 sm:col-span-8 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 sm:top-3" />
            <input
              type="text"
              placeholder="Search vessel by Name, MMSI, IMO, Flag, Destination..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {/* Ship Type Filter Dropdown */}
          <div className="col-span-1 sm:col-span-4 relative">
            <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 sm:top-3 pointer-events-none" />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer transition-colors"
            >
              <option value="All">All Ship Classes</option>
              <option value="Tanker">Oil / Chemical Tankers</option>
              <option value="Container">Container Vessels</option>
              <option value="Bulk Carrier">Bulk Carriers</option>
              <option value="Supply">Offshore Supply / Tugs</option>
            </select>
          </div>
        </div>

        {/* Quick Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-mono scrollbar-none">
          <span className="text-slate-500 text-[10px] uppercase font-bold shrink-0 mr-1">Class:</span>
          {['All', 'Tanker', 'Container', 'Bulk Carrier', 'Supply'].map(type => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-2.5 py-0.5 rounded-full border transition-all shrink-0 ${
                selectedType === type
                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-semibold'
                  : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              {type === 'All' ? 'All Classes' : type}
            </button>
          ))}
        </div>
      </div>

      {/* 4. VIEW 1: Candidate Suspect Vessels for Currently Selected Spill */}
      {viewMode === 'spill_candidates' && (
        <div className="space-y-3">
          {filteredCandidateVessels.length === 0 ? (
            <div className="p-8 text-center text-slate-400 font-mono text-xs glass-card rounded-xl border border-slate-800">
              <AlertTriangle className="w-8 h-8 text-amber-400/80 mx-auto mb-2" />
              <p>No candidate vessels matched search criteria around origin window.</p>
              <button
                onClick={() => { setSearchQuery(''); setSelectedType('All'); }}
                className="mt-3 text-cyan-400 hover:underline text-[11px]"
              >
                Reset Search Filters
              </button>
            </div>
          ) : (
            filteredCandidateVessels.map((v) => {
              const isRank1 = v.suspect_rank === 1;
              const isFocused = focusedVesselMmsi === v.mmsi;

              return (
                <div
                  key={v.mmsi}
                  className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                    isFocused
                      ? 'ring-2 ring-cyan-500 border-cyan-400/80 bg-slate-900/95 shadow-xl shadow-cyan-950/50'
                      : isRank1
                      ? 'bg-gradient-to-r from-orange-950/40 via-slate-900 to-slate-900 border-orange-500/50 shadow-lg shadow-orange-950/30 hover:border-orange-400'
                      : 'glass-card border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  {/* Card Header & Rank */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
                      <span
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs sm:text-sm shrink-0 mt-0.5 sm:mt-0 ${
                          isRank1
                            ? 'bg-orange-500 text-slate-950 shadow-md shadow-orange-500/40'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        #{v.suspect_rank}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                            <span>{v.vessel_name}</span>
                            <span className="text-[11px] font-normal text-slate-400 font-mono">({v.ship_type})</span>
                          </h4>
                          {isRank1 && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-orange-500/20 text-orange-400 border border-orange-500/40 uppercase animate-pulse">
                              Primary Suspect
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] sm:text-xs font-mono text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                          <span>MMSI: <strong className="text-slate-300 font-semibold">{v.mmsi}</strong></span>
                          <span>IMO: <strong className="text-slate-300 font-semibold">{v.imo}</strong></span>
                          <span>Flag: <strong className="text-slate-300 font-semibold">{v.flag}</strong></span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                          {v.destination && (
                            <div className="text-[11px] font-mono text-cyan-400 flex items-center gap-1 truncate">
                              <Compass className="w-3 h-3 shrink-0" />
                              <span className="truncate">Dest: {v.destination}</span>
                            </div>
                          )}
                          {v.corridor && (
                            <div className="text-[11px] font-mono text-purple-400 flex items-center gap-1 truncate">
                              <Navigation className="w-3 h-3 shrink-0" />
                              <span className="truncate">Route: {v.corridor} ({v.base_course ? `${v.base_course}°` : ''})</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Score Badge */}
                    <div className="text-right shrink-0">
                      <div className="text-[9px] sm:text-[10px] uppercase font-mono text-slate-400">Suspect Score</div>
                      <div
                        className={`text-base sm:text-lg font-mono font-bold ${
                          isRank1 ? 'text-orange-400' : 'text-slate-300'
                        }`}
                      >
                        {(v.confidence_score * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* Multi-Factor Score Progress Bars (5 factors laid out neatly in a 5-column grid) */}
                  {v.score_breakdown && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-800/60 font-mono text-[9px] sm:text-[10px]">
                      <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/40">
                        <div className="text-slate-400 mb-1 truncate">Proximity</div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-orange-500 h-full rounded-full" style={{ width: `${v.score_breakdown.proximity * 100}%` }} />
                        </div>
                        <span className="text-slate-300 font-semibold mt-1 block">{(v.score_breakdown.proximity * 100).toFixed(0)}%</span>
                      </div>

                      <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/40">
                        <div className="text-slate-400 mb-1 truncate">Temporal</div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-yellow-500 h-full rounded-full" style={{ width: `${v.score_breakdown.temporal * 100}%` }} />
                        </div>
                        <span className="text-slate-300 font-semibold mt-1 block">{(v.score_breakdown.temporal * 100).toFixed(0)}%</span>
                      </div>

                      <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/40">
                        <div className="text-slate-400 mb-1 truncate">Trajectory</div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${v.score_breakdown.trajectory * 100}%` }} />
                        </div>
                        <span className="text-slate-300 font-semibold mt-1 block">{(v.score_breakdown.trajectory * 100).toFixed(0)}%</span>
                      </div>

                      <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/40">
                        <div className="text-slate-400 mb-1 truncate">Maneuver</div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-purple-500 h-full rounded-full" style={{ width: `${v.score_breakdown.behavior * 100}%` }} />
                        </div>
                        <span className="text-slate-300 font-semibold mt-1 block">{(v.score_breakdown.behavior * 100).toFixed(0)}%</span>
                      </div>

                      <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/40 col-span-2 sm:col-span-1">
                        <div className="text-slate-400 mb-1 truncate">AIS Gap</div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-rose-500 h-full rounded-full" style={{ width: `${v.score_breakdown.ais_gap * 100}%` }} />
                        </div>
                        <span className="text-slate-300 font-semibold mt-1 block">{(v.score_breakdown.ais_gap * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  )}

                  {/* Audit Ranking Reasons */}
                  {v.ranking_reasons && (
                    <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-slate-800/40 text-xs">
                      <div className="text-[10px] sm:text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                        Explainable Audit Evidence:
                      </div>
                      <ul className="space-y-1">
                        {v.ranking_reasons.map((r, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-slate-300 font-mono text-[10px] sm:text-[11px]">
                            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Interactive Map Focus Action */}
                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-800/50">
                    <span className="text-[11px] font-mono text-slate-400 truncate mr-2">
                      {v.metrics?.min_distance_km !== undefined
                        ? `Closest slick point: ${v.metrics.min_distance_km.toFixed(2)} km`
                        : 'Intersecting Spill Origin Corridor'}
                    </span>
                    <button
                      onClick={() => setFocusedVesselMmsi && setFocusedVesselMmsi(isFocused ? null : v.mmsi)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                        isFocused
                          ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/40'
                          : 'bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/20'
                      }`}
                    >
                      <Crosshair className={`w-3.5 h-3.5 ${isFocused ? 'animate-spin' : ''}`} />
                      <span>{isFocused ? 'Tracking on Map' : 'Focus on Map'}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 5. VIEW 2: Full Real AIS Vessel Dataset Search */}
      {viewMode === 'full_dataset' && (
        <div className="space-y-2.5 sm:space-y-3">
          {loadingDataset ? (
            <div className="p-8 text-center text-cyan-400 font-mono text-xs animate-pulse glass-card rounded-xl border border-slate-800">
              Querying real AIS vessel dataset...
            </div>
          ) : fullDataset.length === 0 ? (
            <div className="p-8 text-center text-slate-400 font-mono text-xs glass-card rounded-xl border border-slate-800">
              <AlertTriangle className="w-8 h-8 text-cyan-400/80 mx-auto mb-2" />
              <p>No real AIS vessels found matching your search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {fullDataset.map((v) => (
                <div
                  key={v.mmsi}
                  className="p-3 sm:p-3.5 rounded-xl glass-card border border-slate-800 hover:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all"
                >
                  <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 sm:mt-0">
                      AIS
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-100 flex flex-wrap items-center gap-1.5">
                        <span>{v.name}</span>
                        <span className="text-[11px] font-normal text-slate-400 font-mono">({v.ship_type})</span>
                      </h4>
                      <div className="text-[11px] sm:text-xs font-mono text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                        <span>MMSI: <strong className="text-slate-300 font-semibold">{v.mmsi}</strong></span>
                        <span>IMO: <strong className="text-slate-300 font-semibold">{v.imo}</strong></span>
                        <span>Flag: <strong className="text-slate-300 font-semibold">{v.flag}</strong></span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-300 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        {v.destination && <span className="text-cyan-400">Dest: {v.destination}</span>}
                        {v.corridor && <span className="text-purple-400">Corridor: {v.corridor}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="text-left sm:text-right font-mono text-xs border-t sm:border-t-0 border-slate-800/60 pt-1.5 sm:pt-0 shrink-0">
                    <div className="text-slate-400 text-[10px]">Dimensions</div>
                    <div className="text-slate-200 font-bold">{v.length_m}m × {v.beam_m}m</div>
                    <div className="text-slate-400 text-[10px] mt-0.5">Max Draft: {v.max_draft_m}m</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
