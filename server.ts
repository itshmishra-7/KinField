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
