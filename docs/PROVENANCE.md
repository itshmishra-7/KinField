# KinField Data Provenance & Scientific Transparency

## 1. What Drives the Water-Balance Model (Live Inputs)

| Dataset | Variables | Resolution | Role | Limitations |
|---|---|---|---|---|
| **NASA POWER Daily Agroclimatology** | `T2M`, `T2M_MAX`, `T2M_MIN`, `PRECTOTCORR`, `GWETROOT`, `ALLSKY_SFC_SW_DWN` | `0.5° × 0.625°` (~50 km) | Daily `ET0`, precipitation infiltration, flowering heatwaves, frost nights, and root-zone moisture anomaly (`GWETROOT`) | Grid averages smooth localized hailstorms, village microclimates, and canal seepage |
| **ISRIC SoilGrids v2.0 + Regional AWC Lookup** | `clay`, `sand`, `soc`, `AWC` | `250 m` (live 2.2s timeout) / regional agro-ecological lookup | Sets soil root-zone water bucket capacity (`mm/m`) | Cannot detect local subsoil hardpan compaction, salinity patches, or recent farmyard manure |

## 2. What Is Visualized on the Map (Context Only)

- **NASA GIBS `MODIS_Terra_CorrectedReflectance_TrueColor`** (`250 m`): Visual inspection of seasonal green-up and bare-field periods.
- **NASA GIBS `SMAP_L4_Analyzed_Root_Zone_Soil_Moisture`** (`~9 km`): Visual inspection of regional root-zone soil moisture gradients. **Not** ingested into the per-field water balance (which uses NASA POWER `GWETROOT` + FAO-56 bucket).
- **NASA GIBS `IMERG_Precipitation_Rate`** (`~10 km`): Visual inspection of satellite-estimated rainfall swaths.

## 3. Confidence Grading

- **HIGH**: Real 2005–2024 NASA POWER daily weather + live ISRIC SoilGrids v2.0 soil profile.
- **MED**: Real 2005–2024 NASA POWER daily weather + documented regional soil AWC lookup.
- **LOW**: Offline/timeout synthetic climate fallback (clearly flagged in UI).

## 4. Human-in-the-Loop & KVK Disclaimer

KinField supports **farmers** and **Krishi Vigyan Kendra (KVK)** extension officers by quantifying 20-year historical climate odds. It **never replaces** local soil testing, borewell/canal water availability checks, pest scouting, or village-level agronomic judgment.
