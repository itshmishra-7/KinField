import { useState } from 'react';
import { X, Database, CheckCircle2, Info, AlertTriangle, BookOpen, Layers } from 'lucide-react';
import type { ProvenanceResponse } from '../types';

interface ProvenanceModalProps {
  open: boolean;
  onClose: () => void;
  provenance: ProvenanceResponse | null;
}

export function ProvenanceModal({ open, onClose, provenance }: ProvenanceModalProps) {
  const [tab, setTab] = useState<'provenance' | 'conditions' | 'rotations'>('provenance');

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Science, Data Provenance and Model Transparency"
    >
      <div className="w-full max-w-4xl max-h-[88vh] overflow-y-auto bg-[#0C1018] border border-white/15 rounded-xl shadow-2xl">
        <div className="sticky top-0 z-10 px-6 py-4 bg-[#0C1018]/95 backdrop-blur border-b border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-[#8AB4F8]" />
              <div>
                <h2 className="text-lg font-semibold text-white">
                  NASA Data, Science &amp; Model Transparency
                </h2>
                <p className="text-xs text-slate-400">
                  Deterministic physics, live datasets vs. map layers, and agronomic concepts
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#07090E] rounded-lg w-fit border border-white/10 text-xs">
            <button
              onClick={() => setTab('provenance')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                tab === 'provenance' ? 'bg-[#8AB4F8] text-[#07090E]' : 'text-slate-300 hover:text-white'
              }`}
            >
              Live Datasets &amp; Resolution
            </button>
            <button
              onClick={() => setTab('conditions')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                tab === 'conditions' ? 'bg-[#8AB4F8] text-[#07090E]' : 'text-slate-300 hover:text-white'
              }`}
            >
              Conditions &amp; Terms
            </button>
            <button
              onClick={() => setTab('rotations')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                tab === 'rotations' ? 'bg-[#8AB4F8] text-[#07090E]' : 'text-slate-300 hover:text-white'
              }`}
            >
              Rotation Science
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {tab === 'provenance' && (
            <>
              <div className="p-4 rounded-lg bg-[#111724] border border-[#8AB4F8]/25 flex items-start gap-3">
                <Info className="w-5 h-5 text-[#8AB4F8] shrink-0 mt-0.5" />
                <div className="text-sm text-slate-200 leading-relaxed">
                  <strong className="text-white">Zero Black-Box AI:</strong> KinField computes daily
                  Hargreaves–Samani evapotranspiration, FAO-56 crop coefficients, and soil-water
                  balance directly from NASA POWER daily variables. Same inputs always produce
                  identical outputs.
                </div>
              </div>

              <div className="divide-y divide-white/10 border border-white/10 rounded-lg overflow-hidden">
                {(provenance?.datasets ?? []).map((ds) => (
                  <div key={ds.id} className="p-4 bg-[#090D14]">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-semibold text-white">{ds.name}</span>
                      <span className="text-xs font-mono-tabular">
                        {ds.in_product ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Live in Product
                          </span>
                        ) : (
                          <span className="text-slate-400">Roadmap / Context Only</span>
                        )}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 flex flex-wrap gap-x-3 gap-y-1 mb-1.5 font-mono-tabular">
                      <span>Resolution: {ds.spatial_resolution}</span>
                      <span>·</span>
                      <span>Coverage: {ds.temporal_coverage}</span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed mb-1">{ds.role_in_app}</p>
                    <p className="text-xs text-amber-300/90 leading-relaxed">
                      Gap: {ds.limitations}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'conditions' && (
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="p-4 rounded-lg bg-[#090D14] border border-white/10 space-y-1.5">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#8AB4F8]" /> Evapotranspiration (ET0 &amp; ETc)
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Combined evaporation from soil and transpiration from leaves. Daily reference ET0
                  comes from temperature range and solar radiation; multiplying by crop stage Kc
                  estimates true daily water demand.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-[#090D14] border border-white/10 space-y-1.5">
                <h3 className="font-semibold text-white">Soil Moisture Anomalies</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Measures how much wetter or drier the root zone (GWETROOT / SMAP) is compared to
                  its 20-year historical average for that exact week.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-[#090D14] border border-white/10 space-y-1.5">
                <h3 className="font-semibold text-white">NDVI &amp; Bare-Field Exposure</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Vegetation indices track canopy greenness. Post-harvest gaps with low cover expose
                  topsoil to heat and wind erosion—highlighted visually via MODIS True Color.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-[#090D14] border border-white/10 space-y-1.5">
                <h3 className="font-semibold text-white">Satellite vs. Ground Checks</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  NASA grids (~10–50 km) capture multi-decade climate trends reliably, but cannot see
                  subsoil hardpan, bund height, salinity patches, or canal scheduling. Combine with
                  local KVK soil testing.
                </p>
              </div>
            </div>
          )}

          {tab === 'rotations' && (
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="p-4 rounded-lg bg-[#090D14] border border-white/10 space-y-1.5">
                <h3 className="font-semibold text-emerald-400 flex items-center gap-2">
                  <Layers className="w-4 h-4" /> Nitrogen-Fixing Legumes
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Chickpea, Moong, Soybean, and Groundnut fix 40–65 kg N/ha biologically, reducing
                  urea cost for the following cereal crop and improving soil structure.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-[#090D14] border border-white/10 space-y-1.5">
                <h3 className="font-semibold text-emerald-400">Cover &amp; Green Manure Crops</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Sesbania (Dhaincha) and summer Moong cover bare summer fields, lowering topsoil
                  temperature, curbing dust erosion, and adding organic carbon.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-[#090D14] border border-white/10 space-y-1.5">
                <h3 className="font-semibold text-[#8AB4F8]">Deep-Rooting Crops</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Sorghum, Mustard, Cotton, and Chickpea reach 1.3–1.5 m depth to recover subsoil
                  moisture missed by shallow-rooted paddy.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-[#090D14] border border-white/10 space-y-1.5">
                <h3 className="font-semibold text-amber-400">Pest Breaks &amp; Forage</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Alternating cereals, legumes, and oilseeds breaks host-specific pest/weed cycles
                  while providing dual-purpose fodder security.
                </p>
              </div>
            </div>
          )}

          <div className="p-4 rounded-lg bg-amber-950/25 border border-amber-500/30 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-100/90 leading-relaxed">
              {provenance?.disclaimer ||
                'KinField supports farmer and Krishi Vigyan Kendra (KVK) decision-making and does not replace local soil testing, borewell checks, or extension agronomist advice.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
