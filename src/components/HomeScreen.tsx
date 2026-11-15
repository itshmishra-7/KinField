import { ArrowRight, Compass, Database } from 'lucide-react';
import { motion } from 'motion/react';
import heroEarthImg from '../assets/images/hero_farmland_earth_1794725986108.jpg';
import type { DemoPreset } from '../types';

interface HomeScreenProps {
  presets: DemoPreset[];
  onLaunchMap: (preset?: DemoPreset) => void;
  onOpenProvenance: () => void;
}

export function HomeScreen({ onLaunchMap, onOpenProvenance }: HomeScreenProps) {
  return (
    <div className="relative h-screen min-h-[600px] w-full overflow-hidden bg-[#07090E] text-slate-100 flex flex-col justify-between">
      {/* Background Satellite Earth & Farmland Photography with Scrim */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[#07090E]">
        <img
          src={heroEarthImg}
          alt="Orbital satellite view of irrigated agricultural fields at twilight"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover object-center opacity-75 scale-[1.02]"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 48%, rgba(7, 9, 14, 0.26) 0%, rgba(7, 9, 14, 0.65) 70%, rgba(7, 9, 14, 0.90) 100%)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#07090E]/55 via-transparent to-[#07090E]/82" />
      </div>

      {/* Clean 3-Zone Top Bar */}
      <header className="relative z-10 px-6 sm:px-10 py-4 border-b border-white/10 bg-[#07090E]/45 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
          <span className="font-display text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0">
            KinField
          </span>

          <nav className="hidden sm:flex items-center gap-7 text-sm font-medium text-slate-300">
            <button
              onClick={onOpenProvenance}
              className="hover:text-[#8AB4F8] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              NASA Telemetry
            </button>
            <button
              onClick={onOpenProvenance}
              className="hover:text-[#8AB4F8] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Data Provenance
            </button>
          </nav>

          <button
            onClick={() => onLaunchMap()}
            className="px-4 py-2 text-sm font-semibold text-[#07090E] bg-[#8AB4F8] hover:bg-[#A6C8FF] rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-2 cursor-pointer"
          >
            Open Map
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Centered Clean Hero: Title + 2 Smooth Buttons */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-4xl mx-auto text-center space-y-6"
        >
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="font-display font-bold tracking-tight text-white leading-[1.04]"
            style={{
              fontSize: 'clamp(2.75rem, 6.4vw, 5.25rem)',
              textWrap: 'balance',
            }}
          >
            Adapting Farms with NASA Data
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="text-base sm:text-lg text-slate-200/90 max-w-2xl mx-auto leading-relaxed"
          >
            20-year daily climate backtesting and satellite field intelligence for resilient crop
            rotations.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-wrap items-center justify-center gap-4 pt-3"
          >
            <button
              onClick={() => onLaunchMap()}
              className="px-7 py-3.5 text-sm sm:text-base font-semibold text-[#07090E] bg-[#8AB4F8] hover:bg-[#A6C8FF] hover:-translate-y-0.5 active:translate-y-0 rounded-xl transition-all duration-200 inline-flex items-center gap-2.5 shadow-lg shadow-[#8AB4F8]/20 cursor-pointer"
            >
              <Compass className="w-4 h-4 sm:w-5 sm:h-5" />
              Launch Field Workspace
            </button>

            <button
              onClick={onOpenProvenance}
              className="px-6 py-3.5 text-sm sm:text-base font-medium text-white bg-white/[0.06] hover:bg-white/[0.12] hover:-translate-y-0.5 active:translate-y-0 backdrop-blur-md border border-white/20 hover:border-white/35 rounded-xl transition-all duration-200 inline-flex items-center gap-2.5 cursor-pointer"
            >
              <Database className="w-4 h-4 text-[#8AB4F8]" />
              Data &amp; Methodology
            </button>
          </motion.div>
        </motion.div>
      </main>

      {/* Minimal Footer */}
      <footer className="relative z-10 px-6 sm:px-10 py-3.5 border-t border-white/10 bg-[#07090E]/55 backdrop-blur-sm text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>NASA POWER (2005–2024) · NASA GIBS (MODIS, SMAP, GPM) · ISRIC SoilGrids</span>
          <span>Deterministic FAO-56 Model · Supports KVK &amp; local agronomy</span>
        </div>
      </footer>
    </div>
  );
}
