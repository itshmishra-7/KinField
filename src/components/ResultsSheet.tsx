import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Edit3,
  ShieldCheck,
  BarChart3,
  LayoutGrid,
  RotateCcw,
  Droplets,
  Sprout,
  Coins,
  Maximize2,
  X,
  Thermometer,
  Layers,
} from 'lucide-react';
import type { AnalyzeResponse, CropId, RotationStrategyResult } from '../types';
import { CROP_MEDIA } from '../data/cropMedia';

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

const WEATHER_PRESETS = [
  { label: 'Normal', rain: 0, temp: 0 },
  { label: '-20% Rain', rain: -20, temp: 0 },
  { label: '+2°C Heat', rain: 0, temp: 2 },
  { label: 'Dry + Hot', rain: -20, temp: 2 },
];

function cleanRiskText(text: string): string {
  return text.replace(/\b1 years\b/g, '1 year');
}

function StatusBadge({
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
      label: 'Water Efficiency',
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

/** Dual-series 20-year SVG Telemetry Chart */
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
    padT +
    plotH -
    ((Math.max(minTemp, Math.min(maxTemp, deg)) - minTemp) / (maxTemp - minTemp)) * plotH;

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

/** Interactive Large Crop Photo Showcase inside each strategy card */
function StrategyCropShowcase({
  strategy,
  onExpandGallery,
}: {
  strategy: RotationStrategyResult;
  onExpandGallery: (strat: RotationStrategyResult, initialCropIdx: number) => void;
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const safeIdx = selectedIdx < strategy.crops.length ? selectedIdx : 0;
  const activeCropId: CropId = strategy.crops[safeIdx] ?? 'wheat';
  const media = CROP_MEDIA[activeCropId];

  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-[#080C14]">
      <div className="relative h-44 sm:h-48 w-full overflow-hidden group">
        <AnimatePresence mode="wait">
          <motion.img
            key={`${strategy.id}-${activeCropId}`}
            src={media.image}
            alt={media.name}
            referrerPolicy="no-referrer"
            initial={{ opacity: 0.35, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0.35 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="w-full h-full object-cover"
          />
        </AnimatePresence>

        <div className="absolute inset-0 bg-gradient-to-t from-[#080C14] via-[#080C14]/35 to-black/20 pointer-events-none" />

        <button
          type="button"
          onClick={() => onExpandGallery(strategy, safeIdx)}
          className="absolute top-2.5 right-2.5 px-2.5 py-1.5 rounded-lg bg-[#080C14]/80 hover:bg-[#080C14] border border-white/20 text-[11px] font-medium text-white inline-flex items-center gap-1.5 backdrop-blur-md transition-colors cursor-pointer"
          title="Open large crop photo comparison"
        >
          <Maximize2 className="w-3 h-3 text-[#8AB4F8]" />
          Inspect Crops
        </button>

        <div className="absolute inset-x-3 bottom-2.5 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8AB4F8] block">
              Season {safeIdx + 1} · {media.season}
            </span>
            <h5 className="text-sm font-bold text-white truncate">{media.name}</h5>
            <p className="text-[11px] text-slate-300 truncate">
              {media.waterProfile} · {media.rootNote}
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Crop Switcher Tabs */}
      <div className="grid grid-cols-3 gap-1 p-1.5 bg-[#0A0F18] border-t border-white/10">
        {strategy.crops.map((cropId, idx) => {
          const item = CROP_MEDIA[cropId];
          const active = idx === safeIdx;
          return (
            <button
              key={`${cropId}-${idx}`}
              type="button"
              onClick={() => setSelectedIdx(idx)}
              className={`px-2 py-1.5 rounded-lg text-left flex items-center gap-1.5 transition-all cursor-pointer min-w-0 ${
                active
                  ? 'bg-[#8AB4F8]/20 border border-[#8AB4F8]/55 text-white'
                  : 'bg-white/[0.02] border border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]'
              }`}
            >
              <img
                src={item.image}
                alt={item.name}
                referrerPolicy="no-referrer"
                className="w-6 h-6 rounded object-cover shrink-0"
              />
              <span className="text-[11px] font-medium truncate">
                {idx + 1}. {item.name.split(' ')[0]}
              </span>
            </button>
          );
        })}
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
  const [galleryState, setGalleryState] = useState<{
    strategy: RotationStrategyResult;
    focusedIdx: number;
  } | null>(null);

  const chartStrategy =
    sortedStrategies.find((s) => s.id === chartStrategyId) ?? sortedStrategies[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-[800] bg-[#07090E]/97 backdrop-blur-xl text-slate-100 flex flex-col overflow-hidden"
    >
      {/* 3-Zone Header */}
      <header className="px-4 sm:px-8 py-3.5 border-b border-white/10 bg-[#080B12]/90 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h2 className="font-display text-lg font-bold tracking-tight text-white truncate">
              {data.location.label}
            </h2>
            <span className="font-mono-tabular text-xs text-slate-400 hidden sm:inline">
              {data.location.lat.toFixed(3)}°N, {data.location.lon.toFixed(3)}°E
            </span>
          </div>
          <p className="text-xs text-slate-400 truncate">
            {data.soil.texture} · AWC {data.soil.awc_mm_per_m} mm/m · NASA Mean Rain{' '}
            <span className="font-mono-tabular text-slate-300">
              {data.climate_baseline.mean_annual_rain_mm} mm/yr
            </span>
            {data.location.field_area_ha
              ? ` · Field: ${data.location.field_area_ha.toFixed(2)} ha (${(
                  data.location.field_area_ha * 2.471
                ).toFixed(2)} acres)`
              : ''}
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0D131D] border border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer ${
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
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer ${
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
            Map Layers
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-5">
        <div className="max-w-7xl mx-auto space-y-5">
          {/* Baseline Climate & Soil Telemetry Strip */}
          <section className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/10 rounded-xl bg-[#0D131D] border border-white/10">
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
                Clay {data.soil.clay_pct}% · Sand {data.soil.sand_pct}% · SOC {data.soil.soc_g_kg} g/kg
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
          </section>

          {/* Interactive Future Weather Stress Controls */}
          <section className="rounded-xl bg-[#0D131D] border border-white/10 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <span className="text-xs font-semibold text-white">What-If Climate Stress:</span>
              {WEATHER_PRESETS.map((preset) => {
                const active = rainPct === preset.rain && tempDelta === preset.temp;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => onScenarioChange(preset.rain, preset.temp)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-[#8AB4F8] text-[#07090E] font-semibold'
                        : 'bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
              {scenarioLoading && (
                <span className="text-xs text-[#8AB4F8] ml-1">Recomputing 20 yrs…</span>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4 flex-1 max-w-xl">
              <label className="space-y-1 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Rainfall Change</span>
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
                  <span>Extra Warming</span>
                  <strong className="font-mono-tabular text-white">+{tempDelta.toFixed(1)}°C</strong>
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
          </section>

          <AnimatePresence mode="wait">
            {activeTab === 'overview' ? (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-5"
              >
                {/* 3-Column Strategy Comparison Grid (Matches User's Preferred Design + Interactive Crop Photos) */}
                <div className="grid lg:grid-cols-3 gap-4 items-stretch">
                  {sortedStrategies.map((strat, idx) => {
                    const safeDiff = strat.safe_years - currentStrategy.safe_years;
                    const waterDiffPct =
                      currentStrategy.water_use_mm > 0
                        ? Math.round(
                            ((strat.water_use_mm - currentStrategy.water_use_mm) /
                              currentStrategy.water_use_mm) *
                              100
                          )
                        : 0;

                    const scoreColor =
                      strat.status === 'green'
                        ? 'text-emerald-400'
                        : strat.status === 'yellow'
                        ? 'text-amber-400'
                        : 'text-rose-400';

                    return (
                      <motion.article
                        key={strat.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.26,
                          delay: idx * 0.05,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        className={`p-5 rounded-xl border flex flex-col justify-between gap-4 ${
                          strat.is_best_match
                            ? 'bg-[#101827] border-[#8AB4F8]/55 shadow-lg shadow-black/30'
                            : 'bg-[#0D131D] border-white/10'
                        }`}
                      >
                        <div className="space-y-4">
                          {/* Rank & Status Header */}
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span
                              className={`font-medium ${
                                strat.is_best_match ? 'text-slate-200' : 'text-slate-400'
                              }`}
                            >
                              {strat.is_best_match
                                ? 'Best Match'
                                : strat.is_current
                                ? 'Current Practice'
                                : `Alternative #${idx + 1}`}
                            </span>
                            <StatusBadge status={strat.status} label={strat.status_label_en} />
                          </div>

                          {/* Title + Safe Years Score */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="font-display text-lg font-bold text-white leading-snug">
                                {strat.name_en}
                              </h3>
                              <p className="text-xs text-slate-400 mt-1">
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
                              <span className="text-[11px] text-slate-400 block mt-0.5">
                                safe years
                              </span>
                            </div>
                          </div>

                          {/* Interactive Large Crop Photo Showcase */}
                          <StrategyCropShowcase
                            strategy={strat}
                            onExpandGallery={(s, focusedIdx) =>
                              setGalleryState({ strategy: s, focusedIdx })
                            }
                          />

                          {/* Delta vs Current Practice */}
                          {!strat.is_current && (
                            <div className="flex items-center gap-2 text-xs font-mono-tabular">
                              <span className="text-slate-400">vs. Current:</span>
                              <span
                                className={
                                  safeDiff >= 0
                                    ? 'text-emerald-400 font-semibold'
                                    : 'text-rose-400 font-semibold'
                                }
                              >
                                {safeDiff >= 0 ? `+${safeDiff}` : safeDiff} yrs
                              </span>
                              <span className="text-slate-600">·</span>
                              <span
                                className={
                                  waterDiffPct <= 0
                                    ? 'text-emerald-400 font-semibold'
                                    : 'text-amber-400 font-semibold'
                                }
                              >
                                {waterDiffPct <= 0 ? `${waterDiffPct}%` : `+${waterDiffPct}%`}{' '}
                                water
                              </span>
                            </div>
                          )}

                          {/* Interactive 2005–2024 Year Bar Strip */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                              <span>2005</span>
                              <span>Tap year {inspectedYear} highlighted</span>
                              <span>2024</span>
                            </div>
                            <div className="grid grid-cols-20 gap-1">
                              {strat.years.map((yr) => {
                                const isPicked = yr.year === inspectedYear;
                                const bg =
                                  yr.status === 'GOOD'
                                    ? 'bg-emerald-500'
                                    : yr.status === 'MODERATE'
                                    ? 'bg-amber-400'
                                    : 'bg-rose-500';
                                return (
                                  <button
                                    key={yr.year}
                                    type="button"
                                    onClick={() => setInspectedYear(yr.year)}
                                    onMouseEnter={() => setInspectedYear(yr.year)}
                                    title={`${yr.year}: ${yr.status} · ${yr.rain_mm} mm · ${yr.water_satisfaction_pct}% water met`}
                                    className={`h-6 rounded-xs transition-all cursor-pointer ${bg} ${
                                      isPicked
                                        ? 'ring-2 ring-white scale-110 z-10'
                                        : 'opacity-85 hover:opacity-100'
                                    }`}
                                    aria-label={`${strat.name_en} ${yr.year} ${yr.status}`}
                                  />
                                );
                              })}
                            </div>
                          </div>

                          {/* 3-Metric Telemetry Row */}
                          <div className="grid grid-cols-3 gap-2 py-3 border-y border-white/10 text-xs">
                            <div>
                              <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                                <Droplets className="w-3 h-3 text-[#8AB4F8]" /> Water Use
                              </span>
                              <strong className="font-mono-tabular text-white text-sm mt-0.5 block">
                                {strat.water_use_mm}{' '}
                                <span className="text-[11px] font-normal text-slate-400">mm</span>
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                                <Sprout className="w-3 h-3 text-emerald-400" /> Soil Score
                              </span>
                              <strong className="font-mono-tabular text-white text-sm mt-0.5 block">
                                {strat.soil_score}
                                <span className="text-[11px] font-normal text-slate-400">/100</span>
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                                <Coins className="w-3 h-3 text-amber-400" /> Income Idx
                              </span>
                              <strong className="font-mono-tabular text-white text-sm mt-0.5 block">
                                {strat.income_index}
                                <span className="text-[11px] font-normal text-slate-400">/100</span>
                              </strong>
                            </div>
                          </div>

                          {/* Outcome Summary & Key Risk */}
                          <div className="space-y-1.5 text-xs leading-relaxed">
                            <p className="text-slate-200">{strat.summary_en}</p>
                            <p className="text-amber-300/95">
                              <strong className="font-semibold">Key Risk:</strong>{' '}
                              {cleanRiskText(strat.risks[0])}
                            </p>
                          </div>
                        </div>

                        {/* Bottom 2x2 Agronomic Breakdown */}
                        <div className="grid grid-cols-2 gap-x-3 gap-y-2 pt-3 border-t border-white/10 text-[11px]">
                          <div>
                            <span className="text-slate-400 block">Nitrogen Cycling</span>
                            <span className="text-slate-200 font-medium">
                              {strat.nutrient_cycling_label}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Erosion Cover</span>
                            <span className="text-slate-200 font-medium font-mono-tabular">
                              {strat.erosion_protection}%
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Pest Disruption</span>
                            <span className="text-slate-200 font-medium">
                              {strat.pest_disruption_label}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Irrigation Need</span>
                            <span className="text-slate-200 font-medium font-mono-tabular">
                              {strat.irrigation_need_mm} mm/yr
                            </span>
                          </div>
                        </div>
                      </motion.article>
                    );
                  })}
                </div>

                {/* Synced Single-Year Replay Across All 3 Strategies */}
                <section className="rounded-xl bg-[#0D131D] border border-white/10 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-white">
                      Year Replay ·{' '}
                      <span className="font-mono-tabular text-[#8AB4F8]">{inspectedYear}</span>
                    </h4>
                    <span className="text-xs text-slate-400">
                      Click any bar above (2005–2024) to inspect exact rainfall, moisture satisfaction, and temperature spikes side by side.
                    </span>
                  </div>

                  <div className="grid md:grid-cols-3 gap-3">
                    {sortedStrategies.map((strat) => {
                      const yr =
                        strat.years.find((y) => y.year === inspectedYear) ?? strat.years[0];
                      return (
                        <div
                          key={`replay-${strat.id}`}
                          className="p-3 rounded-lg bg-[#080C14] border border-white/10 space-y-1.5 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <strong className="text-white truncate">{strat.name_en}</strong>
                            <span
                              className={`font-semibold font-mono-tabular shrink-0 ${
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
                          <p className="text-slate-300 font-mono-tabular">
                            Rain <strong className="text-white">{yr.rain_mm} mm</strong> · Water met{' '}
                            <strong className="text-white">{yr.water_satisfaction_pct}%</strong> · Peak{' '}
                            <strong className="text-white">{yr.max_flowering_temp_c}°C</strong>
                          </p>
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
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
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

                  {(rainPct !== 0 || tempDelta !== 0) && (
                    <button
                      type="button"
                      onClick={() => onScenarioChange(0, 0)}
                      className="text-xs text-[#8AB4F8] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Reset Climate Scenario
                    </button>
                  )}
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

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 rounded-xl bg-[#0D131D] border border-white/10 p-4 text-xs">
                  <div>
                    <span className="text-slate-400 block">Actual ETa (Water Use)</span>
                    <strong className="font-mono-tabular text-white text-sm">
                      {chartStrategy.water_use_mm} mm/yr
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Irrigation Applied</span>
                    <strong className="font-mono-tabular text-white text-sm">
                      {chartStrategy.irrigation_need_mm} mm/yr
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Nitrogen Cycling</span>
                    <strong className="text-white text-sm">
                      {chartStrategy.nutrient_cycling_label}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Erosion Cover</span>
                    <strong className="font-mono-tabular text-white text-sm">
                      {chartStrategy.erosion_protection}%
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Pest Disruption</span>
                    <strong className="text-white text-sm">
                      {chartStrategy.pest_disruption_label}
                    </strong>
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
                        Available Water Capacity (
                        <span className="font-mono-tabular">{data.soil.awc_mm_per_m} mm/m</span>{' '}
                        from {data.soil.source}), including{' '}
                        <span className="font-mono-tabular">3.2 mm/day</span> paddy percolation where
                        rice is grown.
                      </li>
                      <li>
                        <strong className="text-white">Annual Pass/Fail Rules:</strong> A year fails
                        if seasonal water satisfaction drops below crop drought tolerance,
                        flowering-window <span className="font-mono-tabular">Tmax</span> exceeds heat
                        limits, <span className="font-mono-tabular">Tmin</span> hits frost, or
                        extraction triggers groundwater overdraft.
                      </li>
                    </ul>
                  </div>

                  <div className="p-5 rounded-xl bg-[#0D131D] border border-white/10 space-y-2.5 text-xs">
                    <h3 className="text-sm font-bold text-amber-300">
                      Resolution Limits &amp; Known Data Gaps
                    </h3>
                    <ul className="space-y-1.5 text-slate-300 leading-relaxed list-disc pl-4">
                      <li>
                        Climate source:{' '}
                        <strong className="text-white">{data.climate_baseline.source}</strong> at{' '}
                        <span className="font-mono-tabular">
                          {data.climate_baseline.grid_resolution}
                        </span>
                        . Localized hailstorms, micro-topography, and canal turns are not resolved.
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

      {/* Interactive Large Crop Rotation Photo Modal */}
      <AnimatePresence>
        {galleryState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setGalleryState(null)}
            className="fixed inset-0 z-[950] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl bg-[#0D131D] border border-white/15 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8AB4F8]">
                    Interactive Crop Sequence Visual
                  </span>
                  <h3 className="font-display text-lg font-bold text-white">
                    {galleryState.strategy.name_en}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setGalleryState(null)}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  aria-label="Close crop gallery"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 grid sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-[75vh] overflow-y-auto">
                {galleryState.strategy.crops.map((cropId, idx) => {
                  const item = CROP_MEDIA[cropId];
                  const highlighted = idx === galleryState.focusedIdx;
                  return (
                    <div
                      key={`${cropId}-${idx}`}
                      onClick={() => setGalleryState({ ...galleryState, focusedIdx: idx })}
                      className={`rounded-xl overflow-hidden border transition-all cursor-pointer bg-[#080C14] ${
                        highlighted
                          ? 'border-[#8AB4F8] ring-2 ring-[#8AB4F8]/35'
                          : 'border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div className="h-44 w-full overflow-hidden">
                        <img
                          src={item.image}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-3.5 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-[#8AB4F8]">
                            Step {idx + 1} · {item.season}
                          </span>
                        </div>
                        <h4 className="font-display text-base font-bold text-white">{item.name}</h4>
                        <div className="space-y-1 text-[11px] text-slate-300 pt-1 border-t border-white/10">
                          <div className="flex items-center gap-1.5">
                            <Droplets className="w-3.5 h-3.5 text-[#8AB4F8] shrink-0" />
                            <span>{item.waterProfile}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>{item.rootNote}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Thermometer className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>{item.heatLimit}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Provenance & KVK Footer */}
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
