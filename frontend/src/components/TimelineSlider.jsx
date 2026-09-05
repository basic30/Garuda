import React, { useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, FastForward, Clock, Wind, Navigation, Activity } from 'lucide-react';

const STEPS = [
  { hour: 0, label: '0h (Detection)', dist: '0.0 km', speed: '0.0 kts' },
  { hour: 6, label: '+6h Drift', dist: '4.2 km', speed: '0.8 kts' },
  { hour: 12, label: '+12h Drift', dist: '8.8 km', speed: '0.9 kts' },
  { hour: 18, label: '+18h Drift', dist: '13.5 km', speed: '1.0 kts' },
  { hour: 24, label: '+24h Drift', dist: '18.2 km', speed: '1.1 kts' },
  { hour: 36, label: '+36h Drift', dist: '27.4 km', speed: '1.0 kts' },
  { hour: 48, label: '+48h Drift', dist: '36.8 km', speed: '0.9 kts' }
];

export default function TimelineSlider({
  timelineHour,
  setTimelineHour,
  isPlaying,
  setIsPlaying,
  playbackSpeed,
  setPlaybackSpeed,
  forecastData,
  originGeojson,
  selectedIncident
}) {
  const timerRef = useRef(null);

  // Extract dynamic environmental forcing from selected incident
  const forcing = selectedIncident?.forcing || forecastData?.['6h']?.geojson?.properties?.forcing || originGeojson?.properties?.forcing;
  const windSpeedMps = forcing?.wind_speed_m_s || 6.28;
  const windKnots = (windSpeedMps * 1.94384).toFixed(1);
  const windU = forcing?.wind_u_m_s || -5.0;
  const windV = forcing?.wind_v_m_s || 3.8;
  const windDirDeg = Math.round((Math.atan2(-windU, -windV) * 180 / Math.PI + 360) % 360);

  const currentSpeedMps = forcing?.current_speed_m_s || 0.45;
  const driftSpeedKts = ((currentSpeedMps + 0.03 * windSpeedMps) * 1.94384).toFixed(1);
  const estDriftKm = (timelineHour * (currentSpeedMps + 0.03 * windSpeedMps) * 3.6).toFixed(1);

  // Animation Loop Effect
  useEffect(() => {
    if (isPlaying) {
      const intervalMs = Math.max(200, 1200 / playbackSpeed);
      timerRef.current = setInterval(() => {
        setTimelineHour((prevHour) => {
          if (prevHour >= 48) {
            return 0;
          }
          return prevHour + 1;
        });
      }, intervalMs);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, playbackSpeed, setTimelineHour]);

  const togglePlay = () => setIsPlaying(!isPlaying);
  const handleReset = () => {
    setIsPlaying(false);
    setTimelineHour(0);
  };

  const toggleSpeed = () => {
    if (playbackSpeed === 1) setPlaybackSpeed(2);
    else if (playbackSpeed === 2) setPlaybackSpeed(4);
    else setPlaybackSpeed(1);
  };

  const progressPercent = (timelineHour / 48) * 100;

  return (
    <div className="w-full glass-panel border border-slate-800/90 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-2xl space-y-2.5 sm:space-y-3 font-sans">
      {/* Header Info Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800/80 pb-2 sm:pb-2.5">
        <div className="flex items-center justify-between md:justify-start gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl border transition-all ${
              isPlaying
                ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-400 shadow-lg shadow-cyan-950/50 animate-pulse'
                : 'bg-slate-900 border-slate-800 text-slate-300'
            }`}>
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-[11px] sm:text-xs uppercase tracking-wider font-semibold text-slate-300 sm:text-slate-400">
                  <span className="hidden sm:inline">Forward </span>Drift Forecast
                </span>
                <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-purple-950/70 border border-purple-500/40 text-purple-300 text-[9px] sm:text-[10px] font-mono font-bold">
                  +{timelineHour}h
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400 font-mono hidden sm:block">
                Trajectory modeling surface current & wind vector drift physics
              </p>
            </div>
          </div>

          {/* Quick Drift Summary badge for small phones */}
          <div className="md:hidden text-[10px] font-mono font-bold text-cyan-300 bg-cyan-950/50 px-2 py-1 rounded-md border border-cyan-500/30">
            {estDriftKm} km drift
          </div>
        </div>

        {/* Real-time Dynamic Environmental Forcing & Drift Metrics */}
        <div className="grid grid-cols-3 md:flex md:items-center gap-1.5 sm:gap-3 md:gap-4 text-[10px] sm:text-xs font-mono">
          <div className="flex items-center justify-center md:justify-start gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-900/90 border border-slate-800">
            <Navigation className="w-3 h-3 text-cyan-400 shrink-0 hidden xs:block" />
            <span className="text-slate-400 hidden sm:inline">Drift:</span>
            <span className="text-cyan-300 font-bold truncate">{estDriftKm}km</span>
          </div>

          <div className="flex items-center justify-center md:justify-start gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-900/90 border border-slate-800">
            <Wind className="w-3 h-3 text-purple-400 shrink-0 hidden xs:block" />
            <span className="text-slate-400 hidden sm:inline">Forcing:</span>
            <span className="text-purple-300 font-bold truncate">{windKnots}kts</span>
          </div>

          <div className="flex items-center justify-center md:justify-start gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-900/90 border border-slate-800">
            <Activity className="w-3 h-3 text-amber-400 shrink-0 hidden xs:block" />
            <span className="text-slate-400 hidden sm:inline">Area:</span>
            <span className="text-amber-300 font-bold truncate">+{(timelineHour * 4.2).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* Main Interactive Controls & Slider Bar */}
      <div className="flex items-center gap-2 sm:gap-4 pt-0.5 sm:pt-1">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          className={`flex items-center justify-center gap-1.5 px-3 py-2 sm:px-5 sm:py-2.5 rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs transition-all shadow-lg shrink-0 ${
            isPlaying
              ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-amber-950/50 hover:brightness-110'
              : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-cyan-950/50 hover:brightness-110'
          }`}
        >
          {isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>PAUSE</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span><span className="hidden sm:inline">PLAY </span>ANIM<span className="hidden sm:inline">ATION</span></span>
            </>
          )}
        </button>

        {/* Reset Button */}
        <button
          onClick={handleReset}
          className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
          title="Reset to 0h"
        >
          <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* Speed Toggle */}
        <button
          onClick={toggleSpeed}
          className="flex items-center gap-0.5 sm:gap-1 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[11px] sm:text-xs hover:border-cyan-500/50 transition-colors shrink-0"
          title="Change playback speed"
        >
          <FastForward className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-400" />
          <span>{playbackSpeed}x</span>
        </button>

        {/* Custom Timeline Slider Control */}
        <div className="flex-1 relative flex flex-col justify-center px-1 sm:px-2 min-w-0">
          {/* Progress Bar background */}
          <div className="relative w-full h-2.5 sm:h-3 bg-slate-900 border border-slate-800 rounded-full overflow-hidden cursor-pointer">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 transition-all duration-150 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* HTML5 Native Range Input Overlay */}
          <input
            type="range"
            min={0}
            max={48}
            step={1}
            value={timelineHour}
            onChange={(e) => {
              setIsPlaying(false);
              setTimelineHour(parseInt(e.target.value, 10));
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />

          {/* Step Tick Marks */}
          <div className="relative w-full h-6 sm:h-8 mt-1 sm:mt-2">
            {STEPS.map((s) => {
              const isActive = timelineHour === s.hour;
              const isPassed = timelineHour >= s.hour;
              const percent = (s.hour / 48) * 100;
              let translateClass = '-translate-x-1/2';
              if (s.hour === 0) translateClass = 'translate-x-0';
              if (s.hour === 48) translateClass = '-translate-x-full';

              return (
                <button
                  key={s.hour}
                  onClick={() => {
                    setIsPlaying(false);
                    setTimelineHour(s.hour);
                  }}
                  style={{ left: `${percent}%` }}
                  className={`absolute top-0 flex flex-col items-center group transition-colors focus:outline-none ${translateClass}`}
                >
                  <div
                    className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full transition-all ${
                      isActive
                        ? 'bg-cyan-400 ring-2 sm:ring-4 ring-cyan-500/30 scale-125'
                        : isPassed
                        ? 'bg-cyan-600'
                        : 'bg-slate-700 group-hover:bg-slate-500'
                    }`}
                  />
                  <span
                    className={`text-[9px] sm:text-[10px] font-mono mt-0.5 sm:mt-1 transition-all ${
                      isActive
                        ? 'text-cyan-300 font-bold scale-105'
                        : 'text-slate-500 group-hover:text-slate-300'
                    }`}
                  >
                    +{s.hour}h
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
