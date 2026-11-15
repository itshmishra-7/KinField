export type CropId =
  | 'wheat'
  | 'rice'
  | 'maize'
  | 'chickpea'
  | 'mustard'
  | 'moong'
  | 'sorghum'
  | 'cotton'
  | 'soybean'
  | 'groundnut'
  | 'cover_crop'
  | 'fallow';

export type PriorityId = 'water' | 'income' | 'soil' | 'reliability';
export type IrrigationLevel = 'none' | 'some' | 'full';
export type EquipmentConstraint = 'standard' | 'no_till' | 'forage_priority';
export type ConfidenceLevel = 'HIGH' | 'MED' | 'LOW';
export type YearStatus = 'GOOD' | 'MODERATE' | 'FAILED';
export type StrategyStatus = 'green' | 'yellow' | 'red';

export interface WeatherDay {
  d: string; // YYYYMMDD
  t: number; // T2M mean C
  tx: number; // T2M_MAX C
  tn: number; // T2M_MIN C
  p: number; // PRECTOTCORR mm/day
  gw: number | null; // GWETROOT 0..1
  sw: number | null; // ALLSKY_SFC_SW_DWN MJ/m2/day
}

export interface SoilProfile {
  texture: string;
  awc_mm_per_m: number;
  clay_pct: number;
  sand_pct: number;
  soc_g_kg: number;
  source: string;
  confidence: ConfidenceLevel;
  region_name: string;
}

export interface WeatherDataset {
  lat: number;
  lon: number;
  elevation_m: number | null;
  label: string;
  source: string;
  period: string;
  grid_resolution: string;
  confidence: ConfidenceLevel;
  days: WeatherDay[];
  soil_fallback?: { texture: string; awc_mm: number };
}

export interface AnalyzeRequest {
  lat: number;
  lon: number;
  current_crop: CropId;
  priorities: PriorityId[];
  irrigation: IrrigationLevel;
  equipment?: EquipmentConstraint;
  field_area_ha?: number | null;
  lang?: 'en' | 'hi';
}

export interface ScenarioRequest extends AnalyzeRequest {
  rain_mult: number; // 0.7 to 1.3
  temp_delta: number; // 0.0 to 3.0
}

export interface YearBacktest {
  year: number;
  status: YearStatus;
  safe: boolean;
  rain_mm: number;
  et0_mm: number;
  water_use_mm: number;
  irrigation_mm: number;
  water_deficit_mm: number;
  water_satisfaction_pct: number;
  max_flowering_temp_c: number;
  min_temp_c: number;
  soil_moisture_anomaly: number | null;
  triggers: string[];
  summary_note: string;
}

export interface RotationStrategyResult {
  id: string;
  name_en: string;
  name_hi: string;
  crops: CropId[];
  crop_labels_en: string[];
  crop_labels_hi: string[];
  is_current: boolean;
  is_best_match: boolean;
  rank: number;
  safe_years: number;
  total_years: number;
  status: StrategyStatus;
  status_label_en: string;
  status_label_hi: string;
  water_use_mm: number;
  irrigation_need_mm: number;
  soil_score: number;
  income_index: number;
  erosion_protection: number;
  nutrient_cycling_label: string;
  pest_disruption_label: string;
  forage_potential: string;
  priority_score: number;
  summary_en: string;
  summary_hi: string;
  why_it_fits: string;
  risks: string[];
  gaps: string[];
  years: YearBacktest[];
}

export interface AnalyzeResponse {
  location: {
    lat: number;
    lon: number;
    label: string;
    elevation_m: number | null;
    field_area_ha: number | null;
  };
  soil: SoilProfile;
  climate_baseline: {
    mean_annual_rain_mm: number;
    mean_max_temp_c: number;
    mean_min_temp_c: number;
    mean_gwetroot: number | null;
    hot_days_above_38_per_yr: number;
    source: string;
    period: string;
    grid_resolution: string;
    confidence: ConfidenceLevel;
  };
  scenario: {
    rain_mult: number;
    temp_delta: number;
  };
  overall_confidence: ConfidenceLevel;
  strategies: RotationStrategyResult[];
  kvk_disclaimer_en: string;
  kvk_disclaimer_hi: string;
  computed_at_ms: number;
}
