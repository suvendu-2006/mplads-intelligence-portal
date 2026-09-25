import React, { useEffect, useState } from 'react'
import { LucideIcon, Info } from 'lucide-react'
import { DeltaChip } from './DeltaChip'
import { useTranslation, toNativeDigits } from '../../lib/i18n'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: number | string
  prefix?: string
  unit?: string
  delta?: number
  sparkline?: number[]
  description?: string
  tooltip?: string
  theme?: 'teal' | 'slate' | 'emerald' | 'amber' | 'red' | 'navy' | 'gold' | 'espresso'
  gaugeValue?: number
  decimals?: number
  borderHighlight?: 'amber' | 'emerald' | 'blue' | 'none'
}

const formatStatValue = (val: number | string, decimals?: number): string | number => {
  if (typeof val === 'string') {
    const trimmed = val.replace(/,/g, '').trim()
    const parsed = parseFloat(trimmed)
    if (!isNaN(parsed) && String(parsed) === trimmed) {
      val = parsed
    } else {
      return val
    }
  }
  if (typeof val !== 'number' || isNaN(val)) return '0'
  if (decimals !== undefined) return val.toFixed(decimals)
  if (val >= 1000) return Math.round(val).toLocaleString('en-IN')
  if (Number.isInteger(val)) return val
  return val.toFixed(1)
}

