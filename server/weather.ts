import fs from 'node:fs';
import path from 'node:path';
import type { ConfidenceLevel, SoilProfile, WeatherDataset, WeatherDay } from './types.js';

const ROOT_DIR = process.cwd();
const SEED_DIR = path.join(ROOT_DIR, 'data', 'cache_seed');
const SOIL_PATH = path.join(ROOT_DIR, 'data', 'soil_awc.json');

interface SeedFile {
  slug: string;
  label: string;
  lat: number;
  lon: number;
  elevation_m: number | null;
  source: string;
  period: string;
  grid_resolution: string;
  soil_fallback?: { texture: string; awc_mm: number };
  days: WeatherDay[];
}

interface SoilRegion {
  id: string;
  name: string;
  lat_min: number;
  lat_max: number;
  lon_min: number;
  lon_max: number;
  texture: string;
  awc_mm_per_m: number;
  clay_pct: number;
  sand_pct: number;
  soc_g_kg: number;
}

interface SoilLookupFile {
  regions: SoilRegion[];
  default_fallback: Omit<SoilRegion, 'id' | 'name' | 'lat_min' | 'lat_max' | 'lon_min' | 'lon_max'>;
}

const memoryWeatherCache = new Map<string, WeatherDataset>();
const memorySoilCache = new Map<string, SoilProfile>();
let loadedSeeds: SeedFile[] | null = null;
let loadedSoilLookup: SoilLookupFile | null = null;

function getSeeds(): SeedFile[] {
  if (loadedSeeds) return loadedSeeds;
  loadedSeeds = [];
  if (fs.existsSync(SEED_DIR)) {
    const files = fs.readdirSync(SEED_DIR).filter((f) => f.startsWith('wx_') && f.endsWith('.json'));
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(SEED_DIR, file), 'utf-8');
        loadedSeeds.push(JSON.parse(raw) as SeedFile);
      } catch {
        // Ignore malformed seed
      }
    }
  }
  return loadedSeeds;
}

function getSoilLookup(): SoilLookupFile {
  if (loadedSoilLookup) return loadedSoilLookup;
  const raw = fs.readFileSync(SOIL_PATH, 'utf-8');
  loadedSoilLookup = JSON.parse(raw) as SoilLookupFile;
  return loadedSoilLookup;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function gridKey(lat: number, lon: number): string {
  const gLat = (Math.round(lat * 4) / 4).toFixed(2);
  const gLon = (Math.round(lon * 4) / 4).toFixed(2);
  return `${gLat}_${gLon}`;
}

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateSyntheticWeather(lat: number, lon: number): WeatherDataset {
  const absLat = Math.abs(lat);
  const rand = seededRandom(Math.round(Math.abs(lat * 1000) + Math.abs(lon * 1000)) + 42);
  const baseTemp = Math.max(8, 30 - absLat * 0.35);
  const ampTemp = Math.min(14, 4 + absLat * 0.28);
  const isSouthAsia = lat >= 8 && lat <= 35 && lon >= 68 && lon <= 95;
  const days: WeatherDay[] = [];

  for (let year = 2005; year <= 2024; year++) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const daysInYear = isLeap ? 366 : 365;
    const yearRainFactor = 0.72 + rand() * 0.56;
    const yearHeatBias = (year - 2005) * 0.04 + (rand() - 0.5) * 1.4;

    const start = new Date(Date.UTC(year, 0, 1));
    for (let i = 0; i < daysInYear; i++) {
      const dt = new Date(start.getTime() + i * 86400000);
      const y = dt.getUTCFullYear();
      const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dt.getUTCDate()).padStart(2, '0');
      const doy = i + 1;
      const phase = lat >= 0 ? doy - 110 : doy - 290;
      const seasonal = Math.sin((2 * Math.PI * phase) / 365);
      const tMean = baseTemp + ampTemp * seasonal + yearHeatBias + (rand() - 0.5) * 2.4;
      const diurnal = 9.5 + (isSouthAsia && doy < 160 ? 3.5 : 0);
      const tmax = tMean + diurnal * 0.55;
      const tmin = tMean - diurnal * 0.45;

      let rain = 0;
      if (isSouthAsia) {
        const isMonsoon = doy >= 170 && doy <= 265;
        const rainProb = isMonsoon ? 0.42 : doy >= 15 && doy <= 65 ? 0.08 : 0.03;
        if (rand() < rainProb) {
          rain = (isMonsoon ? 14 : 6) * Math.pow(rand(), 1.6) * yearRainFactor * 2.2;
        }
      } else {
        if (rand() < 0.22) {
          rain = 9 * Math.pow(rand(), 1.5) * yearRainFactor * 2.0;
        }
      }

      days.push({
        d: `${y}${m}${d}`,
        t: Number(tMean.toFixed(2)),
        tx: Number(tmax.toFixed(2)),
        tn: Number(tmin.toFixed(2)),
        p: Number(rain.toFixed(2)),
        gw: null,
        sw: Number(Math.max(8, 19 + 6 * seasonal).toFixed(2)),
      });
    }
  }

  return {
    lat,
    lon,
    elevation_m: null,
    label: `Field (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`,
    source: 'Synthetic Climatology Fallback (NASA POWER timeout/offline)',
    period: '2005-01-01 to 2024-12-31 (synthesized)',
    grid_resolution: 'Point approximation',
    confidence: 'LOW',
    days,
  };
}

