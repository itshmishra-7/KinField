import { useState } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
  Edit3,
  Droplets,
  Sprout,
  TrendingUp,
  ShieldCheck,
  Info,
} from 'lucide-react';
import type { AnalyzeResponse, RotationStrategyResult, YearBacktest } from '../types';

interface ResultsSheetProps {
  data: AnalyzeResponse;
  rainPct: number;
  tempDelta: number;
  onScenarioChange: (rainPct: number, tempDelta: number) => void;
  scenarioLoading: boolean;
  onEditInputs: () => void;
}

function StatusIndicator({
  status,
  label,
}: {
  status: RotationStrategyResult['status'];
  label: string;
}) {
  if (status === 'green') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
        <CheckCircle2 className="w-4 h-4" />
        {label}
      </span>
    );
  }
  if (status === 'yellow') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400">
        <AlertTriangle className="w-4 h-4" />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400">
      <XCircle className="w-4 h-4" />
      {label}
    </span>
  );
}

export function ResultsSheet({
  data,
  rainPct,
  tempDelta,
  onScenarioChange,
  scenarioLoading,
  onEditInputs,
}: ResultsSheetProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedYear, setSelectedYear] = useState<{
    strategyName: string;
    year: YearBacktest;
  } | null>(null);
  const [openDetailsId, setOpenDetailsId] = useState<string | null>(null);

  const sortedStrategies = [...data.strategies].sort((a, b) => a.rank - b.rank);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={`pointer-events-auto w-full max-w-6xl mx-auto bg-[#0B0F18]/94 backdrop-blur-xl border border-white/15 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col transition-all duration-200 ${
        expanded ? 'max-h-[84vh]' : 'max-h-[54vh] sm:max-h-[50vh]'
      }`}
    >
      {/* Top Result Header Bar */}
      <div className="px-5 py-3.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h2 className="text-base font-bold text-white truncate">{data.location.label}</h2>
            <span className="text-xs font-mono-tabular text-slate-400">
              {data.location.lat.toFixed(3)}°N, {data.location.lon.toFixed(3)}°E
              {data.location.field_area_ha
                ? ` · ${data.location.field_area_ha.toFixed(2)} ha (${(
                    data.location.field_area_ha * 2.471
                  ).toFixed(2)} ac)`
                : ''}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-2">
            <span>
              Soil: <strong className="text-slate-200">{data.soil.texture}</strong> (
              {data.soil.awc_mm_per_m} mm/m AWC)
            </span>
            <span>·</span>
            <span>
              Avg Rain:{' '}
              <strong className="text-slate-200 font-mono-tabular">
                {data.climate_baseline.mean_annual_rain_mm} mm/yr
              </strong>
            </span>
            <span>·</span>
            <span>
              Confidence:{' '}
              <strong
                className={
                  data.overall_confidence === 'HIGH'
                    ? 'text-emerald-400'
                    : data.overall_confidence === 'MED'
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }
              >
                {data.overall_confidence}
              </strong>
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onEditInputs}
            className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-white/5 hover:bg-white/10 border border-white/12 rounded-lg inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit Inputs
          </button>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="px-3 py-1.5 text-xs font-medium text-[#8AB4F8] bg-[#8AB4F8]/10 hover:bg-[#8AB4F8]/20 border border-[#8AB4F8]/30 rounded-lg inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            {expanded ? (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                Show Map
              </>
            ) : (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                Full Report
              </>
            )}
          </button>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="overflow-y-auto px-5 py-4 space-y-4">
        {/* What-If Climate Scenario Sliders */}
        <div className="p-3.5 rounded-xl bg-[#0F1522] border border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200 shrink-0">
            <SlidersHorizontal className="w-4 h-4 text-[#8AB4F8]" />
            <span>Climate Stress Test (What-If)</span>
            {scenarioLoading && <span className="text-[#8AB4F8] font-normal">Recalculating…</span>}
          </div>

          <div className="grid sm:grid-cols-2 gap-4 flex-1 max-w-2xl">
            <label className="flex items-center gap-3 text-xs">
              <span className="text-slate-300 whitespace-nowrap w-24">
                Rainfall:{' '}
                <strong className="font-mono-tabular text-white">
                  {rainPct > 0 ? `+${rainPct}%` : `${rainPct}%`}
                </strong>
              </span>
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

            <label className="flex items-center gap-3 text-xs">
              <span className="text-slate-300 whitespace-nowrap w-28">
                Warming:{' '}
                <strong className="font-mono-tabular text-white">+{tempDelta.toFixed(1)}°C</strong>
              </span>
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

          {(rainPct !== 0 || tempDelta !== 0) && (
            <button
              onClick={() => onScenarioChange(0, 0)}
              className="text-xs text-[#8AB4F8] hover:underline shrink-0 cursor-pointer"
            >
              Reset baseline
            </button>
          )}
        </div>

        {/* Selected Year Inspector */}
        {selectedYear && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3.5 rounded-xl bg-[#11192B] border border-[#8AB4F8]/40 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs">
                <span className="font-semibold text-[#8AB4F8]">
                  Year {selectedYear.year.year} Replay
                </span>
                <span className="text-slate-400"> · {selectedYear.strategyName}</span>
              </div>
              <button
                onClick={() => setSelectedYear(null)}
                className="text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block">Status</span>
                <strong
                  className={
                    selectedYear.year.status === 'GOOD'
                      ? 'text-emerald-400'
                      : selectedYear.year.status === 'MODERATE'
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }
                >
                  {selectedYear.year.status}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block">Rainfall</span>
                <strong className="font-mono-tabular text-white">
                  {selectedYear.year.rain_mm} mm
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block">Water Met</span>
                <strong className="font-mono-tabular text-white">
                  {selectedYear.year.water_satisfaction_pct}%
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block">Peak Flowering</span>
                <strong className="font-mono-tabular text-white">
                  {selectedYear.year.max_flowering_temp_c}°C
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block">GWETROOT Anom</span>
                <strong className="font-mono-tabular text-white">
                  {selectedYear.year.soil_moisture_anomaly !== null
                    ? `${selectedYear.year.soil_moisture_anomaly >= 0 ? '+' : ''}${
                        selectedYear.year.soil_moisture_anomaly
                      }`
                    : 'N/A'}
                </strong>
              </div>
            </div>
            <p className="text-xs text-slate-200">{selectedYear.year.summary_note}</p>
          </motion.div>
        )}

        {/* 3 Rotation Strategy Comparison Cards */}
        <div className="grid lg:grid-cols-3 gap-4">
          {sortedStrategies.map((strat, idx) => {
            const isOpen = openDetailsId === strat.id;
            const scoreColor =
              strat.status === 'green'
                ? 'text-emerald-400'
                : strat.status === 'yellow'
                ? 'text-amber-400'
                : 'text-rose-400';

            return (
              <motion.div
                key={strat.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.05, ease: [0.16, 1, 0.3, 1] }}
                className={`p-4 rounded-xl border transition-colors flex flex-col justify-between gap-3.5 ${
                  strat.is_best_match
                    ? 'bg-[#101827] border-[#8AB4F8]/55'
                    : 'bg-[#0D121C] border-white/10'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-slate-300">
                      {strat.is_best_match
                        ? '★ Best Match'
                        : strat.is_current
                        ? 'Current Practice'
                        : `Alternative #${strat.rank}`}
                    </span>
                    <StatusIndicator status={strat.status} label={strat.status_label_en} />
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-white leading-snug">
                        {strat.name_en}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {strat.crop_labels_en.join(' · ')}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-3xl font-bold font-mono-tabular leading-none ${scoreColor}`}>
                        {strat.safe_years}
                        <span className="text-sm font-normal text-slate-400">
                          /{strat.total_years}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">safe yrs</span>
                    </div>
                  </div>

                  {/* Interactive 20-Year Strip (2005-2024) */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span>2005</span>
                      <span>Click any year to inspect</span>
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
                        const isPicked =
                          selectedYear?.year.year === yr.year &&
                          selectedYear?.strategyName === strat.name_en;
                        return (
                          <button
                            key={yr.year}
                            type="button"
                            onClick={() =>
                              setSelectedYear({ strategyName: strat.name_en, year: yr })
                            }
                            title={`${yr.year}: ${yr.status} (${yr.water_satisfaction_pct}% water met, peak ${yr.max_flowering_temp_c}°C)`}
                            className={`h-6 rounded-sm transition-transform cursor-pointer ${barCls} ${
                              isPicked ? 'ring-2 ring-white scale-110' : ''
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 text-xs">
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

                  <p className="text-xs text-slate-200 leading-relaxed">{strat.summary_en}</p>
                  <p className="text-xs text-amber-300/90 leading-relaxed">
                    Risk: {strat.risks[0]}
                  </p>
                </div>

                <div className="pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setOpenDetailsId(isOpen ? null : strat.id)}
                    className="text-xs font-medium text-[#8AB4F8] hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Info className="w-3.5 h-3.5" />
                    {isOpen
                      ? 'Hide agronomic tradeoffs & data gaps'
                      : 'View nutrient, erosion, forage & data gaps'}
                  </button>

                  {isOpen && (
                    <div className="mt-3 space-y-2.5 text-xs text-slate-300">
                      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-[#080B12] border border-white/10">
                        <div>
                          <span className="text-slate-400 block">Irrigation Need</span>
                          <strong className="font-mono-tabular text-white">
                            {strat.irrigation_need_mm} mm/yr
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Erosion Cover</span>
                          <strong className="font-mono-tabular text-white">
                            {strat.erosion_protection}%
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Nitrogen Cycling</span>
                          <strong className="text-white">{strat.nutrient_cycling_label}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Pest Disruption</span>
                          <strong className="text-white">{strat.pest_disruption_label}</strong>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-400 block">Forage Potential</span>
                          <strong className="text-white">{strat.forage_potential}</strong>
                        </div>
                      </div>

                      <div>
                        <p className="font-semibold text-white mb-1">Why it fits:</p>
                        <p className="text-slate-300 leading-relaxed">{strat.why_it_fits}</p>
                      </div>

                      <div>
                        <p className="font-semibold text-amber-300 mb-1">Known Data Gaps:</p>
                        <ul className="list-disc pl-4 space-y-0.5 text-slate-400">
                          {strat.gaps.map((g, i) => (
                            <li key={i}>{g}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Persistent Provenance & KVK Advisory Footer */}
      <div className="px-5 py-2.5 border-t border-white/10 bg-[#080B12]/90 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 shrink-0">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#8AB4F8]" />
          NASA POWER real daily 2005–2024 · Confidence: {data.overall_confidence} · Map: NASA GIBS
        </span>
        <span className="text-slate-300">{data.kvk_disclaimer_en}</span>
      </div>
    </motion.div>
  );
}
