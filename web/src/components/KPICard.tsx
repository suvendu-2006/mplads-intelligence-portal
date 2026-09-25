import React, { useEffect, useState } from 'react'
import { LucideIcon } from 'lucide-react'
import { useTranslation, toNativeDigits } from '../lib/i18n'

interface KPICardProps {
  label: string
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
  description?: string
  icon?: LucideIcon
  accentColor?: string
}

function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
}: {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
}) {
  const { lang, t } = useTranslation()
  const spanRef = React.useRef<HTMLSpanElement>(null)

  const format = (v: number) => {
    const formatted = v.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    return toNativeDigits(formatted, lang)
  }

  const localizedSuffix = suffix === 'Cr' ? ` ${t('unit.cr')}` : suffix

  const prevValRef = React.useRef<number | null>(null)

  useEffect(() => {
    if (!spanRef.current) return

    const finalStr = format(value)
    if (prevValRef.current === value) {
      spanRef.current.textContent = finalStr
      return
    }

    const start = prevValRef.current ?? 0
    prevValRef.current = value

    if (typeof window === 'undefined' || !window.requestAnimationFrame || value === 0 || start === value) {
      spanRef.current.textContent = finalStr
      return
    }

    const duration = 750
    const startTime = performance.now()
    let handle: number

    function step(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Quartic ease-out: rapid initial roll with an ultra-smooth, silky glide to rest
      const ease = 1 - Math.pow(1 - progress, 4)
      const current = start + (value - start) * ease

      if (spanRef.current) {
        spanRef.current.textContent = format(current)
      }

      if (progress < 1) {
        handle = requestAnimationFrame(step)
      } else if (spanRef.current) {
        spanRef.current.textContent = finalStr
      }
    }

    handle = requestAnimationFrame(step)
    return () => cancelAnimationFrame(handle)
  }, [value, decimals, lang])

  return (
    <span>
      {prefix}
      <span ref={spanRef}>{format(value)}</span>
      {localizedSuffix}
    </span>
  )
}

export const KPICard: React.FC<KPICardProps> = React.memo(({
  label,
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  description,
  icon: Icon,
  accentColor = 'var(--brand-accent)',
}) => {
  const { t, lang } = useTranslation()
  const localizedLabel = t(label)
  const localizedDesc = description ? toNativeDigits(t(description), lang) : ''

  return (
    <div className="lux-card relative overflow-hidden group flex flex-col justify-between">
      <div
        className="h-1 rounded-t-xl transition-opacity duration-200 opacity-85 group-hover:opacity-100"
        style={{
          backgroundColor: accentColor,
          transform: 'scaleX(1)',
          transformOrigin: 'left',
        }}
      />

      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            {localizedLabel}
          </span>
          {Icon && (
            <div
              className="p-1.5 rounded-lg border border-[var(--border-primary)]"
              style={{ backgroundColor: 'var(--surface-alt)' }}
            >
              <Icon className="w-4 h-4 text-[var(--brand-primary)]" />
            </div>
          )}
        </div>

        <div className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tabular-nums tracking-tight">
          <AnimatedNumber
            value={value}
            decimals={decimals}
            prefix={prefix}
            suffix={suffix}
          />
        </div>

        {localizedDesc && (
          <p className="text-xs text-[var(--text-tertiary)] mt-1.5 font-medium leading-relaxed">
            {localizedDesc}
          </p>
        )}
      </div>
    </div>
  )
})
