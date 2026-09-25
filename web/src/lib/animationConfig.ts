/**
 * SATARK-MPLADS Animation Configuration
 * Centralized timing and easing for consistent motion
 */

export const ANIMATION_CONFIG = {
  /**
   * Duration values (in milliseconds) - calibrated for 60fps silky motion
   */
  duration: {
    instant: 0,
    fast: 120,        // Hover states, tooltips
    base: 220,        // Standard transitions
    slow: 350,        // Card entries
    bar: 750,         // Bar chart visible growth from zero
    pie: 800,         // Pie chart full sweep from zero
    area: 1100,       // Area chart sweep from zero (silky smooth)
  },

  /**
   * Easing functions (cubic-bezier & Recharts compatible tokens)
   */
  easing: {
    standard: 'cubic-bezier(0.16, 1, 0.3, 1)',    // 60fps silky deceleration
    entrance: 'cubic-bezier(0.16, 1, 0.3, 1)',    // Smooth deceleration
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',  // Bouncy (badges only)
    linear: 'linear' as const,
    easeOut: 'ease-out' as const,
    easeInOut: 'ease-in-out' as const,
  },

  /**
   * Stagger delays (zero initial delay to eliminate lag / stutter)
   */
  delay: {
    none: 0,
    card: 30,         // KPI card stagger
    section: 40,      // Section card stagger
    bar: 0,           // Synchronized bars
    short: 30,
    row: 10,          // Table row stagger
    pie: 0,           // Instant pie start
    medium: 0,
  },

  /**
   * Page load choreography timeline
   */
  timeline: {
    background: 0,       // Instant
    kpiRow: 20,          // KPI cards rise
    sections: 40,        // Section cards appear
    charts: 0,           // Charts begin immediately with zero delay
    totalBudget: 850,    // 60fps budget
  },

  /**
   * Respect user preferences
   */
  shouldAnimate: (): boolean => {
    if (typeof window === 'undefined') return false
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  },

  /**
   * Get animation props for Recharts components
   */
  getChartProps: (type: 'bar' | 'pie' | 'area' | 'line') => {
    const base = {
      isAnimationActive: ANIMATION_CONFIG.shouldAnimate(),
    }

    switch (type) {
      case 'bar':
        return {
          ...base,
          animationBegin: 0,
          animationDuration: ANIMATION_CONFIG.duration.bar,
          animationEasing: 'ease-out' as const,
        }
      case 'pie':
        return {
          ...base,
          animationBegin: 0,
          animationDuration: ANIMATION_CONFIG.duration.pie,
          animationEasing: 'ease-out' as const,
        }
      case 'area':
      case 'line':
        return {
          ...base,
          animationBegin: 0,
          animationDuration: ANIMATION_CONFIG.duration.area,
          animationEasing: 'ease-out' as const,
        }
      default:
        return base
    }
  },
} as const
