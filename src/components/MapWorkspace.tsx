import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { AnimatePresence, motion } from 'motion/react';
import {
  MapPin,
  Pentagon,
  Trash2,
  Database,
  ArrowLeft,
  Loader2,
  Calendar,
  Layers,
  AlertCircle,
  Check,
  Navigation,
  Satellite,
  Search,
  LocateFixed,
  Undo2,
} from 'lucide-react';
import type {
  AnalyzeResponse,
  CropId,
  DemoPreset,
  EquipmentConstraint,
  IrrigationLevel,
  MapLayerId,
  PriorityId,
} from '../types';
import { ResultsSheet } from './ResultsSheet';

interface MapWorkspaceProps {
  presets: DemoPreset[];
  initialPreset: DemoPreset | null;
  onBackHome: () => void;
  onOpenProvenance: () => void;
}

const CROP_OPTIONS: Array<{ id: CropId; en: string; season: string }> = [
  { id: 'wheat', en: 'Wheat', season: 'Rabi' },
  { id: 'rice', en: 'Rice (Paddy)', season: 'Kharif' },
  { id: 'maize', en: 'Maize', season: 'Kharif' },
  { id: 'chickpea', en: 'Chickpea', season: 'Rabi' },
  { id: 'mustard', en: 'Mustard', season: 'Rabi' },
  { id: 'moong', en: 'Green Gram (Moong)', season: 'Zaid' },
  { id: 'sorghum', en: 'Sorghum', season: 'Kharif' },
  { id: 'cotton', en: 'Cotton', season: 'Kharif' },
  { id: 'soybean', en: 'Soybean', season: 'Kharif' },
  { id: 'groundnut', en: 'Groundnut', season: 'Kharif' },
  { id: 'cover_crop', en: 'Sesbania / Cover Crop', season: 'Zaid' },
  { id: 'fallow', en: 'Rest / Fallow', season: 'Zaid' },
];

const PRIORITY_OPTIONS: Array<{ id: PriorityId; en: string; hint: string }> = [
  { id: 'water', en: 'Save Water', hint: 'Lower pumping & drought risk' },
  { id: 'income', en: 'Income', hint: 'Stronger MSP / market return' },
  { id: 'soil', en: 'Soil Health', hint: 'Nitrogen & organic carbon' },
  { id: 'reliability', en: 'Stability', hint: 'Safe years out of 20' },
];

const SEASONAL_DATES = [
  { date: '2024-08-15', label: 'Aug · Monsoon Peak' },
  { date: '2024-10-15', label: 'Oct · Post-Monsoon' },
  { date: '2024-03-15', label: 'Mar · Rabi Grain-Fill' },
  { date: '2024-05-15', label: 'May · Bare Soil' },
];

const VULNERABILITY_ZONES = [
  {
    name: 'NW Plains Terminal Heat & Aquifer Stress Zone',
    lat: 29.8,
    lon: 75.6,
    radiusKm: 130,
    color: '#F59E0B',
    note: 'Frequent March heatwaves (>35°C) + declining shallow water tables under rice–wheat.',
  },
  {
    name: 'Marathwada Rainfed Dry-Spell Corridor',
    lat: 19.6,
    lon: 75.8,
    radiusKm: 140,
    color: '#F43F5E',
    note: 'High mid-monsoon break frequency; deep-rooting pulses & Vertisol moisture capture critical.',
  },
];

function computePolygonAreaHa(coords: Array<[number, number]>): number {
  if (coords.length < 3) return 0;
  const R = 6378137;
  let area = 0;
  for (let i = 0; i < coords.length; i++) {
    const [lat1, lon1] = coords[i];
    const [lat2, lon2] = coords[(i + 1) % coords.length];
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    area += dLon * (2 + Math.sin(phi1) + Math.sin(phi2));
  }
  const sqMeters = Math.abs((area * R * R) / 2);
  return Number((sqMeters / 10000).toFixed(2));
}

