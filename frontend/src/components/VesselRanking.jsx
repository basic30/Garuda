import React, { useState, useEffect } from 'react';
import { Anchor, Search, Filter, AlertTriangle, ShieldAlert, Navigation, Compass, Globe } from 'lucide-react';

export default function VesselRanking({ vessels }) {
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
      v.vessel_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.mmsi.includes(searchQuery) ||
      v.imo.includes(searchQuery) ||
      v.flag.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const matchesType = selectedType === 'All' || v.ship_type.toLowerCase().includes(selectedType.toLowerCase());
    return matchesSearch && matchesType;
  });

  return (
    <div className="glass-panel p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-800 space-y-3.5 sm:space-y-4 font-sans">
      {/* Header & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 border-b border-slate-800 pb-3">
        <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
          <Anchor className="w-5 h-5 text-orange-400 shrink-0" />
          <span>Vessel Attribution & AIS Search</span>
        </h3>

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

      {/* Search & Filter Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 sm:gap-3">
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

      {/* VIEW 1: Candidate Suspect Vessels for Currently Selected Spill */}
      {viewMode === 'spill_candidates' && (
        <div className="space-y-3">
          {filteredCandidateVessels.length === 0 ? (
            <div className="p-6 text-center text-slate-400 font-mono text-xs glass-card rounded-xl">
              No candidate vessels matched search criteria around origin window.
            </div>
          ) : (
            filteredCandidateVessels.map((v) => {
              const isRank1 = v.suspect_rank === 1;

              return (
                <div
                  key={v.mmsi}
                  className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                    isRank1
                      ? 'bg-gradient-to-r from-orange-950/40 via-slate-900 to-slate-900 border-orange-500/50 shadow-lg shadow-orange-950/30'
                      : 'glass-card border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  {/* Card Header */}
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
                        <h4 className="text-sm font-bold text-slate-100 flex flex-wrap items-center gap-1.5">
                          <span>{v.vessel_name}</span>
                          <span className="text-[11px] font-normal text-slate-400 font-mono">({v.ship_type})</span>
                        </h4>
                        <div className="text-[11px] sm:text-xs font-mono text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                          <span>MMSI: {v.mmsi}</span>
                          <span>IMO: {v.imo}</span>
                          <span>Flag: {v.flag}</span>
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

                  {/* Multi-Factor Score Progress Bars */}
                  {v.score_breakdown && (
                    <div className="grid grid-cols-3 xs:grid-cols-5 gap-2 mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-800/60 font-mono text-[9px] sm:text-[10px]">
                      <div>
                        <div className="text-slate-400 mb-1 truncate">Proximity</div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-orange-500 h-full rounded-full" style={{ width: `${v.score_breakdown.proximity * 100}%` }} />
                        </div>
                        <span className="text-slate-300 font-semibold mt-1 block">{(v.score_breakdown.proximity * 100).toFixed(0)}%</span>
                      </div>

                      <div>
                        <div className="text-slate-400 mb-1 truncate">Temporal</div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-yellow-500 h-full rounded-full" style={{ width: `${v.score_breakdown.temporal * 100}%` }} />
                        </div>
                        <span className="text-slate-300 font-semibold mt-1 block">{(v.score_breakdown.temporal * 100).toFixed(0)}%</span>
                      </div>

                      <div>
                        <div className="text-slate-400 mb-1 truncate">Trajectory</div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${v.score_breakdown.trajectory * 100}%` }} />
                        </div>
                        <span className="text-slate-300 font-semibold mt-1 block">{(v.score_breakdown.trajectory * 100).toFixed(0)}%</span>
                      </div>

                      <div>
                        <div className="text-slate-400 mb-1 truncate">Behavior</div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-purple-500 h-full rounded-full" style={{ width: `${v.score_breakdown.behavior * 100}%` }} />
                        </div>
                        <span className="text-slate-300 font-semibold mt-1 block">{(v.score_breakdown.behavior * 100).toFixed(0)}%</span>
                      </div>

                      <div>
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
                    <div className="mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-slate-800/40 text-xs">
                      <div className="text-[10px] sm:text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                        Explainable Audit Ranking Factors:
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
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VIEW 2: Full Real AIS Vessel Dataset Search */}
      {viewMode === 'full_dataset' && (
        <div className="space-y-2.5 sm:space-y-3">
          {loadingDataset ? (
            <div className="p-6 text-center text-cyan-400 font-mono text-xs animate-pulse">
              Querying real AIS vessel dataset...
            </div>
          ) : fullDataset.length === 0 ? (
            <div className="p-6 text-center text-slate-400 font-mono text-xs glass-card rounded-xl">
              No real AIS vessels found matching your search.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 max-h-[500px] overflow-y-auto pr-1 touch-scroll">
              {fullDataset.map((v) => (
                <div key={v.mmsi} className="p-3 sm:p-3.5 rounded-xl glass-card border border-slate-800 hover:border-slate-700 flex flex-col xs:flex-row xs:items-center justify-between gap-2">
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
                        <span>MMSI: {v.mmsi}</span>
                        <span>IMO: {v.imo}</span>
                        <span>Flag: {v.flag}</span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-300 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <span className="text-cyan-400">Dest: {v.destination}</span>
                        <span className="text-purple-400">Corridor: {v.corridor}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-left xs:text-right font-mono text-xs border-t xs:border-t-0 border-slate-800/60 pt-1.5 xs:pt-0 shrink-0">
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
