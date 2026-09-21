import React, { useState } from 'react'
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

/**
 * Premium donut chart with:
 * - Corner radius & padding
 * - Active sector expansion
 * - Center label (total or hovered slice)
 * - Smooth animations
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
          outerRadius={outerRadius + 5}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          style={{
            filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15))',
            transition: 'all 250ms ease-out',
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
  }

  return (
    <div className="relative w-full">
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

      {/* Center Label */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-2 text-center"
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
      >
        <div className="max-w-[130px] flex flex-col items-center justify-center">
          {activeIndex === null ? (
            <>
              <div className="text-[10px] sm:text-[11px] font-bold text-[var(--text-tertiary)] leading-tight text-center line-clamp-2">
                {totalLabel}
              </div>
              <div className="text-base sm:text-xl font-extrabold text-[var(--text-primary)] tabular-nums leading-tight mt-0.5">
                {formatValue(total)}
              </div>
            </>
          ) : (
            <>
              <div className="text-[10px] sm:text-[11px] font-bold text-[var(--text-secondary)] text-center px-1 max-w-[120px] truncate leading-tight">
                {activeName}
              </div>
              <div className="text-base sm:text-lg font-extrabold text-[var(--text-primary)] tabular-nums leading-tight mt-0.5">
                {activeValue !== null && formatValue(activeValue)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
