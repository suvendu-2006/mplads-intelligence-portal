/**
 * SATARK-MPLADS Animation Configuration
 * Centralized timing and easing for consistent motion
 */

export const ANIMATION_CONFIG = {
  /**
   * Duration values (in milliseconds)
   */
  duration: {
    instant: 0,
    fast: 150,        // Hover states, tooltips
    base: 250,        // Standard transitions
    slow: 600,        // Card entries
    bar: 800,         // Bar chart growth
    pie: 1000,        // Pie chart drawing
    area: 1200,       // Area chart sweep
  },

  /**
   * Easing functions (cubic-bezier)
   */
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',       // Material standard
    entrance: 'cubic-bezier(0.16, 1, 0.3, 1)',    // Smooth deceleration
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',  // Bouncy (badges only)
    linear: 'linear' as const,
    easeOut: 'ease-out' as const,
    easeInOut: 'ease-in-out' as const,
  },

  /**
   * Stagger delays (for waterfall effects)
   */
  delay: {
    none: 0,
    card: 60,         // KPI card stagger
    section: 80,      // Section card stagger
    bar: 80,          // Bar-to-bar delay
    short: 80,
    row: 20,          // Table row stagger (capped at 240ms total)
    pie: 200,         // Pie chart initial delay
    medium: 200,
  },

  /**
   * Page load choreography timeline
   */
  timeline: {
    background: 0,       // Instant
    kpiRow: 60,          // KPI cards rise
    sections: 240,       // Section cards appear
    charts: 450,         // Charts begin animating
    totalBudget: 900,    // Maximum total animation time
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
          animationBegin: ANIMATION_CONFIG.timeline.charts,
          animationDuration: ANIMATION_CONFIG.duration.bar,
          animationEasing: 'ease-out' as const,
        }
      case 'pie':
        return {
          ...base,
          animationBegin: ANIMATION_CONFIG.timeline.charts + ANIMATION_CONFIG.delay.pie,
          animationDuration: ANIMATION_CONFIG.duration.pie,
          animationEasing: 'ease-in-out' as const,
        }
      case 'area':
      case 'line':
        return {
          ...base,
          animationBegin: ANIMATION_CONFIG.timeline.charts,
          animationDuration: ANIMATION_CONFIG.duration.area,
          animationEasing: 'ease-in-out' as const,
        }
      default:
        return base
    }
  },
} as const
