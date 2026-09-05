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
   * Okabe-Ito categorical palette (8 colors)
   * Optimized for color vision deficiency
   * Worst pair ΔE = 15.7, most pairs ΔE > 30
   */
  category: {
    light: [
      '#0072B2',  // Blue (primary series)
      '#D55E00',  // Vermillion (secondary)
      '#009E73',  // Bluish-green (tertiary)
      '#B7791F',  // Gold (money/value)
      '#AA4499',  // Purple (demographic)
      '#56B4E9',  // Sky (light blue)
      '#5D6C8A',  // Slate (infrastructure)
      '#94A3B8',  // Grey ("Other" - ALWAYS LAST)
    ],
    dark: [
      '#6DABF5',  // Brightened blue
      '#FF9E5E',  // Brightened vermillion
      '#2FD0A0',  // Brightened green
      '#E3B341',  // Brightened gold
      '#D98BD0',  // Brightened purple
      '#8DCBFF',  // Brightened sky
      '#A3AEC6',  // Brightened slate
      '#7C8AA5',  // Brightened grey
    ],
  },

  /**
   * Fund allocation triad (hero charts)
   * Blue = Allocated | Gold = Utilized | Grey = Pending
   * Blue/Gold pair: ΔE 89-101 (excellent separation in ALL CVD types)
   */
  fund: {
    allocated: { light: '#1E3A8A', dark: '#6DABF5' },  // Ink Navy Blue in light mode
    utilized: { light: '#B7791F', dark: '#E3B341' },   // Gold NOT green
    pending: { light: '#E4E7EC', dark: '#2A3247' },    // Quiet neutral
  },

  /**
   * Risk tier palette
   * WARNING: High/Medium are ambiguous under CVD (ΔE 8-10)
   * MUST pair with text label: "High", "Medium", etc.
   */
  risk: {
    critical: { light: '#B42318', dark: '#FF8080' },   // 6.6:1 contrast
    high: { light: '#B54708', dark: '#FFB65C' },       // 5.4:1 contrast
    medium: { light: '#9C6B1A', dark: '#E3B341' },     // 4.6:1 contrast
    clean: { light: '#067647', dark: '#2FD0A0' },      // 5.7:1 contrast
  },

  /**
   * Sequential choropleth ramp (maps)
   * Lightness monotonic: L* 91 → 81 → 74 → 52 → 31
   * Survives ALL CVD types (darker = higher value)
   */
  sequential: {
    light: ['#F5E3C0', '#E9C57A', '#A9B4D6', '#5D7BC4', '#274690'],
    dark: ['#3A3F55', '#5D5B77', '#7C7BA0', '#6D8FD8', '#93B4FF'],
  },

  /**
   * Neutral (no data, disabled states)
   */
  neutral: { light: '#E4E7EC', dark: '#2A3247' },

  /**
   * Status colors (semantic)
   */
  status: {
    success: { light: '#067647', dark: '#2FD0A0' },
    warning: { light: '#B54708', dark: '#FFB65C' },
    danger: { light: '#B42318', dark: '#FF8080' },
    info: { light: '#0072B2', dark: '#6DABF5' },
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
