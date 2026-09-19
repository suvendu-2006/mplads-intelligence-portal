import React, { useEffect, useState, useMemo } from 'react'
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { FlagDossierModal, FlagDossierData } from '../components/FlagDossierModal'
import {
  FundCard,
  StatCard,
  TierBadge,
  EmptyState
} from '../components/shared'
import {
  Landmark,
  FileCheck2,
  AlertTriangle,
  Lock,
  Clock,
  Coins,
  Percent,
  Layers,
  Users,
  Search,
  ChevronDown,
  X
} from 'lucide-react'
import { DEFAULT_MP_ID, DEFAULT_STATE_DISPLAY } from '../lib/constants'
import { ALL_MP_SEATS } from '../lib/allMpsData'

export const MPDashboard: React.FC = () => {
  const { id: paramId } = useParams<{ id?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryId = searchParams.get('id') || searchParams.get('mpId')
  const { user, switchRole, setMpJurisdiction } = useStore()
  const navigate = useNavigate()

  // Priority: URL route param -> URL query param -> store mpId -> default
  const activeMpId = paramId || queryId || (user?.mpId && user.mpId !== 'ALL' ? user.mpId : DEFAULT_MP_ID)
  const isAuthorized = ['mp', 'admin', 'mospi', 'viewer'].includes(user.role)

  const [data, setData] = useState<any>(() => {
    try {
      const saved = sessionStorage.getItem(`cached_mp_${activeMpId}`)
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })
  const [loading, setLoading] = useState(() => {
    try {
      return !sessionStorage.getItem(`cached_mp_${activeMpId}`)
    } catch { return true }
  })
  const [activeTab, setActiveTab] = useState<'works' | 'spending' | 'flags'>('works')
  const [selectedFlag, setSelectedFlag] = useState<FlagDossierData | null>(null)
  const [showMpSelector, setShowMpSelector] = useState(false)
  const [selectorSearch, setSelectorSearch] = useState('')

  useEffect(() => {
    async function loadMPDossier() {
      if (!sessionStorage.getItem(`cached_mp_${activeMpId}`)) {
        setLoading(true)
      }
      try {
        const res = await fetch(`/api/mps/${activeMpId}`)
        if (res.ok) {
          const json = await res.json()
          setData(json.data)
          try { sessionStorage.setItem(`cached_mp_${activeMpId}`, JSON.stringify(json.data)) } catch {}
          if (json.data?.summary?.mpName) {
            setMpJurisdiction(activeMpId, json.data.summary.mpName, json.data.summary.state)
          }
        }
      } catch (err) {
        console.error('Failed to load MP profile:', err)
      } finally {
        setLoading(false)
      }
    }
    loadMPDossier()
  }, [activeMpId])

  const filteredSelectorMps = useMemo(() => {
    if (!selectorSearch.trim()) return ALL_MP_SEATS.slice(0, 30)
    const q = selectorSearch.toLowerCase().trim()
    return ALL_MP_SEATS.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.constituency.toLowerCase().includes(q) ||
      m.state.toLowerCase().includes(q)
    ).slice(0, 50)
  }, [selectorSearch])

  const handleSwitchMP = (mp: typeof ALL_MP_SEATS[0]) => {
    setMpJurisdiction(mp.id, mp.name, mp.state)
    if (user.role === 'mp') {
      switchRole('mp', mp.state, mp.constituency, mp.id, mp.name)
    }
    setSearchParams({ id: mp.id })
    setShowMpSelector(false)
    setSelectorSearch('')
  }

  if (!isAuthorized) {
    return (
      <div className="lux-card p-10 max-w-lg mx-auto text-center my-12 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto">
          <Lock size={26} />
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)]">
          Member of Parliament Access Required
        </h2>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          The Parliamentary Constituency Command Dashboard is designed exclusively for Lok Sabha and Rajya Sabha representatives.
        </p>
        <button
          onClick={() =>
            switchRole(
              'mp',
              undefined,
              undefined,
              activeMpId
            )
          }
          className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold shadow hover:opacity-95 transition"
        >
          Switch to Member of Parliament
        </button>
      </div>
    )
  }

  if (loading) {
    return <LoadingSkeleton rows={6} height="h-32" />
  }

  const summary = data?.summary || {}
  const works = data?.works || []
  const flags = data?.flags || []

  let rawAlloc = Number(summary.allocatedAmount || 0)
  let rawExp = Number(summary.totalExpenditure || 0)
  let rawUnspent = Number(summary.unspentAmount || 0)
  let util = Number(summary.utilizationRate || summary.utilizationPercentage || 0)

  if (rawAlloc <= 0 && rawExp > 0 && util > 0) {
    rawAlloc = (rawExp / (util / 100))
    rawUnspent = Math.max(0, rawAlloc - rawExp)
  } else if (rawAlloc <= 0 && util > 0) {
    rawAlloc = 147000000
    rawExp = (rawAlloc * util) / 100
    rawUnspent = Math.max(0, rawAlloc - rawExp)
  } else if (rawUnspent <= 0 && rawAlloc > rawExp) {
    rawUnspent = Math.max(0, rawAlloc - rawExp)
  }
  if (util <= 0 && rawAlloc > 0 && rawExp > 0) {
    util = Number(((rawExp / rawAlloc) * 100).toFixed(1))
  }

  const formatCrores = (val: number) => {
    const cr = val / 10000000
    if (cr === 0) return '0'
    if (cr >= 100) return Math.round(cr).toLocaleString('en-IN')
    if (cr < 10 && cr !== Math.floor(cr) && (cr * 10) % 1 !== 0) return cr.toFixed(2)
    return cr.toFixed(1)
  }

  const allocCr = formatCrores(rawAlloc)
  const expCr = formatCrores(rawExp)
  const unspentCr = formatCrores(rawUnspent)

  const completedWorks = works.filter((w: any) => (w.status || '').toLowerCase().includes('completed')).length
  const ongoingWorks = Math.max(0, works.length - completedWorks)

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Official MP Badge Header */}
      <div className="rounded-2xl p-5 bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center font-bold shrink-0">
            <Landmark size={22} />
          </div>
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--brand-primary)] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>PARLIAMENTARY CONSTITUENCY COMMAND</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight">
              {summary.mpName || user.mpName}
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {summary.house} &bull; <strong className="text-[var(--text-primary)]">{summary.constituency}</strong>, {summary.state} &bull; {summary.party}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick In-Page MP Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowMpSelector(!showMpSelector)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--brand-accent)]/15 border border-[var(--brand-accent)]/30 hover:bg-[var(--brand-accent)] text-[var(--gold-text)] hover:text-white text-xs font-bold transition shadow-2xs cursor-pointer"
            >
              <Users size={14} />
              <span>Switch MP ({summary.constituency || 'Select'})</span>
              <ChevronDown size={13} className={`transition-transform duration-200 ${showMpSelector ? 'rotate-180' : ''}`} />
            </button>

            {showMpSelector && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMpSelector(false)} />
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border-primary)]">
                    <span className="text-xs font-extrabold text-[var(--text-primary)]">
                      Select Member of Parliament ({ALL_MP_SEATS.length} Seats)
                    </span>
                    <button
                      onClick={() => setShowMpSelector(false)}
                      className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-1"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="relative mb-2">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                    <input
                      type="text"
                      value={selectorSearch}
                      onChange={(e) => setSelectorSearch(e.target.value)}
                      placeholder="Search MP name, constituency, or state..."
                      autoFocus
                      className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg bg-[var(--surface-alt)] border border-[var(--border-primary)] text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)]"
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-1 divide-y divide-[var(--border-primary)]/40">
                    {filteredSelectorMps.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => handleSwitchMP(m)}
                        className={`w-full text-left p-2 rounded-lg text-xs transition flex items-center justify-between gap-2 cursor-pointer ${
                          m.id === activeMpId
                            ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] font-bold'
                            : 'hover:bg-[var(--surface-alt)] text-[var(--text-primary)]'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-bold truncate">{m.name}</div>
                          <div className="text-[10px] text-[var(--text-secondary)] truncate">
                            {m.constituency !== 'Sitting Rajya Sabha' ? `${m.constituency} — ` : ''}{m.state} ({m.house})
                          </div>
                        </div>
                        {m.id === activeMpId && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--brand-primary)] text-white shrink-0">
                            Active
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <Link
            to={`/mps/${activeMpId}`}
            className="text-xs px-3 py-1.5 rounded-xl bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-[var(--text-primary)] font-bold transition"
          >
            Public Report
          </Link>
        </div>
      </div>

      {/* Top Highlight: Real ACRU Debit-Card Style Fund Card */}
      <FundCard
        allocated={rawAlloc}
        used={rawExp}
        balance={rawUnspent}
        utilization={util}
        mpName={summary.mpName || user.mpName || 'MP'}
        constituency={summary.constituency}
        house={summary.house}
        party={summary.party}
        term={summary.term || '17th Lok Sabha'}
      />

      {/* 4-KPI Money Band */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Landmark}
          label="5-Year Entitlement Corpus"
          value={allocCr}
          prefix="₹"
          unit="Cr"
          theme="gold"
          description="Total central sanction"
        />
        <StatCard
          icon={Coins}
          label="Disbursed to Works"
          value={expCr}
          prefix="₹"
          unit="Cr"
          theme="gold"
          description="Liquid funds cleared"
        />
        <StatCard
          icon={Percent}
          label="Absorption Velocity"
          value={util}
          unit="%"
          theme="emerald"
          gaugeValue={util}
          description="Delivery percentage"
        />
        <StatCard
          icon={Clock}
          label="Liquid Balance Available"
          value={unspentCr}
          prefix="₹"
          unit="Cr"
          theme="amber"
          description="Ready for new recommendations"
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--border-primary)] pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('works')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === 'works'
              ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm border border-[var(--border-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <FileCheck2 size={14} />
          <span>Projects ({works.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('spending')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === 'spending'
              ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm border border-[var(--border-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Layers size={14} />
          <span>Sector Spending Allocation</span>
        </button>

        <button
          onClick={() => setActiveTab('flags')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === 'flags'
              ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm border border-[var(--border-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <AlertTriangle size={14} className="text-amber-500" />
          <span>Compliance Alerts ({flags.length})</span>
        </button>
      </div>

      {/* TAB 1: PROJECTS */}
      {activeTab === 'works' && (
        <div className="space-y-4">
          {works.length === 0 ? (
            <EmptyState
              title="No Projects Recommended Yet"
              description="You have not registered project recommendations in this tenure ledger yet."
            />
          ) : (
            <div className="lux-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[var(--surface-alt)] border-b border-[var(--border-primary)] text-[var(--text-secondary)]">
                      <th className="p-3 font-bold whitespace-nowrap">Work ID</th>
                      <th className="p-3 font-bold min-w-[260px] max-w-sm">Description</th>
                      <th className="p-3 font-bold whitespace-nowrap">District</th>
                      <th className="p-3 font-bold whitespace-nowrap text-right">Amount</th>
                      <th className="p-3 font-bold text-center whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-primary)]">
                    {works.map((w: any) => {
                      const isDone = (w.status || '').toLowerCase().includes('completed')
                      return (
                        <tr key={w.workId || w.work_id} className="hover:bg-[var(--surface-alt)]/50 transition">
                          <td className="p-3 font-mono font-bold text-[var(--text-primary)] whitespace-nowrap">
                            #{w.workId || w.work_id}
                          </td>
                          <td className="p-3 text-[var(--text-secondary)] leading-relaxed min-w-[260px] max-w-sm break-words whitespace-normal" title={w.work_description || w.workDescription || w.description}>
                            {w.work_description || w.workDescription || w.description || 'Civil Works Project'}
                          </td>
                          <td className="p-3 font-medium text-[var(--text-primary)] whitespace-nowrap">
                            {w.district || summary.constituency}
                          </td>
                          <td className="p-3 font-extrabold tabular-nums numeral-gold whitespace-nowrap text-right">
                            ₹{((w.sanctionedCost || w.cost || 0) / 100000).toFixed(2)} L
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold inline-block whitespace-nowrap ${
                                isDone
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                              }`}
                            >
                              {w.status || 'In Progress'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SPENDING BREAKDOWN */}
      {activeTab === 'spending' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="lux-card p-5 space-y-4">
            <h3 className="font-bold text-sm text-[var(--text-primary)] border-b border-[var(--border-primary)] pb-2">
              Delivery Completion Metrics
            </h3>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-4 rounded-xl bg-[var(--surface-alt)]">
                <span className="text-xs text-[var(--text-secondary)] block">Completed Projects</span>
                <span className="text-2xl font-extrabold text-emerald-600">{completedWorks}</span>
              </div>
              <div className="p-4 rounded-xl bg-[var(--surface-alt)]">
                <span className="text-xs text-[var(--text-secondary)] block">Active in Execution</span>
                <span className="text-2xl font-extrabold text-amber-600">{ongoingWorks}</span>
              </div>
            </div>
          </div>

          <div className="lux-card p-5 space-y-4">
            <h3 className="font-bold text-sm text-[var(--text-primary)] border-b border-[var(--border-primary)] pb-2">
              Primary Sectors Funded
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between p-2 rounded bg-[var(--surface-alt)]">
                <span>Roads & Pathways</span>
                <strong className="text-[var(--text-primary)]">42% of Allocation</strong>
              </div>
              <div className="flex justify-between p-2 rounded bg-[var(--surface-alt)]">
                <span>Public Lighting & Energy</span>
                <strong className="text-[var(--text-primary)]">24% of Allocation</strong>
              </div>
              <div className="flex justify-between p-2 rounded bg-[var(--surface-alt)]">
                <span>School & College Classrooms</span>
                <strong className="text-[var(--text-primary)]">18% of Allocation</strong>
              </div>
              <div className="flex justify-between p-2 rounded bg-[var(--surface-alt)]">
                <span>Community Halls & Others</span>
                <strong className="text-[var(--text-primary)]">16% of Allocation</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FLAGS */}
      {activeTab === 'flags' && (
        <div className="space-y-4">
          {flags.length === 0 ? (
            <EmptyState
              title="Zero Compliance Alerts"
              description="All works recommended by your office are compliant with CPWD benchmark tolerances."
            />
          ) : (
            <div className="lux-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[var(--surface-alt)] border-b border-[var(--border-primary)] text-[var(--text-secondary)]">
                      <th className="p-3 font-bold whitespace-nowrap">Work ID</th>
                      <th className="p-3 font-bold min-w-[260px] max-w-sm">Description</th>
                      <th className="p-3 font-bold whitespace-nowrap text-right">Cost</th>
                      <th className="p-3 font-bold text-center whitespace-nowrap">Severity</th>
                      <th className="p-3 font-bold text-right whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-primary)]">
                    {flags.map((f: any) => (
                      <tr key={f.workId || f.work_id} className="hover:bg-[var(--surface-alt)]/50 transition">
                        <td className="p-3 font-mono font-bold text-[var(--text-primary)] whitespace-nowrap">
                          #{f.workId || f.work_id}
                        </td>
                        <td className="p-3 text-[var(--text-secondary)] leading-relaxed min-w-[260px] max-w-sm break-words whitespace-normal" title={f.work_description || f.workDescription || f.description}>
                          {f.work_description || f.workDescription || f.description || 'Civil Works Project'}
                        </td>
                        <td className="p-3 font-extrabold tabular-nums whitespace-nowrap text-right">
                          ₹{((f.cost || f.sanctionedCost || 0) / 100000).toFixed(2)} L
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <TierBadge tier={f.severity >= 0.7 ? 'critical' : 'high'} count={Number(f.severity?.toFixed(2) || 0)} size="sm" />
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => setSelectedFlag(f)}
                            className="px-2.5 py-1 rounded-lg bg-[var(--brand-primary)] text-white text-xs font-bold hover:opacity-90 transition whitespace-nowrap"
                          >
                            Inspect Report
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Flag Dossier Modal */}
      {selectedFlag && (
        <FlagDossierModal
          flag={selectedFlag}
          onClose={() => setSelectedFlag(null)}
        />
      )}
    </div>
  )
}
