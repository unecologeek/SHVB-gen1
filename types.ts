
export type VisualType = 'results' | 'preview' | 'victory';

// Types stricts pour les sources de base de données
export const DB_SOURCE = {
  CONVEX: 'CONVEX',
  NEON: 'NEON',
  APPWRITE: 'APPWRITE',
  SUPABASE: 'SUPABASE',
  CACHE: 'CACHE',
  LOCAL: 'LOCAL'
} as const;

export type DatabaseSource = typeof DB_SOURCE.CONVEX | typeof DB_SOURCE.NEON | typeof DB_SOURCE.APPWRITE | typeof DB_SOURCE.SUPABASE;
export type CacheSource = typeof DB_SOURCE.CACHE | typeof DB_SOURCE.LOCAL;
export type ConnectionSource = DatabaseSource | CacheSource;

export interface Match {
  id: string;
  league: string;
  team1: {
    name: string;
    logo: string;
  };
  team2: {
    name: string;
    logo: string;
  };
  score1: number;
  score2: number;
  isLive?: boolean;
}

export interface AppConfig {
  visualType: VisualType;
  // Results fields
  title: string;
  subtitle: string;
  resultsBg: string;
  // Preview fields
  category: string;
  matchDate: string;
  location: string;
  previewBg: string;
  // Victory fields
  victoryBg: string;
  victoryPhotoFocus?: { x: number; y: number }; // Coordonnées en pourcentage (0-100)
  // Common fields
  mainColor: string;
  liveColor: string;
  showSlideIndicator: boolean;
  totalSlides: number;
  currentSlide: number;
}