export async function getWeatherSeries(lat: number, lon: number): Promise<WeatherDataset> {
  // 1. Check pre-seeded real NASA POWER pins within 32 km (~0.3 deg)
  const seeds = getSeeds();
  for (const seed of seeds) {
    if (haversineKm(lat, lon, seed.lat, seed.lon) <= 32) {
      return {
        lat,
        lon,
        elevation_m: seed.elevation_m,
        label: seed.label,
        source: `${seed.source} (Pre-seeded Grid)`,
        period: seed.period,
        grid_resolution: seed.grid_resolution,
        confidence: 'HIGH',
        days: seed.days,
        soil_fallback: seed.soil_fallback,
      };
    }
  }

  // 2. Check runtime grid cache (~0.25 deg)
  const key = gridKey(lat, lon);
  const cached = memoryWeatherCache.get(key);
  if (cached) {
    return { ...cached, lat, lon };
  }

  // 3. Live NASA POWER API query with strict 7.5s timeout
  const params = 'T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,GWETROOT,ALLSKY_SFC_SW_DWN';
  const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=${params}&community=AG&longitude=${lon.toFixed(4)}&latitude=${lat.toFixed(4)}&start=20050101&end=20241231&format=JSON`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7500);

  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'KinField-NASA-SpaceApps/1.0' },
    });
    if (!resp.ok) throw new Error(`POWER HTTP ${resp.status}`);
    const raw = (await resp.json()) as {
      geometry?: { coordinates?: number[] };
      properties?: { parameter?: Record<string, Record<string, number>> };
    };
    const p = raw.properties?.parameter;
    if (!p || !p.T2M) throw new Error('Missing POWER parameters');

    const dates = Object.keys(p.T2M).sort();
    const days: WeatherDay[] = [];
    for (const d of dates) {
      const t = p.T2M[d];
      const tx = p.T2M_MAX?.[d];
      const tn = p.T2M_MIN?.[d];
      const pr = p.PRECTOTCORR?.[d];
      const gw = p.GWETROOT?.[d];
      const sw = p.ALLSKY_SFC_SW_DWN?.[d];
      if (t === undefined || tx === undefined || tn === undefined || pr === undefined) continue;
      if (t < -900 || tx < -900 || tn < -900 || pr < -900) continue;
      days.push({
        d,
        t: Number(t.toFixed(2)),
        tx: Number(tx.toFixed(2)),
        tn: Number(tn.toFixed(2)),
        p: Number(Math.max(0, pr).toFixed(2)),
        gw: gw !== undefined && gw >= 0 ? Number(gw.toFixed(3)) : null,
        sw: sw !== undefined && sw >= 0 ? Number(sw.toFixed(2)) : null,
      });
    }

    if (days.length < 3650) throw new Error('Insufficient POWER days');

    const elev = raw.geometry?.coordinates?.[2] ?? null;
    const dataset: WeatherDataset = {
      lat,
      lon,
      elevation_m: typeof elev === 'number' ? Number(elev.toFixed(1)) : null,
      label: `Field (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`,
      source: 'NASA POWER Daily Agroclimatology (Live API)',
      period: '2005-01-01 to 2024-12-31',
      grid_resolution: '0.5° × 0.625° (~50 km)',
      confidence: 'HIGH',
      days,
    };
    memoryWeatherCache.set(key, dataset);
    return dataset;
  } catch {
    const fallback = generateSyntheticWeather(lat, lon);
    try {
      const elevCtrl = new AbortController();
      const elevTimer = setTimeout(() => elevCtrl.abort(), 1200);
      const elevResp = await fetch(
        `https://api.open-meteo.com/v1/elevation?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}`,
        { signal: elevCtrl.signal }
      );
      clearTimeout(elevTimer);
      if (elevResp.ok) {
        const elevJson = (await elevResp.json()) as { elevation?: number[] };
        if (typeof elevJson.elevation?.[0] === 'number') {
          fallback.elevation_m = Number(elevJson.elevation[0].toFixed(1));
        }
      }
    } catch {
      // Ignore optional elevation timeout
    }
    memoryWeatherCache.set(key, fallback);
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

