import React from 'react'
import { CheckCircle2, AlertTriangle } from 'lucide-react'

interface CPWDGaugeProps {
  fairCost: number // Fair CPWD cost (₹)
  tolerancePct?: number // Default 25%
  billedCost: number // Actual invoice cost (₹)
  category?: string
  unitRate?: string
}

export const CPWDGauge: React.FC<CPWDGaugeProps> = ({
  fairCost,
  tolerancePct = 25,
  billedCost,
  category = 'Civil Infrastructure',
  unitRate
}) => {
  const toleranceBuffer = fairCost * (tolerancePct / 100)
  const ceilingCost = fairCost + toleranceBuffer
  const excess = Math.max(0, billedCost - ceilingCost)
  const isOverTolerance = billedCost > ceilingCost

  const deviationPct = fairCost > 0 ? ((billedCost - fairCost) / fairCost) * 100 : 0
  const maxDisplay = Math.max(ceilingCost * 1.2, billedCost * 1.1)

  const fairPct = (fairCost / maxDisplay) * 100
  const tolPct = (toleranceBuffer / maxDisplay) * 100
  const billedMarkerPct = Math.min(100, (billedCost / maxDisplay) * 100)

  const formatLakhs = (val: number) => {
    if (val >= 1e7) {
      return `₹${(val / 1e7).toFixed(2)} Cr`
    }
    if (val >= 1e5) {
      return `₹${(val / 1e5).toFixed(2)} L`
    }
    return `₹${val.toLocaleString('en-IN')}`
  }

  return (
    <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--surface-primary)] p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            CPWD Government Rate Benchmark (DSR 2023)
          </div>
          <div className="text-xs text-[var(--text-tertiary)]">
            Category: <span className="font-semibold text-[var(--text-primary)]">{category}</span>
            {unitRate && <span> &bull; Schedule Baseline: {unitRate}</span>}
          </div>
        </div>

        <div>
          {isOverTolerance ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
              <AlertTriangle size={13} />
              +{deviationPct.toFixed(1)}% (Exceeds Statutory Ceiling)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 size={13} />
              +{deviationPct.toFixed(1)}% (Within Permissible Limit)
            </span>
          )}
        </div>
      </div>

      {/* Multi-segmented horizontal visual bar */}
      <div className="relative pt-6 pb-4">
        {/* Billed Marker Callout */}
        <div
          className="absolute top-0 transform -translate-x-1/2 flex flex-col items-center transition-all duration-500"
          style={{ left: `${billedMarkerPct}%` }}
        >
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-md tabular-nums whitespace-nowrap">
            Contractor Billed: {formatLakhs(billedCost)}
          </span>
          <div className="w-0.5 h-3 bg-[var(--text-primary)]" />
        </div>

        {/* Stacked track */}
        <div className="h-5 w-full rounded-full bg-[var(--surface-alt)] overflow-hidden flex shadow-inner border border-[var(--border-primary)]">
          {/* Fair Cost segment */}
          <div
            className="h-full bg-emerald-600 transition-all duration-700 flex items-center justify-center text-[9px] font-bold text-white tracking-wider"
            style={{ width: `${fairPct}%` }}
            title={`Govt Standard Cost: ${formatLakhs(fairCost)}`}
          >
            STANDARD RATE
          </div>
          {/* 25% Tolerance Buffer segment */}
          <div
            className="h-full bg-amber-500 transition-all duration-700 flex items-center justify-center text-[9px] font-bold text-white tracking-wider"
            style={{ width: `${tolPct}%` }}
            title={`25% Permissible Buffer: ${formatLakhs(toleranceBuffer)}`}
          >
            +25% BUFFER
          </div>
          {/* Flagged Excess segment */}
          {excess > 0 && (
            <div
              className="h-full bg-rose-600 animate-pulse transition-all duration-700 flex items-center justify-center text-[9px] font-bold text-white tracking-wider"
              style={{ width: `${Math.min(100 - fairPct - tolPct, (excess / maxDisplay) * 100)}%` }}
              title={`Flagged Excess: ${formatLakhs(excess)}`}
            >
              EXCESS BILLED
            </div>
          )}
        </div>
      </div>

      {/* Legend & Key figures */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs border-t border-[var(--border-primary)]">
        <div>
          <span className="text-[10px] text-[var(--text-tertiary)] block">Govt Standard Cost (CPWD)</span>
          <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatLakhs(fairCost)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-[var(--text-tertiary)] block">Permissible Buffer (+25%)</span>
          <span className="font-bold tabular-nums text-amber-600 dark:text-amber-400">
            {formatLakhs(toleranceBuffer)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-[var(--text-tertiary)] block">Max Permissible Ceiling</span>
          <span className="font-bold tabular-nums text-[var(--text-primary)]">
            {formatLakhs(ceilingCost)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-[var(--text-tertiary)] block">Excess Over Ceiling</span>
          <span className={`font-bold tabular-nums ${isOverTolerance ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {excess > 0 ? `+${formatLakhs(excess)} (Requires Justification)` : 'Compliant'}
          </span>
        </div>
      </div>
    </div>
  )
}
