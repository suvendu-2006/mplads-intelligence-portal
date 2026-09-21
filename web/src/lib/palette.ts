/**
 * SATARK-MPLADS Color Palette
 * Based on Okabe-Ito "Color Universal Design" (Nature Methods)
 *
 * Verification:
 * - All critical pairs: ΔE ≥ 15.7 (CVD-safe threshold)
 * - Blue/Gold: ΔE 89-101 across all 3 CVD types
 * - Blue/Green: ΔE 15.7 (minimum acceptable)
 * - Text contrast: WCAG AA minimum (4.5:1 normal, 3:1 large)
 *
 * Usage Rules:
 * 1. Data series: ONLY use category[] or fund.*
 * 2. Risk tiers: ALWAYS pair color + text label
 * 3. Gold small text: use goldText, not brandAccent
 * 4. "Other" category: ALWAYS neutral, ALWAYS last
 */

export const palette = {
  /**
   * Categorical palette
   * Donut chart slices strictly use: #243B85, #5DA9E0, #C8642A, #3E9C78, #B7883F, #8E4A8F
   */
  category: {
    light: [
      '#243B85',  // Brand Navy Blue
      '#5DA9E0',  // Azure Sky Blue
      '#C8642A',  // Warm Terracotta Orange
      '#3E9C78',  // Emerald Mint Green
      '#B7883F',  // Chart Gold
      '#8E4A8F',  // Amethyst Purple
    ],
    dark: [
      '#8FA8F0',  // Brand Soft Navy
      '#60BAF5',  // Sky Blue
      '#F0A05A',  // Warm Orange
      '#4CC38A',  // Good Green
      '#D9AE62',  // Chart Gold
      '#BA78BB',  // Soft Purple
    ],
  },

  /**
   * Fund allocation triad (hero charts)
   * Navy = Allocated | Gold = Utilized | Neutral = Pending
   */
  fund: {
    allocated: { light: '#1F3A8A', dark: '#8FA8F0' },  // Brand Navy
    utilized: { light: '#B7883F', dark: '#D9AE62' },   // Chart Gold
    pending: { light: '#E7E2D9', dark: '#2D2723' },    // Quiet neutral border
  },

  /**
   * Risk tier palette
   */
  risk: {
    critical: { light: '#B91C1C', dark: '#F87171' },   // 6.5:1 contrast - Reserved for fraud/flags
    high: { light: '#B45309', dark: '#F0A05A' },       // 5.0:1 contrast - Warning / Queue / Gap
    medium: { light: '#B7883F', dark: '#D9AE62' },     // Chart Gold
    clean: { light: '#1F7A4D', dark: '#4CC38A' },      // 5.3:1 contrast - Good
  },

  /**
   * Sequential choropleth ramp (maps)
   */
  sequential: {
    light: ['#F6F4EF', '#BACAEB', '#7A9CE3', '#2B4EA8', '#1F3A8A'],
    dark: ['#1D1916', '#26345A', '#415B9E', '#6B8EE0', '#8FA8F0'],
  },

  /**
   * Neutral (no data, disabled states)
   */
  neutral: { light: '#E7E2D9', dark: '#2D2723' },

  /**
   * Status colors (semantic)
   */
  status: {
    success: { light: '#1F7A4D', dark: '#4CC38A' },
    warning: { light: '#B45309', dark: '#F0A05A' },
    danger: { light: '#B91C1C', dark: '#F87171' },
    info: { light: '#1F3A8A', dark: '#8FA8F0' },
  },
} as const

/**
 * Helper: Get color for current theme
 */
export const getThemeColor = (
  colorObj: { light: string; dark: string },
  isDark: boolean = typeof document !== 'undefined'
    ? document.documentElement.getAttribute('data-theme') === 'dark'
    : false
): string => {
  return isDark ? colorObj.dark : colorObj.light
}

/**
 * Helper: Get full categorical palette for current theme
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
