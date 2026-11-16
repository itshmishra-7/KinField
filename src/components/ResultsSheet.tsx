import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  SlidersHorizontal,
  Edit3,
  Droplets,
  Sprout,
  TrendingUp,
  ShieldCheck,
  BarChart3,
  LayoutGrid,
  RotateCcw,
} from 'lucide-react';
import type { AnalyzeResponse, RotationStrategyResult } from '../types';

interface ResultsSheetProps {
  data: AnalyzeResponse;
  rainPct: number;
  tempDelta: number;
  onScenarioChange: (rainPct: number, tempDelta: number) => void;
  scenarioLoading: boolean;
  onEditInputs: () => void;
  onViewMap: () => void;
}

type ViewTab = 'overview' | 'science';

function StatusLabel({
  status,
  label,
}: {
  status: RotationStrategyResult['status'];
  label: string;
}) {
  if (status === 'green') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        {label}
      </span>
    );
  }
  if (status === 'yellow') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400 whitespace-nowrap">
      <XCircle className="w-3.5 h-3.5 shrink-0" />
      {label}
    </span>
  );
}

function formatDelta(val: number, suffix: string, invertGood = false) {
  if (val === 0) return { text: `0${suffix}`, cls: 'text-slate-400' };
  const sign = val > 0 ? '+' : '';
  const good = invertGood ? val < 0 : val > 0;
  return {
    text: `${sign}${val}${suffix}`,
    cls: good ? 'text-emerald-400' : 'text-amber-400',
  };
}

