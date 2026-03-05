
export type VisualType = 'results' | 'preview' | 'victory';

// Types stricts pour les sources de base de données
export const DB_SOURCE = {
  AIVEN: 'AIVEN',
  SUPABASE: 'SUPABASE',
  CACHE: 'CACHE',
  LOCAL: 'LOCAL'
} as const;

export type DatabaseSource = typeof DB_SOURCE.AIVEN | typeof DB_SOURCE.SUPABASE;
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
  /** Jusqu'à 3 équipes à gauche du "VS" (slots 0,1,2). null = slot vide. Si absent, dérivé de matches[0].team1 */
  previewLeftTeams?: ({ name: string; logo: string } | null)[];
  /** Jusqu'à 3 équipes à droite du "VS" (slots 0,1,2). null = slot vide. Si absent, dérivé de matches[0].team2 */
  previewRightTeams?: ({ name: string; logo: string } | null)[];
  // Victory fields
  victoryBg: string;
  victoryPhotoFocus?: { x: number; y: number }; // Coordonnées en pourcentage (0-100)
  // Common fields
  mainColor: string;
  liveColor: string;
  showSlideIndicator: boolean;
  totalSlides: number;
  currentSlide: number;
  // Marges et padding de la pagination
  paginationMarginTop?: number; // px
  paginationMarginBottom?: number; // px
  paginationPaddingTop?: number; // px
  paginationPaddingBottom?: number; // px
}
