import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { runBacktestAnalysis } from './server/engine.js';
import type { AnalyzeRequest, ScenarioRequest } from './server/types.js';
import { getDemoPresets, getSoilProfile, getWeatherSeries } from './server/weather.js';

const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Open CORS for public demo & Space Apps judging
  app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

  app.get(['/api/health', '/health'], (_req, res) => {
    res.json({
      status: 'ok',
      service: 'KinField',
      engine: 'deterministic-fao56-hargreaves',
      timestamp: new Date().toISOString(),
    });
  });

  app.get(['/api/provenance', '/provenance'], (_req, res) => {
    const raw = fs.readFileSync(path.join(process.cwd(), 'data', 'provenance.json'), 'utf-8');
    res.json(JSON.parse(raw));
  });

  app.get('/api/presets', (_req, res) => {
    res.json({ presets: getDemoPresets() });
  });

  app.get('/api/crops', (_req, res) => {
    const raw = fs.readFileSync(path.join(process.cwd(), 'data', 'crops.json'), 'utf-8');
    res.json(JSON.parse(raw));
  });

  app.get('/api/geocode', async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q || q.length < 2) {
      res.json({ results: [] });
      return;
    }

    // Support direct "lat, lon" coordinate input
    const coordMatch = q.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (coordMatch) {
      const lat = Number(coordMatch[1]);
      const lon = Number(coordMatch[2]);
      if (lat >= -60 && lat <= 60 && lon >= -180 && lon <= 180) {
        res.json({
          results: [
            {
              name: `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`,
              display_name: `Coordinates (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
              lat,
              lon,
            },
          ],
        });
        return;
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        q
      )}&format=json&limit=5&addressdetails=1`;
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'KinField-NASA-SpaceApps/1.0' },
      });
      if (!resp.ok) throw new Error(`Nominatim ${resp.status}`);
      const items = (await resp.json()) as Array<{
        name?: string;
        display_name: string;
        lat: string;
        lon: string;
      }>;
      res.json({
        results: items.map((it) => ({
          name: it.name || it.display_name.split(',')[0],
          display_name: it.display_name,
          lat: Number(Number(it.lat).toFixed(5)),
          lon: Number(Number(it.lon).toFixed(5)),
        })),
      });
    } catch {
      // Fallback match against pre-seeded districts
      const presets = getDemoPresets().filter((p) =>
        p.name.toLowerCase().includes(q.toLowerCase())
      );
      res.json({
        results: presets.map((p) => ({
          name: p.name,
          display_name: `${p.name} — ${p.subtitle}`,
          lat: p.lat,
          lon: p.lon,
        })),
      });
    } finally {
      clearTimeout(timer);
    }
  });

  app.get('/api/reverse-geocode', async (req, res) => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      res.status(400).json({ error: 'lat and lon required' });
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat.toFixed(
        5
      )}&lon=${lon.toFixed(5)}&format=json&zoom=14`;
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'KinField-NASA-SpaceApps/1.0' },
      });
      if (!resp.ok) throw new Error(`Reverse ${resp.status}`);
      const data = (await resp.json()) as {
        display_name?: string;
        address?: Record<string, string>;
      };
      const addr = data.address || {};
      const parts = [
        addr.village || addr.town || addr.suburb || addr.hamlet || addr.city,
        addr.county || addr.state_district || addr.district,
        addr.state,
      ].filter(Boolean);
      const label =
        parts.length > 0
          ? parts.slice(0, 3).join(', ')
          : data.display_name?.split(',').slice(0, 3).join(', ') ||
            `Field (${lat.toFixed(3)}°, ${lon.toFixed(3)}°)`;
      res.json({ label });
    } catch {
      res.json({ label: `Field (${lat.toFixed(3)}°, ${lon.toFixed(3)}°)` });
    } finally {
      clearTimeout(timer);
    }
  });

  // In-memory cache for verified agricultural parcels & Sentinel-2 cropland points
  interface FarmlandParcel {
    id: string;
    label: string;
    landuse: string;
    centroid: [number, number];
    area_ha: number;
    coords: Array<[number, number]>;
  }
  const farmlandCache = new Map<string, { ts: number; parcels: FarmlandParcel[] }>();

  function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function calcRingAreaHa(coords: Array<[number, number]>): number {
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
    return Number((Math.abs((area * R * R) / 2) / 10000).toFixed(2));
  }

  async function fetchSentinel2CropPoints(
    lat: number,
    lon: number,
    spanDeg = 0.028
  ): Promise<FarmlandParcel[]> {
    const steps = [-1.0, -0.6, -0.2, 0.2, 0.6, 1.0];
    const points: Array<[number, number]> = [];
    for (const dy of steps) {
      for (const dx of steps) {
        const pLat = Number((lat + dy * spanDeg).toFixed(5));
        const pLon = Number((lon + dx * spanDeg).toFixed(5));
        points.push([pLon, pLat]);
      }
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3200);
    try {
      const geom = JSON.stringify({
        points,
        spatialReference: { wkid: 4326 },
      });
      const url = `https://ic.imagery1.arcgis.com/arcgis/rest/services/Sentinel2_10m_LandCover/ImageServer/getSamples?f=json&geometryType=esriGeometryMultipoint&geometry=${encodeURIComponent(
        geom
      )}`;
      const resp = await fetch(url, { signal: ctrl.signal });
      if (!resp.ok) return [];
      const data = (await resp.json()) as {
        samples?: Array<{
          location?: { x: number; y: number };
          value?: string;
        }>;
      };

      const parcels: FarmlandParcel[] = [];
      const halfCellLat = 0.0011;
      const halfCellLon = 0.0012;
      (data.samples ?? []).forEach((s, idx) => {
        if (s.value !== '5' || !s.location) return;
        const pLat = Number(s.location.y.toFixed(5));
        const pLon = Number(s.location.x.toFixed(5));
        const coords: Array<[number, number]> = [
          [pLat - halfCellLat, pLon - halfCellLon],
          [pLat - halfCellLat, pLon + halfCellLon],
          [pLat + halfCellLat, pLon + halfCellLon],
          [pLat + halfCellLat, pLon - halfCellLon],
        ];
        parcels.push({
          id: `s2crop-${idx}-${pLat}-${pLon}`,
          label: 'Verified Cropland Plot',
          landuse: 'cropland',
          centroid: [pLat, pLon],
          area_ha: 2.5,
          coords,
        });
      });
      return parcels;
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchOverpassFarmlands(lat: number, lon: number): Promise<FarmlandParcel[]> {
    const query = `[out:json][timeout:3];(way["landuse"~"^(farmland|orchard|vineyard|meadow|allotments)$"](${(
      lat - 0.025
    ).toFixed(4)},${(lon - 0.025).toFixed(4)},${(lat + 0.025).toFixed(4)},${(
      lon + 0.025
    ).toFixed(4)}););out geom 25;`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2800);
    try {
      const resp = await fetch('https://overpass.private.coffee/api/interpreter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          Accept: 'application/json',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: ctrl.signal,
      });
      if (!resp.ok) return [];
      const text = await resp.text();
      if (!text.trim().startsWith('{')) return [];
      const json = JSON.parse(text) as {
        elements?: Array<{
          id: number;
          tags?: Record<string, string>;
          geometry?: Array<{ lat: number; lon: number }>;
        }>;
      };
      const parcels: FarmlandParcel[] = [];
      for (const el of json.elements ?? []) {
        const pts = (el.geometry ?? []).map((g) => [g.lat, g.lon] as [number, number]);
        if (pts.length < 3) continue;
        const areaHa = calcRingAreaHa(pts);
        if (areaHa < 0.08 || areaHa > 2500) continue;
        const cLat = Number((pts.reduce((s, p) => s + p[0], 0) / pts.length).toFixed(5));
        const cLon = Number((pts.reduce((s, p) => s + p[1], 0) / pts.length).toFixed(5));
        const lu = el.tags?.landuse || 'farmland';
        const name =
          el.tags?.name || el.tags?.crop || `${lu.charAt(0).toUpperCase()}${lu.slice(1)} Plot`;
        parcels.push({
          id: `osm-${el.id}`,
          label: name,
          landuse: lu,
          centroid: [cLat, cLon],
          area_ha: areaHa,
          coords: pts,
        });
      }
      return parcels;
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchNearbyFarmlands(lat: number, lon: number): Promise<FarmlandParcel[]> {
    const key = `${(Math.round(lat * 50) / 50).toFixed(2)}_${(Math.round(lon * 50) / 50).toFixed(2)}`;
    const cached = farmlandCache.get(key);
    if (cached && Date.now() - cached.ts < 10 * 60 * 1000) {
      return cached.parcels;
    }

    const [s2Parcels, osmParcels] = await Promise.all([
      fetchSentinel2CropPoints(lat, lon),
      fetchOverpassFarmlands(lat, lon),
    ]);

    const combined = osmParcels.length >= 6 ? osmParcels : [...osmParcels, ...s2Parcels];
    farmlandCache.set(key, { ts: Date.now(), parcels: combined });
    return combined;
  }

  app.get('/api/farmlands', async (req, res) => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      res.status(400).json({ error: 'lat and lon required' });
      return;
    }
    const parcels = await fetchNearbyFarmlands(lat, lon);
    res.json({ parcels, source: 'Sentinel-2 10m LandCover + OpenStreetMap' });
  });

  app.get('/api/landuse-check', async (req, res) => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      res.status(400).json({ error: 'lat and lon required' });
      return;
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);

    const s2Geom = encodeURIComponent(
      JSON.stringify({ x: lon, y: lat, spatialReference: { wkid: 4326 } })
    );

    try {
      const [nomRes, s2Res] = await Promise.allSettled([
        fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat.toFixed(5)}&lon=${lon.toFixed(
            5
          )}&format=jsonv2&zoom=18&extratags=1&addressdetails=1`,
          { signal: ctrl.signal, headers: { 'User-Agent': 'KinField-NASA-SpaceApps/1.0' } }
        ).then((r) => (r.ok ? r.json() : null)),
        fetch(
          `https://ic.imagery1.arcgis.com/arcgis/rest/services/Sentinel2_10m_LandCover/ImageServer/identify?f=json&geometryType=esriGeometryPoint&geometry=${s2Geom}`,
          { signal: ctrl.signal }
        ).then((r) => (r.ok ? r.json() : null)),
      ]);

      const nom = (nomRes.status === 'fulfilled' ? nomRes.value : null) as {
        category?: string;
        class?: string;
        type?: string;
        addresstype?: string;
        name?: string;
        lat?: string;
        lon?: string;
        display_name?: string;
        address?: Record<string, string>;
      } | null;

      const s2 = (s2Res.status === 'fulfilled' ? s2Res.value : null) as {
        value?: string;
      } | null;

      const s2Class = s2?.value ?? '';
      const nomCat = (nom?.category || nom?.class || '').toLowerCase();
      const nomType = (nom?.type || nom?.addresstype || '').toLowerCase();
      const addr = nom?.address ?? {};
      const snapLat = nom?.lat ? Number(nom.lat) : NaN;
      const snapLon = nom?.lon ? Number(nom.lon) : NaN;
      const snapDistM =
        Number.isFinite(snapLat) && Number.isFinite(snapLon)
          ? haversineMeters(lat, lon, snapLat, snapLon)
          : 9999;

      const parts = [
        addr.village || addr.town || addr.suburb || addr.hamlet || addr.city,
        addr.county || addr.state_district || addr.district,
        addr.state,
      ].filter(Boolean);
      const placeLabel =
        parts.length > 0
          ? parts.slice(0, 3).join(', ')
          : nom?.display_name?.split(',').slice(0, 3).join(', ') ||
            `Field (${lat.toFixed(3)}°, ${lon.toFixed(3)}°)`;

      // 1. Direct road/highway click check (strict proximity so nearby farm fields 80m away are not blocked)
      if (nomCat === 'highway' && (snapDistM <= 26 || s2Class === '7')) {
        const roadName = nom?.name || addr.road || nomType || 'Roadway';
        res.json({
          allowed: false,
          kind: 'road',
          title: 'Road / Transport Corridor Selected',
          detail: `Pin landed on "${roadName}". KinField simulates crops on farm fields — please tap a green highlighted farm plot instead.`,
          label: placeLabel,
        });
        return;
      }

      // 2. Water bodies (Sentinel-2 Water class 1 or OSM waterway within 35m)
      if (
        s2Class === '1' ||
        ((nomCat === 'waterway' || ['water', 'river', 'canal', 'reservoir'].includes(nomType)) &&
          snapDistM <= 35)
      ) {
        const waterName =
          nomCat === 'waterway' && nom?.name
            ? nom.name
            : ['water', 'river', 'canal', 'reservoir'].includes(nomType)
            ? nomType
            : 'Surface Water / River (Sentinel-2 10m)';
        res.json({
          allowed: false,
          kind: 'water',
          title: 'Water Body Selected',
          detail: `Detected "${waterName}" at this location. Please place your pin on cultivated agricultural land.`,
          label: placeLabel,
        });
        return;
      }

      // 3. Built-up / Buildings / Houses / Commercial Zones (Sentinel-2 Built Area class 7 or OSM building)
      const isUrbanOsm =
        [
          'building',
          'amenity',
          'shop',
          'office',
          'tourism',
          'aeroway',
          'railway',
          'leisure',
        ].includes(nomCat) ||
        [
          'residential',
          'commercial',
          'industrial',
          'retail',
          'apartments',
          'house',
          'school',
          'hospital',
          'mall',
          'university',
        ].includes(nomType) ||
        Boolean(addr.house_number);

      if (s2Class === '7' || (isUrbanOsm && snapDistM <= 45)) {
        const areaName = nom?.name || addr.road || addr.suburb || 'Built-Up / Residential Zone';
        res.json({
          allowed: false,
          kind: 'building',
          title: 'Building or Built-Up Area Selected',
          detail: `Detected "${areaName}" (urban/structure footprint). Crop simulations require agricultural soil — snap to a nearby green farm field.`,
          label: placeLabel,
        });
        return;
      }

      // 4. Verified agricultural cropland (Sentinel-2 Crops class 5 or OSM farmland)
      if (
        s2Class === '5' ||
        (nomCat === 'landuse' &&
          ['farmland', 'farm', 'orchard', 'vineyard', 'meadow', 'allotments'].includes(nomType))
      ) {
        res.json({
          allowed: true,
          kind: 'farmland',
          title: 'Verified Agricultural Cropland',
          detail: 'Active cropland detected (Sentinel-2 10m Land Cover) — ready for 20-year crop simulation.',
          label: placeLabel,
        });
        return;
      }

      // 5. Open rural land without built-up, road, or water obstruction
      res.json({
        allowed: true,
        kind: 'rural',
        title: 'Rural Arable Area',
        detail: 'No roads, buildings, or water obstructions detected at this coordinate.',
        label: placeLabel,
      });
    } catch {
      res.json({
        allowed: true,
        kind: 'rural',
        title: 'Field Coordinate',
        detail: 'Land-use lookup timed out; proceeding with NASA soil & climate analysis.',
        label: `Field (${lat.toFixed(3)}°, ${lon.toFixed(3)}°)`,
      });
    } finally {
      clearTimeout(timer);
    }
  });

  app.post(['/api/analyze', '/analyze'], async (req, res) => {
    try {
      const body = req.body as Partial<AnalyzeRequest>;
      const lat = Number(body.lat);
      const lon = Number(body.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -60 || lat > 60 || lon < -180 || lon > 180) {
        res.status(400).json({ error: 'Valid latitude (-60..60) and longitude (-180..180) are required.' });
        return;
      }

      const payload: AnalyzeRequest = {
        lat,
        lon,
        current_crop: body.current_crop || 'wheat',
        priorities: Array.isArray(body.priorities) && body.priorities.length > 0 ? body.priorities : ['water', 'reliability'],
        irrigation: body.irrigation || 'some',
        equipment: body.equipment || 'standard',
        field_area_ha: typeof body.field_area_ha === 'number' ? body.field_area_ha : null,
        lang: body.lang || 'en',
      };

      const weather = await getWeatherSeries(lat, lon);
      const soil = await getSoilProfile(lat, lon, weather.soil_fallback);
      const result = runBacktestAnalysis(payload, weather, soil, 1.0, 0.0);
      res.json(result);
    } catch (err) {
      console.error('Analyze error:', err);
      res.status(500).json({ error: 'Failed to run 20-year rotation backtest.' });
    }
  });

  app.post(['/api/scenario', '/scenario'], async (req, res) => {
    try {
      const body = req.body as Partial<ScenarioRequest>;
      const lat = Number(body.lat);
      const lon = Number(body.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        res.status(400).json({ error: 'Valid latitude and longitude are required.' });
        return;
      }

      const rainMult = Math.max(0.7, Math.min(1.3, Number(body.rain_mult ?? 1.0)));
      const tempDelta = Math.max(0.0, Math.min(3.0, Number(body.temp_delta ?? 0.0)));

      const payload: AnalyzeRequest = {
        lat,
        lon,
        current_crop: body.current_crop || 'wheat',
        priorities: Array.isArray(body.priorities) && body.priorities.length > 0 ? body.priorities : ['water', 'reliability'],
        irrigation: body.irrigation || 'some',
        equipment: body.equipment || 'standard',
        field_area_ha: typeof body.field_area_ha === 'number' ? body.field_area_ha : null,
        lang: body.lang || 'en',
      };

      const weather = await getWeatherSeries(lat, lon);
      const soil = await getSoilProfile(lat, lon, weather.soil_fallback);
      const result = runBacktestAnalysis(payload, weather, soil, rainMult, tempDelta);
      res.json(result);
    } catch (err) {
      console.error('Scenario error:', err);
      res.status(500).json({ error: 'Failed to run climate scenario simulation.' });
    }
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KinField server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