/** 5-axis SVG Polygon Radar comparing Current Practice vs Best Match */
function TradeoffRadarChart({
  current,
  best,
}: {
  current: RotationStrategyResult;
  best: RotationStrategyResult;
}) {
  const maxWater = Math.max(current.water_use_mm, best.water_use_mm, 1200);
  const toAxes = (s: RotationStrategyResult) => [
    { label: 'Safe Years', value: Math.round((s.safe_years / s.total_years) * 100) },
    {
      label: 'Water Saved',
      value: Math.max(8, Math.min(100, Math.round((1 - s.water_use_mm / (maxWater * 1.15)) * 100))),
    },
    { label: 'Soil Health', value: s.soil_score },
    { label: 'Erosion Cover', value: s.erosion_protection },
    { label: 'Income Idx', value: s.income_index },
  ];

  const curAxes = toAxes(current);
  const bestAxes = toAxes(best);
  const cx = 150;
  const cy = 132;
  const radius = 86;
  const rings = [0.25, 0.5, 0.75, 1];

  const pointAt = (idx: number, pct: number) => {
    const angle = -Math.PI / 2 + (idx * 2 * Math.PI) / 5;
    const r = radius * (pct / 100);
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  };

  const polygonPoints = (axes: Array<{ value: number }>) =>
    axes
      .map((a, i) => {
        const p = pointAt(i, a.value);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(' ');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-white">Multi-Objective Tradeoff Radar</span>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="inline-flex items-center gap-1.5 text-[#8AB4F8]">
            <span className="w-3 h-0.5 bg-[#8AB4F8] inline-block" />
            {best.is_current ? 'Current (Top)' : 'Best Match'}
          </span>
          {!best.is_current && (
            <span className="inline-flex items-center gap-1.5 text-amber-400">
              <span className="w-3 h-0.5 border-t border-dashed border-amber-400 inline-block" />
              Current
            </span>
          )}
        </div>
      </div>

      <svg viewBox="0 0 300 258" className="w-full max-w-[300px] mx-auto overflow-visible">
        {rings.map((ring) => (
          <polygon
            key={ring}
            points={[0, 1, 2, 3, 4]
              .map((i) => {
                const p = pointAt(i, ring * 100);
                return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
              })
              .join(' ')}
            fill="none"
            stroke="rgba(148, 163, 184, 0.16)"
            strokeWidth="1"
          />
        ))}

        {bestAxes.map((axis, i) => {
          const outer = pointAt(i, 100);
          const labelPt = pointAt(i, 122);
          return (
            <g key={axis.label}>
              <line
                x1={cx}
                y1={cy}
                x2={outer.x}
                y2={outer.y}
                stroke="rgba(148, 163, 184, 0.16)"
                strokeWidth="1"
              />
              <text
                x={labelPt.x}
                y={labelPt.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-slate-300 text-[10px] font-medium"
              >
                {axis.label}
              </text>
            </g>
          );
        })}

        {!best.is_current && (
          <polygon
            points={polygonPoints(curAxes)}
            fill="rgba(245, 158, 11, 0.10)"
            stroke="#F59E0B"
            strokeWidth="1.75"
            strokeDasharray="4 3"
          />
        )}

        <motion.polygon
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
          points={polygonPoints(bestAxes)}
          fill="rgba(138, 180, 248, 0.20)"
          stroke="#8AB4F8"
          strokeWidth="2"
        />

        {bestAxes.map((a, i) => {
          const p = pointAt(i, a.value);
          return <circle key={a.label} cx={p.x} cy={p.y} r="3.2" fill="#8AB4F8" />;
        })}
      </svg>

      <div className="divide-y divide-white/10 text-xs border-t border-white/10 pt-1">
        {bestAxes.map((ax, idx) => (
          <div key={ax.label} className="py-1.5 flex items-center justify-between">
            <span className="text-slate-400">{ax.label}</span>
            <div className="font-mono-tabular flex items-center gap-3">
              {!best.is_current && (
                <span className="text-amber-400/90">{curAxes[idx].value}</span>
              )}
              <span className="text-white font-semibold">{ax.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Dual-series 20-year SVG Telemetry Chart (Rainfall + Water Met % + Flowering Peak °C) */
function ClimateTimeSeriesChart({
  strategy,
  inspectedYear,
  onSelectYear,
}: {
  strategy: RotationStrategyResult;
  inspectedYear: number;
  onSelectYear: (yr: number) => void;
}) {
  const years = strategy.years;
  const W = 760;
  const H = 250;
  const padL = 44;
  const padR = 44;
  const padT = 22;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxRain = Math.max(1200, ...years.map((y) => y.rain_mm));
  const minTemp = 20;
  const maxTemp = Math.max(46, ...years.map((y) => Math.ceil(y.max_flowering_temp_c + 2)));
  const colW = plotW / years.length;

  const yRain = (mm: number) => padT + plotH - (mm / maxRain) * plotH;
  const yTemp = (deg: number) =>
    padT + plotH - ((Math.max(minTemp, Math.min(maxTemp, deg)) - minTemp) / (maxTemp - minTemp)) * plotH;

  const tempPath = years
    .map((y, i) => {
      const x = padL + i * colW + colW / 2;
      const py = yTemp(y.max_flowering_temp_c);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${py.toFixed(1)}`;
    })
    .join(' ');

  const activeData = years.find((y) => y.year === inspectedYear) ?? years[years.length - 1];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div>
          <h3 className="font-semibold text-white">
            20-Year Hydro-Thermal Replay · {strategy.name_en}
          </h3>
          <p className="text-slate-400 text-[11px]">
            Bars show annual rainfall (mm) colored by crop outcome; curve shows peak temperature during flowering (°C).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-300">
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500/80 inline-block" /> Safe
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-400/85 inline-block" /> Moderate
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-rose-500/85 inline-block" /> Failed
          </span>
          <span className="inline-flex items-center gap-1 text-sky-300">
            <span className="w-3 h-0.5 bg-sky-400 inline-block" /> Peak Flowering °C
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padT + plotH * (1 - t);
          const rainVal = Math.round(maxRain * t);
          const tempVal = Math.round(minTemp + (maxTemp - minTemp) * t);
          return (
            <g key={t}>
              <line
                x1={padL}
                y1={y}
                x2={W - padR}
                y2={y}
                stroke="rgba(148,163,184,0.12)"
                strokeWidth="1"
              />
              <text
                x={padL - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-slate-400 text-[9.5px] font-mono-tabular"
              >
                {rainVal}
              </text>
              <text
                x={W - padR + 6}
                y={y + 3}
                textAnchor="start"
                className="fill-sky-300/80 text-[9.5px] font-mono-tabular"
              >
                {tempVal}°C
              </text>
            </g>
          );
        })}

        <text x={padL} y={12} className="fill-slate-400 text-[9.5px] font-mono-tabular">
          Rain (mm/yr)
        </text>
        <text
          x={W - padR}
          y={12}
          textAnchor="end"
          className="fill-sky-300 text-[9.5px] font-mono-tabular"
        >
          Flowering Tmax (°C)
        </text>

        {years.map((yr, i) => {
          const x = padL + i * colW;
          const barW = Math.max(8, colW - 8);
          const barX = x + (colW - barW) / 2;
          const barTop = yRain(yr.rain_mm);
          const barH = Math.max(2, padT + plotH - barTop);
          const isSelected = yr.year === activeData.year;

          const fill =
            yr.status === 'GOOD'
              ? 'rgba(34, 197, 94, 0.62)'
              : yr.status === 'MODERATE'
              ? 'rgba(245, 158, 11, 0.72)'
              : 'rgba(239, 68, 68, 0.75)';

          return (
            <g
              key={yr.year}
              className="cursor-pointer"
              onMouseEnter={() => onSelectYear(yr.year)}
              onClick={() => onSelectYear(yr.year)}
            >
              {isSelected && (
                <rect
                  x={x + 1}
                  y={padT}
                  width={colW - 2}
                  height={plotH}
                  rx={4}
                  fill="rgba(138, 180, 248, 0.12)"
                  stroke="rgba(138, 180, 248, 0.45)"
                  strokeWidth="1"
                />
              )}
              <rect x={barX} y={barTop} width={barW} height={barH} rx={2.5} fill={fill} />
              {(i % 2 === 0 || isSelected) && (
                <text
                  x={x + colW / 2}
                  y={H - 10}
                  textAnchor="middle"
                  className={`text-[9.5px] font-mono-tabular ${
                    isSelected ? 'fill-white font-semibold' : 'fill-slate-400'
                  }`}
                >
                  {String(yr.year).slice(2)}
                </text>
              )}
            </g>
          );
        })}

        <path d={tempPath} fill="none" stroke="#38BDF8" strokeWidth="2" strokeLinejoin="round" />
        {years.map((yr, i) => {
          const cx = padL + i * colW + colW / 2;
          const cy = yTemp(yr.max_flowering_temp_c);
          const isSelected = yr.year === activeData.year;
          return (
            <circle
              key={`pt-${yr.year}`}
              cx={cx}
              cy={cy}
              r={isSelected ? 4.5 : 2.5}
              fill={isSelected ? '#FFFFFF' : '#38BDF8'}
              stroke="#07090E"
              strokeWidth="1.2"
              className="pointer-events-none"
            />
          );
        })}
      </svg>

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 pt-2.5 border-t border-white/10 text-xs">
        <div>
          <span className="text-slate-400 block text-[11px]">Selected Year</span>
          <strong className="font-mono-tabular text-white">
            {activeData.year} ·{' '}
            <span
              className={
                activeData.status === 'GOOD'
                  ? 'text-emerald-400'
                  : activeData.status === 'MODERATE'
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }
            >
              {activeData.status}
            </span>
          </strong>
        </div>
        <div>
          <span className="text-slate-400 block text-[11px]">Rainfall / ET0</span>
          <strong className="font-mono-tabular text-white">
            {activeData.rain_mm} / {activeData.et0_mm} mm
          </strong>
        </div>
        <div>
          <span className="text-slate-400 block text-[11px]">Water Satisfaction</span>
          <strong className="font-mono-tabular text-white">
            {activeData.water_satisfaction_pct}%
          </strong>
        </div>
        <div>
          <span className="text-slate-400 block text-[11px]">Irrigation / Deficit</span>
          <strong className="font-mono-tabular text-white">
            {activeData.irrigation_mm} / {activeData.water_deficit_mm} mm
          </strong>
        </div>
        <div>
          <span className="text-slate-400 block text-[11px]">Flowering Tmax / Tmin</span>
          <strong className="font-mono-tabular text-white">
            {activeData.max_flowering_temp_c}°C / {activeData.min_temp_c}°C
          </strong>
        </div>
        <div>
          <span className="text-slate-400 block text-[11px]">GWETROOT Anom</span>
          <strong className="font-mono-tabular text-white">
            {activeData.soil_moisture_anomaly !== null
              ? `${activeData.soil_moisture_anomaly >= 0 ? '+' : ''}${
                  activeData.soil_moisture_anomaly
                }`
              : 'N/A'}
          </strong>
        </div>
        <div className="col-span-2 sm:col-span-6 text-slate-300 text-xs bg-white/[0.03] rounded-lg px-3 py-2 border border-white/10">
          <strong className="text-white">Diagnostic Note:</strong> {activeData.summary_note}
        </div>
      </div>
    </div>
  );
}

export function ResultsSheet({
  data,
  rainPct,
  tempDelta,
  onScenarioChange,
  scenarioLoading,
  onEditInputs,
  onViewMap,
}: ResultsSheetProps) {
  const sortedStrategies = useMemo(
    () => [...data.strategies].sort((a, b) => a.rank - b.rank),
    [data.strategies]
  );

  const currentStrategy = useMemo(
    () => sortedStrategies.find((s) => s.is_current) ?? sortedStrategies[0],
    [sortedStrategies]
  );
  const bestStrategy = useMemo(
    () => sortedStrategies.find((s) => s.is_best_match) ?? sortedStrategies[0],
    [sortedStrategies]
  );

  const defaultYear = useMemo(() => {
    const failedYr = currentStrategy.years.find((y) => y.status === 'FAILED');
    return failedYr?.year ?? 2023;
  }, [currentStrategy]);

  const [activeTab, setActiveTab] = useState<ViewTab>('overview');
  const [inspectedYear, setInspectedYear] = useState<number>(defaultYear);
  const [chartStrategyId, setChartStrategyId] = useState<string>(bestStrategy.id);

  const chartStrategy =
    sortedStrategies.find((s) => s.id === chartStrategyId) ?? sortedStrategies[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-[800] bg-[#07090E]/96 backdrop-blur-xl text-slate-100 flex flex-col overflow-hidden"
    >
      <header className="px-4 sm:px-8 py-3.5 border-b border-white/10 bg-[#080B12]/90 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h2 className="font-display text-lg font-bold tracking-tight text-white truncate">
              {data.location.label}
            </h2>
          </div>
          <p className="text-xs text-slate-400 font-mono-tabular truncate">
            {data.location.lat.toFixed(3)}°N, {data.location.lon.toFixed(3)}°E
            {data.location.field_area_ha
              ? ` · ${data.location.field_area_ha.toFixed(2)} ha (${(
                  data.location.field_area_ha * 2.471
                ).toFixed(2)} ac)`
              : ''}
            {` · ${data.soil.texture} (${data.soil.awc_mm_per_m} mm/m)`}
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0D131D] border border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`relative px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-[#8AB4F8] text-[#07090E]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Farmer Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('science')}
            className={`relative px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'science'
                ? 'bg-[#8AB4F8] text-[#07090E]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Scientific Telemetry
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onEditInputs}
            className="px-3.5 py-2 text-xs font-medium text-slate-200 bg-white/5 hover:bg-white/10 border border-white/12 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit Inputs
          </button>
          <button
            type="button"
            onClick={onViewMap}
            className="px-4 py-2 text-xs font-semibold text-[#07090E] bg-[#8AB4F8] hover:bg-[#A6C8FF] rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Map
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-5">
        <div className="max-w-7xl mx-auto space-y-5">
          <section className="grid xl:grid-cols-12 gap-4 items-stretch">
            <div className="xl:col-span-7 grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/10 rounded-xl bg-[#0D131D] border border-white/10">
              <div className="p-3.5">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 block">
                  Annual Rainfall
                </span>
                <div className="mt-1 flex items-baseline gap-1">
                  <strong className="text-xl font-bold font-mono-tabular text-white">
                    {data.climate_baseline.mean_annual_rain_mm}
                  </strong>
                  <span className="text-[11px] font-mono-tabular text-slate-400">mm/yr</span>
                </div>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  NASA POWER 2005–2024
                </span>
              </div>

              <div className="p-3.5">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 block">
                  Root-Zone AWC
                </span>
                <div className="mt-1 flex items-baseline gap-1">
                  <strong className="text-xl font-bold font-mono-tabular text-white">
                    {data.soil.awc_mm_per_m}
                  </strong>
                  <span className="text-[11px] font-mono-tabular text-slate-400">mm/m</span>
                </div>
                <span className="text-[11px] text-slate-400 block mt-0.5 truncate">
                  Clay {data.soil.clay_pct}% · Sand {data.soil.sand_pct}%
                </span>
              </div>

              <div className="p-3.5">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 block">
                  Heat Spikes (&gt;38°C)
                </span>
                <div className="mt-1 flex items-baseline gap-1">
                  <strong className="text-xl font-bold font-mono-tabular text-amber-300">
                    {data.climate_baseline.hot_days_above_38_per_yr}
                  </strong>
                  <span className="text-[11px] font-mono-tabular text-slate-400">days/yr</span>
                </div>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  GWETROOT{' '}
                  {data.climate_baseline.mean_gwetroot !== null
                    ? data.climate_baseline.mean_gwetroot.toFixed(2)
                    : 'N/A'}
                </span>
              </div>

              <div className="p-3.5">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 block">
                  Data Confidence
                </span>
                <div className="mt-1">
                  <strong
                    className={`text-xl font-bold font-mono-tabular ${
                      data.overall_confidence === 'HIGH'
                        ? 'text-emerald-400'
                        : data.overall_confidence === 'MED'
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {data.overall_confidence}
                  </strong>
                </div>
                <span className="text-[11px] text-slate-400 block mt-0.5 truncate">
                  {data.climate_baseline.grid_resolution}
                </span>
              </div>
            </div>

            <div className="xl:col-span-5 p-3.5 rounded-xl bg-[#0D131D] border border-white/10 flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-white inline-flex items-center gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#8AB4F8]" />
                  Climate What-If Stress Test
                </span>
                <div className="flex items-center gap-2 text-xs">
                  {scenarioLoading && (
                    <span className="text-[#8AB4F8] text-[11px]">Recalculating…</span>
                  )}
                  {(rainPct !== 0 || tempDelta !== 0) && (
                    <button
                      type="button"
                      onClick={() => onScenarioChange(0, 0)}
                      className="text-[11px] text-[#8AB4F8] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" /> Reset
                    </button>
                  )}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3.5">
                <label className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Rainfall Shift</span>
                    <strong className="font-mono-tabular text-white">
                      {rainPct > 0 ? `+${rainPct}%` : `${rainPct}%`}
                    </strong>
                  </div>
                  <input
                    type="range"
                    min={-30}
                    max={30}
                    step={5}
                    value={rainPct}
                    onChange={(e) => onScenarioChange(Number(e.target.value), tempDelta)}
                    className="w-full accent-[#8AB4F8] cursor-pointer"
                  />
                </label>

                <label className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Warming</span>
                    <strong className="font-mono-tabular text-white">
                      +{tempDelta.toFixed(1)}°C
                    </strong>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={3}
                    step={0.5}
                    value={tempDelta}
                    onChange={(e) => onScenarioChange(rainPct, Number(e.target.value))}
                    className="w-full accent-[#8AB4F8] cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </section>

          <AnimatePresence mode="wait">
            {activeTab === 'overview' ? (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-5"
              >
                <section className="grid lg:grid-cols-3 gap-4 items-stretch">
                  {sortedStrategies.map((strat, idx) => {
                    const scoreColor =
                      strat.status === 'green'
                        ? 'text-emerald-400'
                        : strat.status === 'yellow'
                        ? 'text-amber-400'
                        : 'text-rose-400';

                    const safeDelta = formatDelta(
                      strat.safe_years - currentStrategy.safe_years,
                      ' yrs'
                    );
                    const waterPctDiff =
                      currentStrategy.water_use_mm > 0
                        ? Math.round(
                            ((strat.water_use_mm - currentStrategy.water_use_mm) /
                              currentStrategy.water_use_mm) *
                              100
                          )
                        : 0;
                    const waterDelta = formatDelta(waterPctDiff, '% water', true);

                    return (
                      <motion.article
                        key={strat.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.25,
                          delay: idx * 0.05,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        className={`p-5 rounded-xl border flex flex-col justify-between gap-4 ${
                          strat.is_best_match
                            ? 'bg-[#101827] border-[#8AB4F8]/55'
                            : 'bg-[#0D131D] border-white/10'
                        }`}
                      >
                        <div className="space-y-3.5">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-semibold text-slate-300">
                              {strat.is_best_match
                                ? 'Best Match'
                                : strat.is_current
                                ? 'Current Practice'
                                : `Alternative #${strat.rank}`}
                            </span>
                            <StatusLabel status={strat.status} label={strat.status_label_en} />
                          </div>

                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="font-display text-lg font-bold text-white leading-snug">
                                {strat.name_en}
                              </h3>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {strat.crop_labels_en.join(' · ')}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <div
                                className={`text-3xl font-bold font-mono-tabular leading-none ${scoreColor}`}
                              >
                                {strat.safe_years}
                                <span className="text-sm font-normal text-slate-400">
                                  /{strat.total_years}
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-400">safe years</span>
                            </div>
                          </div>

                          {!strat.is_current && (
                            <div className="flex items-center gap-2 text-[11px] font-mono-tabular text-slate-400">
                              <span>vs. Current:</span>
                              <strong className={safeDelta.cls}>{safeDelta.text}</strong>
                              <span>·</span>
                              <strong className={waterDelta.cls}>{waterDelta.text}</strong>
                            </div>
                          )}

                          <div>
                            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5 font-mono-tabular">
                              <span>2005</span>
                              <span className="font-sans text-slate-400">
                                Tap year {inspectedYear} highlighted
                              </span>
                              <span>2024</span>
                            </div>
                            <div className="grid grid-cols-[repeat(20,minmax(0,1fr))] gap-1">
                              {strat.years.map((yr) => {
                                const barCls =
                                  yr.status === 'GOOD'
                                    ? 'bg-emerald-500/85 hover:bg-emerald-400'
                                    : yr.status === 'MODERATE'
                                    ? 'bg-amber-400/85 hover:bg-amber-300'
                                    : 'bg-rose-500/85 hover:bg-rose-400';
                                const isPicked = inspectedYear === yr.year;
                                return (
                                  <button
                                    key={yr.year}
                                    type="button"
                                    onClick={() => setInspectedYear(yr.year)}
                                    title={`${yr.year}: ${yr.status} (${yr.water_satisfaction_pct}% water met, peak ${yr.max_flowering_temp_c}°C)`}
                                    className={`h-7 rounded-sm transition-transform cursor-pointer ${barCls} ${
                                      isPicked ? 'ring-2 ring-white scale-110 z-10' : ''
                                    }`}
                                  />
                                );
                              })}
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/10 text-xs">
                            <div>
                              <span className="text-slate-400 flex items-center gap-1">
                                <Droplets className="w-3 h-3 text-[#8AB4F8]" /> Water Use
                              </span>
                              <strong className="font-mono-tabular text-white text-sm">
                                {strat.water_use_mm} mm
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-400 flex items-center gap-1">
                                <Sprout className="w-3 h-3 text-emerald-400" /> Soil Score
                              </span>
                              <strong className="font-mono-tabular text-white text-sm">
                                {strat.soil_score}/100
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-400 flex items-center gap-1">
                                <TrendingUp className="w-3 h-3 text-amber-400" /> Income Idx
                              </span>
                              <strong className="font-mono-tabular text-white text-sm">
                                {strat.income_index}/100
                              </strong>
                            </div>
                          </div>

                          <div className="space-y-2 text-xs leading-relaxed">
                            <p className="text-slate-200">{strat.summary_en}</p>
                            <p className="text-amber-300/95">
                              <strong className="font-semibold">Key Risk:</strong> {strat.risks[0]}
                            </p>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-white/10 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
                          <div>
                            <span className="text-slate-400 block">Nitrogen Cycling</span>
                            <strong className="text-slate-200">{strat.nutrient_cycling_label}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Erosion Cover</span>
                            <strong className="font-mono-tabular text-slate-200">
                              {strat.erosion_protection}%
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Pest Disruption</span>
                            <strong className="text-slate-200">{strat.pest_disruption_label}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Irrigation Need</span>
                            <strong className="font-mono-tabular text-slate-200">
                              {strat.irrigation_need_mm} mm/yr
                            </strong>
                          </div>
                        </div>
                      </motion.article>
                    );
                  })}
                </section>

                <section className="p-4 sm:p-5 rounded-xl bg-[#0D131D] border border-white/10 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        Year <span className="font-mono-tabular text-[#8AB4F8]">{inspectedYear}</span>{' '}
                        Side-by-Side Comparison
                      </h3>
                      <p className="text-xs text-slate-400">
                        Click any bar in the 2005–2024 strips above to compare how each rotation handled that year&apos;s weather.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('science')}
                      className="text-xs font-medium text-[#8AB4F8] hover:underline cursor-pointer"
                    >
                      Open 20-year hydro-thermal graphs →
                    </button>
                  </div>

                  <div className="grid md:grid-cols-3 gap-3">
                    {sortedStrategies.map((strat) => {
                      const yr =
                        strat.years.find((y) => y.year === inspectedYear) ?? strat.years[0];
                      return (
                        <div
                          key={`yr-${strat.id}`}
                          className="p-3 rounded-lg bg-[#080B12] border border-white/10 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <strong className="text-white truncate">{strat.name_en}</strong>
                            <span
                              className={`font-mono-tabular font-semibold ${
                                yr.status === 'GOOD'
                                  ? 'text-emerald-400'
                                  : yr.status === 'MODERATE'
                                  ? 'text-amber-400'
                                  : 'text-rose-400'
                              }`}
                            >
                              {yr.status}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 font-mono-tabular text-[11px] text-slate-300">
                            <div>
                              <span className="text-slate-500 block font-sans">Rain</span>
                              {yr.rain_mm} mm
                            </div>
                            <div>
                              <span className="text-slate-500 block font-sans">Water Met</span>
                              {yr.water_satisfaction_pct}%
                            </div>
                            <div>
                              <span className="text-slate-500 block font-sans">Flower Tmax</span>
                              {yr.max_flowering_temp_c}°C
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            {yr.summary_note}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </motion.div>
            ) : (
              <motion.div
                key="science"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-300">
                    Inspect Strategy Time Series:
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#0D131D] border border-white/10">
                    {sortedStrategies.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setChartStrategyId(s.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                          chartStrategy.id === s.id
                            ? 'bg-[#8AB4F8] text-[#07090E] font-semibold'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {s.name_en} ({s.safe_years}/{s.total_years})
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid lg:grid-cols-12 gap-4 items-stretch">
                  <div className="lg:col-span-8 p-5 rounded-xl bg-[#0D131D] border border-white/10">
                    <ClimateTimeSeriesChart
                      strategy={chartStrategy}
                      inspectedYear={inspectedYear}
                      onSelectYear={setInspectedYear}
                    />
                  </div>

                  <div className="lg:col-span-4 p-5 rounded-xl bg-[#0D131D] border border-white/10">
                    <TradeoffRadarChart current={currentStrategy} best={bestStrategy} />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-5 rounded-xl bg-[#0D131D] border border-white/10 space-y-2.5 text-xs">
                    <h3 className="text-sm font-bold text-white">
                      Deterministic Biophysical Pipeline (Zero Black-Box AI)
                    </h3>
                    <ul className="space-y-2 text-slate-300 leading-relaxed list-disc pl-4">
                      <li>
                        <strong className="text-white">Reference ET₀:</strong> Solar-calibrated
                        Hargreaves–Samani computed daily from NASA POWER{' '}
                        <span className="font-mono-tabular">T2M_MAX, T2M_MIN</span>, and{' '}
                        <span className="font-mono-tabular">ALLSKY_SFC_SW_DWN</span>.
                      </li>
                      <li>
                        <strong className="text-white">Soil Water Bucket:</strong> Root-depth scaled
                        Available Water Capacity (<span className="font-mono-tabular">{data.soil.awc_mm_per_m} mm/m</span>{' '}
                        from {data.soil.source}), including <span className="font-mono-tabular">3.2 mm/day</span>{' '}
                        paddy percolation where rice is grown.
                      </li>
                      <li>
                        <strong className="text-white">Annual Pass/Fail Rules:</strong> A year fails
                        if seasonal water satisfaction drops below crop drought tolerance, flowering-window{' '}
                        <span className="font-mono-tabular">Tmax</span> exceeds heat limits,{' '}
                        <span className="font-mono-tabular">Tmin</span> hits frost, or extraction triggers groundwater overdraft.
                      </li>
                    </ul>
                  </div>

                  <div className="p-5 rounded-xl bg-[#0D131D] border border-white/10 space-y-2.5 text-xs">
                    <h3 className="text-sm font-bold text-amber-300">
                      Resolution Limits &amp; Known Data Gaps
                    </h3>
                    <ul className="space-y-1.5 text-slate-300 leading-relaxed list-disc pl-4">
                      <li>
                        Climate source: <strong className="text-white">{data.climate_baseline.source}</strong>{' '}
                        at <span className="font-mono-tabular">{data.climate_baseline.grid_resolution}</span>.
                        Localized hailstorms, micro-topography, and canal turns are not resolved.
                      </li>
                      {chartStrategy.gaps.map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="px-4 sm:px-8 py-2.5 border-t border-white/10 bg-[#080B12] flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 shrink-0">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#8AB4F8]" />
          {data.climate_baseline.source} · {data.soil.source} · Confidence: {data.overall_confidence}
        </span>
        <span className="text-slate-300">{data.kvk_disclaimer_en}</span>
      </footer>
    </motion.div>
  );
}