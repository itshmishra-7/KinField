# KinField — Adapting Farms with NASA Data

**Geospatial Crop Rotation Intelligence & 20-Year Climate Backtesting**  
Built for **NASA Space Apps Challenge · Field Shift: Adapting Farms with NASA Data**

KinField is a deterministic, transparent agricultural decision-support platform. Rather than offering opaque black-box predictions, KinField simulates **20 years (2005–2024) of real daily NASA POWER agroclimatology** across 3 tailored crop rotation strategies on an interactive dark satellite map powered by **NASA GIBS WMTS** imagery.

---

## Core Features

### 1. Interactive Dark Satellite Geospatial Workspace
- **Dark-Graded High-Resolution Satellite Basemap**: Keyless `Esri World Imagery` styled for low-glare field inspection, layered with `World_Transportation` roads and `World_Boundaries_and_Places` white district/village labels. Switchable between **Dark Sat**, **True Sat**, and **Vector**.
- **Live NASA GIBS WMTS Overlays**:
  - **MODIS True Color** (`MODIS_Terra_CorrectedReflectance_TrueColor`, 250 m)
  - **SMAP Soil Moisture** (`SMAP_L4_Analyzed_Root_Zone_Soil_Moisture`, ~9 km) with calibrated colorbar legend
  - **GPM Precipitation** (`IMERG_Precipitation_Rate`, ~10 km) with rainfall intensity legend
- **Seasonal Timeline Scrubber**: Inspect seasonal transitions across dates (`Aug · Monsoon Peak`, `Oct · Post-Monsoon`, `Mar · Rabi Grain-Fill`, `May · Bare Soil`, or any custom date).
- **Field Selection Tools**:
  - **Search**: Find any village, tehsil, district, pincode, or `lat, lon` via OpenStreetMap Nominatim (`/api/geocode`).
  - **My Location (GPS)**: Center directly on the user's field at plot-level zoom (`z=15`) with reverse-geocoded place names (`/api/reverse-geocode`).
  - **Pin Field & Draw Field Boundary**: Click corners around a field (with Undo) to compute geodesic area in **hectares (`ha`)** and **acres (`ac`)**.

### 2. Deterministic 20-Year Crop Rotation Engine
- **Reference Evapotranspiration ($ET_0$)**: Daily Hargreaves–Samani calibrated with NASA POWER CERES surface shortwave irradiance (`ALLSKY_SFC_SW_DWN`).
- **FAO-56 Crop Coefficients ($K_c$) & Root-Zone Soil-Water Bucket**: 4-stage `Kc` curves, root-depth-scaled available water capacity (`AWC`), paddy percolation losses, and 3 irrigation regimes (`Rainfed`, `Limited`, `Full`).
- **Biophysical Failure Triggers**: Evaluates daily `T2M_MAX` and `T2M_MIN` specifically inside each crop's flowering/grain-fill window, alongside seasonal water satisfaction and groundwater overdraft thresholds.
- **3 Ranked Strategies**: Always compares **Current Practice** against **2 priority-aligned alternatives** (`Save Water`, `Income`, `Soil Health`, `Stability`).
- **Interactive Year Replay & What-If Sliders**: Click any bar in the 2005–2024 strip to inspect that year's exact rainfall, water satisfaction %, flowering peak temperature, and `GWETROOT` anomaly; adjust **Rainfall (`±30%`)** and **Warming (`+0–3°C`)** sliders to re-rank strategies live.

---

## NASA & Earth Observation Data Provenance

| Dataset / Service | Variables / Layer | Resolution | Role in KinField |
|---|---|---|---|
| **NASA POWER Daily Agroclimatology** | `T2M`, `T2M_MAX`, `T2M_MIN`, `PRECTOTCORR`, `GWETROOT`, `ALLSKY_SFC_SW_DWN` | `0.5° × 0.625°` (~50 km), daily (2005–2024) | **Live Model Input** — Drives daily ET0, soil-water balance, flowering heat & frost checks |
| **ISRIC SoilGrids v2.0 + Regional AWC** | `clay`, `sand`, `soc`, `AWC` | `250 m` (1.5s live REST) / Regional fallback | **Live Model Input** — Sets root-zone water bucket capacity (`mm/m`) |
| **NASA GIBS MODIS Terra** | `MODIS_Terra_CorrectedReflectance_TrueColor` | `250 m` | **Map Context Layer** — Visual canopy green-up and bare-soil inspection |
| **NASA GIBS SMAP L4** | `SMAP_L4_Analyzed_Root_Zone_Soil_Moisture` | `~9 km` | **Map Context Layer** — Regional root-zone moisture gradients |
| **NASA GIBS GPM IMERG** | `IMERG_Precipitation_Rate` | `~10 km` | **Map Context Layer** — Satellite precipitation swaths |

