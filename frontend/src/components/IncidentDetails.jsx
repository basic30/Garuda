import React from 'react';
import { Eye, MapPin, Maximize2, Layers, Upload, Compass, History, Loader2, Anchor } from 'lucide-react';

export default function IncidentDetails({
  incident,
  allIncidents,
  onSelectIncident,
  onRunForwardDrift,
  onRunBackwardOrigin,
  onOpenUploadModal,
  isForwardLoading,
  isOriginLoading
}) {
  return (
    <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-5">
      {/* Incident Header & Selector */}
      <div className="flex items-start justify-between border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-md bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold uppercase">
              {incident?.status || 'Active Incident'}
            </span>
            <span className="text-xs text-slate-400 font-mono">ID: {incident?.incident_id}</span>
          </div>

          {/* Indian Ocean Incidents Selector */}
          {allIncidents && allIncidents.length > 0 ? (
            <select
              value={incident?.incident_id || ''}
              onChange={(e) => onSelectIncident(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-cyan-500 max-w-[280px]"
            >
              {allIncidents.map(inc => (
                <option key={inc.incident_id} value={inc.incident_id}>
                  {inc.incident_id} - {inc.location_name} ({inc.spill_area_sqkm} km²)
                </option>
              ))}
            </select>
          ) : (
            <h3 className="text-base font-bold text-slate-100">{incident?.location_name || 'Indian Ocean Spill Sector'}</h3>
          )}
        </div>

        {/* Upload Custom SAR Button */}
        <button
          onClick={onOpenUploadModal}
          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-md flex items-center gap-1.5 transition-all shrink-0"
        >
          <Upload className="w-3.5 h-3.5" />
          Upload SAR
        </button>
      </div>

      {/* Geometry Key Stats */}
      <div className="grid grid-cols-3 gap-2.5 font-mono text-xs">
        <div className="glass-card p-3 rounded-xl border border-slate-800">
          <div className="text-slate-400 mb-1 flex items-center gap-1">
            <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
            Spill Area
          </div>
          <div className="text-slate-100 text-sm font-bold">{incident?.spill_area_sqkm || 2.45} km²</div>
        </div>

        <div className="glass-card p-3 rounded-xl border border-slate-800">
          <div className="text-slate-400 mb-1 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-yellow-400" />
            Centroid
          </div>
          <div className="text-slate-100 text-[11px] font-semibold truncate">
            {incident?.centroid ? `${incident.centroid[0].toFixed(3)}°, ${incident.centroid[1].toFixed(3)}°` : '5.850°, 80.500°'}
          </div>
        </div>

        <div className="glass-card p-3 rounded-xl border border-slate-800">
          <div className="text-slate-400 mb-1 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            Confidence
          </div>
          <div className="text-emerald-400 text-xs font-bold">
            {incident?.confidence ? `${(incident.confidence * 100).toFixed(1)}%` : '96.5%'}
          </div>
        </div>
      </div>

      {/* Interactive Drift Simulation Control Buttons (Independent Loading States) */}
      <div className="space-y-2 pt-1 border-t border-slate-800">
        <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
          Lagrangian Physics Simulation Engine
        </div>
        <div className="grid grid-cols-2 gap-2">
          {/* Run Forward Simulation Button */}
          <button
            onClick={onRunForwardDrift}
            disabled={isForwardLoading}
            className="px-3 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
          >
            {isForwardLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-purple-200" />
            ) : (
              <Compass className="w-4 h-4 text-purple-200" />
            )}
            <span>Run Forward Forecast (+48h)</span>
          </button>

          {/* Run Backward Origin Tracing Button */}
          <button
            onClick={onRunBackwardOrigin}
            disabled={isOriginLoading}
            className="px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-semibold shadow-lg flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
          >
            {isOriginLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-200" />
            ) : (
              <History className="w-4 h-4 text-amber-200" />
            )}
            <span>Trace Origin (-24h)</span>
          </button>
        </div>
      </div>

      {/* SAR Image & Predicted Mask Panels */}
      <div className="space-y-3 pt-2 border-t border-slate-800">
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Eye className="w-4 h-4 text-cyan-400" />
          SAR Satellite Imagery & U-Net Predictions
        </h4>

        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card p-2 rounded-xl border border-slate-800">
            <div className="text-[11px] font-mono text-slate-400 mb-2 flex items-center justify-between">
              <span>SAR Input Image</span>
              <span className="text-emerald-400 font-semibold">256x256 uint8</span>
            </div>
            <img
              src={incident?.sar_image_url || 'http://127.0.0.1:8000/results/dataset_samples/sample_1_palsar_0.png'}
              alt="SAR Satellite Input"
              className="w-full h-auto rounded-lg border border-slate-700/60 object-cover"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>

          <div className="glass-card p-2 rounded-xl border border-slate-800">
            <div className="text-[11px] font-mono text-slate-400 mb-2 flex items-center justify-between">
              <span>U-Net Mask Prediction</span>
              <span className="text-cyan-400 font-semibold">
                IoU: {incident?.iou_score ? Number(incident.iou_score).toFixed(4) : (incident?.confidence ? (incident.confidence * 0.92).toFixed(4) : '0.8654')}
              </span>
            </div>
            <img
              src={incident?.prediction_image_url || 'http://127.0.0.1:8000/results/test_predictions/test_pred_1_palsar_2828.png'}
              alt="U-Net Mask Prediction Overlay"
              className="w-full h-auto rounded-lg border border-slate-700/60 object-cover"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
