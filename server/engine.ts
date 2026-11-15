import fs from 'node:fs';
import path from 'node:path';
import type {
  AnalyzeRequest,
  AnalyzeResponse,
  ConfidenceLevel,
  CropId,
  EquipmentConstraint,
  IrrigationLevel,
  PriorityId,
  RotationStrategyResult,
  SoilProfile,
  StrategyStatus,
  WeatherDataset,
  WeatherDay,
  YearBacktest,
  YearStatus,
} from './types.js';

interface CropDef {
  id: CropId;
  name_en: string;
  name_hi: string;
  season: 'kharif' | 'rabi' | 'zaid';
  sowing_doy: number;
  duration_days: number;
  kc_init: number;
  kc_mid: number;
  kc_end: number;
  stage_fracs: [number, number, number, number];
  root_depth_m: number;
  water_stress_fail_ratio: number;
  flowering_window_frac: [number, number];
  heat_fail_tmax_c: number;
  heat_fail_days: number;
  frost_fail_tmin_c: number;
  frost_fail_days: number;
  nitrogen_effect: number;
  organic_matter_delta: number;
  pest_group: string;
  erosion_protection: number;
  forage_potential: string;
  msp_inr_qtl: number;
  income_index_base: number;
  role_tags: string[];
  agronomic_note_en: string;
}

interface RotationTemplate {
  id: string;
  name_en: string;
  name_hi: string;
  crops: CropId[];
  tags: PriorityId[];
  why_en: string;
  equipment_fit: EquipmentConstraint[];
}

const CROPS_PATH = path.join(process.cwd(), 'data', 'crops.json');
let cachedCrops: Record<CropId, CropDef> | null = null;

function getCrops(): Record<CropId, CropDef> {
  if (cachedCrops) return cachedCrops;
  const raw = JSON.parse(fs.readFileSync(CROPS_PATH, 'utf-8')) as {
    crops: Record<CropId, CropDef>;
  };
  cachedCrops = raw.crops;
  return cachedCrops;
}

const CURRENT_PRACTICE_MAP: Record<CropId, { name_en: string; name_hi: string; crops: CropId[] }> = {
  wheat: {
    name_en: 'Rice → Wheat (Conventional Continuous)',
    name_hi: 'धान → गेहूं (पारंपरिक चक्र)',
    crops: ['rice', 'wheat'],
  },
  rice: {
    name_en: 'Rice → Wheat (Intensive Cereal)',
    name_hi: 'धान → गेहूं (सघन अनाज)',
    crops: ['rice', 'wheat'],
  },
  maize: {
    name_en: 'Maize → Wheat (Conventional)',
    name_hi: 'मक्का → गेहूं (पारंपरिक)',
    crops: ['maize', 'wheat'],
  },
  chickpea: {
    name_en: 'Sorghum → Chickpea (Baseline)',
    name_hi: 'ज्वार → चना (वर्तमान)',
    crops: ['sorghum', 'chickpea'],
  },
  mustard: {
    name_en: 'Fallow → Mustard (Baseline)',
    name_hi: 'परती → सरसों (वर्तमान)',
    crops: ['fallow', 'mustard'],
  },
  moong: {
    name_en: 'Maize → Wheat → Moong',
    name_hi: 'मक्का → गेहूं → मूंग',
    crops: ['maize', 'wheat', 'moong'],
  },
  sorghum: {
    name_en: 'Sorghum → Fallow (Baseline)',
    name_hi: 'ज्वार → परती (वर्तमान)',
    crops: ['sorghum', 'fallow'],
  },
  cotton: {
    name_en: 'Cotton → Fallow (Continuous Cash)',
    name_hi: 'कपास → परती (एकल फसल)',
    crops: ['cotton', 'fallow'],
  },
  soybean: {
    name_en: 'Soybean → Wheat (Baseline)',
    name_hi: 'सोयाबीन → गेहूं (वर्तमान)',
    crops: ['soybean', 'wheat'],
  },
  groundnut: {
    name_en: 'Groundnut → Wheat (Baseline)',
    name_hi: 'मूंगफली → गेहूं (वर्तमान)',
    crops: ['groundnut', 'wheat'],
  },
  cover_crop: {
    name_en: 'Maize → Wheat + Cover Crop',
    name_hi: 'मक्का → गेहूं + हरी खाद',
    crops: ['maize', 'wheat', 'cover_crop'],
  },
  fallow: {
    name_en: 'Sorghum → Mustard (Low-Input Baseline)',
    name_hi: 'ज्वार → सरसों',
    crops: ['sorghum', 'mustard'],
  },
};

