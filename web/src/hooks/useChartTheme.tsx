import React, { useState, useEffect, useMemo } from 'react'
import { palette, getThemeColor, getCategoryPalette } from '../lib/palette'
import { ANIMATION_CONFIG } from '../lib/animationConfig'
import { useStore } from '../store/useStore'

export interface ColorPair {
  css: string
  hex: string
}

/**
 * Enhanced chart theme hook with Okabe-Ito palette
 * Returns BOTH CSS vars (for HTML) and computed hex (for SVG)
 *
 * Why dual format?
 * - SVG fill attributes have inconsistent CSS var() support
 * - Safari < 16.4 and Firefox < 115 need actual hex values
 * - HTML elements can use CSS vars for theme reactivity
 */
export const useChartTheme = () => {
  const [activeTheme, setActiveTheme] = useState<'light' | 'dark'>(() => {
    if (typeof document !== 'undefined') {
      return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light'
    }
    return 'light'
  })
  const userTheme = useStore((s) => s.theme)

  useEffect(() => {
    const updateTheme = () => {
      const current =
        (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light'
      setActiveTheme(current)
    }

    updateTheme()

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          updateTheme()
        }
      })
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    return () => observer.disconnect()
  }, [userTheme])

  const isDark = activeTheme === 'dark'
  const isLight = !isDark

  /**
   * Compute actual hex value from CSS custom property
   * Fallback to hardcoded value if computation fails
   */
  const getComputedColor = (varName: string, fallback: string): string => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return fallback
    }
    try {
      const computed = getComputedStyle(document.documentElement)
        .getPropertyValue(varName)
        .trim()
      if (computed && (computed.startsWith('#') || computed.startsWith('rgb'))) {
        return computed
      }
      return fallback
    } catch {
      return fallback
    }
  }

  return useMemo(() => {
    const categoryColors = getCategoryPalette(isDark)

    // Color pairs
    const allocatedPair: ColorPair = {
      css: 'var(--brand-primary)',
      hex: getComputedColor('--brand-primary', palette.fund.allocated[isDark ? 'dark' : 'light']),
    }

    const utilizedPair: ColorPair = {
      css: 'var(--brand-accent)',
      hex: getComputedColor('--brand-accent', palette.fund.utilized[isDark ? 'dark' : 'light']),
    }

    const pendingPair: ColorPair = {
      css: 'var(--border-primary)',
      hex: getThemeColor(palette.fund.pending, isDark),
    }

    const criticalPair: ColorPair = {
      css: 'var(--danger)',
      hex: getComputedColor('--danger', palette.risk.critical[isDark ? 'dark' : 'light']),
    }

    const highPair: ColorPair = {
      css: 'var(--warning)',
      hex: getComputedColor('--warning', palette.risk.high[isDark ? 'dark' : 'light']),
    }

    const mediumPair: ColorPair = {
      css: 'var(--gold-text)',
      hex: getComputedColor('--gold-text', palette.risk.medium[isDark ? 'dark' : 'light']),
    }

    const cleanPair: ColorPair = {
      css: 'var(--success)',
      hex: getComputedColor('--success', palette.risk.clean[isDark ? 'dark' : 'light']),
    }

    const gridColor = getComputedColor('--border-primary', isDark ? '#232A3D' : '#E7E2D9')
    const textColor = getComputedColor('--text-secondary', isDark ? '#A5B0C2' : '#423229')
    const mutedTextColor = getComputedColor('--text-tertiary', isDark ? '#6B7A93' : '#705F55')

    const tooltip = {
      bg: getComputedColor('--surface-primary', isDark ? '#111520' : '#FFFFFF'),
      border: getComputedColor('--border-primary', isDark ? '#232A3D' : '#E7E2D9'),
      text: getComputedColor('--text-primary', isDark ? '#F4F6FA' : '#24140E'),
    }

    // Chart color pairs array for category
    const chartColors: ColorPair[] = categoryColors.map((hex, idx) => ({
      css: `var(--category-${idx}, ${hex})`,
      hex,
    }))

    // Gradients JSX for SVG defs
    const gradients = (
      <defs>
        <linearGradient id="gradientAllocated" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={categoryColors[0]} stopOpacity={0.6} />
          <stop offset="95%" stopColor={categoryColors[0]} stopOpacity={0.02} />
        </linearGradient>

        <linearGradient id="gradientUtilized" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.fund.utilized[isDark ? 'dark' : 'light']} stopOpacity={0.8} />
          <stop offset="95%" stopColor={palette.fund.utilized[isDark ? 'dark' : 'light']} stopOpacity={0.05} />
        </linearGradient>

        <linearGradient id="gradientNavy" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={allocatedPair.hex} stopOpacity={0.5} />
          <stop offset="95%" stopColor={allocatedPair.hex} stopOpacity={0.02} />
        </linearGradient>

        <linearGradient id="gradientGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={utilizedPair.hex} stopOpacity={0.7} />
          <stop offset="95%" stopColor={utilizedPair.hex} stopOpacity={0.05} />
        </linearGradient>
      </defs>
    )

    return {
      theme: activeTheme,
      isLight,
      isDark,

      /**
       * Categorical palette (Okabe-Ito 8 colors)
       * Use for data series in charts
       */
      category: categoryColors,

      /**
       * Fund allocation colors (hero charts)
       * Blue = Allocated | Gold = Utilized | Grey = Pending
       */
      allocated: allocatedPair,
      utilized: utilizedPair,
      pending: pendingPair,

      /**
       * Risk tier colors
       * ALWAYS pair with text labels
       */
      critical: criticalPair,
      high: highPair,
      medium: mediumPair,
      clean: cleanPair,

      /**
       * Sequential ramp (maps)
       */
      sequential: palette.sequential[isDark ? 'dark' : 'light'],

      /**
       * Chart element colors
       */
      gridColor,
      textColor,
      mutedTextColor,

      /**
       * Tooltip styling
       */
      tooltip,
      tooltipBg: tooltip.bg,
      tooltipBorder: tooltip.border,
      tooltipText: tooltip.text,

      /**
       * Gradients definition for Recharts SVG
       */
      gradients,

      /**
       * Backward compatibility pairs
       */
      navy: allocatedPair,
      emerald: cleanPair,
      sky: { css: 'var(--info)', hex: categoryColors[5] },
      amber: highPair,
      rose: criticalPair,
      violet: { css: 'var(--category-4)', hex: categoryColors[4] },
      slate: { css: 'var(--category-6)', hex: categoryColors[6] },
      gold: utilizedPair,

      chartColors,
      animationConfig: ANIMATION_CONFIG,
    }
  }, [activeTheme, isDark, isLight])
}
