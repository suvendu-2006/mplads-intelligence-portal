/**
 * SATARK-MPLADS Color Palette
 * Refined Royal Navy & Cobalt Palette — Crisp, authoritative, and high-contrast
 *
 * Verification:
 * - Primary Accent: Royal Cobalt (#2563EB) & Deep Navy (#1E3A8A)
 * - Allocated: Royal Blue (#2563EB) | Disbursed: Sky Blue (#0284C7)
 * - Neutral ground: Pure Crisp White (#FFFFFF)
 * - CVD-safe categorical distribution
 * - Clean white slice dividers on charts (no harsh black strokes)
 */

export const palette = {
  /**
   * Categorical palette (8 colors, distinct, non-blue, color-blind safe)
   * High visual contrast and clarity — zero blue so pie charts are instantly distinguishable
   */
  category: {
    light: [
      '#F59E0B',  // 1. Amber Gold
      '#7C3AED',  // 2. Royal Purple / Violet
      '#EA580C',  // 3. Warm Tangerine
      '#C026D3',  // 4. Fuchsia / Magenta
      '#E11D48',  // 5. Vivid Rose
      '#475569',  // 6. Slate Charcoal
      '#D97706',  // 7. Rich Ochre
      '#9F1239',  // 8. Deep Berry
    ],
    dark: [
      '#38BDF8',  // 1. Sky Blue
      '#FB923C',  // 2. Warm Orange
      '#2FD0A0',  // 3. Mint Emerald
      '#FACC15',  // 4. Amber Yellow
      '#F472B6',  // 5. Rose Pink
      '#818CF8',  // 6. Indigo Violet
      '#A78BFA',  // 7. Lavender
      '#94A3B8',  // 8. Slate
    ],
  },

  /**
   * Fund allocation triad (hero charts)
   * Deep Slate = Allocated Budget | Royal Blue = Utilized Disbursal | Neutral = Pending
   */
  fund: {
    allocated: { light: '#1E293B', dark: '#5DA1F3' },  // Deep Executive Slate / Cornflower Blue
    utilized: { light: '#2563EB', dark: '#FF9E3B' },   // Royal Cobalt Blue / Warm Amber
    pending: { light: '#E2E8F0', dark: '#1B2335' },    // Neutral border
  },

  /**
   * 5-tier Forensic Risk Scale (D1–D15)
   */
  risk: {
    critical: { light: '#DC2626', dark: '#FF6B6B' },   // Crimson Danger
    high: { light: '#D97706', dark: '#FF9E3B' },       // Amber Warning
    medium: { light: '#B45309', dark: '#FACC15' },     // Warm Ochre / Yellow
    low: { light: '#0284C7', dark: '#38BDF8' },        // Sky Info
    clean: { light: '#2563EB', dark: '#2FD0A0' },      // Royal Blue / Mint Emerald
  },

  /**
   * Sequential choropleth ramp (maps, heatmaps) - 5-step single-hue Cobalt
   */
  sequential: {
    light: ['#F0F9FF', '#BAE6FD', '#38BDF8', '#0284C7', '#1E3A8A'],
    dark: ['#F0F9FF', '#BAE6FD', '#38BDF8', '#0284C7', '#1E3A8A'],
  },

  /**
   * Diverging scale (deviation-from-median)
   */
  diverging: {
    light: ['#BE123C', '#FDA4AF', '#F8FAFC', '#93C5FD', '#1E3A8A'],
    dark: ['#BE123C', '#FDA4AF', '#F8FAFC', '#93C5FD', '#1E3A8A'],
  },

  /**
   * Neutral (no data, borders, dividers)
   */
  neutral: { light: '#E2E8F0', dark: '#E2E8F0' },

  /**
   * Status colors (semantic)
   */
  status: {
    success: { light: '#2563EB', dark: '#2563EB' },
    warning: { light: '#D97706', dark: '#D97706' },
    danger: { light: '#DC2626', dark: '#DC2626' },
    info: { light: '#0284C7', dark: '#0284C7' },
  },
} as const

/**
 * Helper: Get color for current theme
 */
export const getThemeColor = (
  colorObj: { light: string; dark: string },
  isDark: boolean = false
): string => {
  return isDark ? colorObj.dark : colorObj.light
}

/**
 * Helper: Get full categorical palette
 */
export const getCategoryPalette = (isDark: boolean = false): string[] => {
  return isDark ? [...palette.category.dark] : [...palette.category.light]
}

/**
 * Validation: Check if using palette correctly
 */
export const validateChartColors = (colors: string[]): boolean => {
  const allColors: string[] = [...palette.category.light, ...palette.category.dark]
  return colors.every((c) => allColors.includes(c))
}