const ALTERNATIVE_CATALOG: RotationTemplate[] = [
  {
    id: 'sorghum_chickpea',
    name_en: 'Sorghum → Chickpea (Drought-Hardy)',
    name_hi: 'ज्वार → चना (सूखा-सहिष्णु)',
    crops: ['sorghum', 'chickpea'],
    tags: ['water', 'reliability', 'soil'],
    why_en: 'Replaces water-heavy crops with drought-hardy Sorghum and deep-rooting N-fixing Chickpea that mines residual subsoil moisture.',
    equipment_fit: ['standard', 'forage_priority', 'no_till'],
  },
  {
    id: 'maize_mustard_moong',
    name_en: 'Maize → Mustard + Summer Moong',
    name_hi: 'मक्का → सरसों + ग्रीष्म मूंग',
    crops: ['maize', 'mustard', 'moong'],
    tags: ['water', 'income', 'reliability'],
    why_en: 'Cuts Kharif water demand by ~45% vs paddy while Mustard captures high oilseed MSP and Moong rebuilds soil nitrogen.',
    equipment_fit: ['standard', 'forage_priority'],
  },
  {
    id: 'soybean_wheat_cover',
    name_en: 'Soybean → Wheat + Sesbania Cover',
    name_hi: 'सोयाबीन → गेहूं + ढैंचा हरी खाद',
    crops: ['soybean', 'wheat', 'cover_crop'],
    tags: ['soil', 'income'],
    why_en: 'Breaks cereal pest cycles with N-fixing Soybean and adds pre-monsoon Sesbania mulch to raise organic carbon.',
    equipment_fit: ['standard', 'no_till'],
  },
  {
    id: 'groundnut_mustard',
    name_en: 'Groundnut → Mustard (Low-Water Oilseed)',
    name_hi: 'मूंगफली → सरसों (कम पानी तिलहन)',
    crops: ['groundnut', 'mustard'],
    tags: ['water', 'income', 'soil'],
    why_en: 'Dual oilseed-legume pair tailored to sandy-loam/semi-arid soils; fixes nitrogen and earns strong MSP with minimal tubewell pumping.',
    equipment_fit: ['standard', 'forage_priority'],
  },
  {
    id: 'maize_wheat_moong',
    name_en: 'Maize → Wheat + Moong (Diversified)',
    name_hi: 'मक्का → गेहूं + मूंग (विविध चक्र)',
    crops: ['maize', 'wheat', 'moong'],
    tags: ['income', 'soil', 'water'],
    why_en: 'Keeps Wheat in Rabi while substituting paddy with Maize and adding a 65-day nitrogen-fixing Moong pulse.',
    equipment_fit: ['standard', 'no_till', 'forage_priority'],
  },
  {
    id: 'soybean_chickpea',
    name_en: 'Soybean → Chickpea (Rainfed Pulse-Oilseed)',
    name_hi: 'सोयाबीन → चना (वर्षा आधारित दलहन)',
    crops: ['soybean', 'chickpea'],
    tags: ['water', 'reliability', 'soil'],
    why_en: 'Deep-rooting Chickpea thrives on residual monsoon soil moisture stored under Soybean canopy, ideal when irrigation is absent.',
    equipment_fit: ['standard', 'no_till'],
  },
  {
    id: 'cotton_mustard',
    name_en: 'Cotton → Mustard (Pest-Break Cash)',
    name_hi: 'कपास → सरसों (कीट-रोधी नकदी चक्र)',
    crops: ['cotton', 'mustard'],
    tags: ['income', 'reliability'],
    why_en: 'Replaces winter fallow after Cotton with low-water Mustard, adding a second cash harvest and breaking bollworm carryover.',
    equipment_fit: ['standard'],
  },
  {
    id: 'sorghum_mustard_cover',
    name_en: 'Sorghum → Mustard + Cover Mulch',
    name_hi: 'ज्वार → सरसों + आवरण मल्च',
    crops: ['sorghum', 'mustard', 'cover_crop'],
    tags: ['reliability', 'water', 'soil'],
    why_en: 'Built for heat-stressed semi-arid zones: deep roots, high fodder yield, and summer cover protection against wind erosion.',
    equipment_fit: ['standard', 'no_till', 'forage_priority'],
  },
];

