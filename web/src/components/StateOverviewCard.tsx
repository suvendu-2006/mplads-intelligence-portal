import React from 'react'
import { Link } from 'react-router-dom'
import { Users, Check, ArrowRight } from 'lucide-react'
import { StateOverviewItem } from '../lib/allStatesData'

interface StateOverviewCardProps {
  item: StateOverviewItem
}

export const StateOverviewCard: React.FC<StateOverviewCardProps> = ({ item }) => {
  // Format Crore amounts cleanly: e.g. 19.0 -> "19 CR", 35.4 -> "35.4 CR", 1778.3 -> "1,778.3 CR"
  const formatCr = (val: number) => {
    if (val >= 1000) {
      return `${val.toLocaleString('en-IN', { minimumFractionDigits: val % 1 === 0 ? 0 : 1, maximumFractionDigits: 1 })} CR`
    }
    const isWhole = Math.abs(val - Math.round(val)) < 0.05
    return `${isWhole ? Math.round(val) : val.toFixed(1)} CR`
  }

  return (
    <div className="rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)] p-5 sm:p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group">
      <div>
        {/* Top Header: State Name in clean sans font + Rank Badge on Top Right, MPs count below Name (no "i" and no location pin) */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              to={`/states/${encodeURIComponent(item.state)}`}
              className="text-lg sm:text-xl font-bold font-sans text-[var(--text-primary)] tracking-tight hover:text-[var(--brand-primary)] transition truncate block"
            >
              {item.state}
            </Link>

            <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] font-medium mt-1">
              <Users size={13} className="text-[var(--text-tertiary)]" />
              <span>{item.mps} MPs</span>
            </div>
          </div>

          {/* Rank Badge */}
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-900/60 shrink-0">
            Rank #{item.rank} of 36
          </span>
        </div>

        {/* Two-Column Metrics: ALLOCATED vs RECORDED EXPENDITURE */}
        <div className="mt-6 mb-5 grid grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] sm:text-[11px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">
              ALLOCATED
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 mt-1 tabular-nums">
              {formatCr(item.allocatedCr)}
            </div>
          </div>

          <div>
            <div className="text-[10px] sm:text-[11px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">
              RECORDED EXPENDITURE
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 mt-1 tabular-nums">
              {formatCr(item.expenditureCr)}
            </div>
          </div>
        </div>

        {/* Expenditure Rate & Uniform Cohesive Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-600 dark:text-slate-400">Expenditure Rate</span>
            <span className="font-bold tabular-nums text-[var(--text-primary)]">
              ↗{item.expenditureRate.toFixed(1)}%
            </span>
          </div>


          <div className="w-full h-1.5 sm:h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mt-1.5">
            <div
              className="h-full rounded-full transition-all duration-700 bg-[#B7791F] dark:bg-[#FF9E3B]"
              style={{ width: `${Math.min(100, Math.max(3, item.expenditureRate))}%` }}
            />
          </div>
        </div>

        {/* Works Completed & Completion Rate */}
        <div className="flex items-center justify-between py-3 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full border border-emerald-500 text-emerald-500 flex items-center justify-center shrink-0">
              <Check size={11} strokeWidth={3} />
            </div>
            <div>
              <div className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 leading-tight tabular-nums">
                {item.completedWorks.toLocaleString()}
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-tight">
                Works Completed
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 font-medium">
              Completion
            </div>
            <div className="text-sm sm:text-base font-bold text-sky-900 dark:text-sky-200 tabular-nums">
              {item.completionRate.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* Footer Link */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 mt-1 text-center">
        <Link
          to={`/states/${encodeURIComponent(item.state)}`}
          className="text-xs font-semibold text-sky-700 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 inline-flex items-center justify-center gap-1 group-hover:underline transition"
        >
          <span>View Details</span>
          <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  )
}

