import React from 'react'
import { Landmark, ShieldCheck } from 'lucide-react'

interface FundCardProps {
  allocated: number // in Crores or Rupees
  used: number
  balance: number
  utilization: number
  mpName: string
  constituency?: string
  house?: string
  party?: string
  term?: string
}

export const FundCard: React.FC<FundCardProps> = ({
  allocated,
  used,
  balance,
  utilization,
  mpName,
  constituency,
  house,
  party,
  term
}) => {
  const statusBadge = (
    <span className="inline-flex items-center px-3.5 py-1 rounded-xl text-xs font-bold bg-white/10 text-white border border-white/20 backdrop-blur-md shadow-sm">
      Utilization: {utilization.toFixed(1)}%
    </span>
  )

  const formatCr = (val: number) => {
    if (val >= 1e7) {
      return `₹${(val / 1e7).toFixed(2)} Cr`
    }
    return `₹${val.toLocaleString('en-IN')}`
  }

  return (
    <div
      className="relative rounded-2xl p-6 sm:p-8 text-white overflow-hidden shadow-2xl transition-all hover:scale-[1.005]"
      style={{
        background: 'linear-gradient(135deg, #0A192F 0%, #112240 50%, #1A365D 100%)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 16px 40px rgba(10, 25, 47, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
      }}
    >
      {/* Subtle Ashok Chakra / Watermark motif */}
      <div className="absolute right-4 -bottom-10 opacity-10 pointer-events-none text-white">
        <Landmark size={200} />
      </div>

      {/* Top Bar of the Card: Gold Chip + Title + Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          {/* Gold Microchip visual */}
          <div className="w-11 h-8 rounded-md bg-gradient-to-tr from-amber-500 to-amber-300 p-1 flex flex-col justify-between shadow-inner border border-amber-200/50">
            <div className="w-full h-1 bg-amber-950/50 rounded-full" />
            <div className="w-2/3 h-1 bg-amber-950/50 rounded-full" />
            <div className="w-full h-1 bg-amber-950/50 rounded-full" />
          </div>
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-amber-300">
              GOVERNMENT OF INDIA &bull; MPLADS
            </div>
            <div className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5 mt-0.5">
              <span>Constituency Corpus Ledger</span>
              <ShieldCheck size={14} className="text-emerald-400" />
            </div>
          </div>
        </div>
        <div>{statusBadge}</div>
      </div>

      {/* Financials Row (3 columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 py-5 border-y border-white/15 my-4">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-300 mb-1">
            Total Allocated
          </div>
          <div className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight text-white">
            {formatCr(allocated)}
          </div>
          <div className="text-[11px] font-medium text-slate-300 mt-1">Sanctioned 5-Yr Entitlement</div>
        </div>

        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400 mb-1">
            Used / Disbursed
          </div>
          <div className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight text-emerald-300">
            {formatCr(used)}
          </div>
          <div className="text-[11px] font-medium text-slate-300 mt-1">Liquid Treasury Outlay</div>
        </div>

        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300 mb-1">
            Unspent Balance
          </div>
          <div className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight text-amber-200">
            {formatCr(balance)}
          </div>
          <div className="text-[11px] font-medium text-slate-300 mt-1">Available for Sanction</div>
        </div>
      </div>

      {/* Footer of the Card: MP Name + House + Constituency */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div>
          <div className="text-lg sm:text-xl font-black text-white tracking-tight">
            {mpName}
          </div>
          <div className="text-xs text-slate-200 flex items-center gap-2 mt-1">
            {house && <span className="font-bold text-white">{house}</span>}
            {constituency && <span>&bull; <strong className="text-slate-100">{constituency}</strong></span>}
            {party && (
              <span className="px-2 py-0.5 rounded bg-white/15 text-[11px] font-bold text-white border border-white/20">
                {party}
              </span>
            )}
          </div>
        </div>
        {term && (
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">Tenure</div>
            <div className="text-xs font-bold text-white tabular-nums mt-0.5">{term}</div>
          </div>
        )}
      </div>
    </div>
  )
}