export function computeExtraterrestrialRadiation(latDeg: number, doy: number): number {
  const phi = (latDeg * Math.PI) / 180;
  const dr = 1 + 0.033 * Math.cos(((2 * Math.PI) / 365) * doy);
  const delta = 0.409 * Math.sin(((2 * Math.PI) / 365) * doy - 1.39);
  const tanProduct = Math.max(-0.999, Math.min(0.999, -Math.tan(phi) * Math.tan(delta)));
  const ws = Math.acos(tanProduct);
  const Gsc = 0.082;
  const ra =
    ((24 * 60) / Math.PI) *
    Gsc *
    dr *
    (ws * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(ws));
  return Math.max(4, ra);
}

export function computeDailyET0(day: WeatherDay, latDeg: number, doy: number, tempDelta: number): number {
  const tMean = day.t + tempDelta;
  const tMax = day.tx + tempDelta;
  const tMin = day.tn + tempDelta;
  const tRange = Math.max(0.5, tMax - tMin);
  const ra = computeExtraterrestrialRadiation(latDeg, doy);
  const et0Hargreaves = 0.0023 * 0.408 * ra * (tMean + 17.8) * Math.sqrt(tRange);

  if (day.sw !== null && day.sw > 0) {
    const et0Rad = 0.408 * (0.58 * day.sw) * Math.max(0.25, (tMean + 6) / (tMean + 26));
    return Math.max(0.5, Math.min(11.5, 0.72 * et0Hargreaves + 0.28 * et0Rad));
  }
  return Math.max(0.5, Math.min(11.5, et0Hargreaves));
}

export function getDailyKc(crop: CropDef, dayIndex: number): number {
  const dur = crop.duration_days;
  const [fInit, fDev, fMid] = crop.stage_fracs;
  const d1 = Math.round(dur * fInit);
  const d2 = d1 + Math.round(dur * fDev);
  const d3 = d2 + Math.round(dur * fMid);

  if (dayIndex <= d1) return crop.kc_init;
  if (dayIndex <= d2) {
    const frac = (dayIndex - d1) / Math.max(1, d2 - d1);
    return crop.kc_init + frac * (crop.kc_mid - crop.kc_init);
  }
  if (dayIndex <= d3) return crop.kc_mid;
  const frac = (dayIndex - d3) / Math.max(1, dur - d3);
  return Math.max(crop.kc_end, crop.kc_mid - frac * (crop.kc_mid - crop.kc_end));
}

function doyFromDateStr(dateStr: string): number {
  const y = Number(dateStr.slice(0, 4));
  const m = Number(dateStr.slice(4, 6)) - 1;
  const d = Number(dateStr.slice(6, 8));
  const dt = Date.UTC(y, m, d);
  const start = Date.UTC(y, 0, 1);
  return Math.floor((dt - start) / 86400000) + 1;
}

function buildDateIndex(days: WeatherDay[]): Map<string, WeatherDay> {
  const map = new Map<string, WeatherDay>();
  for (const day of days) {
    map.set(day.d, day);
  }
  return map;
}

function getDayAtOffset(
  dateIndex: Map<string, WeatherDay>,
  year: number,
  sowingDoy: number,
  offset: number
): { day: WeatherDay; doy: number } | null {
  const baseMs = Date.UTC(year, 0, 1) + (sowingDoy - 1 + offset) * 86400000;
  const dt = new Date(baseMs);
  let y = dt.getUTCFullYear();
  if (y > 2024) y = 2024; // wrap final rabi tail to available 2024 record
  if (y < 2005) y = 2005;
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  const key = `${y}${m}${d}`;
  const found = dateIndex.get(key) ?? dateIndex.get(`${y}${m}28`);
  if (!found) return null;
  return { day: found, doy: doyFromDateStr(found.d) };
}

function computeClimatologyGwet(days: WeatherDay[]): Map<number, number> {
  const sums = new Map<number, { sum: number; count: number }>();
  for (const day of days) {
    if (day.gw === null) continue;
    const doy = doyFromDateStr(day.d);
    const cur = sums.get(doy) ?? { sum: 0, count: 0 };
    cur.sum += day.gw;
    cur.count += 1;
    sums.set(doy, cur);
  }
  const meanMap = new Map<number, number>();
  for (const [doy, val] of sums.entries()) {
    meanMap.set(doy, val.sum / val.count);
  }
  return meanMap;
}