> **Pre-Seeded Real NASA POWER Datasets**: Real 2005–2024 daily series (7,305 days each) are cached in `data/cache_seed/` for **Hisar (Haryana)**, **Ludhiana (Punjab)**, and **Aurangabad (Maharashtra)**. Any other global coordinate queries `power.larc.nasa.gov` live with `0.25°` grid caching.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Leaflet, Motion (`motion/react`), Lucide Icons
- **Backend**: Node.js 22, Express, `tsx` (serves both API routes and Vite/static frontend on a single port)
- **Data & Config**: JSON agronomic crop database (`data/crops.json`), soil AWC lookup (`data/soil_awc.json`), provenance spec (`data/provenance.json`)
- **Deployment**: `Dockerfile` (Cloud Run / Railway / Fly.io) and `render.yaml` (Render)

---

## Project Structure

```text
kinfield/
├── data/
│   ├── crops.json              # 12 crops: FAO-56 Kc, root depth, heat/frost limits, N-fixation, MSP
│   ├── soil_awc.json           # Regional soil texture & AWC fallback profiles
│   ├── provenance.json         # Honest dataset inventory & limitations
│   └── cache_seed/             # Real 2005-2024 NASA POWER daily JSONs (Hisar, Ludhiana, Aurangabad)
├── docs/
│   └── PROVENANCE.md           # Scientific methodology & uncertainty documentation
├── server/
│   ├── types.ts                # Shared backend TypeScript contracts
│   ├── weather.ts              # NASA POWER client, cache, ISRIC SoilGrids & DEM fallback
│   └── engine.ts               # Deterministic FAO-56 / Hargreaves-Samani 20-year engine
├── src/
│   ├── components/
│   │   ├── HomeScreen.tsx      # Centered dark hero with orbital farmland imagery
│   │   ├── MapWorkspace.tsx    # Leaflet map, NASA GIBS layers, search, GPS, polygon & setup sheet
│   │   ├── ResultsSheet.tsx    # 3-strategy comparison, 20-year replay strips & What-If sliders
│   │   └── ProvenanceModal.tsx # Tabbed Data Provenance, Conditions & Rotation Science guide
│   ├── App.tsx
│   ├── index.css
│   └── types.ts
├── server.ts                   # Express + Vite full-stack entry point (port 3000)
├── Dockerfile
├── render.yaml
└── package.json
```

---

## Local Development

**Prerequisites:** Node.js `>=20` and npm.

```bash
# 1. Install dependencies
npm install

# 2. Start full-stack dev server (Express API + Vite frontend on port 3000)
npm run dev
```

Open `http://localhost:3000` in your browser.

### Production Build & Type Check

```bash
npm run lint    # TypeScript check (tsc --noEmit)
npm run build   # Vite production bundle -> dist/
npm start       # Serves API + dist/ via Express on port 3000
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health check |
| `GET` | `/api/provenance` | Dataset inventory, spatial resolution, and KVK disclaimer |
| `GET` | `/api/presets` | Pre-seeded benchmark agricultural districts |
| `GET` | `/api/geocode?q=...` | Village/district/coordinate search via Nominatim |
| `GET` | `/api/reverse-geocode?lat=...&lon=...` | Reverse-geocode coordinates to local place name |
| `POST` | `/api/analyze` | Run 20-year crop rotation simulation |
| `POST` | `/api/scenario` | Re-run simulation with `rain_mult` (`0.7–1.3`) and `temp_delta` (`0–3°C`) |

---

## Deployment

### Option A: Render (`render.yaml` included)
1. Push this repository to GitHub.
2. In Render, choose **New → Blueprint** (or **New Web Service**) and connect the GitHub repo.
3. Build Command: `npm install && npm run build` · Start Command: `npm start` · Port: `3000`.

### Option B: Google Cloud Run / Docker (`Dockerfile` included)
```bash
gcloud run deploy kinfield \
  --source . \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated \
  --port 3000
```

---

## Disclaimer

KinField supports farmers and **Krishi Vigyan Kendra (KVK)** agronomists with historical satellite-reanalysis climate odds. It does **not** replace field soil testing, groundwater/canal availability checks, or local extension expertise.