export function MapWorkspace({
  presets,
  initialPreset,
  onBackHome,
  onOpenProvenance,
}: MapWorkspaceProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseLayerRef = useRef<L.LayerGroup | null>(null);
  const gibsLayerRef = useRef<L.TileLayer | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const polygonRef = useRef<L.Polygon | null>(null);
  const polyVerticesRef = useRef<L.CircleMarker[]>([]);
  const vulnGroupRef = useRef<L.LayerGroup | null>(null);

  const [baseStyle, setBaseStyle] = useState<'dark-sat' | 'imagery' | 'dark'>('dark-sat');
  const [activeLayer, setActiveLayer] = useState<MapLayerId>('base');
  const [gibsDate, setGibsDate] = useState<string>('2024-10-15');
  const [gibsLoading, setGibsLoading] = useState<boolean>(false);
  const [showVulnOverlay, setShowVulnOverlay] = useState<boolean>(false);

  // Location search & GPS state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{ name: string; display_name: string; lat: number; lon: number }>
  >([]);
  const [searching, setSearching] = useState(false);
  const [locatingGps, setLocatingGps] = useState(false);
  const [gpsToast, setGpsToast] = useState<string | null>(null);
  const searchTimerRef = useRef<number | null>(null);

  // Field placement state
  const [toolMode, setToolMode] = useState<'pin' | 'polygon'>('pin');
  const [pinnedLocation, setPinnedLocation] = useState<{
    lat: number;
    lon: number;
    label?: string;
    areaHa?: number | null;
  } | null>(
    initialPreset
      ? { lat: initialPreset.lat, lon: initialPreset.lon, label: initialPreset.name, areaHa: null }
      : null
  );
  const [polygonPoints, setPolygonPoints] = useState<Array<[number, number]>>([]);

  // Farmer inputs
  const [currentCrop, setCurrentCrop] = useState<CropId>(initialPreset?.default_crop ?? 'wheat');
  const [priorities, setPriorities] = useState<PriorityId[]>(['water', 'reliability']);
  const [irrigation, setIrrigation] = useState<IrrigationLevel>(
    initialPreset?.default_irrigation ?? 'some'
  );
  const [equipment, setEquipment] = useState<EquipmentConstraint>('standard');

  // Analysis & scenario state
  const [loading, setLoading] = useState(false);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [results, setResults] = useState<AnalyzeResponse | null>(null);
  const [rainPct, setRainPct] = useState(0);
  const [tempDelta, setTempDelta] = useState(0);
  const scenarioTimerRef = useRef<number | null>(null);

  // Initialize Leaflet map once with topright zoom control (never blocked by bottom sheet)
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const startLat = initialPreset?.lat ?? 24.5;
    const startLon = initialPreset?.lon ?? 77.5;
    const startZoom = initialPreset ? 12 : 5;

    const map = L.map(mapContainerRef.current, {
      center: [startLat, startLon],
      zoom: startZoom,
      zoomControl: false,
      attributionControl: true,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    const baseGrp = L.layerGroup().addTo(map);
    baseLayerRef.current = baseGrp;

    const vulnGroup = L.layerGroup();
    VULNERABILITY_ZONES.forEach((z) => {
      L.circle([z.lat, z.lon], {
        radius: z.radiusKm * 1000,
        color: z.color,
        weight: 1.5,
        dashArray: '5 5',
        fillColor: z.color,
        fillOpacity: 0.08,
      })
        .bindPopup(
          `<div style="font-size:12px;color:#0f172a;"><strong>${z.name}</strong><br/>${z.note}</div>`
        )
        .addTo(vulnGroup);
    });
    vulnGroupRef.current = vulnGroup;
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Switch basemap between Dark Satellite (default), True Color Satellite, and Dark Vector
  useEffect(() => {
    const grp = baseLayerRef.current;
    if (!grp) return;
    grp.clearLayers();

    if (baseStyle === 'dark-sat') {
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 18,
          zIndex: 100,
          className: 'kinfield-dark-sat-tiles',
          attribution: 'Esri World Imagery | NASA POWER &amp; GIBS',
        }
      ).addTo(grp);
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 18,
          zIndex: 310,
          opacity: 0.45,
        }
      ).addTo(grp);
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 18,
          zIndex: 330,
          opacity: 0.96,
        }
      ).addTo(grp);
    } else if (baseStyle === 'imagery') {
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 18,
          zIndex: 100,
          attribution: 'Esri World Imagery | NASA POWER &amp; GIBS',
        }
      ).addTo(grp);
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 18,
          zIndex: 330,
          opacity: 0.9,
        }
      ).addTo(grp);
    } else {
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 16,
          zIndex: 100,
          attribution: 'Esri Dark Gray Canvas | NASA POWER &amp; GIBS',
        }
      ).addTo(grp);
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 16,
          zIndex: 330,
          opacity: 0.9,
        }
      ).addTo(grp);
    }
  }, [baseStyle]);

  // Update NASA GIBS WMTS tile layer cleanly with dark-theme CSS filters
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (gibsLayerRef.current) {
      map.removeLayer(gibsLayerRef.current);
      gibsLayerRef.current = null;
    }

    if (activeLayer === 'base') {
      setGibsLoading(false);
      return;
    }

    let url = '';
    let maxNativeZoom = 9;
    let opacity = 0.86;
    let className = 'kinfield-gibs-modis';

    if (activeLayer === 'modis') {
      url = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${gibsDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
      maxNativeZoom = 9;
      opacity = 0.88;
      className = 'kinfield-gibs-modis';
    } else if (activeLayer === 'smap') {
      url = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/SMAP_L4_Analyzed_Root_Zone_Soil_Moisture/default/${gibsDate}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`;
      maxNativeZoom = 6;
      opacity = 0.74;
      className = 'kinfield-gibs-smap';
    } else if (activeLayer === 'gpm') {
      url = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate/default/${gibsDate}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`;
      maxNativeZoom = 6;
      opacity = 0.78;
      className = 'kinfield-gibs-gpm';
    }

    setGibsLoading(true);
    const layer = L.tileLayer(url, {
      maxNativeZoom,
      maxZoom: 18,
      zIndex: 250,
      opacity,
      className,
      crossOrigin: 'anonymous',
      attribution: 'NASA GIBS EOSDIS',
    });
    layer.on('loading', () => setGibsLoading(true));
    layer.on('load', () => setGibsLoading(false));
    layer.on('tileerror', () => setGibsLoading(false));
    layer.addTo(map);
    gibsLayerRef.current = layer;

    return () => {
      layer.off('loading');
      layer.off('load');
      layer.off('tileerror');
    };
  }, [activeLayer, gibsDate]);

  // Toggle Vulnerability overlay
  useEffect(() => {
    const map = mapRef.current;
    const grp = vulnGroupRef.current;
    if (!map || !grp) return;
    if (showVulnOverlay) grp.addTo(map);
    else map.removeLayer(grp);
  }, [showVulnOverlay]);

  // Render marker and polygon on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (markerRef.current) {
      map.removeLayer(markerRef.current);
      markerRef.current = null;
    }
    if (polygonRef.current) {
      map.removeLayer(polygonRef.current);
      polygonRef.current = null;
    }
    polyVerticesRef.current.forEach((m) => map.removeLayer(m));
    polyVerticesRef.current = [];

    if (polygonPoints.length > 0) {
      polygonPoints.forEach(([lat, lon]) => {
        const vm = L.circleMarker([lat, lon], {
          radius: 5,
          color: '#FFFFFF',
          weight: 2,
          fillColor: '#8AB4F8',
          fillOpacity: 1,
        }).addTo(map);
        polyVerticesRef.current.push(vm);
      });
      if (polygonPoints.length >= 2) {
        polygonRef.current = L.polygon(polygonPoints, {
          color: '#8AB4F8',
          weight: 2,
          fillColor: '#8AB4F8',
          fillOpacity: 0.22,
        }).addTo(map);
      }
    }

    if (pinnedLocation) {
      markerRef.current = L.circleMarker([pinnedLocation.lat, pinnedLocation.lon], {
        radius: 9,
        color: '#FFFFFF',
        weight: 2.5,
        fillColor: '#8AB4F8',
        fillOpacity: 0.95,
      }).addTo(map);
    }
  }, [pinnedLocation, polygonPoints]);

  const resolvePlaceLabel = useCallback(async (lat: number, lon: number) => {
    try {
      const resp = await fetch(
        `/api/reverse-geocode?lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}`
      );
      if (!resp.ok) return;
      const data = (await resp.json()) as { label?: string };
      if (data.label) {
        setPinnedLocation((prev) => {
          if (!prev) return prev;
          if (Math.abs(prev.lat - lat) > 0.01 || Math.abs(prev.lon - lon) > 0.01) return prev;
          return { ...prev, label: data.label };
        });
      }
    } catch {
      // Keep coordinate label on timeout
    }
  }, []);

  // Handle map clicks for Pin or Polygon vertex
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      const latR = Number(lat.toFixed(5));
      const lonR = Number(lng.toFixed(5));
      setErrorMsg(null);
      setGpsToast(null);
      setSearchResults([]);
      if (toolMode === 'pin') {
        setPolygonPoints([]);
        setPinnedLocation({
          lat: latR,
          lon: lonR,
          areaHa: null,
        });
        setResults(null);
        resolvePlaceLabel(latR, lonR);
      } else {
        setPolygonPoints((prev) => {
          const next: Array<[number, number]> = [...prev, [lat, lng]];
          if (next.length >= 3) {
            const cLat = Number((next.reduce((s, p) => s + p[0], 0) / next.length).toFixed(5));
            const cLon = Number((next.reduce((s, p) => s + p[1], 0) / next.length).toFixed(5));
            setPinnedLocation({
              lat: cLat,
              lon: cLon,
              label: 'Custom Field Boundary',
              areaHa: computePolygonAreaHa(next),
            });
            resolvePlaceLabel(cLat, cLon);
          }
          return next;
        });
      }
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [toolMode, resolvePlaceLabel]);

  const handleSearchInput = (val: string) => {
    setSearchQuery(val);
    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);
    if (val.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimerRef.current = window.setTimeout(async () => {
      setSearching(true);
      try {
        const resp = await fetch(`/api/geocode?q=${encodeURIComponent(val.trim())}`);
        if (resp.ok) {
          const data = (await resp.json()) as {
            results?: Array<{ name: string; display_name: string; lat: number; lon: number }>;
          };
          setSearchResults(data.results ?? []);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 320);
  };

  const handlePickSearchResult = (item: {
    name: string;
    display_name: string;
    lat: number;
    lon: number;
  }) => {
    setSearchQuery(item.name);
    setSearchResults([]);
    setPolygonPoints([]);
    setToolMode('pin');
    setResults(null);
    setErrorMsg(null);
    setGpsToast(null);
    setPinnedLocation({
      lat: item.lat,
      lon: item.lon,
      label: item.display_name.split(',').slice(0, 2).join(', '),
      areaHa: null,
    });
    if (mapRef.current) {
      mapRef.current.flyTo([item.lat, item.lon], 14, { duration: 0.9 });
    }
  };

  const handleLocateGps = () => {
    setGpsToast(null);
    if (!navigator.geolocation) {
      setGpsToast('GPS unavailable in this browser. Search your village above.');
      return;
    }
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocatingGps(false);
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lon = Number(pos.coords.longitude.toFixed(5));
        setPolygonPoints([]);
        setToolMode('pin');
        setResults(null);
        setPinnedLocation({ lat, lon, label: 'My GPS Field', areaHa: null });
        if (mapRef.current) {
          mapRef.current.flyTo([lat, lon], 15, { duration: 1.0 });
        }
        resolvePlaceLabel(lat, lon);
      },
      () => {
        setLocatingGps(false);
        setGpsToast('Location access blocked. Use village search above.');
      },
      { enableHighAccuracy: true, timeout: 7000 }
    );
  };

  const handleSelectPreset = useCallback((preset: DemoPreset) => {
    setErrorMsg(null);
    setGpsToast(null);
    setSearchResults([]);
    setPolygonPoints([]);
    setToolMode('pin');
    setPinnedLocation({
      lat: preset.lat,
      lon: preset.lon,
      label: preset.name,
      areaHa: null,
    });
    setCurrentCrop(preset.default_crop);
    setIrrigation(preset.default_irrigation);
    setResults(null);
    setRainPct(0);
    setTempDelta(0);
    if (mapRef.current) {
      mapRef.current.flyTo([preset.lat, preset.lon], 12, { duration: 0.8 });
    }
  }, []);

  const togglePriority = (p: PriorityId) => {
    setPriorities((prev) => {
      if (prev.includes(p)) {
        return prev.length > 1 ? prev.filter((item) => item !== p) : prev;
      }
      if (prev.length >= 2) {
        return [prev[1], p];
      }
      return [...prev, p];
    });
  };

  const handleClearField = () => {
    setPinnedLocation(null);
    setPolygonPoints([]);
    setResults(null);
    setErrorMsg(null);
    setGpsToast(null);
    setRainPct(0);
    setTempDelta(0);
  };

  const runAnalysis = async () => {
    if (!pinnedLocation) return;
    setLoading(true);
    setErrorMsg(null);
    setRainPct(0);
    setTempDelta(0);

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 14000);

    try {
      const resp = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          lat: pinnedLocation.lat,
          lon: pinnedLocation.lon,
          current_crop: currentCrop,
          priorities,
          irrigation,
          equipment,
          field_area_ha: pinnedLocation.areaHa ?? null,
          lang: 'en',
        }),
      });
      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        throw new Error(errBody.error || `Request failed (${resp.status})`);
      }
      const data = (await resp.json()) as AnalyzeResponse;
      setResults(data);
    } catch (err) {
      const msg =
        err instanceof Error && err.name === 'AbortError'
          ? 'NASA request timed out. Please try again or pick a benchmark district.'
          : err instanceof Error
          ? err.message
          : 'Could not complete simulation.';
      setErrorMsg(msg);
    } finally {
      window.clearTimeout(timer);
      setLoading(false);
    }
  };

  const handleScenarioChange = (nextRainPct: number, nextTempDelta: number) => {
    setRainPct(nextRainPct);
    setTempDelta(nextTempDelta);
    if (!pinnedLocation) return;

    if (scenarioTimerRef.current) {
      window.clearTimeout(scenarioTimerRef.current);
    }
    scenarioTimerRef.current = window.setTimeout(async () => {
      setScenarioLoading(true);
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 12000);
      try {
        const resp = await fetch('/api/scenario', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            lat: pinnedLocation.lat,
            lon: pinnedLocation.lon,
            current_crop: currentCrop,
            priorities,
            irrigation,
            equipment,
            field_area_ha: pinnedLocation.areaHa ?? null,
            lang: 'en',
            rain_mult: Number((1 + nextRainPct / 100).toFixed(2)),
            temp_delta: nextTempDelta,
          }),
        });
        if (resp.ok) {
          const data = (await resp.json()) as AnalyzeResponse;
          setResults(data);
        }
      } catch {
        // Keep last valid results on transient slider abort
      } finally {
        window.clearTimeout(timer);
        setScenarioLoading(false);
      }
    }, 200);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#05070B] select-none">
      {/* Full-Viewport Interactive Satellite Map */}
      <div
        ref={mapContainerRef}
        className={`absolute inset-0 z-0 ${toolMode === 'polygon' ? 'cursor-crosshair' : ''}`}
      />

      {/* Unified Non-Overlapping Top HUD Shell */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="pointer-events-none absolute top-3 left-3 right-3 z-[500] flex flex-col lg:flex-row lg:items-start lg:justify-between gap-2.5"
      >
        {/* Left Zone: Brand + Search + Vertical Tool Rail (stacked so they NEVER collide) */}
        <div className="flex flex-col items-start gap-2.5 shrink-0">
          <div className="pointer-events-auto flex items-center gap-2 bg-[#0B0F18]/92 backdrop-blur-md border border-white/15 rounded-xl px-3 py-2 shadow-xl">
            <button
              onClick={onBackHome}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Back to Home Screen"
              aria-label="Back to Home Screen"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="font-display text-base font-bold tracking-tight text-white">
              KinField
            </span>
          </div>

          {/* Search Village / District / Coordinates */}
          <div className="pointer-events-auto relative w-64 sm:w-72">
            <div className="flex items-center gap-2 px-3 py-2 bg-[#0B0F18]/92 backdrop-blur-md border border-white/15 focus-within:border-[#8AB4F8] rounded-xl shadow-xl">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                placeholder="Search village, district, or lat, lon…"
                className="w-full bg-transparent text-xs text-white placeholder:text-slate-400 focus:outline-none"
                aria-label="Search village or district"
              />
              {searching && <Loader2 className="w-3.5 h-3.5 text-[#8AB4F8] animate-spin shrink-0" />}
            </div>

            {searchResults.length > 0 && (
              <div className="mt-1.5 bg-[#0B0F18]/96 backdrop-blur-xl border border-white/15 rounded-xl shadow-2xl overflow-hidden divide-y divide-white/10 max-h-56 overflow-y-auto">
                {searchResults.map((item, idx) => (
                  <button
                    key={`${item.lat}_${item.lon}_${idx}`}
                    type="button"
                    onClick={() => handlePickSearchResult(item)}
                    className="w-full text-left px-3 py-2.5 hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <p className="text-xs font-semibold text-white truncate">{item.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{item.display_name}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Left Tool Rail neatly inside the left stack */}
          {!results && (
            <div className="pointer-events-auto flex flex-col items-start gap-2">
              <div className="bg-[#0B0F18]/92 backdrop-blur-md border border-white/15 rounded-xl p-1.5 flex flex-row lg:flex-col gap-1 shadow-xl">
                <button
                  onClick={handleLocateGps}
                  disabled={locatingGps}
                  className="px-3 py-2 rounded-lg text-xs font-medium text-[#8AB4F8] hover:bg-[#8AB4F8]/15 inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                  title="Detect my current field location via GPS"
                >
                  {locatingGps ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LocateFixed className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">My Location</span>
                </button>

                <button
                  onClick={() => setToolMode('pin')}
                  className={`px-3 py-2 rounded-lg text-xs font-medium inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                    toolMode === 'pin'
                      ? 'bg-[#8AB4F8] text-[#07090E]'
                      : 'text-slate-300 hover:bg-white/10'
                  }`}
                  title="Tap anywhere on map to place field pin"
                >
                  <MapPin className="w-4 h-4" />
                  <span className="hidden sm:inline">Pin Field</span>
                </button>

                <button
                  onClick={() => {
                    setToolMode('polygon');
                    setPolygonPoints([]);
                  }}
                  className={`px-3 py-2 rounded-lg text-xs font-medium inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                    toolMode === 'polygon'
                      ? 'bg-[#8AB4F8] text-[#07090E]'
                      : 'text-slate-300 hover:bg-white/10'
                  }`}
                  title="Click corners on the map to trace field boundary"
                >
                  <Pentagon className="w-4 h-4" />
                  <span className="hidden sm:inline">Draw Field</span>
                </button>

                <button
                  onClick={() => setShowVulnOverlay((v) => !v)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                    showVulnOverlay
                      ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                      : 'text-slate-300 hover:bg-white/10'
                  }`}
                  title="Show regional heat & dry-spell vulnerability zones"
                >
                  <Layers className="w-4 h-4" />
                  <span className="hidden sm:inline">Stress Zones</span>
                </button>

                {(pinnedLocation || polygonPoints.length > 0) && (
                  <button
                    onClick={handleClearField}
                    className="px-3 py-2 rounded-lg text-xs font-medium text-rose-300 hover:bg-rose-500/15 inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                    title="Clear field pin"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Clear</span>
                  </button>
                )}
              </div>

              {gpsToast && (
                <div className="max-w-[220px] p-2.5 rounded-xl bg-[#0B0F18]/94 border border-amber-400/40 text-[11px] text-amber-200 shadow-xl">
                  {gpsToast}
                </div>
              )}

              <AnimatePresence>
                {toolMode === 'polygon' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="max-w-[210px] p-2.5 rounded-xl bg-[#0B0F18]/92 border border-[#8AB4F8]/40 text-[11px] text-slate-200 shadow-xl space-y-2"
                  >
                    <p>Click corners around your field ({polygonPoints.length} placed).</p>
                    <div className="flex gap-1.5">
                      {polygonPoints.length > 0 && (
                        <button
                          onClick={() => setPolygonPoints((prev) => prev.slice(0, -1))}
                          className="flex-1 py-1 rounded bg-white/10 hover:bg-white/15 text-slate-200 font-medium inline-flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Undo2 className="w-3 h-3" /> Undo
                        </button>
                      )}
                      {polygonPoints.length >= 3 && (
                        <button
                          onClick={() => setToolMode('pin')}
                          className="flex-1 py-1 rounded bg-[#8AB4F8] text-[#07090E] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3 h-3" /> Done
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Center Zone: NASA GIBS Layer Switcher + Seasonal Timeline Scrubber */}
        <div className="pointer-events-auto flex flex-col items-center gap-2 lg:mx-auto">
          <div className="flex items-center gap-1 p-1 bg-[#0B0F18]/92 backdrop-blur-md border border-white/15 rounded-xl shadow-xl">
            {(
              [
                { id: 'base', label: 'Base' },
                { id: 'modis', label: 'MODIS' },
                { id: 'smap', label: 'SMAP' },
                { id: 'gpm', label: 'GPM' },
              ] as Array<{ id: MapLayerId; label: string }>
            ).map((layer) => (
              <button
                key={layer.id}
                onClick={() => setActiveLayer(layer.id)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer ${
                  activeLayer === layer.id
                    ? 'bg-[#8AB4F8] text-[#07090E] shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                {layer.label}
                {activeLayer === layer.id && gibsLoading && layer.id !== 'base' && (
                  <Loader2 className="w-3 h-3 animate-spin" />
                )}
              </button>
            ))}

            <span className="text-slate-700 mx-0.5">|</span>

            <button
              onClick={() =>
                setBaseStyle((s) =>
                  s === 'dark-sat' ? 'imagery' : s === 'imagery' ? 'dark' : 'dark-sat'
                )
              }
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                baseStyle !== 'dark'
                  ? 'bg-emerald-400/15 text-emerald-300'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
              title="Cycle basemap: Dark Satellite → True Color Satellite → Dark Vector"
            >
              <Satellite className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {baseStyle === 'dark-sat'
                  ? 'Dark Sat'
                  : baseStyle === 'imagery'
                  ? 'True Sat'
                  : 'Vector'}
              </span>
            </button>
          </div>

          <AnimatePresence>
            {activeLayer !== 'base' && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-wrap items-center justify-center gap-1.5 px-3 py-1.5 bg-[#0B0F18]/92 backdrop-blur-md border border-white/15 rounded-xl shadow-xl text-xs"
              >
                <Calendar className="w-3.5 h-3.5 text-[#8AB4F8]" />
                {SEASONAL_DATES.map((sd) => (
                  <button
                    key={sd.date}
                    onClick={() => setGibsDate(sd.date)}
                    className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                      gibsDate === sd.date
                        ? 'bg-white/15 text-white font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {sd.label}
                  </button>
                ))}
                <input
                  type="date"
                  value={gibsDate}
                  max="2025-12-31"
                  min="2016-01-01"
                  onChange={(e) => e.target.value && setGibsDate(e.target.value)}
                  className="bg-[#07090E] text-slate-200 border border-white/15 rounded px-2 py-0.5 text-[11px] font-mono-tabular"
                  aria-label="Satellite imagery date"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {(activeLayer === 'smap' || activeLayer === 'gpm') && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="px-3 py-1.5 bg-[#0B0F18]/92 backdrop-blur-md border border-white/15 rounded-lg text-[11px] text-slate-300 flex items-center gap-3 shadow-lg"
              >
                {activeLayer === 'smap' ? (
                  <>
                    <span className="font-semibold text-white">SMAP Soil Moisture:</span>
                    <span>Dry (0.05)</span>
                    <span className="w-20 h-2 rounded-full bg-gradient-to-r from-amber-500 via-emerald-400 to-blue-600 inline-block" />
                    <span>Wet (0.45 m³/m³)</span>
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-white">GPM IMERG Rain:</span>
                    <span>Light</span>
                    <span className="w-20 h-2 rounded-full bg-gradient-to-r from-sky-300 via-blue-600 to-purple-500 inline-block" />
                    <span>Heavy (mm/hr)</span>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Zone: Provenance Button (placed neatly above topright zoom buttons) */}
        <button
          onClick={onOpenProvenance}
          className="pointer-events-auto self-end lg:self-auto px-3.5 py-2 bg-[#0B0F18]/92 backdrop-blur-md border border-white/15 hover:border-[#8AB4F8]/50 rounded-xl text-xs font-medium text-slate-200 inline-flex items-center gap-2 shadow-xl cursor-pointer transition-colors shrink-0"
        >
          <Database className="w-3.5 h-3.5 text-[#8AB4F8]" />
          <span>Data &amp; Provenance</span>
        </button>
      </motion.div>

      {/* Single Clean Bottom Prompt + Pre-Seeded District Strip when no field is pinned */}
      <AnimatePresence>
        {!pinnedLocation && !results && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 14 }}
            className="pointer-events-none absolute inset-x-0 bottom-5 z-[500] flex justify-center px-4"
          >
            <div className="pointer-events-auto px-5 py-3 rounded-xl bg-[#0B0F18]/92 backdrop-blur-md border border-white/15 shadow-2xl flex flex-wrap items-center justify-center gap-2.5 text-xs sm:text-sm">
              <span className="text-slate-200">
                Click anywhere on the satellite map to pin your field, or jump to:
              </span>
              <div className="flex items-center gap-1.5">
                {presets.map((p) => (
                  <button
                    key={p.slug}
                    onClick={() => handleSelectPreset(p)}
                    className="px-3 py-1 rounded-lg bg-[#8AB4F8]/15 hover:bg-[#8AB4F8] text-[#8AB4F8] hover:text-[#07090E] border border-[#8AB4F8]/35 text-xs font-semibold transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Navigation className="w-3 h-3" />
                    {p.name.split(',')[0]}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Glass Sheet: Farmer Inputs OR Final Results */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 sm:bottom-4 z-[600] px-0 sm:px-4">
        <AnimatePresence mode="wait">
          {pinnedLocation && !results && (
            <motion.div
              key="setup-sheet"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto w-full max-w-4xl mx-auto bg-[#0B0F18]/94 backdrop-blur-xl border border-white/15 rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 space-y-4 max-h-[55vh] overflow-y-auto"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div>
                  <h2 className="text-base font-bold text-white">
                    {pinnedLocation.label || 'Selected Field Coordinates'}
                  </h2>
                  <p className="text-xs font-mono-tabular text-slate-400">
                    {pinnedLocation.lat.toFixed(4)}°N, {pinnedLocation.lon.toFixed(4)}°E
                    {pinnedLocation.areaHa
                      ? ` · Field Area: ${pinnedLocation.areaHa} ha (${(
                          pinnedLocation.areaHa * 2.471
                        ).toFixed(2)} acres)`
                      : ''}
                  </p>
                </div>
                <button
                  onClick={handleClearField}
                  className="text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Clear Pin
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    1. Current Primary Crop
                  </label>
                  <select
                    value={currentCrop}
                    onChange={(e) => setCurrentCrop(e.target.value as CropId)}
                    className="w-full px-3 py-2.5 rounded-lg bg-[#111724] border border-white/15 text-sm text-white focus:outline-none focus:border-[#8AB4F8]"
                  >
                    {CROP_OPTIONS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.en} ({c.season})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    2. Water / Irrigation Access
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'none', en: 'Rainfed' },
                        { id: 'some', en: 'Limited' },
                        { id: 'full', en: 'Full' },
                      ] as Array<{ id: IrrigationLevel; en: string }>
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setIrrigation(opt.id)}
                        className={`py-2.5 px-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                          irrigation === opt.id
                            ? 'bg-[#8AB4F8] text-[#07090E] border-[#8AB4F8]'
                            : 'bg-[#111724] text-slate-300 border-white/12 hover:border-white/30'
                        }`}
                      >
                        {opt.en}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    3. Field / Equipment Constraint
                  </label>
                  <select
                    value={equipment}
                    onChange={(e) => setEquipment(e.target.value as EquipmentConstraint)}
                    className="w-full px-3 py-2.5 rounded-lg bg-[#111724] border border-white/15 text-sm text-white focus:outline-none focus:border-[#8AB4F8]"
                  >
                    <option value="standard">Standard Farm Machinery</option>
                    <option value="no_till">Zero-Till / Low Draft Priority</option>
                    <option value="forage_priority">Livestock / Fodder Priority</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pt-1">
                <div className="space-y-1.5 flex-1">
                  <span className="block text-xs font-semibold text-slate-300">
                    4. Choose up to 2 priorities:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {PRIORITY_OPTIONS.map((pr) => {
                      const selected = priorities.includes(pr.id);
                      return (
                        <button
                          key={pr.id}
                          type="button"
                          onClick={() => togglePriority(pr.id)}
                          className={`p-2 rounded-lg text-left border transition-colors cursor-pointer ${
                            selected
                              ? 'bg-[#8AB4F8]/15 border-[#8AB4F8] text-white'
                              : 'bg-[#111724] border-white/10 text-slate-300 hover:border-white/25'
                          }`}
                        >
                          <div className="text-xs font-semibold">{pr.en}</div>
                          <div className="text-[10px] text-slate-400 truncate">{pr.hint}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={loading}
                  onClick={runAnalysis}
                  className="px-6 py-3.5 rounded-xl bg-[#8AB4F8] hover:bg-[#A6C8FF] disabled:opacity-60 text-[#07090E] text-sm font-bold transition-colors whitespace-nowrap shrink-0 inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Running Simulation…
                    </>
                  ) : (
                    'Run 20-Year Simulation'
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {results && (
            <ResultsSheet
              key="results-sheet"
              data={results}
              rainPct={rainPct}
              tempDelta={tempDelta}
              onScenarioChange={handleScenarioChange}
              scenarioLoading={scenarioLoading}
              onEditInputs={() => setResults(null)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Non-hanging bounded loading indicator */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-[700] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
          >
            <div className="px-6 py-4 rounded-xl bg-[#0B0F18] border border-[#8AB4F8]/40 shadow-2xl flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-[#8AB4F8] animate-spin" />
              <div className="text-sm">
                <p className="font-semibold text-white">
                  Querying NASA POWER 2005–2024 daily series
                </p>
                <p className="text-xs text-slate-400">
                  Evaluating daily ET0, soil-water bucket &amp; flowering heat thresholds…
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
