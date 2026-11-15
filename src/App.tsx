import { useEffect, useState } from 'react';
import { HomeScreen } from './components/HomeScreen';
import { MapWorkspace } from './components/MapWorkspace';
import { ProvenanceModal } from './components/ProvenanceModal';
import type { DemoPreset, ProvenanceResponse } from './types';

const FALLBACK_PRESETS: DemoPreset[] = [
  {
    slug: 'hisar',
    name: 'Hisar, Haryana',
    subtitle: 'Semi-Arid Indo-Gangetic Plains · Sandy Loam',
    lat: 29.15,
    lon: 75.72,
    default_crop: 'wheat',
    default_irrigation: 'some',
    highlight: 'March heatwave & groundwater stress zone',
  },
  {
    slug: 'ludhiana',
    name: 'Ludhiana, Punjab',
    subtitle: 'Central Punjab Alluvial · Loam',
    lat: 30.9,
    lon: 75.85,
    default_crop: 'rice',
    default_irrigation: 'full',
    highlight: 'Intensive rice–wheat aquifer depletion belt',
  },
  {
    slug: 'aurangabad',
    name: 'Aurangabad, Maharashtra',
    subtitle: 'Marathwada Deccan Basalt · Vertisol Clay Loam',
    lat: 19.88,
    lon: 75.34,
    default_crop: 'cotton',
    default_irrigation: 'none',
    highlight: 'Rainfed dry-spell & mid-monsoon break hotspot',
  },
];

export default function App() {
  const [view, setView] = useState<'home' | 'map'>('home');
  const [selectedPreset, setSelectedPreset] = useState<DemoPreset | null>(null);
  const [presets, setPresets] = useState<DemoPreset[]>(FALLBACK_PRESETS);
  const [provenance, setProvenance] = useState<ProvenanceResponse | null>(null);
  const [provenanceOpen, setProvenanceOpen] = useState(false);

  useEffect(() => {
    fetch('/api/presets')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.presets?.length) setPresets(d.presets);
      })
      .catch(() => {});

    fetch('/api/provenance')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.datasets) setProvenance(d);
      })
      .catch(() => {});
  }, []);

  const handleLaunchMap = (preset?: DemoPreset) => {
    setSelectedPreset(preset ?? null);
    setView('map');
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      {view === 'home' ? (
        <HomeScreen
          presets={presets}
          onLaunchMap={handleLaunchMap}
          onOpenProvenance={() => setProvenanceOpen(true)}
        />
      ) : (
        <MapWorkspace
          presets={presets}
          initialPreset={selectedPreset}
          onBackHome={() => setView('home')}
          onOpenProvenance={() => setProvenanceOpen(true)}
        />
      )}

      <ProvenanceModal
        open={provenanceOpen}
        onClose={() => setProvenanceOpen(false)}
        provenance={provenance}
      />
    </>
  );
}
