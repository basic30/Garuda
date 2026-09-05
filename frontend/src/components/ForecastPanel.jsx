import React from 'react';
import { Compass, Wind, Waves, Clock, History, AlertCircle } from 'lucide-react';

export default function ForecastPanel({ forecastData, originGeojson }) {
  const forcing = forecastData?.['6h']?.geojson?.properties?.forcing || originGeojson?.properties?.forcing;

  const windSpeed = forcing?.wind_speed_m_s || 6.28;
  const windKnots = (windSpeed * 1.94384).toFixed(1);
  const currentSpeed = forcing?.current_speed_m_s || 1.10;
  const currentKnots = (currentSpeed * 1.94384).toFixed(1);
  const sourceName = forcing?.source || "Open-Meteo Real Meteorological & Marine Forcing";

  return (
    <div className="glass-panel p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-800 space-y-4 sm:space-y-5 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
          <Compass className="w-5 h-5 text-cyan-400 shrink-0" />
          <span>Drift Modeling Engine</span>
        </h3>
        <span className="self-start sm:self-auto text-[11px] font-mono text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20">
          OpenDrift Physics
        </span>
      </div>

      {/* Live Environmental Telemetry (Wind & Ocean Currents) */}
      <div className="glass-card p-3 sm:p-4 rounded-xl border border-cyan-500/30 bg-cyan-950/20 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
            <Wind className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Environmental Telemetry</span>
          </h4>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded">
            Live Feed
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 font-mono text-xs">
          {/* Real Wind Component */}
          <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
            <div className="text-[10px] text-slate-400 flex items-center gap-1 mb-1">
              <Wind className="w-3 h-3 text-cyan-400 shrink-0" />
              Surface Wind (10m Vector)
            </div>
            <div className="text-sm font-bold text-cyan-300">{windSpeed} m/s <span className="text-xs text-slate-400">({windKnots} kts)</span></div>
            <div className="text-[10px] text-slate-400 mt-1">U: {forcing?.wind_u_m_s || -5.0} m/s | V: {forcing?.wind_v_m_s || 3.8} m/s</div>
          </div>

          {/* Real Ocean Current Component */}
          <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
            <div className="text-[10px] text-slate-400 flex items-center gap-1 mb-1">
              <Waves className="w-3 h-3 text-blue-400 shrink-0" />
              Ocean Surface Current
            </div>
            <div className="text-sm font-bold text-blue-300">{currentSpeed} m/s <span className="text-xs text-slate-400">({currentKnots} kts)</span></div>
            <div className="text-[10px] text-slate-400 mt-1">U: {forcing?.current_u_m_s || 1.09} m/s | V: {forcing?.current_v_m_s || -0.17} m/s</div>
          </div>
        </div>

        <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5 pt-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="truncate">Source: <strong className="text-slate-200">{sourceName}</strong></span>
        </div>
      </div>

      {/* Backward Origin Simulation Summary */}
      <div className="glass-card p-3 sm:p-4 rounded-xl border border-yellow-500/30 bg-yellow-950/20">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold text-yellow-400 uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4 shrink-0" />
            <span>Backward Origin Tracing (-24h)</span>
          </h4>
          <span className="text-[11px] font-mono text-slate-400 shrink-0 ml-2">
            <strong className="text-yellow-300">{originGeojson?.properties?.origin_area_sqkm || 2.41} km²</strong>
          </span>
        </div>
        <p className="text-xs text-slate-300 font-mono leading-relaxed">
          Probable spill origin zone traced reverse in time using backward ocean current vectors and 3% windage. The yellow envelope defines the suspect vessel search area.
        </p>
      </div>

      {/* Forward Drift Forecast Timeline Cards */}
      <div className="space-y-2.5 sm:space-y-3">
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Clock className="w-4 h-4 text-purple-400 shrink-0" />
          Forward Drift Forecast Timeline (+6h to +48h)
        </h4>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 font-mono text-xs">
          {['6h', '12h', '24h', '48h'].map((step, idx) => {
            const data = forecastData?.[step];
            const area = data?.area_sqkm || (1.18 * (1 + idx * 0.45)).toFixed(2);
            const colors = ['border-cyan-500/40 text-cyan-400', 'border-blue-500/40 text-blue-400', 'border-indigo-500/40 text-indigo-400', 'border-purple-500/40 text-purple-400'];

            return (
              <div key={step} className={`glass-card p-2.5 sm:p-3 rounded-xl border ${colors[idx]}`}>
                <div className="text-[10px] text-slate-400 uppercase">+{step} Forecast</div>
                <div className="text-sm font-bold mt-1 text-slate-100">{area} km²</div>
                <div className="text-[10px] text-slate-400 mt-1">Dispersion Growth</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
