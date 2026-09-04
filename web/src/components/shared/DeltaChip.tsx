import React from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface DeltaChipProps {
  value: number
  suffix?: string
  invert?: boolean
}

export const DeltaChip: React.FC<DeltaChipProps> = ({ value, suffix = '%', invert = false }) => {
  const isPositive = value >= 0
  const isGood = invert ? !isPositive : isPositive

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums ${
        isGood
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
      }`}
    >
      {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      <span>
        {isPositive ? '+' : ''}
        {value.toFixed(1)}
        {suffix}
      </span>
    </span>
  )
}
