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
export type MapLayerId = 'base' | 'modis' | 'smap' | 'gpm';

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
  soil: {
    texture: string;
    awc_mm_per_m: number;
    clay_pct: number;
    sand_pct: number;
    soc_g_kg: number;
    source: string;
    confidence: ConfidenceLevel;
    region_name: string;
  };
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

export interface DemoPreset {
  slug: string;
  name: string;
  subtitle: string;
  lat: number;
  lon: number;
  default_crop: CropId;
  default_irrigation: IrrigationLevel;
  highlight: string;
}

export interface ProvenanceDataset {
  id: string;
  name: string;
  spatial_resolution: string;
  temporal_coverage: string;
  role_in_app: string;
  in_product: boolean;
  limitations: string;
}

export interface ProvenanceResponse {
  product: string;
  version: string;
  datasets: ProvenanceDataset[];
  disclaimer: string;
}
