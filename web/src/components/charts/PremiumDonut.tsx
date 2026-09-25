import React, { useState, useEffect, useRef } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts'
import { useChartTheme } from '../../hooks/useChartTheme'
import { ANIMATION_CONFIG } from '../../lib/animationConfig'
import { fmtCrore } from '../../lib/currency'

export interface DonutData {
  name: string
  value: number
  color?: string
  amount?: number
  fullName?: string
}

export interface PremiumDonutProps {
  data: DonutData[]
  totalLabel?: string
  formatter?: 'crore' | 'percent' | 'number'
  size?: number
}

const AnimatedCenterTotal: React.FC<{
  value: number
  formatter?: 'crore' | 'percent' | 'number'
}> = ({ value, formatter }) => {
  const spanRef = useRef<HTMLSpanElement>(null)
  const prevValRef = useRef<number | null>(null)

  const formatText = (val: number) => {
    if (formatter === 'percent') return `${val.toFixed(1)}%`
    if (formatter === 'number') return Math.round(val).toLocaleString('en-IN')
    if (Math.abs(val) < 100000) return `₹${val.toLocaleString('en-IN', { maximumFractionDigits: 1 })} Cr`
    return `₹${fmtCrore(val, 2)} Cr`
  }

  useEffect(() => {
    if (!spanRef.current) return
    const el = spanRef.current
    const finalStr = formatText(value)

    if (prevValRef.current === value) {
      el.textContent = finalStr
      return
    }

    const startVal = prevValRef.current ?? 0
    prevValRef.current = value

    if (typeof window === 'undefined' || !window.requestAnimationFrame || value === 0 || startVal === value) {
      el.textContent = finalStr
      return
    }

    const duration = 750
    const start = performance.now()
    let frameId: number

    const render = (now: number) => {
      const elapsed = Math.min(now - start, duration)
      const progress = elapsed / duration
      // Quartic ease-out: rapid initial roll with an ultra-smooth, silky glide to rest
      const ease = 1 - Math.pow(1 - progress, 4)
      const current = startVal + (value - startVal) * ease

      el.textContent = formatText(current)

      if (progress < 1) {
        frameId = requestAnimationFrame(render)
      } else {
        el.textContent = finalStr
      }
    }

    frameId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(frameId)
  }, [value, formatter])

  return <span ref={spanRef}>{formatText(value)}</span>
}

/**
 * Premium donut chart with:
 * - Corner radius & padding
 * - Active sector expansion
 * - Center label (total or hovered slice)
 * - Smooth animations from zero
 */
export const PremiumDonut: React.FC<PremiumDonutProps> = ({
  data,
  totalLabel = 'Total',
  formatter = 'crore',
  size = 260,
}) => {
  const theme = useChartTheme()
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const total = data.reduce((sum, item) => sum + (item.value || 0), 0)

  const renderActiveShape = (props: any) => {
    const {
      cx,
      cy,
      innerRadius,
      outerRadius,
      startAngle,
      endAngle,
      fill,
    } = props

    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 4}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          stroke="#FFFFFF"
          strokeWidth={2}
          style={{
            cursor: 'pointer',
          }}
        />
      </g>
    )
  }

  const formatValue = (value: number): string => {
    if (formatter === 'percent') {
      return `${((value / (total || 1)) * 100).toFixed(1)}%`
    }
    if (formatter === 'number') {
      return value.toLocaleString('en-IN')
    }
    if (Math.abs(value) < 100000) {
      return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 1 })} Cr`
    }
    return `₹${fmtCrore(value, 2)} Cr`
  }

  const activeName = activeIndex !== null ? (data[activeIndex]?.fullName || data[activeIndex]?.name) : null
  const activeValue = activeIndex !== null ? data[activeIndex]?.value : null

  const animationProps = ANIMATION_CONFIG.getChartProps('pie')
  const pieProps: any = {
    data,
    cx: '50%',
    cy: '50%',
    innerRadius: '60%',
    outerRadius: '82%',
    dataKey: 'value',
    paddingAngle: 2,
    cornerRadius: 6,
    activeIndex: activeIndex ?? undefined,
    activeShape: renderActiveShape,
    onMouseEnter: (_: any, index: number) => setActiveIndex(index),
    onMouseLeave: () => setActiveIndex(null),
    ...animationProps,
    animationDuration: ANIMATION_CONFIG.duration.pie,
    animationEasing: 'ease-out',
    animationBegin: 0,
    isAnimationActive: true,
  }

  return (
    <div className="relative w-full chart-container">
      <ResponsiveContainer width="100%" height={size}>
        <PieChart>
          <Pie {...pieProps}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || theme.category[index % theme.category.length]}
                style={{
                  opacity: activeIndex === null || activeIndex === index ? 1 : 0.55,
                  transition: 'opacity 250ms ease-out',
                  cursor: 'pointer',
                }}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* Center Label (Fixed Non-Overlapping Layout) */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none px-2 text-center"
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
      >
        <div className="w-[140px] h-[86px] flex flex-col items-center justify-center overflow-hidden">
          {activeIndex === null ? (
            <>
              <div className="text-[10px] sm:text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider leading-tight text-center line-clamp-1 px-1">
                {totalLabel}
              </div>
              <div className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tabular-nums leading-none my-1 tracking-tight">
                <AnimatedCenterTotal value={total} formatter={formatter} />
              </div>
            </>
          ) : (
            <>
              <div className="text-[10px] sm:text-[11px] font-bold text-[var(--text-secondary)] text-center px-1 max-w-[136px] line-clamp-2 leading-tight break-words">
                {activeName}
              </div>
              <div className="text-lg sm:text-xl font-black text-[var(--text-primary)] tabular-nums leading-none my-1 tracking-tight">
                {activeValue !== null && formatValue(activeValue)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
