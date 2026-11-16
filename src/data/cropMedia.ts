import type { CropId } from '../types';

import wheatImg from '../assets/images/crop_wheat_1794793274870.jpg';
import riceImg from '../assets/images/crop_rice_1794793276417.jpg';
import maizeImg from '../assets/images/crop_maize_1794793275647.jpg';
import chickpeaImg from '../assets/images/crop_chickpea_1794793275884.jpg';
import mustardImg from '../assets/images/crop_mustard_1794793276962.jpg';
import moongImg from '../assets/images/crop_moong_1794793277729.jpg';
import sorghumImg from '../assets/images/crop_sorghum_1794793278790.jpg';
import cottonImg from '../assets/images/crop_cotton_1794793279078.jpg';
import soybeanImg from '../assets/images/crop_soybean_1794793278807.jpg';
import groundnutImg from '../assets/images/crop_groundnut_1794793278078.jpg';
import coverCropImg from '../assets/images/crop_cover_crop_1794793279276.jpg';
import fallowImg from '../assets/images/crop_fallow_1794793279425.jpg';

export interface CropMediaInfo {
  id: CropId;
  name: string;
  season: string;
  image: string;
  waterProfile: string;
  rootNote: string;
  heatLimit: string;
}

export const CROP_MEDIA: Record<CropId, CropMediaInfo> = {
  wheat: {
    id: 'wheat',
    name: 'Wheat',
    season: 'Rabi · Nov–Mar',
    image: wheatImg,
    waterProfile: 'Moderate water need',
    rootNote: '1.1 m root depth',
    heatLimit: 'Sensitive >35°C at grain-fill',
  },
  rice: {
    id: 'rice',
    name: 'Rice (Paddy)',
    season: 'Kharif · Jun–Oct',
    image: riceImg,
    waterProfile: 'High water + percolation',
    rootNote: '0.55 m shallow roots',
    heatLimit: 'Sensitive >38°C at flowering',
  },
  maize: {
    id: 'maize',
    name: 'Maize',
    season: 'Kharif · Jun–Sep',
    image: maizeImg,
    waterProfile: 'Balanced monsoon fit',
    rootNote: '1.2 m deep roots',
    heatLimit: 'Heat limit 39°C at silking',
  },
  chickpea: {
    id: 'chickpea',
    name: 'Chickpea',
    season: 'Rabi · Nov–Mar',
    image: chickpeaImg,
    waterProfile: 'Low water · N-fixing legume',
    rootNote: '1.1 m taproot',
    heatLimit: 'Heat limit 34°C at podding',
  },
  mustard: {
    id: 'mustard',
    name: 'Mustard',
    season: 'Rabi · Oct–Mar',
    image: mustardImg,
    waterProfile: 'Low water · oilseed',
    rootNote: '1.0 m root depth',
    heatLimit: 'Heat limit 35°C at flowering',
  },
  moong: {
    id: 'moong',
    name: 'Green Gram (Moong)',
    season: 'Zaid · Mar–May',
    image: moongImg,
    waterProfile: '65-day short legume',
    rootNote: '0.65 m · fixes +30 kg N/ha',
    heatLimit: 'Tolerates up to 41°C',
  },
  sorghum: {
    id: 'sorghum',
    name: 'Sorghum (Jowar)',
    season: 'Kharif · Jun–Oct',
    image: sorghumImg,
    waterProfile: 'Drought-hardy millet',
    rootNote: '1.4 m deep moisture capture',
    heatLimit: 'Tolerates up to 42°C',
  },
  cotton: {
    id: 'cotton',
    name: 'Cotton',
    season: 'Kharif · Jun–Nov',
    image: cottonImg,
    waterProfile: 'Long-season fiber crop',
    rootNote: '1.35 m deep taproot',
    heatLimit: 'Tolerates up to 41°C',
  },
  soybean: {
    id: 'soybean',
    name: 'Soybean',
    season: 'Kharif · Jun–Oct',
    image: soybeanImg,
    waterProfile: 'Rainfed legume · N-fixer',
    rootNote: '0.9 m root depth',
    heatLimit: 'Heat limit 37°C at pod-fill',
  },
  groundnut: {
    id: 'groundnut',
    name: 'Groundnut',
    season: 'Kharif · Jun–Oct',
    image: groundnutImg,
    waterProfile: 'Sandy-loam oilseed legume',
    rootNote: '0.85 m · fixes +30 kg N/ha',
    heatLimit: 'Tolerates up to 39°C',
  },
  cover_crop: {
    id: 'cover_crop',
    name: 'Sesbania / Cover Mulch',
    season: 'Zaid · Apr–May',
    image: coverCropImg,
    waterProfile: 'Soil-building green manure',
    rootNote: 'Adds organic carbon + N',
    heatLimit: 'Protects bare summer soil',
  },
  fallow: {
    id: 'fallow',
    name: 'Mulched Rest / Fallow',
    season: 'Zaid · Apr–May',
    image: fallowImg,
    waterProfile: 'Zero irrigation draw',
    rootNote: 'Conserves residual moisture',
    heatLimit: 'Residue cools soil surface',
  },
};
