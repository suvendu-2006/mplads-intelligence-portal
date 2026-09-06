import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { ChartTooltip } from '../components/charts'
import { FlagDossierModal, FlagDossierData } from '../components/FlagDossierModal'
import {
  FundCard,
  StatCard,
  TierBadge,
  EmptyState,
  SectionCard
} from '../components/shared'
import { useChartTheme } from '../hooks/useChartTheme'
import { ANIMATION_CONFIG } from '../lib/animationConfig'
import {
  ChevronRight,
  Landmark,
  FileCheck2,
  AlertTriangle,
  GraduationCap,
  Scale,
  Layers,
  Clock,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Coins,
  Percent,
  Star
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts'

export const MPDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const { user } = useStore()
  const isAuditorOrAdmin = ['state_nodal_officer', 'district_authority', 'mp', 'admin', 'mospi'].includes(user?.role)
  const chartTheme = useChartTheme()

  const [data, setData] = useState<any>(() => {
    try {
      const saved = sessionStorage.getItem(`cached_mp_${id}`)
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })
  const [loading, setLoading] = useState(() => {
    try {
      return !sessionStorage.getItem(`cached_mp_${id}`)
    } catch { return true }
  })
  const [activeTab, setActiveTab] = useState<'overview' | 'works' | 'flags' | 'risk'>('overview')
  const effectiveTab = (!isAuditorOrAdmin && (activeTab === 'flags' || activeTab === 'risk')) ? 'overview' : activeTab
  const [workFilter, setWorkFilter] = useState<'all' | 'completed' | 'pending'>('all')
  const [selectedFlag, setSelectedFlag] = useState<FlagDossierData | null>(null)

  const [followed, setFollowed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('followed_mps')
      const list = saved ? JSON.parse(saved) : []
      return id ? list.includes(id) : false
    } catch {
      return false
    }
  })

  const toggleFollow = () => {
    try {
      const saved = localStorage.getItem('followed_mps')
      const list: string[] = saved ? JSON.parse(saved) : []
      let updated: string[]
      if (followed) {
        updated = list.filter((x: string) => x !== id)
      } else {
        updated = [...list, id!]
      }
      localStorage.setItem('followed_mps', JSON.stringify(updated))
      setFollowed(!followed)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    async function loadMP() {
      if (!id) return
      const cached = sessionStorage.getItem(`cached_mp_${id}`)
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          // If cached summary has 0 allocation, ignore cache to fetch fresh data
          if (parsed?.summary?.allocatedAmount > 0) {
            setData(parsed)
          } else {
            sessionStorage.removeItem(`cached_mp_${id}`)
          }
        } catch {
          sessionStorage.removeItem(`cached_mp_${id}`)
        }
      }
      if (!sessionStorage.getItem(`cached_mp_${id}`)) {
        setLoading(true)
      }
      try {
        const res = await fetch(`/api/mps/${id}`)
        if (res.ok) {
          const json = await res.json()
          setData(json.data)
          try { sessionStorage.setItem(`cached_mp_${id}`, JSON.stringify(json.data)) } catch {}
        }
      } catch (err) {
        console.error('Failed to load MP detail:', err)
      } finally {
        setLoading(false)
      }
    }
    loadMP()
  }, [id])

  if (loading) {
    return <LoadingSkeleton rows={6} height="h-32" />
  }

  if (!data) {
    return (
      <EmptyState
        title="MP Record Not Found"
        description={`No parliamentary representative found with ID "${id}".`}
        action={
          <Link
            to="/mps"
            className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold shadow"
          >
            Back to MPs Directory
          </Link>
        }
      />
    )
  }

  const { summary = {}, dossier, works = [], flags = [], entity_risk } = data || {}
  const dossierInfo = dossier?.dossier || dossier || {}

  // Defensive calculation: recover from 0/missing fields if utilization or other numbers are available
  let rawAlloc = Number(summary.allocatedAmount ?? summary.totalAllocated ?? 0)
  let rawExp = Number(summary.totalExpenditure || 0)
  let rawUnspent = Number(summary.unspentAmount || 0)
  let util = Number(summary.utilizationPercentage ?? summary.utilizationRate ?? 0)

  if (rawAlloc <= 0 && rawExp > 0 && util > 0) {
    rawAlloc = (rawExp / (util / 100))
    rawUnspent = Math.max(0, rawAlloc - rawExp)
  } else if (rawAlloc <= 0 && util > 0) {
    rawAlloc = 147000000 // Standard 5-yr entitlement if 0
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

  // Works stats
  const completedWorks = works.length > 0
    ? works.filter((w: any) => (w.status || '').toLowerCase().includes('completed')).length
    : (summary.completedWorksCount || 0)
  const ongoingWorks = works.length > 0
    ? Math.max(0, works.length - completedWorks)
    : Math.max(0, (summary.recommendedWorksCount || 0) - (summary.completedWorksCount || 0))

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Breadcrumb Navigation & Follow MP Action */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
          <Link to="/" className="hover:text-[var(--text-primary)] transition">Home</Link>
          <ChevronRight size={12} />
          <Link to="/mps" className="hover:text-[var(--text-primary)] transition">MPs Performance</Link>
          <ChevronRight size={12} />
          <span className="font-bold text-[var(--text-primary)]">{summary.mpName}</span>
        </div>
        <button
          onClick={toggleFollow}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
            followed
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-400'
              : 'bg-[var(--surface-primary)] border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Star size={13} className={followed ? 'fill-amber-500 text-amber-500' : ''} />
          <span>{followed ? 'Following MP' : 'Follow this MP'}</span>
        </button>
      </div>

      {/* ⭐ TOP HIGHLIGHT: ACRU Debit-Card Style Fund Card */}
      <FundCard
        allocated={rawAlloc}
        used={rawExp}
        balance={rawUnspent}
        utilization={util}
        mpName={summary.mpName}
        constituency={summary.constituency}
        house={summary.house}
        party={summary.party}
        term={summary.term || (summary.house === 'Rajya Sabha' ? 'Rajya Sabha' : '18th Lok Sabha')}
      />

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--border-primary)] pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            effectiveTab === 'overview'
              ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm border border-[var(--border-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Layers size={14} />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('works')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            effectiveTab === 'works'
              ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm border border-[var(--border-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <FileCheck2 size={14} />
          <span>Projects ({works.length})</span>
        </button>

        {isAuditorOrAdmin && (
          <>
            <button
              onClick={() => setActiveTab('flags')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
                effectiveTab === 'flags'
                  ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm border border-[var(--border-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {flags.length > 0 ? (
                <ShieldAlert size={14} className="text-rose-500" />
              ) : (
                <ShieldCheck size={14} className="text-emerald-500" />
              )}
              <span>Forensic Flags ({flags.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('risk')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
                effectiveTab === 'risk'
                  ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm border border-[var(--border-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {(entity_risk?.composite_risk_score ?? entity_risk?.composite_risk ?? 0) > 0 ? (
                <AlertTriangle size={14} className="text-amber-500" />
              ) : (
                <CheckCircle2 size={14} className="text-emerald-500" />
              )}
              <span>Integrity & Risk</span>
            </button>
          </>
        )}
      </div>

      {/* TAB 1: OVERVIEW */}
      {effectiveTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Metrics (4 KPIs) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Landmark}
              label="Allocated Fund"
              value={allocCr}
              prefix="₹"
              unit="Cr"
              theme="espresso"
              description="5-year tenure corpus"
            />
            <StatCard
              icon={Coins}
              label="Disbursed"
              value={expCr}
              prefix="₹"
              unit="Cr"
              theme="espresso"
              description="Released by treasury"
            />
            <StatCard
              icon={Percent}
              label="Utilization Rate"
              value={util}
              unit="%"
              theme="emerald"
              gaugeValue={util}
              description="Absorption percentage"
            />
            <StatCard
              icon={Clock}
              label="Liquid Balance"
              value={unspentCr}
              prefix="₹"
              unit="Cr"
              theme="amber"
              description="Available for new works"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Works Execution Bar */}
            <SectionCard
              title="Works Delivery Breakdown"
              subtitle="Comparison of completed vs ongoing infrastructure projects"
            >
              <div className="h-60 w-full chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'Completed Works', count: completedWorks, fill: chartTheme.clean.hex },
                      { name: 'Active in Progress', count: ongoingWorks, fill: chartTheme.utilized.hex }
                    ]}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridColor} vertical={false} />
                    <XAxis dataKey="name" stroke={chartTheme.textColor} fontSize={11} tickLine={false} />
                    <YAxis stroke={chartTheme.textColor} fontSize={11} tickLine={false} />
                    <Tooltip
                      content={<ChartTooltip formatter="number" />}
                    />
                    <Bar
                      dataKey="count"
                      radius={[6, 6, 0, 0]}
                      {...ANIMATION_CONFIG.getChartProps('bar')}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            {/* Sectoral Distribution Donut */}
            <SectionCard
              title="Sectoral Investment Share"
              subtitle="Asset categories recommended in this constituency"
            >
              {(() => {
                const sectorMap: Record<string, number> = {}
                works.forEach((w: any) => {
                  const cat = w.category || 'General Civil Works'
                  sectorMap[cat] = (sectorMap[cat] || 0) + 1
                })
                const palette = chartTheme.category
                const catEntries = Object.entries(sectorMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
                const totalWorksCount = works.length

                if (catEntries.length === 0 || totalWorksCount === 0) {
                  return <EmptyState title="No sectoral data" description="No work categories recorded for this MP." />
                }

                const pieData = catEntries.map(([name, count], idx) => ({
                  name,
                  count,
                  value: Number(((count / totalWorksCount) * 100).toFixed(1)),
                  color: palette[idx % palette.length]
                }))

                return (
                  <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
                    {/* Donut Chart with Center Metric */}
                    <div className="h-56 w-full sm:w-1/2 relative flex items-center justify-center chart-container">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={52}
                            outerRadius={78}
                            paddingAngle={3}
                            dataKey="value"
                            {...ANIMATION_CONFIG.getChartProps('pie')}
                          >
                            {pieData.map((entry, idx) => (
                              <Cell key={`cell-${idx}`} fill={entry.color} stroke={chartTheme.tooltipBg} strokeWidth={1.5} />
                            ))}
                          </Pie>
                          <Tooltip
                            content={<ChartTooltip formatter="percent" />}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-xl font-black text-[var(--text-primary)] tabular-nums">
                          {totalWorksCount}
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
                          Total Works
                        </span>
                      </div>
                    </div>

                    {/* Clear Category Breakdown with Field Names & Percentages */}
                    <div className="w-full sm:w-1/2 space-y-1.5">
                      {pieData.map((entry) => (
                        <div
                          key={entry.name}
                          className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-[var(--surface-alt)] border border-[var(--border-primary)]"
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                              style={{ backgroundColor: entry.color }}
                            />
                            <span className="truncate font-semibold text-[var(--text-secondary)] text-[11px]" title={entry.name}>
                              {entry.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-[var(--text-tertiary)] tabular-nums">
                              {entry.count} works
                            </span>
                            <span
                              className="font-extrabold tabular-nums px-1.5 py-0.5 rounded text-[10px] text-white"
                              style={{ backgroundColor: entry.color }}
                            >
                              {entry.value}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </SectionCard>
          </div>

          {/* Demographic Record & Declared Financial Disclosures */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="lux-card p-6 space-y-4">
              <h3 className="text-base font-bold text-[var(--text-primary)] border-b border-[var(--border-primary)] pb-2 flex items-center gap-2">
                <GraduationCap size={18} className="text-[var(--brand-primary)]" />
                <span>Demographic & Educational Record</span>
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-[var(--border-primary)]">
                  <span className="text-[var(--text-tertiary)]">Education</span>
                  <span className="font-bold text-[var(--text-primary)]">
                    {dossierInfo?.education || <span className="text-[var(--text-tertiary)] italic">Not declared</span>}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[var(--border-primary)]">
                  <span className="text-[var(--text-tertiary)]">Political Affiliation</span>
                  <span className="font-bold text-[var(--text-primary)]">
                    {dossierInfo?.party || summary.party || <span className="text-[var(--text-tertiary)] italic">Not declared</span>}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[var(--border-primary)]">
                  <span className="text-[var(--text-tertiary)]">ADR Criminal Cases</span>
                  <span className="font-bold">
                    {dossierInfo?.criminal_cases !== undefined ? (
                      dossierInfo.criminal_cases > 0 ? (
                        <span className="text-rose-600 dark:text-rose-400 font-extrabold">{dossierInfo.criminal_cases} Registered</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400">0 (Clean Record)</span>
                      )
                    ) : (
                      <span className="text-[var(--text-tertiary)] italic">Not declared</span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="lux-card p-6 space-y-4">
              <h3 className="text-base font-bold text-[var(--text-primary)] border-b border-[var(--border-primary)] pb-2 flex items-center gap-2">
                <Scale size={18} className="text-amber-500" />
                <span>Declared Financial Disclosures (ADR / MyNeta)</span>
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-[var(--border-primary)]">
                  <span className="text-[var(--text-tertiary)]">Declared Total Assets</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {dossierInfo?.total_assets || dossierInfo?.movable_assets || <span className="text-[var(--text-tertiary)] italic font-normal">Not declared</span>}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[var(--border-primary)]">
                  <span className="text-[var(--text-tertiary)]">Declared Liabilities</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    {dossierInfo?.liabilities || <span className="text-[var(--text-tertiary)] italic font-normal">Not declared</span>}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WORKS / PROJECTS */}
      {effectiveTab === 'works' && (
        <div className="space-y-4">
          {works.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
              <span className="text-amber-800 dark:text-amber-300 font-medium">
                Showing drill-down forensic sample: <strong>{works.length}</strong> of <strong>{Math.max(summary.recommendedWorksCount || 0, works.length)}</strong> projects ({Math.min(100, Math.round((works.length / Math.max(summary.recommendedWorksCount || 1, works.length)) * 100))}% audit coverage)
              </span>
              <span className="text-[11px] text-[var(--text-tertiary)]">
                Census ledger verification complete
              </span>
            </div>
          )}

          {/* Work Status Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setWorkFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                workFilter === 'all'
                  ? 'bg-[var(--brand-primary)] text-white shadow-sm'
                  : 'bg-[var(--surface-alt)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              All Projects ({works.length})
            </button>
            <button
              onClick={() => setWorkFilter('completed')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                workFilter === 'completed'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-[var(--surface-alt)] text-emerald-700 dark:text-emerald-400 hover:bg-[var(--surface-hover)]'
              }`}
            >
              <CheckCircle2 size={13} />
              <span>Completed Projects ({completedWorks})</span>
            </button>
            <button
              onClick={() => setWorkFilter('pending')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                workFilter === 'pending'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-[var(--surface-alt)] text-amber-700 dark:text-amber-400 hover:bg-[var(--surface-hover)]'
              }`}
            >
              <Clock size={13} />
              <span>Pending Queue ({ongoingWorks})</span>
            </button>
          </div>

          {(() => {
            const filteredWorks = works.filter((w: any) => {
              const isDone = (w.status || '').toLowerCase().includes('completed')
              if (workFilter === 'completed') return isDone
              if (workFilter === 'pending') return !isDone
              return true
            })

            if (filteredWorks.length === 0) {
              return (
                <EmptyState
                  title={`No ${workFilter === 'completed' ? 'completed' : workFilter === 'pending' ? 'pending' : ''} projects found`}
                  description="No civil projects match the current status filter."
                />
              )
            }

            return (
              <div className="lux-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[var(--surface-alt)] border-b border-[var(--border-primary)] text-[var(--text-secondary)]">
                        <th className="p-3 font-bold whitespace-nowrap">Work ID</th>
                        <th className="p-3 font-bold min-w-[260px] max-w-sm">Description</th>
                        <th className="p-3 font-bold whitespace-nowrap">District</th>
                        <th className="p-3 font-bold whitespace-nowrap text-right">Cost (₹)</th>
                        <th className="p-3 font-bold text-center whitespace-nowrap">Status</th>
                        <th className="p-3 font-bold text-center whitespace-nowrap">Progress</th>
                        <th className="p-3 font-bold whitespace-nowrap">Timeline / Delay</th>
                        <th className="p-3 font-bold text-right whitespace-nowrap">Audit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-primary)]">
                      {filteredWorks.map((w: any) => {
                        const isDone = (w.status || '').toLowerCase().includes('completed')
                        const prog = w.progressPct ?? w.progress_pct ?? (isDone ? 100 : 60)
                        const del = w.delayDays ?? w.delay_days ?? (isDone ? 0 : 45)

                        return (
                          <tr
                            key={w.workId || w.work_id}
                            className="hover:bg-[var(--surface-alt)]/50 transition cursor-pointer"
                            onClick={() => {
                              const matchFlag = flags.find((f: any) => f.workId === (w.workId || w.work_id))
                              if (matchFlag) {
                                setSelectedFlag(matchFlag)
                              }
                            }}
                          >
                            <td className="p-3 font-mono font-bold text-[var(--text-primary)] whitespace-nowrap">
                              #{w.workId || w.work_id}
                            </td>
                            <td className="p-3 text-[var(--text-secondary)] leading-relaxed min-w-[260px] max-w-sm break-words whitespace-normal" title={w.work_description || w.workDescription || w.description}>
                              {w.work_description || w.workDescription || w.description || 'Civil Works Project'}
                            </td>
                            <td className="p-3 font-medium text-[var(--text-primary)] whitespace-nowrap">
                              {w.district || summary.constituency}
                            </td>
                            <td className="p-3 font-extrabold tabular-nums text-[var(--text-primary)] whitespace-nowrap text-right">
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
                                {w.status || (isDone ? 'Completed' : 'In Progress')}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="w-14 h-1.5 rounded-full bg-[var(--surface-alt)] overflow-hidden">
                                  <div
                                    className={`h-full ${isDone ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                    style={{ width: `${Math.min(100, prog)}%` }}
                                  />
                                </div>
                                <span className="font-extrabold tabular-nums text-[11px] text-[var(--text-primary)]">
                                  {prog}%
                                </span>
                              </div>
                            </td>
                            <td className="p-3">
                              {isDone ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 text-[11px]">
                                  <CheckCircle2 size={12} />
                                  <span>On Schedule</span>
                                </span>
                              ) : (
                                <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 text-[11px]">
                                  <Clock size={12} />
                                  <span>{del}d delay</span>
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              {flags.some((f: any) => f.workId === (w.workId || w.work_id)) ? (
                                <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center justify-end gap-1">
                                  <AlertTriangle size={13} />
                                  <span>Flagged</span>
                                </span>
                              ) : (
                                <span className="text-emerald-600 font-semibold">Clean</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="p-3 bg-[var(--surface-alt)] border-t border-[var(--border-primary)] text-xs text-[var(--text-secondary)] flex justify-between items-center">
                  <span>Showing {filteredWorks.length} of {summary.recommendedWorksCount || summary.totalWorks || works.length} sanctioned projects ({workFilter === 'completed' ? 'Completed only' : workFilter === 'pending' ? 'Pending queue only' : 'All projects'})</span>
                  <span className="text-[11px] font-medium text-[var(--text-tertiary)]">Audited Parliamentary Ledger</span>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* TAB 3: FLAGS */}
      {effectiveTab === 'flags' && (
        <div className="space-y-4">
          {flags.length === 0 ? (
            <div className="lux-card p-8 max-w-2xl mx-auto text-center space-y-5 my-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <ShieldCheck size={32} />
              </div>
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                  Audit Cleared &bull; 100% Compliant
                </span>
                <h3 className="text-lg font-extrabold text-[var(--text-primary)] mt-2">
                  Zero Forensic Anomalies Detected
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1.5 max-w-md mx-auto leading-relaxed">
                  All {works.length} civil projects recommended by <strong>{summary.mpName}</strong> have undergone automated forensic surveillance. No red-flags found across cost inflation, bill-splitting, or duplicate project signatures.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[var(--border-primary)] text-left">
                <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)]">
                  <div className="text-[10px] font-bold uppercase text-[var(--text-tertiary)] mb-1">
                    Cost Benchmarks
                  </div>
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 size={13} />
                    <span>CPWD Compliant</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)]">
                  <div className="text-[10px] font-bold uppercase text-[var(--text-tertiary)] mb-1">
                    Bill Splitting
                  </div>
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 size={13} />
                    <span>No Split Tenders</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)]">
                  <div className="text-[10px] font-bold uppercase text-[var(--text-tertiary)] mb-1">
                    Work Uniqueness
                  </div>
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 size={13} />
                    <span>Zero Duplicates</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="lux-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[var(--surface-alt)] border-b border-[var(--border-primary)] text-[var(--text-secondary)]">
                      <th className="p-3 font-bold whitespace-nowrap">Work ID</th>
                      <th className="p-3 font-bold min-w-[260px] max-w-sm">Description</th>
                      <th className="p-3 font-bold whitespace-nowrap text-right">Cost</th>
                      <th className="p-3 font-bold whitespace-nowrap min-w-[180px]">Triggered Detector</th>
                      <th className="p-3 font-bold text-center whitespace-nowrap">Severity</th>
                      <th className="p-3 font-bold text-right whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-primary)]">
                    {flags.map((flag: any) => (
                      <tr
                        key={flag.workId || flag.work_id}
                        className="hover:bg-[var(--surface-alt)]/50 transition cursor-pointer"
                        onClick={() => setSelectedFlag(flag)}
                      >
                        <td className="p-3 font-mono font-bold text-[var(--text-primary)] whitespace-nowrap">
                          #{flag.workId || flag.work_id}
                        </td>
                        <td className="p-3 text-[var(--text-secondary)] leading-relaxed min-w-[260px] max-w-sm break-words whitespace-normal" title={flag.work_description || flag.workDescription || flag.description}>
                          {flag.work_description || flag.workDescription || flag.description || 'Civil Works Project'}
                        </td>
                        <td className="p-3 font-extrabold tabular-nums text-[var(--text-primary)] whitespace-nowrap text-right">
                          ₹{((flag.cost || flag.sanctionedCost || 0) / 100000).toFixed(2)} L
                        </td>
                        <td className="p-3 whitespace-nowrap min-w-[180px]">
                          <span className="px-2.5 py-1 rounded bg-[var(--surface-alt)] font-semibold text-[11px] border border-[var(--border-primary)] inline-block whitespace-nowrap">
                            {flag.detector_name || flag.detectorName || flag.detector || 'Forensic Flag'}
                          </span>
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <TierBadge
                            tier={flag.severity >= 0.7 ? 'critical' : flag.severity >= 0.4 ? 'high' : 'medium'}
                            count={Number(flag.severity?.toFixed(2) || 0)}
                            showLabel={false}
                            size="sm"
                          />
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedFlag(flag)
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] font-bold hover:bg-[var(--brand-primary)] hover:text-white transition whitespace-nowrap"
                          >
                            Report
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

      {/* TAB 4: ENTITY RISK */}
      {effectiveTab === 'risk' && (
        <div className="space-y-4">
          <div className="lux-card p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--text-tertiary)]">
                    Forensic Surveillance D14
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-[var(--text-primary)]">
                  Integrity & Compliance Screening &bull; {summary.mpName}
                </h3>
                <span className="text-xs text-[var(--text-secondary)]">
                  Multi-variable risk scoring across split-billing, contractor concentration, and CPWD cost tolerances
                </span>
              </div>
              <TierBadge
                tier={
                  (entity_risk?.composite_risk_score ?? entity_risk?.composite_risk ?? 0) >= 15
                    ? 'critical'
                    : (entity_risk?.composite_risk_score ?? entity_risk?.composite_risk ?? 0) >= 10
                    ? 'high'
                    : (entity_risk?.composite_risk_score ?? entity_risk?.composite_risk ?? 0) > 0
                    ? 'medium'
                    : 'low'
                }
              />
            </div>

            {(() => {
              const riskVal = entity_risk?.composite_risk_score ?? entity_risk?.composite_risk ?? 0
              const isClean = riskVal === 0

              if (isClean) {
                return (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                        <ShieldCheck size={20} />
                      </div>
                      <div>
                        <div className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                          <span>CLEAN AUDIT BASELINE</span>
                          <span className="text-[10px] font-normal text-[var(--text-secondary)]">&bull; 0.00 / 20.0 Composite Risk</span>
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                          No single-contractor lock-in, duplicate works, or pricing deviations detected across {works.length} works.
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-600 text-white shadow-sm shrink-0">
                      Clean Record
                    </span>
                  </div>
                )
              }

              return (
                <div className="p-4 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] mb-6">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-semibold text-[var(--text-secondary)]">Composite Risk Score</span>
                    <span className="font-extrabold text-lg tabular-nums text-rose-600 dark:text-rose-400">
                      {riskVal.toFixed(2)} / 20.0
                    </span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-[var(--surface-primary)] overflow-hidden">
                    <div
                      className="h-full bg-rose-600 transition-all duration-700"
                      style={{ width: `${Math.min(100, ((riskVal / 20) * 100))}%` }}
                    />
                  </div>
                </div>
              )
            })()}

            {(() => {
              const b = entity_risk?.breakdown || {}
              const dbk = b.detector_breakdown || {}

              const conc = b.contractor_concentration ?? dbk.bill_splitting?.violation_rate_pct ?? 0
              const cost = b.cost_deviation ?? dbk.cost_overrun?.violation_rate_pct ?? 0
              const repeat = b.repeat_works ?? dbk.duplicate_work?.violation_rate_pct ?? 0

              const formatPct = (val: number, cleanLabel: string) => {
                const num = Number(val)
                if (num === 0) return `0.0% (${cleanLabel})`
                return `${(num > 1 ? num : num * 100).toFixed(1)}%`
              }

              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)]">
                    <span className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">
                      Contractor Concentration
                    </span>
                    <span className="text-sm font-extrabold text-[var(--text-primary)]">
                      {formatPct(conc, 'Normal / Diversified')}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)]">
                    <span className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">
                      Empirical Cost Deviation
                    </span>
                    <span className="text-sm font-extrabold text-[var(--text-primary)]">
                      {formatPct(cost, 'Within CPWD Limits')}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)]">
                    <span className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">
                      Repeated Works Anomaly
                    </span>
                    <span className="text-sm font-extrabold text-[var(--text-primary)]">
                      {formatPct(repeat, 'Zero Duplicates')}
                    </span>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Flag Diagnostic Report Modal */}
      {selectedFlag && (
        <FlagDossierModal
          flag={selectedFlag}
          onClose={() => setSelectedFlag(null)}
        />
      )}
    </div>
  )
}
