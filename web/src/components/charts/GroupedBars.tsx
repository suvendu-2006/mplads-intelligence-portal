import React from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useChartTheme } from '../../hooks/useChartTheme'
import { ANIMATION_CONFIG } from '../../lib/animationConfig'
import { ChartTooltip } from './ChartTooltip'

export interface BarSeriesConfig {
  key: string
  label: string
  color?: string
}

export interface GroupedBarsProps {
  data: any[]
  xAxisKey: string
  series: BarSeriesConfig[]
  height?: number
  formatter?: 'crore' | 'lakh' | 'percent' | 'number'
  layout?: 'horizontal' | 'vertical'
}

/**
 * Reusable Grouped/Single Bar Chart with:
 * - Okabe-Ito colors
 * - Systematic staggered animation (800ms)
 * - Custom ₹ formatted tooltip
 */
export const GroupedBars: React.FC<GroupedBarsProps> = ({
  data,
  xAxisKey,
  series,
  height = 320,
  formatter = 'crore',
  layout = 'horizontal',
}) => {
  const theme = useChartTheme()
  const barAnimation = ANIMATION_CONFIG.getChartProps('bar')

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout={layout}
          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={theme.gridColor}
            vertical={false}
          />
          {layout === 'horizontal' ? (
            <>
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
            </>
          ) : (
            <>
              <XAxis
                type="number"
                stroke={theme.textColor}
                fontSize={11}
                tickLine={false}
              />
              <YAxis
                dataKey={xAxisKey}
                type="category"
                stroke={theme.textColor}
                fontSize={11}
                tickLine={false}
              />
            </>
          )}

          <Tooltip
            content={<ChartTooltip formatter={formatter} />}
            cursor={{ fill: 'var(--surface-hover)', opacity: 0.5 }}
          />

          {series.map((s, idx) => {
            const fill =
              s.color ||
              (idx === 0
                ? theme.allocated.hex
                : idx === 1
                ? theme.utilized.hex
                : theme.category[idx % theme.category.length])

            return (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={fill}
                radius={[6, 6, 0, 0]}
                {...barAnimation}
              />
            )
          })}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
