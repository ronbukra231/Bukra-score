/**
 * Bukra Score category weights — frontend mirror of backend/services/bukra_weights.py.
 *
 * The actual scoring computation happens in the Python backend.
 * This file is the single source of documentation for the frontend
 * and can be used to display weight rationale in future UI features.
 *
 * When changing weights: update BOTH files and keep them in sync.
 */
export const BUKRA_WEIGHTS: Record<string, number> = {
  profitability: 0.30,
  cash_flow:     0.25,
  stability:     0.20,
  growth:        0.15,
  debt:          0.10,
}

/**
 * Human-readable rationale per category weight (for future UI display).
 */
export const BUKRA_WEIGHT_RATIONALE: Record<string, { en: string; he: string }> = {
  profitability: {
    en: 'Most predictive of long-term business durability.',
    he: 'הפרמטר המנבא ביותר לאיתנות עסקית לטווח ארוך.',
  },
  cash_flow: {
    en: 'Real cash is harder to manipulate than reported earnings.',
    he: 'תזרים מזומנים אמיתי קשה יותר לניפוח מרווחים מדווחים.',
  },
  stability: {
    en: 'Balance-sheet strength protects against adversity.',
    he: 'איתנות המאזן מגנה בעת משברים.',
  },
  growth: {
    en: 'Important but partially captured by profitability trends.',
    he: 'חשוב, אך נלכד חלקית במגמות הרווחיות.',
  },
  debt: {
    en: 'Least independent; well-captured by stability metrics.',
    he: 'פחות עצמאי — נלכד טוב יותר ע"י מדדי היציבות.',
  },
}