export const StatCard: React.FC<StatCardProps> = React.memo(({
  icon: Icon,
  label,
  value,
  prefix = '',
  unit = '',
  delta,
  description,
  tooltip,
  theme = 'slate',
  decimals,
  borderHighlight = 'none'
}) => {
  const { lang, t } = useTranslation()
  const numVal = typeof value === 'string' ? parseFloat(value.replace(/,/g, '').trim()) : value
  const isNumeric = typeof numVal === 'number' && !isNaN(numVal)

  const numSpanRef = React.useRef<HTMLSpanElement>(null)
  const prevNumRef = React.useRef<number | null>(null)

  useEffect(() => {
    if (!numSpanRef.current) return

    if (!isNumeric) {
      numSpanRef.current.textContent = toNativeDigits(value, lang)
      return
    }

    const targetVal = typeof numVal === 'number' ? numVal : 0
    const finalFormatted = toNativeDigits(formatStatValue(targetVal, decimals), lang)

    // Skip animation if target value has not changed
    if (prevNumRef.current === targetVal) {
      numSpanRef.current.textContent = finalFormatted
      return
    }

    const startVal = prevNumRef.current ?? 0
    prevNumRef.current = targetVal

    if (typeof window === 'undefined' || !window.requestAnimationFrame || targetVal === 0 || startVal === targetVal) {
      numSpanRef.current.textContent = finalFormatted
      return
    }

    const duration = 750
    const startTime = performance.now()
    let frameId: number

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Quartic ease-out: rapid initial roll with an ultra-smooth, silky glide to rest
      const easeOut = 1 - Math.pow(1 - progress, 4)
      const current = startVal + (targetVal - startVal) * easeOut

      if (numSpanRef.current) {
        numSpanRef.current.textContent = toNativeDigits(formatStatValue(current, decimals), lang)
      }

      if (progress < 1) {
        frameId = requestAnimationFrame(step)
      } else if (numSpanRef.current) {
        numSpanRef.current.textContent = finalFormatted
      }
    }

    frameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameId)
  }, [value, decimals, lang])

  const iconBgClasses = {
    teal: 'bg-[var(--primary-100)] text-[var(--primary-700)] border-[var(--primary-700)]/25',
    slate: 'bg-[var(--surface-alt)] text-[var(--text-secondary)] border-[var(--border-primary)]',
    navy: 'bg-[var(--surface-alt)] text-[var(--text-secondary)] border-[var(--border-primary)]',
    emerald: 'bg-[var(--risk-clear-bg)] text-[var(--success)] border-[var(--risk-clear-border)]',
    amber: 'bg-[var(--risk-high-bg)] text-[var(--warning)] border-[var(--risk-high-border)]',
    red: 'bg-[var(--risk-critical-bg)] text-[var(--danger)] border-[var(--risk-critical-border)]',
    gold: 'bg-[var(--primary-50)] text-[var(--warning)] border-[var(--risk-high-border)]',
    espresso: 'bg-[var(--surface-alt)] text-[var(--text-secondary)] border-[var(--border-primary)]'
  }[theme]

  const numeralClasses = {
    teal: 'text-[var(--text-primary)]',
    slate: 'text-[var(--text-primary)]',
    navy: 'text-[var(--text-primary)]',
    emerald: 'text-[var(--success)]',
    amber: 'text-[var(--warning)]',
    red: 'text-[var(--danger)]',
    gold: 'text-[var(--text-primary)]',
    espresso: 'text-[var(--text-primary)]'
  }[theme]

  const borderClasses = borderHighlight === 'amber'
    ? '!border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.08)]'
    : borderHighlight === 'emerald'
    ? '!border-emerald-500/80 shadow-[0_0_15px_rgba(47,208,160,0.08)]'
    : borderHighlight === 'blue'
    ? '!border-blue-500/80 shadow-[0_0_15px_rgba(59,130,246,0.08)]'
    : ''

  const rawTooltipText = tooltip || description
  const localizedLabel = t(label)
  const localizedTooltip = rawTooltipText ? toNativeDigits(t(rawTooltipText), lang) : ''
  const localizedDesc = description ? toNativeDigits(t(description), lang) : ''
  const initialNum = toNativeDigits(formatStatValue(value, decimals), lang)
  const localizedUnit = unit === 'Cr' || unit === 'unit.cr' || unit === '₹ Cr'
    ? ` ${t('unit.cr')}`
    : unit === 'Lakh' || unit === 'unit.lakh' || unit === 'L'
    ? ` ${t('unit.lakh')}`
    : unit === '%'
    ? '%'
    : unit ? ` ${t(unit)}` : ''

  return (
    <div
      style={borderHighlight === 'amber' ? { borderColor: 'rgba(245, 158, 11, 0.75)' } : undefined}
      className={`lux-card p-5 relative overflow-visible group/card hover:z-10 transition-colors duration-150 flex flex-col justify-between ${borderClasses}`}
    >
      {/* Top row: Icon + Label + Tooltip */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${iconBgClasses}`}>
            <Icon size={18} />
          </div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
            {localizedLabel}
          </span>
        </div>
        {localizedTooltip && (
          <div className="group relative cursor-help">
            <span
              tabIndex={0}
              role="button"
              aria-label={`Information about ${localizedLabel}`}
              className="p-1 -m-1 flex items-center justify-center rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)] transition-colors focus:outline-none"
            >
              <Info size={14} />
            </span>
            <div
              role="tooltip"
              className="absolute right-0 top-full mt-2 hidden group-hover:block group-focus-within:block z-50 w-64 sm:w-72 p-3 text-xs font-normal leading-relaxed rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-2xl text-[var(--text-primary)] pointer-events-none animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="font-bold text-[11px] text-[var(--text-secondary)] uppercase tracking-wider mb-1">
                {localizedLabel}
              </div>
              <div className="text-[12px] text-[var(--text-primary)] leading-normal font-medium">
                {localizedTooltip}
              </div>
              <div className="absolute right-2.5 -top-1 w-2 h-2 rotate-45 bg-[var(--surface-primary)] border-l border-t border-[var(--border-primary)]" />
            </div>
          </div>
        )}
      </div>

      {/* Main Stat */}
      <div className="flex items-baseline justify-between gap-2 mt-1">
        <div className="flex items-baseline gap-1">
          {prefix && <span className="text-xl font-black text-[var(--text-primary)]">{prefix}</span>}
          <span
            ref={numSpanRef}
            className={`text-3xl sm:text-4xl font-black tracking-tight tabular-nums ${numeralClasses}`}
          >
            {initialNum}
          </span>
          {localizedUnit && <span className="text-sm font-extrabold text-[var(--text-primary)]">{localizedUnit}</span>}
        </div>
        {delta !== undefined && <DeltaChip value={delta} />}
      </div>

      {/* Bottom description */}
      {localizedDesc && (
        <p className="text-[11px] font-semibold text-[var(--text-secondary)] mt-2 line-clamp-1">
          {localizedDesc}
        </p>
      )}
    </div>
  )
})
