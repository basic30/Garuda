import React from 'react';
import { ShieldAlert, Radio, Activity, Cpu, Layers } from 'lucide-react';

export default function Navbar({ liveStatus, activeTab, setActiveTab }) {
  return (
    <header className="glass-panel sticky top-0 z-50 px-6 py-3 border-b border-slate-800 flex items-center justify-between">
      {/* System Identity - Logo Emblem + Brand Name & Subtitle */}
      <div className="flex items-center gap-3">
        <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-white/95 border border-cyan-500/50 p-0.5 shadow-lg shadow-cyan-950/60 shrink-0 flex items-center justify-center transition-all hover:scale-105">
          <img
            src="/sagar_netra_logo.jpeg"
            alt="Sagar Netra Logo Emblem"
            className="w-full h-full object-contain"
          />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-cyan-100 to-cyan-300 bg-clip-text text-transparent">
            Sagar Netra
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            SAR Oil Spill Detection • Drift Tracking • Vessel Attribution
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => setActiveTab('map')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'map'
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-4 h-4" />
          Interactive GIS Map
        </button>
        <button
          onClick={() => setActiveTab('vessels')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'vessels'
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Activity className="w-4 h-4" />
          Vessel Attribution
        </button>
      </div>

      {/* Live System Status Indicators */}
      <div className="flex items-center gap-4 text-xs font-mono">
        {/* ML Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800">
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-400">ML Model:</span>
          <span className="text-emerald-400 font-semibold">U-Net (ResNet34)</span>
        </div>

        {/* Live AIS Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800">
          <Radio className={`w-3.5 h-3.5 ${liveStatus?.connected ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
          <span className="text-slate-400">AISstream:</span>
          <span className={liveStatus?.connected ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
            {liveStatus?.connected ? `LIVE (${liveStatus?.vessel_count || 0} Ships)` : 'Connecting...'}
          </span>
        </div>
      </div>
    </header>
  );
}
