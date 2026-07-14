export interface LevelResult {
  level: number;
  durationMs: number;
  completedAt: string; // ISO 8601
  moves?: number;
  score?: number;
}

export interface GameState {
  version: 1;
  gameId: string;
  currentLevel: number;
  completedLevels: LevelResult[];
  bestTimes: Record<number, number>;
  bestScores?: Record<number, number>;
  totalPlayMs: number;
  extra?: Record<string, unknown>;
}

// Common CSS variables and helpers can be added here
export const coreStyles = `
  :host {
    --og-bg: #ffffff;
    --og-surface: #f4f7fb;
    --og-primary: #0066cc;
    --og-accent: #ff9900;
    --og-text: #333333;
    --og-radius: 8px;
    --og-font: system-ui, -apple-system, sans-serif;
  }
`;
