import React, { useState, useEffect, useMemo } from 'react'
import { palette, getThemeColor, getCategoryPalette } from '../lib/palette'
import { ANIMATION_CONFIG } from '../lib/animationConfig'
import { useStore } from '../store/useStore'

export interface ColorPair {
  css: string
  hex: string
}

/**
 * Enhanced chart theme hook with Royal Navy & Cobalt Palette
 *
 * Designed for institutional clarity and crisp white presentation:
 * - Allocated = Royal Blue (#2563EB)
 * - Utilized = Sky Blue (#0284C7)
 * - Clean white slice dividers (#FFFFFF)
 * - Dark high-contrast tooltips
 */
export const useChartTheme = () => {
  const [activeTheme, setActiveTheme] = useState<'light' | 'dark'>(() => {
    if (typeof document !== 'undefined') {
      const dt = document.documentElement.getAttribute('data-theme')
      if (dt === 'dark' || dt === 'light') return dt
      if (document.documentElement.classList.contains('dark')) return 'dark'
    }
    return 'dark'
  })
  const userTheme = useStore((s) => s.theme)

  useEffect(() => {
    const checkTheme = () => {
      if (typeof document !== 'undefined') {
        const dt = document.documentElement.getAttribute('data-theme')
        if (dt === 'dark' || document.documentElement.classList.contains('dark')) {
          setActiveTheme('dark')
        } else {
          setActiveTheme('light')
        }
      }
    }
    checkTheme()

    if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
      const observer = new MutationObserver(() => checkTheme())
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme', 'class'],
      })
      return () => observer.disconnect()
    }
  }, [userTheme])

  const isDark = activeTheme === 'dark'
  const isLight = !isDark

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

    const allocatedPair: ColorPair = {
      css: isDark ? 'var(--chart-navy, #5DA1F3)' : 'var(--indigo-700, #4338CA)',
      hex: isDark ? getComputedColor('--chart-navy', '#5DA1F3') : getComputedColor('--indigo-700', '#4338CA'),
    }

    const utilizedPair: ColorPair = {
      css: isDark ? 'var(--chart-amber, #FF9E5E)' : 'var(--amber-600, #D97706)',
      hex: isDark ? getComputedColor('--chart-amber', '#FF9E5E') : getComputedColor('--amber-600', '#D97706'),
    }

    const pendingPair: ColorPair = {
      css: 'var(--border-primary)',
      hex: isDark ? '#1B2335' : '#E2E8F0',
    }

    const criticalPair: ColorPair = {
      css: 'var(--danger)',
      hex: isDark ? '#FF6B6B' : '#DC2626',
    }

    const highPair: ColorPair = {
      css: 'var(--warning)',
      hex: isDark ? '#FF9E3B' : '#D97706',
    }

    const mediumPair: ColorPair = {
      css: 'var(--risk-medium-text)',
      hex: isDark ? '#FACC15' : '#B45309',
    }

    const cleanPair: ColorPair = {
      css: 'var(--success)',
      hex: isDark ? '#2FD0A0' : '#2563EB',
    }

    const gridColor = isDark ? '#1B2335' : '#E2E8F0'
    const textColor = isDark ? '#94A3B8' : '#334155'
    const mutedTextColor = isDark ? '#64748B' : '#64748B'

    // Tooltip styling
    const tooltip = {
      bg: isDark ? '#0D121D' : '#0F172A',
      border: isDark ? '#1B2335' : '#1E293B',
      text: '#FFFFFF',
    }

    // Chart color pairs array for category
    const chartColors: ColorPair[] = categoryColors.map((hex, idx) => ({
      css: `var(--chart-${idx + 1}, ${hex})`,
      hex,
    }))

    // Gradients JSX for SVG defs
    const gradients = (
      <defs>
        <linearGradient id="barAllocatedGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isDark ? '#5DA1F3' : '#4F46E5'} stopOpacity={1} />
          <stop offset="100%" stopColor={isDark ? '#3B82F6' : '#3730A3'} stopOpacity={0.95} />
        </linearGradient>

        <linearGradient id="barUtilizedGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isDark ? '#FF9E5E' : '#F59E0B'} stopOpacity={1} />
          <stop offset="100%" stopColor={isDark ? '#E58F39' : '#D97706'} stopOpacity={0.95} />
        </linearGradient>

        <linearGradient id="gradientAllocated" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isDark ? '#5DA1F3' : '#2563EB'} stopOpacity={0.6} />
          <stop offset="95%" stopColor={isDark ? '#5DA1F3' : '#2563EB'} stopOpacity={0.02} />
        </linearGradient>

        <linearGradient id="gradientUtilized" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isDark ? '#FF9E5E' : '#0284C7'} stopOpacity={0.8} />
          <stop offset="95%" stopColor={isDark ? '#FF9E5E' : '#0284C7'} stopOpacity={0.05} />
        </linearGradient>
      </defs>
    )

    return {
      theme: activeTheme,
      isLight,
      isDark,

      category: categoryColors,

      allocated: allocatedPair,
      utilized: utilizedPair,
      pending: pendingPair,

      critical: criticalPair,
      high: highPair,
      medium: mediumPair,
      clean: cleanPair,

      sequential: palette.sequential[isDark ? 'dark' : 'light'],

      gridColor,
      textColor,
      mutedTextColor,

      tooltip,
      tooltipBg: tooltip.bg,
      tooltipBorder: tooltip.border,
      tooltipText: tooltip.text,

      // Slice border for pie / donut charts: pure crisp dark card or white
      sliceBorder: isDark ? '#0D121D' : '#FFFFFF',

      gradients,

      navy: allocatedPair,
      emerald: cleanPair,
      sky: utilizedPair,
      amber: highPair,
      rose: criticalPair,
      violet: { css: 'var(--chart-6)', hex: categoryColors[5] },
      slate: { css: 'var(--chart-8)', hex: categoryColors[7] },
      gold: utilizedPair,

      chartColors,
      animationConfig: ANIMATION_CONFIG,
    }
  }, [activeTheme, isDark, isLight])
}
