import React, { useEffect, useState, useMemo } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { FlagDossierModal, FlagDossierData } from '../components/FlagDossierModal'
import { RecommendWorkModal } from '../components/RecommendWorkModal'
import { BackButton } from '../components/BackButton'
import {
  FundCard,
  StatCard,
  TierBadge,
  EmptyState,
  SectionCard,
  AgencyBadge
} from '../components/shared'
import { ANIMATION_CONFIG } from '../lib/animationConfig'
import { useChartTheme } from '../hooks/useChartTheme'
import {
  ChevronRight,
  Landmark,
  FileCheck2,
  AlertTriangle,
  Globe2,
  Clock,
  ShieldAlert,
  CheckCircle2,
  Coins,
  Percent,
  Search,
  Building2,
  User,
  ArrowUpRight,
  Filter,
  PlusCircle
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
import { ALL_MP_SEATS } from '../lib/allMpsData'
import { getConstituencySummary } from '../lib/allConstituenciesData'
import { findAssemblyConstituencies, getACsByPC } from '../lib/assemblyConstituencies'
import { fetchPrefetchedJson } from '../lib/speedPrefetch'
import { useTranslation, translateState, translateConstituency, translateMP } from '../lib/i18n'
import { useStore } from '../store/useStore'

const UNSPECIFIED_SEGMENT = 'District-Wide / Unspecified'

function normalizeAcBase(name: string): string {
  return (name || '')
    .replace(/\s*\((?:sc|st|s\.c\.|s\.t\.|s)\)?$/i, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function resolveWorkSegmentFallback(
  w: any,
  assemblies: Array<{ ac_name?: string; district?: string }>,
  pcName: string
): string {
  const desc = String(w.description || w.work_description || w.workDescription || '').toLowerCase()
  const rawLoc = String(w.location || '').trim()
  const rawDistrict = String(w.district || '').trim()
  const normPc = normalizeAcBase(pcName)
  const normWorkDist = normalizeAcBase(rawDistrict)
  const normLoc = normalizeAcBase(rawLoc)
  const isGenericLoc =
    !normLoc ||
    normLoc === normPc ||
    normLoc === normWorkDist ||
    normLoc === `dist ${normWorkDist}` ||
    normLoc === `${normWorkDist} district` ||
    normLoc === `district ${normWorkDist}`
  const searchableText = isGenericLoc ? desc : `${desc} ${rawLoc.toLowerCase()}`

  const candidates = assemblies
    .map((a) => ({
      acName: String(a.ac_name || '').trim(),
      base: normalizeAcBase(String(a.ac_name || ''))
    }))
    .filter((c) => c.acName && c.base)
    .sort((a, b) => b.base.length - a.base.length)

  for (const { acName, base } of candidates) {
    const pattern = escapeRegExp(base).replace(/\s+/g, '\\s+')
    const isNamesake = base === normPc || (normWorkDist !== '' && base === normWorkDist)
    if (isNamesake) {
      const contextRe = new RegExp(
        `(?:\\b${pattern}\\s+(?:municipality|municipal|nagar\\s+palika|city|town|ward|block|assembly|vidhan\\s+sabha|ac)\\b|\\b(?:municipality|municipal|block|ward)\\s+${pattern}\\b)`,
        'i'
      )
      if (contextRe.test(searchableText)) return acName
    } else {
      const boundaryRe = new RegExp(`\\b${pattern}\\b`, 'i')
      if (boundaryRe.test(searchableText)) return acName
    }
  }
  return UNSPECIFIED_SEGMENT
}

function getSafeSessionConstituency(name: string | undefined): any {
  if (!name || typeof window === 'undefined') return null
  const clean = name.trim()
  try {
    const saved = localStorage.getItem(`cached_constituency_v2_${clean}`) || sessionStorage.getItem(`cached_constituency_v2_${clean}`)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed?.summary && Array.isArray(parsed.summary.assembly_segments)) {
        return parsed
      }
    }
  } catch {}

  const pcSum = getConstituencySummary(clean)
  const qLower = clean.toLowerCase()
  const matchedSeat = ALL_MP_SEATS.find(
    m => m.constituency.toLowerCase() === qLower ||
         m.constituency.toLowerCase().startsWith(qLower)
  ) || ALL_MP_SEATS.find(m => m.constituency.toLowerCase().includes(qLower))

  if (pcSum || matchedSeat) {
    const constName = pcSum?.name || matchedSeat?.constituency || clean
    const stateName = pcSum?.state || matchedSeat?.state || ''
    const alloc = pcSum ? pcSum.allocatedAmount : (matchedSeat ? matchedSeat.allocated : 0)
    const exp = pcSum ? pcSum.totalExpenditure : (matchedSeat ? matchedSeat.expenditure : 0)
    const comp = pcSum ? pcSum.completedWorksCount : (matchedSeat ? matchedSeat.completedWorks : 0)
    const rec = pcSum ? pcSum.recommendedWorksCount : (matchedSeat ? matchedSeat.recommendedWorks : 0)
    const rem = pcSum ? pcSum.remainedWorksCount : Math.max(0, rec - comp)
    const tot = Math.max(rec, comp)
    const compRate = pcSum ? pcSum.completionRate : (matchedSeat ? matchedSeat.completionRate : 0.0)
    const util = pcSum ? pcSum.utilizationPercentage : (matchedSeat ? matchedSeat.utilizationPercentage : 0.0)

    const pcAcs = getACsByPC(constName)
    const assembliesSource = pcAcs.length > 0 ? pcAcs : findAssemblyConstituencies(constName, 20)
    const assemblies = assembliesSource.map(a => ({
      ac_name: a.ac,
      ac_no: '',
      district: a.district || '',
      state: a.state
    }))

    return {
      summary: {
        name: constName,
        state: stateName,
        house: (matchedSeat ? matchedSeat.house : 'Lok Sabha'),
        allocatedAmount: alloc,
        totalExpenditure: exp,
        utilizationPercentage: util,
        unspentAmount: Math.max(0, alloc - exp),
        totalWorks: tot,
        completedWorksCount: comp,
        recommendedWorksCount: rec,
        remainedWorksCount: rem,
        completionRate: compRate,
        redFlagCount: 0,
        redFlagPct: 0.0,
        matched_assembly_constituency: undefined,
        mp: matchedSeat ? {
          id: matchedSeat.id,
          name: matchedSeat.name,
          party: matchedSeat.party,
          house: matchedSeat.house
        } : (pcSum ? {
          id: '',
          name: pcSum.mpName,
          party: '',
          house: pcSum.house
        } : null),
        assemblies,
        assembly_segments: assemblies,
        unspecifiedWorksCount: 0
      },
      sectorBreakdown: [],
      agencyBreakdown: [],
      works: [],
      flags: []
    }
  }
  return null
}

export const ConstituencyDetail: React.FC = () => {
  const { user } = useStore()
  const { name } = useParams<{ name: string }>()
  const { t, toNativeDigits: formatNum, lang } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const acParam = searchParams.get('ac') || ''
  const [selectedAc, setSelectedAc] = useState<string>(acParam)
  const chartTheme = useChartTheme()

  const [data, setData] = useState<any>(() => getSafeSessionConstituency(name))
  const [loading, setLoading] = useState(() => !getSafeSessionConstituency(name))
  const [activeTab, setActiveTab] = useState<'overview' | 'works' | 'flags'>('overview')
  const effectiveTab = (user?.role === 'viewer' && activeTab === 'flags') ? 'overview' : activeTab
  const [workFilter, setWorkFilter] = useState<'all' | 'recommended' | 'completed' | 'remained'>('all')
  const [isRecommendModalOpen, setIsRecommendModalOpen] = useState(false)
  const [workSearch, setWorkSearch] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [selectedFlag, setSelectedFlag] = useState<FlagDossierData | null>(null)
  const [workPage, setWorkPage] = useState(1)
  const [workPageSize, setWorkPageSize] = useState<number | 'all'>(30)
  const [chartKey, setChartKey] = useState(0)
  const [prevName, setPrevName] = useState(name)
  const [prevAcParam, setPrevAcParam] = useState(acParam)

  if (name !== prevName) {
    setPrevName(name)
    setPrevAcParam(acParam)
    const nextSeed = getSafeSessionConstituency(name)
    setData(nextSeed)
    setLoading(!nextSeed)
    setActiveTab('overview')
    setWorkFilter('all')
    setWorkSearch('')
    setCategoryFilter('all')
    setWorkPage(1)
    setSelectedAc(acParam)
  } else if (acParam !== prevAcParam) {
    setPrevAcParam(acParam)
    setSelectedAc(acParam)
    setWorkPage(1)
  }

  useEffect(() => {
    const timer = setTimeout(() => setChartKey(1), 50)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    async function loadConstituency() {
      if (!name) return
      const cleanName = (name || '').trim()
      const cached = getSafeSessionConstituency(cleanName)
      if (!cached) {
        setLoading(true)
      }

      try {
        const json = await fetchPrefetchedJson(`/api/constituencies/${encodeURIComponent(cleanName)}`)
        if (json?.data) {
          setData(json.data)
          try {
            localStorage.setItem(`cached_constituency_v2_${cleanName}`, JSON.stringify(json.data))
            sessionStorage.setItem(`cached_constituency_v2_${cleanName}`, JSON.stringify(json.data))
          } catch {}
          const currentAcParam = typeof window !== 'undefined'
            ? (new URLSearchParams(window.location.search).get('ac') || '')
            : ''
          if (json.data?.summary?.matched_assembly_constituency && !currentAcParam) {
            setSelectedAc(json.data.summary.matched_assembly_constituency)
            setWorkPage(1)
          }
          setLoading(false)
          return
        }
      } catch (err) {
        console.log('API fetch failed, trying fallback:', err)
      }

      // Resilient fallback with 100% real data
      const fallback = getSafeSessionConstituency(cleanName)
      if (fallback) {
        setData(fallback)
      }
      setLoading(false)
    }
    loadConstituency()
  }, [name])

  if (loading) {
    return <LoadingSkeleton rows={6} height="h-32" />
  }

  if (!data || !data.summary) {
    return (
      <EmptyState
        title="Constituency Record Not Found"
        description={`No parliamentary constituency matching "${name}" was found.`}
        action={
          <Link
            to="/map"
            className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold shadow"
          >
            Explore GIS Map
          </Link>
        }
      />
    )
  }

  const { summary, sectorBreakdown = [], agencyBreakdown = [], works = [], flags = [] } = data
  const rawAlloc = Number(summary.allocatedAmount || 0)
  const rawExp = Number(summary.totalExpenditure || 0)
  const rawUnspent = Number(summary.unspentAmount || 0)
  const util = Number(summary.utilizationPercentage || 0)

  const totalWorks = summary.totalWorks || (summary.completedWorksCount + summary.remainedWorksCount)
  const completedWorks = summary.completedWorksCount || 0
  const remainedWorks = summary.remainedWorksCount || Math.max(0, totalWorks - completedWorks)
  const completionRate = summary.completionRate || (totalWorks > 0 ? ((completedWorks / totalWorks) * 100).toFixed(1) : 0)

  const rawAssembliesList: any[] =
    Array.isArray(summary.assembly_segments) && summary.assembly_segments.length > 0
      ? summary.assembly_segments
      : (summary.assemblies || [])

  const seenAcKeys = new Set<string>()
  const assembliesList: any[] = rawAssembliesList.filter((ac: any) => {
    const k = String(ac?.ac_name || '').trim().toLowerCase()
    if (!k || seenAcKeys.has(k)) return false
    seenAcKeys.add(k)
    return true
  })

  const canonicalAcByLower: Record<string, string> = {}
  assembliesList.forEach((ac: any) => {
    const acName = String(ac.ac_name || '').trim()
    if (acName) canonicalAcByLower[acName.toLowerCase()] = acName
  })

  const hasExplicitSegments = works.some(
    (w: any) => typeof w.assembly_segment === 'string' && w.assembly_segment.trim().length > 0
  )

  const getResolvedWorkSegment = (w: any): string => {
    const explicit = typeof w.assembly_segment === 'string' ? w.assembly_segment.trim() : ''
    if (explicit) {
      if (explicit.toLowerCase() === UNSPECIFIED_SEGMENT.toLowerCase()) return UNSPECIFIED_SEGMENT
      return canonicalAcByLower[explicit.toLowerCase()] || explicit
    }
    if (!hasExplicitSegments) {
      return resolveWorkSegmentFallback(w, assembliesList, summary.name || '')
    }
    return UNSPECIFIED_SEGMENT
  }

  const segmentCounts: Record<string, number> = {}
  assembliesList.forEach((ac: any) => {
    const k = String(ac.ac_name || '').trim().toLowerCase()
    if (k) segmentCounts[k] = 0
  })
  let unspecifiedCount = 0

  if (works.length > 0) {
    works.forEach((w: any) => {
      const seg = getResolvedWorkSegment(w)
      const segLower = seg.toLowerCase()
      if (segLower !== UNSPECIFIED_SEGMENT.toLowerCase() && segLower in segmentCounts) {
        segmentCounts[segLower] += 1
      } else {
        unspecifiedCount += 1
      }
    })
  } else {
    assembliesList.forEach((ac: any) => {
      const k = String(ac.ac_name || '').trim().toLowerCase()
      if (k) segmentCounts[k] = Number(ac.count ?? 0)
    })
    unspecifiedCount = Number(summary.unspecifiedWorksCount ?? 0)
  }

  const matchesSelectedAc = (w: any, targetAc: string): boolean => {
    const q = targetAc.trim().toLowerCase()
    if (!q) return true
    if (typeof w.assembly_segment === 'string' && w.assembly_segment.trim().length > 0) {
      return w.assembly_segment.trim().toLowerCase() === q
    }
    if (!hasExplicitSegments) {
      const resolved = resolveWorkSegmentFallback(w, assembliesList, summary.name || '')
      if (q === UNSPECIFIED_SEGMENT.toLowerCase() || q in canonicalAcByLower) {
        return resolved.toLowerCase() === q
      }
      const base = normalizeAcBase(targetAc)
      if (!base) return false
      const desc = String(w.description || w.work_description || w.workDescription || '').toLowerCase()
      const rawLoc = String(w.location || '').trim()
      const normPc = normalizeAcBase(summary.name || '')
      const normWorkDist = normalizeAcBase(String(w.district || ''))
      const normLoc = normalizeAcBase(rawLoc)
      const isGenericLoc = !normLoc || normLoc === normPc || normLoc === normWorkDist
      const searchable = isGenericLoc ? desc : `${desc} ${rawLoc.toLowerCase()}`
      return new RegExp(`\\b${escapeRegExp(base).replace(/\s+/g, '\\s+')}\\b`, 'i').test(searchable)
    }
    return q === UNSPECIFIED_SEGMENT.toLowerCase()
  }

  const acScopedWorks = selectedAc
    ? works.filter((w: any) => matchesSelectedAc(w, selectedAc))
    : works

  const worksRecCount = acScopedWorks.filter((w: any) => (w.status || '').toLowerCase().includes('recommended')).length
  const worksCompCount = acScopedWorks.filter((w: any) => (w.status || '').toLowerCase().includes('completed')).length

  // Works filtering logic
  const filteredWorks = acScopedWorks.filter((w: any) => {
    const st = (w.status || '').toLowerCase()
    const isComp = st.includes('completed')
    const isRec = st.includes('recommended')

    // Status filter
    if (workFilter === 'completed' && !isComp) return false
    if (workFilter === 'recommended' && !isRec) return false
    if (workFilter === 'remained' && isComp) return false

    // Category filter
    if (categoryFilter !== 'all' && (w.category || '').toLowerCase() !== categoryFilter.toLowerCase()) return false

    // Search query
    if (workSearch.trim()) {
      const q = workSearch.toLowerCase()
      const inId = String(w.work_id).includes(q)
      const inDesc = (w.description || '').toLowerCase().includes(q)
      const inLoc = (w.location || '').toLowerCase().includes(q)
      const inAgency = (w.implementing_agency || '').toLowerCase().includes(q)
      const inSeg = (w.assembly_segment || '').toLowerCase().includes(q)
      if (!inId && !inDesc && !inLoc && !inAgency && !inSeg) return false
    }

    return true
  })

  // Chart data formatting - show full text without truncation or ellipsis
  const chartSectors = sectorBreakdown.slice(0, 6).map((s: any) => ({
    name: s.category,
    fullName: s.category,
    amountCr: Number((s.amount / 10000000).toFixed(2)),
    count: s.count
  }))

  const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4']

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Breadcrumb Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackButton fallback="/map" />
          <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)] flex-wrap">
            <Link to="/" className="hover:text-[var(--text-primary)] transition">Home</Link>
            <ChevronRight size={12} />
            {summary.state && (
              <>
                <Link to={`/states/${encodeURIComponent(summary.state)}`} className="hover:text-[var(--text-primary)] transition">
                  {summary.state}
                </Link>
                <ChevronRight size={12} />
              </>
            )}
            <span className="font-bold text-[var(--text-primary)]">{summary.name}</span>
          </div>
        </div>
      </div>

      {/* Official Constituency Header */}
      <div className="rounded-2xl p-6 sm:p-7 bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-start sm:items-center gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border border-[var(--brand-primary)]/20">
                PARLIAMENTARY CONSTITUENCY
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--surface-alt)] text-[var(--text-secondary)] border border-[var(--border-primary)]">
                {translateState(summary.state, lang)}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--surface-alt)] text-[var(--text-secondary)] border border-[var(--border-primary)]">
                {summary.house || 'Lok Sabha'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight">
              {translateConstituency(summary.name, lang)}
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5 flex items-center gap-1.5">
              <span>Constituency Territorial Profile &bull; Statutory 5-Year Development Envelope</span>
            </p>
          </div>
        </div>

        {/* Quick Action Badges */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Recommend Work Action */}
          <button
            type="button"
            onClick={() => setIsRecommendModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--brand-primary)] hover:opacity-90 text-white text-xs font-bold shadow-md shadow-[var(--brand-primary)]/20 transition cursor-pointer"
          >
            <PlusCircle size={15} />
            <span>{t('btn.recommend_work')}</span>
          </button>

          {/* Deep-link to GIS Map */}
          <Link
            to={`/map?pc=${encodeURIComponent(summary.name)}`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition group"
          >
            <Globe2 size={15} />
            <span>Open in GIS Map</span>
            <ArrowUpRight size={13} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
          </Link>

          {/* Sitting MP Badge with 1-click Link to MP profile */}
          {summary.mp?.name && (
            <Link
              to={`/mps/${encodeURIComponent(summary.mp.id || summary.mp.name)}`}
              className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[var(--surface-alt)] hover:bg-[var(--border-primary)]/40 border border-[var(--border-primary)] text-xs text-[var(--text-primary)] transition group"
            >
              <div className="w-6 h-6 rounded-full bg-[var(--brand-primary)]/15 text-[var(--brand-primary)] flex items-center justify-center shrink-0">
                <User size={13} />
              </div>
              <div className="text-left">
                <div className="text-[9px] uppercase font-bold text-[var(--text-tertiary)]">Incumbent MP</div>
                <div className="font-extrabold truncate max-w-[150px]">{translateMP(summary.mp.name, lang)}</div>
              </div>
              <ChevronRight size={14} className="text-[var(--text-tertiary)] group-hover:translate-x-0.5 transition" />
            </Link>
          )}
        </div>
      </div>

      {/* Assembly Segment Alert Banner (if user searched or filtered by AC) */}
      {selectedAc && (
        <div className="p-4 rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-xs font-bold text-[var(--text-primary)] flex flex-wrap items-center gap-1.5">
                <span>Assembly Segment (Vidhan Sabha): <strong>{selectedAc}</strong></span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--surface-alt)] text-[var(--text-secondary)] border border-[var(--border-primary)]">
                  {selectedAc === UNSPECIFIED_SEGMENT ? `${summary.name} District-Wide` : `Part of ${summary.name} Lok Sabha`}
                </span>
                {works.length > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border border-[var(--brand-primary)]/20 tabular-nums">
                    {formatNum(acScopedWorks.length)} of {formatNum(works.length)} detailed works
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                {selectedAc === UNSPECIFIED_SEGMENT
                  ? 'Viewing district-wide projects and works without a specific localized Vidhan Sabha segment tag.'
                  : 'Viewing developmental works and fund utilization allocated for this assembly segment.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setSelectedAc('')
              setSearchParams({}, { replace: true })
              setWorkPage(1)
            }}
            className="px-3 py-1.5 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-bold transition shrink-0 cursor-pointer"
          >
            Clear Segment Filter &times;
          </button>
        </div>
      )}

      {/* ⭐ TOP HIGHLIGHT: Statutory Fund Card */}
      <FundCard
        allocated={rawAlloc}
        used={rawExp}
        balance={rawUnspent}
        utilization={util}
        mpName={summary.mp?.name || 'Sitting Representative'}
        constituency={summary.name}
        house={summary.house || 'Lok Sabha'}
        party={summary.mp?.party || ''}
        term={summary.house === 'Rajya Sabha' ? 'Rajya Sabha' : '18th Lok Sabha'}
      />

      {/* Key Works & Governance Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="table.total_works"
          value={totalWorks}
          icon={FileCheck2}
          theme="navy"
          tooltip="Total developmental civil projects recommended by the MP in this constituency."
        />

        <StatCard
          label="status.completed"
          value={completedWorks}
          icon={CheckCircle2}
          theme="emerald"
          tooltip="Civil projects that have received final completion certificates."
        />

        <StatCard
          label="status.recommended"
          value={remainedWorks}
          icon={Clock}
          theme="amber"
          tooltip="Projects recommended by the MP actively pending sanction or under physical progress."
        />

        <StatCard
          label="states.tab_forensic_flags"
          value={summary.redFlagCount ?? 0}
          icon={AlertTriangle}
          theme={(summary.redFlagCount ?? 0) > 0 ? 'red' : 'emerald'}
          tooltip="Algorithmic fraud & anomaly alerts detected across projects in this constituency."
        />
      </div>

      {/* Interactive Assembly Segments Grid (Vidhan Sabha ACs) */}
      {(assembliesList.length > 0 || unspecifiedCount > 0) && (
        <div className="p-4 rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-sm space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-black uppercase tracking-wider text-[var(--text-tertiary)] flex flex-wrap items-center gap-2">
              <span>Vidhan Sabha Assembly Segments ({assembliesList.length})</span>
              {works.length > 0 && works.length < totalWorks && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold normal-case tracking-normal bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  Showing {formatNum(works.length)} of {formatNum(totalWorks)} detailed records
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedAc && (
                <button
                  type="button"
                  aria-label={`Clear assembly segment filter ${selectedAc}`}
                  onClick={() => {
                    setSelectedAc('')
                    setSearchParams({}, { replace: true })
                    setWorkPage(1)
                  }}
                  className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer"
                >
                  Clear Segment
                </button>
              )}
              <span className="text-[10px] text-[var(--text-tertiary)]">Click any segment to filter works</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(() => {
              const handleToggleSegment = (targetAc: string) => {
                const isSelected = selectedAc.toLowerCase() === targetAc.toLowerCase()
                if (isSelected) {
                  setSelectedAc('')
                  setSearchParams({}, { replace: true })
                  setWorkPage(1)
                } else {
                  setSelectedAc(targetAc)
                  setSearchParams({ ac: targetAc }, { replace: true })
                  setWorkPage(1)
                  setActiveTab('works')
                }
              }
              return (
                <>
                  {assembliesList.map((ac: any) => {
                    const isSelected = selectedAc.toLowerCase() === (ac.ac_name || '').toLowerCase()
                    const count = segmentCounts[(ac.ac_name || '').toLowerCase()] ?? 0
                    return (
                      <button
                        key={ac.ac_name}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => handleToggleSegment(ac.ac_name)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition border inline-flex items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-sm'
                            : 'bg-[var(--surface-alt)] hover:bg-[var(--border-primary)]/60 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-primary)]'
                        }`}
                      >
                        <span>{ac.ac_name}</span>
                        {ac.district && (
                          <span className="text-[10px] opacity-75 font-normal">
                            ({ac.district})
                          </span>
                        )}
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : count > 0
                                ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                                : 'bg-[var(--surface-primary)] text-[var(--text-tertiary)]'
                          }`}
                        >
                          {formatNum(count)}
                        </span>
                      </button>
                    )
                  })}
                  {unspecifiedCount > 0 && (() => {
                    const isUnspecSelected = selectedAc.toLowerCase() === UNSPECIFIED_SEGMENT.toLowerCase()
                    return (
                      <button
                        key={UNSPECIFIED_SEGMENT}
                        type="button"
                        aria-pressed={isUnspecSelected}
                        onClick={() => handleToggleSegment(UNSPECIFIED_SEGMENT)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition border inline-flex items-center gap-1.5 cursor-pointer ${
                          isUnspecSelected
                            ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                            : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/30 border-dashed'
                        }`}
                        title="District-wide schemes or works without a single localized Vidhan Sabha tag"
                      >
                        <span>District-Wide / Unspecified</span>
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${
                            isUnspecSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-amber-500/20 text-amber-900 dark:text-amber-200'
                          }`}
                        >
                          {formatNum(unspecifiedCount)}
                        </span>
                      </button>
                    )
                  })()}
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div role="tablist" aria-label="Constituency sections" className="flex items-center gap-2 border-b border-[var(--border-primary)] pb-2">
        <button
          type="button"
          role="tab"
          aria-selected={effectiveTab === 'overview'}
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 ${
            effectiveTab === 'overview'
              ? 'bg-[var(--brand-primary)] text-white shadow-sm'
              : 'text-[var(--text-secondary)] hover:bg-[var(--surface-alt)]'
          }`}
        >
          <span>Sectoral & Agency Overview</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={effectiveTab === 'works'}
          onClick={() => setActiveTab('works')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 ${
            effectiveTab === 'works'
              ? 'bg-[var(--brand-primary)] text-white shadow-sm'
              : 'text-[var(--text-secondary)] hover:bg-[var(--surface-alt)]'
          }`}
        >
          <span>Developmental Works ({works.length > 0 ? filteredWorks.length : totalWorks})</span>
        </button>

        {user?.role !== 'viewer' && (
          <button
            type="button"
            role="tab"
            aria-selected={effectiveTab === 'flags'}
            onClick={() => setActiveTab('flags')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 ${
              effectiveTab === 'flags'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-alt)]'
            }`}
          >
            <span>Forensic Alerts ({flags.length || summary.redFlagCount || 0})</span>
          </button>
        )}
      </div>

      {/* TAB 1: Overview & Sector Breakdown */}
      {effectiveTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sector Outlay Chart */}
          <SectionCard
            title="Sectoral Development Outlay"
            subtitle="Allocation breakdown across public asset categories"
          >
            {chartSectors.length > 0 ? (
              <div className="h-80 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    key={`bar-chart-${chartKey}`}
                    data={chartSectors}
                    margin={{ top: 15, right: 15, left: 15, bottom: 85 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" opacity={0.5} vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: 'var(--text-secondary)', fontSize: 10, fontWeight: 500 }}
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                      height={85}
                    />
                    <YAxis
                      width={65}
                      tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                      tickFormatter={(val) => `₹${val} Cr`}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                      contentStyle={{
                        backgroundColor: 'var(--surface-primary)',
                        borderColor: 'var(--border-primary)',
                        borderRadius: '12px',
                        fontSize: '12px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                      }}
                      formatter={(val: any) => [`₹${val} Cr`, 'Allocated']}
                    />
                    <Bar
                      dataKey="amountCr"
                      fill="#3B82F6"
                      radius={[6, 6, 0, 0]}
                      isAnimationActive={true}
                      animationDuration={800}
                      animationEasing="ease-out"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-[var(--text-tertiary)]">
                Sectoral breakdown records updating...
              </div>
            )}
          </SectionCard>

          {/* Top Implementing Agencies */}
          <SectionCard
            title="Active Implementing Agencies (IDAs)"
            subtitle="Executive wings responsible for tender & field execution"
          >
            <div className="space-y-3">
              {agencyBreakdown.length > 0 ? (
                agencyBreakdown.slice(0, 5).map((ag: any, idx: number) => (
                  <div
                    key={ag.agency || idx}
                    className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-bold text-xs text-[var(--text-tertiary)] w-5 shrink-0">
                        {idx + 1}.
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-[var(--text-primary)] break-words">
                          {ag.agency}
                        </div>
                        <div className="text-[10px] text-[var(--text-secondary)]">
                          {ag.count} developmental projects
                        </div>
                      </div>
                    </div>
                    <div className="font-extrabold text-[var(--text-primary)] tabular-nums shrink-0">
                      ₹{(ag.amount / 10000000).toFixed(2)} Cr
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-xs text-[var(--text-tertiary)]">
                  Agency assignment telemetry being synchronized.
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      )}

      {/* TAB 2: Developmental Works Explorer */}
      {effectiveTab === 'works' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-4 rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)] flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <input
                  type="text"
                  value={workSearch}
                  onChange={(e) => {
                    setWorkSearch(e.target.value)
                    setWorkPage(1)
                  }}
                  placeholder="Search works by ID, description, location..."
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] w-64"
                />
              </div>

              <div className="flex items-center gap-1 bg-[var(--surface-alt)] p-1 rounded-xl border border-[var(--border-primary)]">
                {[
                  { id: 'all', label: `All (${acScopedWorks.length})` },
                  { id: 'recommended', label: `${t('status.recommended')} (${worksRecCount})` },
                  { id: 'completed', label: `${t('status.completed')} (${worksCompCount})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setWorkFilter(tab.id as any)
                      setWorkPage(1)
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      workFilter === tab.id
                        ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setIsRecommendModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm hover:opacity-90 cursor-pointer shrink-0"
              >
                <PlusCircle size={14} />
                <span>{t('btn.recommend_work')}</span>
              </button>

              {/* Page Size Selector */}
              <div className="flex items-center gap-1 bg-[var(--surface-alt)] px-2 py-1 rounded-xl border border-[var(--border-primary)] text-xs">
                <span className="text-[10px] text-[var(--text-tertiary)] font-bold uppercase mr-1">{t('common.per_page')}:</span>
                {[30, 50, 100, 'all'].map((sz) => (
                  <button
                    key={sz}
                    onClick={() => {
                      setWorkPageSize(sz as any)
                      setWorkPage(1)
                    }}
                    className={`px-2 py-0.5 rounded text-xs font-bold transition ${
                      workPageSize === sz
                        ? 'bg-[var(--brand-primary)] text-white shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {sz === 'all' ? t('common.all') : formatNum(sz)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)] font-semibold">
              <span>
                Showing <strong className="text-[var(--text-primary)]">{formatNum(filteredWorks.length)}</strong>
                {selectedAc ? <> of <strong className="text-[var(--text-primary)]">{formatNum(acScopedWorks.length)}</strong> in {selectedAc}</> : <> works</>}
              </span>
              {works.length > 0 && works.length < totalWorks && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  Showing {formatNum(works.length)} of {formatNum(totalWorks)} detailed records
                </span>
              )}
            </div>
          </div>

          {/* Works Table */}
          {(() => {
            const paginatedWorks = workPageSize === 'all'
              ? filteredWorks
              : filteredWorks.slice((workPage - 1) * Number(workPageSize), workPage * Number(workPageSize))
            const totalWorkPages = workPageSize === 'all' ? 1 : Math.ceil(filteredWorks.length / Number(workPageSize)) || 1

            return (
              <div className="rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
                    <thead>
                      <tr className="bg-[var(--surface-alt)] border-b border-[var(--border-primary)] text-[var(--text-tertiary)] font-bold uppercase text-[10px] tracking-wider">
                        <th className="p-3.5 w-20">Work ID</th>
                        <th className="p-3.5 min-w-[200px]">Description</th>
                        <th className="p-3.5 min-w-[140px] w-36">Category</th>
                        <th className="p-3.5 min-w-[140px] w-36">Location</th>
                        <th className="p-3.5 w-28 text-right whitespace-nowrap">Cost</th>
                        <th className="p-3.5 w-28 text-center">Status</th>
                        <th className="p-3.5 min-w-[220px] w-64">Implementing Agency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-primary)]">
                      {paginatedWorks.length > 0 ? (
                        paginatedWorks.map((w: any) => {
                          const isComp = (w.status || '').toLowerCase().includes('completed')
                          return (
                            <tr key={w.work_id} className="hover:bg-[var(--surface-alt)]/60 transition-colors duration-100">
                              <td className="p-3.5 font-bold font-mono text-[var(--brand-primary)]">
                                <div className="flex items-center gap-1.5">
                                  <span>#{formatNum(w.work_id)}</span>
                                  {w.isNew && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-500 text-white animate-pulse">
                                      NEW
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3.5 font-medium text-[var(--text-primary)]" title={w.description}>
                                <div className="line-clamp-2 break-words text-xs leading-relaxed">
                                  {w.description}
                                </div>
                              </td>
                              <td className="p-3.5 text-[var(--text-secondary)]">
                                <span className="px-2.5 py-1 rounded-md bg-[var(--surface-alt)] border border-[var(--border-primary)] text-[11px] font-semibold inline-block break-words leading-snug">
                                  {w.category}
                                </span>
                              </td>
                              <td className="p-3.5 text-[var(--text-secondary)] break-words leading-snug" title={w.location}>
                                <div>{w.location}</div>
                                {w.assembly_segment && (
                                  <span
                                    className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                      w.assembly_segment === UNSPECIFIED_SEGMENT
                                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
                                        : 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border-[var(--brand-primary)]/20'
                                    }`}
                                  >
                                    {w.assembly_segment}
                                  </span>
                                )}
                              </td>
                              <td className="p-3.5 font-bold text-[var(--text-primary)] tabular-nums text-right whitespace-nowrap">
                                ₹{formatNum(Number(w.cost || 0).toLocaleString('en-IN'))}
                              </td>
                              <td className="p-3.5 text-center whitespace-nowrap">
                                {(() => {
                                  const st = (w.status || '').toLowerCase()
                                  const isComp = st.includes('completed')
                                  const isRec = st.includes('recommended')
                                  return (
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                      isComp
                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                        : isRec
                                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                    }`}>
                                      {isComp ? <CheckCircle2 size={10} /> : isRec ? <FileCheck2 size={10} /> : <Clock size={10} />}
                                      <span>{isComp ? t('status.completed') : isRec ? t('status.recommended') : t('status.in_progress')}</span>
                                    </span>
                                  )
                                })()}
                              </td>
                              <td className="p-3.5 text-[var(--text-secondary)] break-words leading-snug font-medium" title={w.implementing_agency}>
                                {w.implementing_agency || 'State Agency'}
                              </td>
                            </tr>
                          )
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-xs text-[var(--text-secondary)]">
                            No projects match the selected criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {totalWorkPages > 1 && (
                  <div className="p-3 bg-[var(--surface-alt)] border-t border-[var(--border-primary)] text-xs text-[var(--text-secondary)] flex justify-between items-center">
                    <span>Showing {paginatedWorks.length} of {filteredWorks.length} works</span>
                    <div className="flex items-center gap-2">
                      <button
                        disabled={workPage === 1}
                        onClick={() => setWorkPage((p) => Math.max(1, p - 1))}
                        className="px-2.5 py-1 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] text-xs font-bold disabled:opacity-40"
                      >
                        {t('common.previous')}
                      </button>
                      <span className="text-xs font-semibold text-[var(--text-secondary)] px-1">
                        {t('common.page')} {formatNum(workPage)} {t('common.of')} {formatNum(totalWorkPages)}
                      </span>
                      <button
                        disabled={workPage === totalWorkPages}
                        onClick={() => setWorkPage((p) => Math.min(totalWorkPages, p + 1))}
                        className="px-2.5 py-1 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] text-xs font-bold disabled:opacity-40"
                      >
                        {t('common.next')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* TAB 3: Forensic Flags */}
      {effectiveTab === 'flags' && user?.role !== 'viewer' && (
        <div className="space-y-3">
          {flags.length > 0 ? (
            flags.map((flag: any) => (
              <div
                key={flag.anomaly_id}
                onClick={() => setSelectedFlag({
                  work_id: flag.work_id,
                  workId: flag.work_id,
                  detector_type: flag.detector_type,
                  detector_name: flag.detector_name,
                  severity: flag.severity,
                  explanation: flag.explanation
                })}
                className="p-4 rounded-2xl bg-[var(--surface-primary)] border border-rose-500/20 hover:border-rose-500/40 shadow-sm cursor-pointer transition flex items-start justify-between gap-4 group"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs text-[var(--text-primary)]">
                        {flag.detector_name}
                      </span>
                      <TierBadge tier={flag.tier || 'T1'} />
                      <span className="font-mono text-[10px] text-[var(--text-tertiary)]">
                        Work #{flag.work_id}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">
                      {flag.explanation}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    Severity: {Math.round(flag.severity * 100)}%
                  </span>
                  <div className="text-[10px] text-[var(--brand-primary)] font-bold mt-1 group-hover:underline">
                    {user?.role === 'viewer' ? 'View Findings →' : 'View Forensic Dossier →'}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)] text-center space-y-2">
              <CheckCircle2 size={24} className="mx-auto text-emerald-500" />
              <div className="font-bold text-xs text-[var(--text-primary)]">No Active Forensic Irregularities</div>
              <p className="text-[11px] text-[var(--text-secondary)]">
                All projects in this constituency comply with statutory CPWD financial benchmarks.
              </p>
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

      {/* Official Form 1A Recommend Work Modal */}
      <RecommendWorkModal
        isOpen={isRecommendModalOpen}
        onClose={() => setIsRecommendModalOpen(false)}
        mpId={summary.mp?.id || ''}
        mpName={summary.mp?.name || 'Sitting Representative'}
        state={summary.state || ''}
        constituency={summary.name || ''}
        house={summary.house || 'Lok Sabha'}
        unspentBalance={rawUnspent}
        onWorkRecommended={(newWork: any) => {
          setData((prev: any) => {
            if (!prev) return prev
            const updatedWorks = [
              {
                ...newWork,
                isNew: true,
                implementing_agency: newWork.implementing_agency || 'District Collectorate / RES Wing',
                location: newWork.location || summary.name,
                category: newWork.category || 'General Civil Works',
                assembly_segment: newWork.assembly_segment || selectedAc || UNSPECIFIED_SEGMENT
              },
              ...(prev.works || [])
            ]
            return {
              ...prev,
              summary: {
                ...prev.summary,
                totalWorks: (prev.summary.totalWorks || 0) + 1,
                recommendedWorksCount: (prev.summary.recommendedWorksCount || 0) + 1,
                remainedWorksCount: (prev.summary.remainedWorksCount || 0) + 1
              },
              works: updatedWorks
            }
          })
          setActiveTab('works')
          setWorkFilter('recommended')
        }}
      />
    </div>
  )
}

export default ConstituencyDetail
