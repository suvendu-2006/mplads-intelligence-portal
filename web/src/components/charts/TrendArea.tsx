import React from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useChartTheme } from '../../hooks/useChartTheme'
import { ANIMATION_CONFIG } from '../../lib/animationConfig'
import { ChartTooltip } from './ChartTooltip'

export interface AreaSeriesConfig {
  key: string
  label: string
  color?: string
  gradientId?: string
}

export interface TrendAreaProps {
  data: any[]
  xAxisKey: string
  series: AreaSeriesConfig[]
  height?: number
  formatter?: 'crore' | 'lakh' | 'percent' | 'number'
}

/**
 * Reusable Trend Area Chart with:
 * - Smooth cubic interpolation & area gradients
 * - Okabe-Ito stroke and fill
 * - Systematic 1200ms sweep animation
 * - Custom ₹ formatted tooltip
 */
export const TrendArea: React.FC<TrendAreaProps> = ({
  data,
  xAxisKey,
  series,
  height = 280,
  formatter = 'crore',
}) => {
  const theme = useChartTheme()
  const areaAnimation = ANIMATION_CONFIG.getChartProps('area')

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
        >
          {theme.gradients}

          <CartesianGrid
            strokeDasharray="3 3"
            stroke={theme.gridColor}
            vertical={false}
          />
          <XAxis
            dataKey={xAxisKey}
            stroke={theme.textColor}
            fontSize={11}
            tickLine={false}
          />
          <YAxis
            stroke={theme.textColor}
            fontSize={11}
            tickLine={false}
            tickFormatter={(v) => (formatter === 'crore' ? `₹${v}Cr` : String(v))}
          />

          <Tooltip
            content={<ChartTooltip formatter={formatter} />}
          />

          {series.map((s, idx) => {
            const strokeColor =
              s.color ||
              (idx === 0
                ? theme.allocated.hex
                : idx === 1
                ? theme.utilized.hex
                : theme.category[idx % theme.category.length])
            const fillGradient =
              s.gradientId || (idx === 0 ? 'url(#gradientAllocated)' : 'url(#gradientUtilized)')

            return (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={strokeColor}
                strokeWidth={2.5}
                fill={fillGradient}
                dot={false}
                activeDot={{ r: 5, fill: strokeColor, stroke: theme.tooltip.bg, strokeWidth: 2 }}
                {...areaAnimation}
              />
            )
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