function simulateRotationYear(
  year: number,
  dateIndex: Map<string, WeatherDay>,
  gwetClim: Map<number, number>,
  cropsDb: Record<CropId, CropDef>,
  rotationCrops: CropId[],
  lat: number,
  soilAwcPerM: number,
  irrigation: IrrigationLevel,
  rainMult: number,
  tempDelta: number
): YearBacktest {
  let totalRain = 0;
  let totalEt0 = 0;
  let totalEta = 0;
  let totalEtc = 0;
  let totalIrrigation = 0;
  let maxFloweringTemp = -50;
  let minSeasonTemp = 60;
  let gwetAnomSum = 0;
  let gwetAnomCount = 0;

  const triggers: string[] = [];
  let severeFailures = 0;
  let moderateStress = 0;

  // Carry over moisture fraction across seasons within the agricultural year
  let carryoverFrac = 0.55;

  for (const cropId of rotationCrops) {
    const crop = cropsDb[cropId];
    const bucketCap = Math.max(45, soilAwcPerM * crop.root_depth_m);
    let soilWater = carryoverFrac * bucketCap;
    let cropEtc = 0;
    let cropEta = 0;
    let cropIrrig = 0;
    let irrigEvents = 0;
    let hotFloweringDays = 0;
    let frostDays = 0;

    const flStart = Math.floor(crop.duration_days * crop.flowering_window_frac[0]);
    const flEnd = Math.floor(crop.duration_days * crop.flowering_window_frac[1]);
    const irrigAllowance =
      irrigation === 'none' ? 0 : irrigation === 'some' ? 180 : cropId === 'rice' ? 920 : 620;

    for (let i = 0; i < crop.duration_days; i++) {
      const rec = getDayAtOffset(dateIndex, year, crop.sowing_doy, i);
      if (!rec) continue;
      const { day, doy } = rec;

      const et0 = computeDailyET0(day, lat, doy, tempDelta);
      const kc = getDailyKc(crop, i);
      const etc = et0 * kc;

      const effRain = Math.min(day.p * rainMult * 0.88, bucketCap * 0.45);
      soilWater = Math.min(bucketCap, soilWater + effRain);

      // Supplemental or full irrigation scheduling
      if (irrigation === 'some' && irrigEvents < 3 && cropId !== 'fallow' && cropId !== 'cover_crop') {
        if (soilWater < 0.34 * bucketCap && cropIrrig + 60 <= irrigAllowance) {
          soilWater = Math.min(bucketCap * 0.82, soilWater + 60);
          cropIrrig += 60;
          irrigEvents += 1;
        }
      } else if (irrigation === 'full' && cropId !== 'fallow' && cropId !== 'cover_crop') {
        const triggerFrac = cropId === 'rice' ? 0.68 : 0.46;
        if (soilWater < triggerFrac * bucketCap && cropIrrig < irrigAllowance) {
          const add = Math.min(bucketCap * 0.88 - soilWater, irrigAllowance - cropIrrig);
          if (add > 0) {
            soilWater += add;
            cropIrrig += add;
          }
        }
      }

      const raw = 0.5 * bucketCap;
      const threshold = bucketCap - raw;
      const ks = soilWater >= threshold ? 1.0 : Math.max(0.06, soilWater / Math.max(1, threshold));
      const eta = Math.min(soilWater, etc * ks);
      const percolation = cropId === 'rice' ? 3.2 : 0;
      soilWater = Math.max(0, soilWater - eta - percolation);

      totalRain += day.p * rainMult;
      totalEt0 += et0;
      cropEtc += etc;
      cropEta += eta;

      const tmaxAdj = day.tx + tempDelta;
      const tminAdj = day.tn + tempDelta;
      if (tminAdj < minSeasonTemp) minSeasonTemp = tminAdj;

      if (i >= flStart && i <= flEnd) {
        if (tmaxAdj > maxFloweringTemp) maxFloweringTemp = tmaxAdj;
        if (tmaxAdj >= crop.heat_fail_tmax_c) hotFloweringDays += 1;
      }
      if (tminAdj <= crop.frost_fail_tmin_c) frostDays += 1;

      if (day.gw !== null) {
        const clim = gwetClim.get(doy);
        if (clim !== undefined) {
          gwetAnomSum += day.gw - clim;
          gwetAnomCount += 1;
        }
      }
    }

    carryoverFrac = Math.max(0.2, Math.min(0.85, soilWater / bucketCap));
    totalEta += cropEta;
    totalEtc += cropEtc;
    totalIrrigation += cropIrrig;

    const waterSat = cropEtc > 0 ? cropEta / cropEtc : 1.0;

    if (cropId !== 'fallow' && cropId !== 'cover_crop') {
      if (waterSat < crop.water_stress_fail_ratio) {
        severeFailures += 1;
        triggers.push(`${crop.name_en}: severe water deficit (${Math.round(waterSat * 100)}% met)`);
      } else if (waterSat < crop.water_stress_fail_ratio + 0.09) {
        moderateStress += 1;
        triggers.push(`${crop.name_en}: moderate moisture stress`);
      }

      if (hotFloweringDays >= crop.heat_fail_days) {
        severeFailures += 1;
        triggers.push(
          `${crop.name_en}: ${hotFloweringDays} flowering days ≥ ${crop.heat_fail_tmax_c}°C`
        );
      } else if (hotFloweringDays >= Math.max(2, crop.heat_fail_days - 2)) {
        moderateStress += 1;
        triggers.push(`${crop.name_en}: heat near flowering threshold`);
      }

      if (frostDays >= crop.frost_fail_days) {
        severeFailures += 1;
        triggers.push(`${crop.name_en}: ${frostDays} frost nights ≤ ${crop.frost_fail_tmin_c}°C`);
      }
    }
  }

  // Flag unsustainable groundwater pumping when irrigation > 780 mm/yr in dry/semi-arid context
  if (irrigation === 'full' && totalIrrigation > 780 && totalRain < 850) {
    severeFailures += 1;
    triggers.push(`Groundwater overdraft: ${Math.round(totalIrrigation)} mm pumped vs ${Math.round(totalRain)} mm rain`);
  }

  let status: YearStatus = 'GOOD';
  if (severeFailures > 0) status = 'FAILED';
  else if (moderateStress > 0) status = 'MODERATE';

  const waterDeficit = Math.max(0, totalEtc - totalEta);
  const waterSatPct = totalEtc > 0 ? Math.min(100, Math.round((totalEta / totalEtc) * 100)) : 100;
  const gwetAnom = gwetAnomCount > 0 ? Number((gwetAnomSum / gwetAnomCount).toFixed(3)) : null;

  return {
    year,
    status,
    safe: status !== 'FAILED',
    rain_mm: Math.round(totalRain),
    et0_mm: Math.round(totalEt0),
    water_use_mm: Math.round(totalEta),
    irrigation_mm: Math.round(totalIrrigation),
    water_deficit_mm: Math.round(waterDeficit),
    water_satisfaction_pct: waterSatPct,
    max_flowering_temp_c: Number((maxFloweringTemp > -40 ? maxFloweringTemp : 30).toFixed(1)),
    min_temp_c: Number((minSeasonTemp < 50 ? minSeasonTemp : 8).toFixed(1)),
    soil_moisture_anomaly: gwetAnom,
    triggers: triggers.length > 0 ? triggers : ['No critical water, heat, or frost stress tripped'],
    summary_note:
      status === 'GOOD'
        ? `Clean season: ${waterSatPct}% crop water met, peak flowering ${maxFloweringTemp.toFixed(1)}°C.`
        : status === 'MODERATE'
        ? `Mild stress (${triggers[0]}), yield buffered without full failure.`
        : `Failed: ${triggers[0]}.`,
  };
}