function textureFromClaySand(clayPct: number, sandPct: number): { texture: string; awc: number } {
  if (clayPct >= 35) return { texture: 'Clay / Vertisol', awc: 168 };
  if (clayPct >= 25 && sandPct < 45) return { texture: 'Clay Loam', awc: 158 };
  if (sandPct >= 62) return { texture: 'Sandy Loam', awc: 118 };
  if (sandPct <= 28 && clayPct <= 25) return { texture: 'Silt Loam', awc: 152 };
  return { texture: 'Loam', awc: 142 };
}

export async function getSoilProfile(
  lat: number,
  lon: number,
  seedSoil?: { texture: string; awc_mm: number }
): Promise<SoilProfile> {
  const key = gridKey(lat, lon);
  const cached = memorySoilCache.get(key);
  if (cached) return cached;

  // Query ISRIC SoilGrids v2.0 with a strict 1.5s timeout so demo stays <2s
  const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon.toFixed(4)}&lat=${lat.toFixed(4)}&property=clay&property=sand&property=soc&depth=0-30cm&value=mean`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);

  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (resp.ok) {
      const json = (await resp.json()) as {
        properties?: {
          layers?: Array<{
            name: string;
            depths?: Array<{ values?: { mean?: number } }>;
          }>;
        };
      };
      const layers = json.properties?.layers ?? [];
      const clayRaw = layers.find((l) => l.name === 'clay')?.depths?.[0]?.values?.mean;
      const sandRaw = layers.find((l) => l.name === 'sand')?.depths?.[0]?.values?.mean;
      const socRaw = layers.find((l) => l.name === 'soc')?.depths?.[0]?.values?.mean;
      if (typeof clayRaw === 'number' && typeof sandRaw === 'number') {
        const clayPct = Number((clayRaw / 10).toFixed(1));
        const sandPct = Number((sandRaw / 10).toFixed(1));
        const socGKg = typeof socRaw === 'number' ? Number((socRaw / 10).toFixed(1)) : 5.5;
        const derived = textureFromClaySand(clayPct, sandPct);
        const profile: SoilProfile = {
          texture: derived.texture,
          awc_mm_per_m: derived.awc,
          clay_pct: clayPct,
          sand_pct: sandPct,
          soc_g_kg: socGKg,
          source: 'ISRIC SoilGrids v2.0 (250 m, live API)',
          confidence: 'HIGH',
          region_name: 'ISRIC 250 m grid',
        };
        memorySoilCache.set(key, profile);
        return profile;
      }
    }
  } catch {
    // Fall through cleanly to regional lookup
  } finally {
    clearTimeout(timer);
  }

  const lookup = getSoilLookup();
  const match = lookup.regions.find(
    (r) => lat >= r.lat_min && lat <= r.lat_max && lon >= r.lon_min && lon <= r.lon_max
  );

  if (match) {
    const profile: SoilProfile = {
      texture: seedSoil?.texture ?? match.texture,
      awc_mm_per_m: seedSoil?.awc_mm ?? match.awc_mm_per_m,
      clay_pct: match.clay_pct,
      sand_pct: match.sand_pct,
      soc_g_kg: match.soc_g_kg,
      source: 'Regional Agro-Ecological Soil Lookup (SoilGrids fallback)',
      confidence: 'MED',
      region_name: match.name,
    };
    memorySoilCache.set(key, profile);
    return profile;
  }

  const def = lookup.default_fallback;
  const fallbackProfile: SoilProfile = {
    texture: seedSoil?.texture ?? def.texture,
    awc_mm_per_m: seedSoil?.awc_mm ?? def.awc_mm_per_m,
    clay_pct: def.clay_pct,
    sand_pct: def.sand_pct,
    soc_g_kg: def.soc_g_kg,
    source: 'Global Default Soil AWC Fallback',
    confidence: 'MED',
    region_name: 'Global Loam Baseline',
  };
  memorySoilCache.set(key, fallbackProfile);
  return fallbackProfile;
}

export function getDemoPresets() {
  return [
    {
      slug: 'hisar',
      name: 'Hisar, Haryana',
      subtitle: 'Semi-Arid Indo-Gangetic Plains · Sandy Loam',
      lat: 29.15,
      lon: 75.72,
      default_crop: 'wheat' as const,
      default_irrigation: 'some' as const,
      highlight: 'March heatwave & groundwater stress zone',
    },
    {
      slug: 'ludhiana',
      name: 'Ludhiana, Punjab',
      subtitle: 'Central Punjab Alluvial · Loam',
      lat: 30.9,
      lon: 75.85,
      default_crop: 'rice' as const,
      default_irrigation: 'full' as const,
      highlight: 'Intensive rice–wheat aquifer depletion belt',
    },
    {
      slug: 'aurangabad',
      name: 'Aurangabad, Maharashtra',
      subtitle: 'Marathwada Deccan Basalt · Vertisol Clay Loam',
      lat: 19.88,
      lon: 75.34,
      default_crop: 'cotton' as const,
      default_irrigation: 'none' as const,
      highlight: 'Rainfed dry-spell & mid-monsoon break hotspot',
    },
  ];
}
