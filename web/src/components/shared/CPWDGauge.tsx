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

  // Calculate deviation accurately against the permissible ceiling
  const excessPct = ceilingCost > 0 ? ((billedCost - ceilingCost) / ceilingCost) * 100 : 0

  // Calculate bar percentages on a shared scale
  const maxScale = Math.max(billedCost, ceilingCost) * 1.08 || 1
  const ceilingBarPct = Math.min(100, (ceilingCost / maxScale) * 100)
  const billedBarPct = Math.min(100, (billedCost / maxScale) * 100)
  const allowedPortionPct = Math.min(billedBarPct, ceilingBarPct)
  const excessPortionPct = Math.max(0, billedBarPct - ceilingBarPct)

  const formatLakhs = (val: number) => {
    if (val >= 1e7) {
      return `₹${(val / 1e7).toFixed(2)} Cr`
    }
    if (val >= 1e5) {
      return `₹${(val / 1e5).toFixed(2)} Lakhs`
    }
    return `₹${val.toLocaleString('en-IN')}`
  }

  return (
    <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--surface-primary)] p-4 sm:p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-primary)] pb-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            CPWD Government Rate Benchmark (DSR 2023)
          </div>
          <div className="text-xs text-[var(--text-tertiary)] mt-0.5">
            Category: <span className="font-semibold text-[var(--text-primary)]">{category}</span>
            {unitRate && <span> &bull; Baseline Rate: {unitRate}</span>}
          </div>
        </div>

        <div>
          {isOverTolerance ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
              <AlertTriangle size={14} />
              +{excessPct.toFixed(1)}% Over Statutory Ceiling
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 size={14} />
              Within Statutory Ceiling (Compliant)
            </span>
          )}
        </div>
      </div>

      {/* Direct 2-Bar Comparison (Simple & Intuitive for Administrative Authorities) */}
      <div className="space-y-4 pt-1">
        {/* Bar 1: Government Permissible Limit */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-baseline text-xs">
            <span className="font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              Government Permissible Limit (CPWD + 25% Buffer)
            </span>
            <span className="font-extrabold text-[var(--text-primary)] tabular-nums">
              {formatLakhs(ceilingCost)}
            </span>
          </div>
          <div className="h-4 w-full rounded-lg bg-[var(--surface-alt)] overflow-hidden border border-[var(--border-primary)]">
            <div
              className="h-full bg-emerald-500 transition-all duration-500 rounded-md"
              style={{ width: `${ceilingBarPct}%` }}
              title={`Permissible Limit: ${formatLakhs(ceilingCost)}`}
            />
          </div>
          <div className="flex justify-between text-[11px] text-[var(--text-tertiary)]">
            <span>Base Standard: {formatLakhs(fairCost)}</span>
            <span>+25% Buffer: {formatLakhs(toleranceBuffer)}</span>
          </div>
        </div>

        {/* Bar 2: Contractor Billed Amount */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-baseline text-xs">
            <span className="font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isOverTolerance ? 'bg-rose-500' : 'bg-emerald-500'} inline-block`} />
              Contractor Billed Amount (Submitted Invoice)
            </span>
            <div className="flex items-center gap-2">
              {isOverTolerance && (
                <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                  +{formatLakhs(excess)} Overrun
                </span>
              )}
              <span className="font-extrabold text-[var(--text-primary)] tabular-nums">
                {formatLakhs(billedCost)}
              </span>
            </div>
          </div>
          <div className="h-4 w-full rounded-lg bg-[var(--surface-alt)] overflow-hidden border border-[var(--border-primary)] flex">
            {/* Allowed portion */}
            <div
              className={`h-full ${isOverTolerance ? 'bg-slate-400 dark:bg-slate-600' : 'bg-emerald-500'} transition-all duration-500`}
              style={{ width: `${allowedPortionPct}%` }}
              title={`Approved Portions: ${formatLakhs(Math.min(billedCost, ceilingCost))}`}
            />
            {/* Excess portion */}
            {isOverTolerance && (
              <div
                className="h-full bg-rose-500 transition-all duration-500 rounded-r-md"
                style={{ width: `${excessPortionPct}%` }}
                title={`Excess Billed Over Ceiling: +${formatLakhs(excess)}`}
              />
            )}
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-[var(--text-tertiary)]">
              {isOverTolerance ? 'Gray: Covered by ceiling' : '100% compliant with ceiling'}
            </span>
            {isOverTolerance ? (
              <span className="font-bold text-rose-600 dark:text-rose-400">
                Red: Unjustified Excess (+{excessPct.toFixed(1)}%)
              </span>
            ) : (
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                No Excess Overrun
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3 Clear Executive Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-[var(--border-primary)]">
        <div className="p-2.5 rounded-lg bg-[var(--surface-alt)] border border-[var(--border-primary)]">
          <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)] block">
            1. Govt Allowed Limit
          </span>
          <span className="text-sm font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400 block mt-0.5">
            {formatLakhs(ceilingCost)}
          </span>
          <span className="text-[10px] text-[var(--text-tertiary)] block mt-0.5">
            Max statutory threshold
          </span>
        </div>

        <div className="p-2.5 rounded-lg bg-[var(--surface-alt)] border border-[var(--border-primary)]">
          <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)] block">
            2. Contractor Billed
          </span>
          <span className="text-sm font-extrabold tabular-nums text-[var(--text-primary)] block mt-0.5">
            {formatLakhs(billedCost)}
          </span>
          <span className="text-[10px] text-[var(--text-tertiary)] block mt-0.5">
            Total claimed invoice
          </span>
        </div>

        <div className={`p-2.5 rounded-lg border ${
          isOverTolerance
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
        }`}>
          <span className="text-[10px] uppercase font-bold block opacity-80">
            3. Audit Discrepancy
          </span>
          <span className="text-sm font-extrabold tabular-nums block mt-0.5">
            {isOverTolerance ? `+${formatLakhs(excess)} (+${excessPct.toFixed(1)}%)` : 'Compliant (₹0 Excess)'}
          </span>
          <span className="text-[10px] block mt-0.5 opacity-80">
            {isOverTolerance ? 'Requires Rate Justification' : 'Passed statutory check'}
          </span>
        </div>
      </div>
    </div>
  )
}