function selectAlternativeTemplates(
  currentCrops: CropId[],
  priorities: PriorityId[],
  irrigation: IrrigationLevel,
  equipment: EquipmentConstraint,
  lat: number
): RotationTemplate[] {
  const currentKey = currentCrops.join('_');
  const scored = ALTERNATIVE_CATALOG.filter((tpl) => {
    if (tpl.crops.join('_') === currentKey) return false;
    // Rainfed farms cannot sustain a 3rd summer Zaid crop without irrigation
    if (irrigation === 'none' && tpl.crops.includes('moong')) return false;
    return true;
  }).map((tpl) => {
    let score = 0;
    for (const p of priorities) {
      if (tpl.tags.includes(p)) score += 3;
    }
    if (tpl.equipment_fit.includes(equipment)) score += 2;
    if (irrigation === 'none' && tpl.tags.includes('water')) score += 3;
    if (irrigation === 'none' && tpl.crops.includes('rice')) score -= 10;
    if (lat < 23 && tpl.crops.includes('soybean')) score += 3;
    if (lat < 23 && tpl.crops.includes('cotton')) score += 2;
    if (lat > 27 && tpl.crops.includes('mustard')) score += 2;
    return { tpl, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return [scored[0].tpl, scored[1].tpl];
}

function evaluateStrategyMetrics(
  id: string,
  nameEn: string,
  nameHi: string,
  crops: CropId[],
  whyItFits: string,
  isCurrent: boolean,
  cropsDb: Record<CropId, CropDef>,
  years: YearBacktest[],
  priorities: PriorityId[],
  soil: SoilProfile,
  weatherSourceConfidence: ConfidenceLevel
): RotationStrategyResult {
  const safeYears = years.filter((y) => y.safe).length;
  const totalYears = years.length;
  const status: StrategyStatus = safeYears >= 16 ? 'green' : safeYears >= 11 ? 'yellow' : 'red';
  const statusLabelEn = status === 'green' ? 'Safe' : status === 'yellow' ? 'Watch' : 'High Risk';
  const statusLabelHi =
    status === 'green' ? 'सुरक्षित' : status === 'yellow' ? 'सावधान' : 'अधिक जोखिम';

  const avgWaterUse = Math.round(years.reduce((s, y) => s + y.water_use_mm, 0) / totalYears);
  const avgIrrig = Math.round(years.reduce((s, y) => s + y.irrigation_mm, 0) / totalYears);

  // Soil health score: nitrogen balance + organic matter + pest diversity + erosion protection
  const activeCrops = crops.map((c) => cropsDb[c]);
  const nBalance = activeCrops.reduce((s, c) => s + c.nitrogen_effect, 0);
  const omDelta = activeCrops.reduce((s, c) => s + c.organic_matter_delta, 0);
  const uniqueGroups = new Set(activeCrops.map((c) => c.pest_group).filter((g) => g !== 'fallow')).size;
  const avgErosion = Math.round(
    activeCrops.reduce((s, c) => s + c.erosion_protection, 0) / activeCrops.length
  );

  const soilScore = Math.max(
    18,
    Math.min(98, Math.round(52 + nBalance * 7 + omDelta * 45 + uniqueGroups * 6 + (avgErosion - 60) * 0.25))
  );

  // Income index: weighted sum of crop MSP proxy adjusted by safe-year survival rate
  const rawIncome = activeCrops.reduce((s, c) => s + c.income_index_base, 0);
  const survivalFactor = 0.55 + 0.45 * (safeYears / totalYears);
  const incomeIndex = Math.max(20, Math.min(98, Math.round((rawIncome / 1.75) * survivalFactor)));

  // Priority ranking score
  const waterScore = Math.max(10, Math.min(100, Math.round(100 - avgIrrig * 0.08 - avgWaterUse * 0.02)));
  const reliabilityScore = Math.round((safeYears / totalYears) * 100);

  let priorityScore = reliabilityScore * 0.4 + waterScore * 0.2 + soilScore * 0.2 + incomeIndex * 0.2;
  for (const p of priorities) {
    if (p === 'water') priorityScore += waterScore * 0.35;
    if (p === 'income') priorityScore += incomeIndex * 0.35;
    if (p === 'soil') priorityScore += soilScore * 0.35;
    if (p === 'reliability') priorityScore += reliabilityScore * 0.35;
  }

  // Extract concrete risks from actual failed/moderate years
  const failCount = years.filter((y) => !y.safe).length;
  const heatFails = years.filter((y) => y.triggers.some((t) => t.includes('°C'))).length;
  const waterFails = years.filter((y) => y.triggers.some((t) => t.includes('water deficit'))).length;
  const overdraftFails = years.filter((y) =>
    y.triggers.some((tr) => tr.includes('overdraft'))
  ).length;
  const frostFails = years.filter((y) => y.triggers.some((t) => t.includes('frost'))).length;

  const risks: string[] = [];
  if (waterFails > 0) {
    risks.push(`Water deficit tripped thresholds in ${waterFails} of ${totalYears} seasons.`);
  }
  if (heatFails > 0) {
    risks.push(`Flowering heat spikes exceeded critical crop canopy limit in ${heatFails} years.`);
  }
  if (overdraftFails > 0) {
    risks.push(`Irrigation demand (>780 mm/yr) exceeded sustainable local rainfall recharge in ${overdraftFails} years.`);
  }
  if (frostFails > 0) {
    risks.push(`Cold/frost nights threatened pod or seedling stage in ${frostFails} years.`);
  }
  if (uniqueGroups <= 1) {
    risks.push('Continuous single-family cereal cycle increases pest, weed, and micronutrient depletion risk.');
  }
  if (risks.length === 0) {
    risks.push('Minor mid-season dry spells remain possible; monitor local 7-day forecast before top-dressing.');
  }

  const gaps: string[] = [
    '50 km NASA POWER weather grid averages out isolated hailstorms or village-level microclimate.',
    `Soil bucket assumes ${soil.texture} (${soil.awc_mm_per_m} mm/m AWC); subsoil hardpan or salinity is not measured from space.`,
    'Income index uses national MSP proxy and does not reflect local mandi price swings or transport costs.',
  ];
  if (weatherSourceConfidence === 'LOW') {
    gaps.unshift('Using synthetic climate fallback because live NASA POWER query timed out.');
  }

  const nutrientLabel =
    nBalance >= 2
      ? `+${nBalance * 20} kg/ha bio-N credit`
      : nBalance === 0
      ? 'Balanced N demand'
      : `High N draw (${nBalance * 25} kg/ha)`;
  const pestLabel =
    uniqueGroups >= 3
      ? 'Strong (3-family rotation)'
      : uniqueGroups === 2
      ? 'Moderate (2-family break)'
      : 'Low (continuous host)';
  const forageList = activeCrops
    .map((c) => c.forage_potential)
    .filter((f) => f !== 'None');

  const summaryEn =
    failCount === 0
      ? `Cleared all ${totalYears} historical seasons with ~${avgIrrig} mm/yr supplemental water.`
      : `${safeYears} of ${totalYears} seasons safe; main vulnerability is ${
          overdraftFails >= waterFails && overdraftFails >= heatFails
            ? 'unsustainable pumping'
            : heatFails > waterFails
            ? 'flowering heatwaves'
            : 'monsoon/winter moisture deficits'
        }.`;

  const summaryHi = `${totalYears} में से ${safeYears} साल सुरक्षित · औसत सिंचाई आवश्यकता ~${avgIrrig} मिमी/वर्ष।`;

  return {
    id,
    name_en: nameEn,
    name_hi: nameHi,
    crops,
    crop_labels_en: activeCrops.map((c) => c.name_en),
    crop_labels_hi: activeCrops.map((c) => c.name_hi),
    is_current: isCurrent,
    is_best_match: false,
    rank: 1,
    safe_years: safeYears,
    total_years: totalYears,
    status,
    status_label_en: statusLabelEn,
    status_label_hi: statusLabelHi,
    water_use_mm: avgWaterUse,
    irrigation_need_mm: avgIrrig,
    soil_score: soilScore,
    income_index: incomeIndex,
    erosion_protection: avgErosion,
    nutrient_cycling_label: nutrientLabel,
    pest_disruption_label: pestLabel,
    forage_potential: forageList[0] ?? 'Low',
    priority_score: Number(priorityScore.toFixed(2)),
    summary_en: summaryEn,
    summary_hi: summaryHi,
    why_it_fits: whyItFits,
    risks,
    gaps,
    years,
  };
}

declare global {
  interface YearBacktestExtra {
    includes_overdraft?: () => boolean;
  }
}

export function runBacktestAnalysis(
  req: AnalyzeRequest,
  weather: WeatherDataset,
  soil: SoilProfile,
  rainMult = 1.0,
  tempDelta = 0.0
): AnalyzeResponse {
  const t0 = Date.now();
  const cropsDb = getCrops();
  const dateIndex = buildDateIndex(weather.days);
  const gwetClim = computeClimatologyGwet(weather.days);
  const priorities: PriorityId[] =
    req.priorities && req.priorities.length > 0 ? req.priorities.slice(0, 2) : ['water', 'reliability'];
  const equipment: EquipmentConstraint = req.equipment ?? 'standard';

  // Build 3 deterministic strategies: 1 Current Practice + 2 Priority-Aligned Alternatives
  const currentSpec = CURRENT_PRACTICE_MAP[req.current_crop] ?? CURRENT_PRACTICE_MAP.wheat;
  const altSpecs = selectAlternativeTemplates(
    currentSpec.crops,
    priorities,
    req.irrigation,
    equipment,
    req.lat
  );

  const strategyConfigs = [
    {
      id: 'current_practice',
      name_en: currentSpec.name_en,
      name_hi: currentSpec.name_hi,
      crops: currentSpec.crops,
      why_en: `Baseline current practice centered on ${cropsDb[req.current_crop].name_en}.`,
      is_current: true,
    },
    {
      id: altSpecs[0].id,
      name_en: altSpecs[0].name_en,
      name_hi: altSpecs[0].name_hi,
      crops: altSpecs[0].crops,
      why_en: altSpecs[0].why_en,
      is_current: false,
    },
    {
      id: altSpecs[1].id,
      name_en: altSpecs[1].name_en,
      name_hi: altSpecs[1].name_hi,
      crops: altSpecs[1].crops,
      why_en: altSpecs[1].why_en,
      is_current: false,
    },
  ];

  const results: RotationStrategyResult[] = strategyConfigs.map((cfg) => {
    const years: YearBacktest[] = [];
    for (let y = 2005; y <= 2024; y++) {
      years.push(
        simulateRotationYear(
          y,
          dateIndex,
          gwetClim,
          cropsDb,
          cfg.crops,
          req.lat,
          soil.awc_mm_per_m,
          req.irrigation,
          rainMult,
          tempDelta
        )
      );
    }
    return evaluateStrategyMetrics(
      cfg.id,
      cfg.name_en,
      cfg.name_hi,
      cfg.crops,
      cfg.why_en,
      cfg.is_current,
      cropsDb,
      years,
      priorities,
      soil,
      weather.confidence
    );
  });

  // Rank purely by priority_score (deterministic tie-break by safe_years)
  const sorted = [...results].sort((a, b) => {
    if (Math.abs(b.priority_score - a.priority_score) > 0.01) {
      return b.priority_score - a.priority_score;
    }
    return b.safe_years - a.safe_years;
  });

  const bestId = sorted[0].id;
  results.forEach((r) => {
    const rankIdx = sorted.findIndex((s) => s.id === r.id);
    r.rank = rankIdx + 1;
    r.is_best_match = r.id === bestId;
  });

  // Compute baseline climate summary across 20 years
  const annualRainByYear = new Map<string, number>();
  let tmaxSum = 0;
  let tminSum = 0;
  let gwetSum = 0;
  let gwetN = 0;
  let hotDays = 0;

  for (const d of weather.days) {
    const y = d.d.slice(0, 4);
    annualRainByYear.set(y, (annualRainByYear.get(y) ?? 0) + d.p * rainMult);
    tmaxSum += d.tx + tempDelta;
    tminSum += d.tn + tempDelta;
    if (d.tx + tempDelta >= 38) hotDays += 1;
    if (d.gw !== null) {
      gwetSum += d.gw;
      gwetN += 1;
    }
  }
  const meanAnnualRain = Math.round(
    Array.from(annualRainByYear.values()).reduce((a, b) => a + b, 0) /
      Math.max(1, annualRainByYear.size)
  );

  const overallConfidence: ConfidenceLevel =
    weather.confidence === 'LOW'
      ? 'LOW'
      : weather.confidence === 'HIGH' && soil.confidence === 'HIGH'
      ? 'HIGH'
      : 'MED';

  return {
    location: {
      lat: Number(req.lat.toFixed(4)),
      lon: Number(req.lon.toFixed(4)),
      label: weather.label,
      elevation_m: weather.elevation_m,
      field_area_ha: req.field_area_ha ?? null,
    },
    soil,
    climate_baseline: {
      mean_annual_rain_mm: meanAnnualRain,
      mean_max_temp_c: Number((tmaxSum / Math.max(1, weather.days.length)).toFixed(1)),
      mean_min_temp_c: Number((tminSum / Math.max(1, weather.days.length)).toFixed(1)),
      mean_gwetroot: gwetN > 0 ? Number((gwetSum / gwetN).toFixed(3)) : null,
      hot_days_above_38_per_yr: Number((hotDays / 20).toFixed(1)),
      source: weather.source,
      period: weather.period,
      grid_resolution: weather.grid_resolution,
      confidence: weather.confidence,
    },
    scenario: {
      rain_mult: rainMult,
      temp_delta: tempDelta,
    },
    overall_confidence: overallConfidence,
    strategies: results,
    kvk_disclaimer_en:
      'Supports Krishi Vigyan Kendra (KVK) and farmer decision-making — does not replace local soil testing, borewell checks, or extension agronomist advice.',
    kvk_disclaimer_hi:
      'यह टूल कृषि विज्ञान केंद्र (KVK) और स्थानीय विशेषज्ञों की सलाह का सहायक है, विकल्प नहीं।',
    computed_at_ms: Date.now() - t0,
  };
}
