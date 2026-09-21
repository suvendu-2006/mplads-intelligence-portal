import React, { useEffect, useState, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MapContainer, GeoJSON, useMap } from 'react-leaflet'
import { Globe2, MapPin, Info, ArrowRight, Search, X } from 'lucide-react'
import { palette } from '../lib/palette'
import { findAssemblyConstituencies } from '../lib/assemblyConstituencies'
import { useTranslation, t, toNativeDigits, translateState } from '../lib/i18n'

const INDIA_CENTER: [number, number] = [22.0, 82.5]
const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [6.0, 67.5],
  [37.5, 97.5]
]

const TERRITORIES = [
  { key: 'geo.all_india', label: 'All India', bounds: INDIA_BOUNDS },
  { key: 'geo.jk_ladakh', label: 'Jammu & Kashmir & Ladakh', bounds: [[32.0, 73.0], [37.3, 80.5]] as [[number, number], [number, number]] },
  { key: 'geo.andaman_nicobar', label: 'Andaman & Nicobar', bounds: [[6.5, 92.0], [14.0, 94.5]] as [[number, number], [number, number]] },
  { key: 'geo.lakshadweep', label: 'Lakshadweep', bounds: [[8.0, 71.5], [12.5, 74.5]] as [[number, number], [number, number]] },
  { key: 'geo.delhi_ncr', label: 'Delhi NCR', bounds: [[28.3, 76.7], [28.9, 77.4]] as [[number, number], [number, number]] },
  { key: 'geo.north_east', label: 'North East', bounds: [[23.0, 89.5], [29.5, 97.5]] as [[number, number], [number, number]] },
]

function ResetViewControl() {
  const map = useMap()
  return (
    <div className="leaflet-top leaflet-left" style={{ marginTop: '70px', marginLeft: '10px' }}>
      <div className="leaflet-control leaflet-bar shadow-md border border-[var(--border-primary)] rounded-lg overflow-hidden">
        <button
          onClick={() => map.fitBounds(INDIA_BOUNDS, { padding: [15, 15], animate: true })}
          title="Reset to Full Sovereign India View"
          className="h-8 px-2.5 flex items-center justify-center bg-[var(--surface-primary)] text-[var(--text-primary)] hover:bg-[var(--surface-alt)] font-bold text-xs tracking-wider uppercase transition cursor-pointer"
        >
          {t('btn.reset')}
        </button>
      </div>
    </div>
  )
}

function InitialFitBounds() {
  const map = useMap()
  useEffect(() => {
    map.fitBounds(INDIA_BOUNDS, { padding: [15, 15] })
  }, [map])
  return null
}

function MapFocusController({ bounds }: { bounds: [[number, number], [number, number]] | null }) {
  const map = useMap()
  useEffect(() => {
    if (bounds) {
      map.flyToBounds(bounds, { maxZoom: 8, duration: 1.2, padding: [20, 20] })
    }
  }, [bounds, map])
  return null
}

function getFeatureBounds(geom: any): [[number, number], [number, number]] | null {
  if (!geom || !geom.coordinates) return null
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180

  function scan(c: any) {
    if (typeof c[0] === 'number' && typeof c[1] === 'number') {
      const lng = c[0]
      const lat = c[1]
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
      if (lng < minLng) minLng = lng
      if (lng > maxLng) maxLng = lng
    } else if (Array.isArray(c)) {
      c.forEach(scan)
    }
  }
  scan(geom.coordinates)
  if (minLat > maxLat || minLng > maxLng) return null
  return [[minLat, minLng], [maxLat, maxLng]]
}

const GEO_CACHE: Record<string, any> = {}

export const GISMap: React.FC = () => {
  const { t, lang } = useTranslation()
  const [layerType, setLayerType] = useState<'pcs' | 'districts'>('pcs')
  const [geoData, setGeoData] = useState<any>(() => {
    if (GEO_CACHE['pcs']) return GEO_CACHE['pcs']
    try {
      const saved = sessionStorage.getItem('cached_map_pcs')
      if (saved) {
        const parsed = JSON.parse(saved)
        GEO_CACHE['pcs'] = parsed
        return parsed
      }
    } catch {}
    return null
  })
  const [loading, setLoading] = useState(() => !GEO_CACHE['pcs'] && typeof window !== 'undefined' && !sessionStorage.getItem('cached_map_pcs'))
  const [metric, setMetric] = useState<'utilization' | 'works'>('utilization')
  const [selectedFeature, setSelectedFeature] = useState<any>(null)
  const [mapSearch, setMapSearch] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [flyToBounds, setFlyToBounds] = useState<[[number, number], [number, number]] | null>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const [searchParams] = useSearchParams()
  const queryParam = searchParams.get('pc') || searchParams.get('q') || searchParams.get('district')

  useEffect(() => {
    if (queryParam && geoData?.features) {
      const q = queryParam.trim().toLowerCase()
      const match = geoData.features.find((f: any) => {
        const p = f.properties || {}
        const name = String(p.pc_name || p.NAME_2 || p.district || '').trim().toLowerCase()
        return name === q || name.includes(q)
      })
      if (match) {
        setSelectedFeature(match.properties)
        const bounds = getFeatureBounds(match.geometry)
        if (bounds) setFlyToBounds(bounds)
      }
    }
  }, [geoData, queryParam])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    async function loadGeoJson() {
      if (GEO_CACHE[layerType]) {
        setGeoData(GEO_CACHE[layerType])
        setLoading(false)
        return
      }

      try {
        sessionStorage.removeItem('cached_map_pcs')
        sessionStorage.removeItem('cached_map_districts')
        sessionStorage.removeItem('cached_map_v2_pcs')
        sessionStorage.removeItem('cached_map_v2_districts')
        const saved = sessionStorage.getItem(`cached_map_v3_${layerType}`)
        if (saved) {
          const parsed = JSON.parse(saved)
          GEO_CACHE[layerType] = parsed
          setGeoData(parsed)
          setLoading(false)
          return
        }
      } catch {}

      setLoading(true)
      try {
        const staticUrl = `/data/${layerType === 'pcs' ? 'pcs_enriched' : 'districts_enriched'}.geojson`
        const apiUrl = layerType === 'pcs' ? '/api/map/pcs' : '/api/map/districts'
        
        let res = await fetch(staticUrl)
        if (!res.ok) {
          res = await fetch(apiUrl)
        }
        if (res.ok) {
          const json = await res.json()
          const featData = (json.data && json.data.type === 'FeatureCollection') ? json.data : json
          GEO_CACHE[layerType] = featData
          setGeoData(featData)
          try {
            const serialized = JSON.stringify(featData)
            if (serialized.length < 3 * 1024 * 1024) {
              sessionStorage.setItem(`cached_map_v3_${layerType}`, serialized)
            }
          } catch {}
        }
      } catch (err) {
        console.error('Failed to load GeoJSON:', err)
      } finally {
        setLoading(false)
      }
    }
    loadGeoJson()
  }, [layerType])

  const mapSuggestions = React.useMemo(() => {
    const q = mapSearch.trim().toLowerCase()
    if (q.length < 2 || !geoData?.features) return []
    const results: any[] = []

    // 1. Check Assembly Constituencies if on PC layer
    if (layerType === 'pcs') {
      const acMatches = findAssemblyConstituencies(q, 4)
      for (const ac of acMatches) {
        const pcFeature = geoData.features.find((f: any) => {
          const pcName = String(f.properties?.pc_name || '').trim().toUpperCase()
          return pcName === ac.pc.toUpperCase()
        })
        if (pcFeature) {
          results.push({
            type: 'Assembly',
            name: `${ac.ac} (Assembly)`,
            subtext: `Parent PC: ${ac.pc}, ${ac.state} • MP: ${ac.mpName}`,
            state: ac.state,
            mp: ac.mpName,
            feature: pcFeature,
            acName: ac.ac
          })
        }
      }
    }

    // 2. Direct Feature matches
    for (const feat of geoData.features) {
      const p = feat.properties || {}
      const name = String(p.pc_name || p.NAME_2 || p.district || p.district_name || '').trim()
      const state = String(p.state || p.NAME_1 || '').trim()
      const mp = String(p.mp_name || p.mps_active || '').trim()

      if (name.toLowerCase().includes(q) || mp.toLowerCase().includes(q) || state.toLowerCase().includes(q)) {
        results.push({
          type: layerType === 'pcs' ? 'Constituency' : 'District',
          name,
          state,
          mp,
          feature: feat
        })
      }
      if (results.length >= 8) break
    }
    return results
  }, [mapSearch, geoData, layerType])

  const handleSelectSuggestion = (s: any) => {
    setIsSearchOpen(false)
    setSelectedFeature(s.feature.properties)
    const bounds = getFeatureBounds(s.feature.geometry)
    if (bounds) {
      setFlyToBounds(bounds)
    }
  }

  const isDark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark'
  const ramp = isDark ? palette.sequential.dark : palette.sequential.light

  const getColor = (val: number, isPct: boolean) => {
    if (isPct) {
      if (val >= 80) return ramp[4]
      if (val >= 60) return ramp[3]
      if (val >= 40) return ramp[2]
      if (val >= 20) return ramp[1]
      return ramp[0]
    } else {
      if (val >= 150) return ramp[4]
      if (val >= 100) return ramp[3]
      if (val >= 50) return ramp[2]
      if (val >= 20) return ramp[1]
      return ramp[0]
    }
  }

  const styleFeature = (feature: any) => {
    const props = feature.properties || {}
    let val = 0
    let isPct = true

    if (layerType === 'pcs') {
      if (metric === 'utilization') {
        val = parseFloat(props.utilization_pct || props.utilizationPercentage || 0)
        isPct = true
      } else {
        val = parseInt(props.completed_works || props.completedWorksCount || 0, 10)
        isPct = false
      }
    } else {
      if (metric === 'utilization') {
        val = parseFloat(props.completion_rate_pct || 0)
        isPct = true
      } else {
        val = parseInt(props.completed_works_count || 0, 10)
        isPct = false
      }
    }

    const stateName = String(props.state || props.NAME_1 || '').toLowerCase()
    const isIsland = stateName.includes('andaman') || stateName.includes('lakshadweep')

    return {
      fillColor: getColor(val, isPct),
      weight: isIsland ? 2 : 1.2,
      opacity: 0.9,
      color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(30, 41, 59, 0.5)',
      fillOpacity: isIsland ? 0.95 : 0.85,
    }
  }

  const onEachFeature = (feature: any, layer: any) => {
    layer.on({
      click: () => {
        setSelectedFeature(feature.properties)
      },
      mouseover: (e: any) => {
        const l = e.target
        l.setStyle({
          weight: 2.5,
          color: isDark ? palette.fund.utilized.dark : palette.fund.utilized.light,
          fillOpacity: 0.9,
        })
      },
      mouseout: (e: any) => {
        const l = e.target
        l.setStyle(styleFeature(feature))
      },
    })
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Title & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--brand-primary)]">
              {t('geo.surveillance')}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              ● {t('geo.india_only')}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] flex items-center gap-2.5 tracking-tight">
            <Globe2 className="text-[var(--brand-primary)]" size={26} />
            <span>{t('geo.title')}</span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            {t('geo.subtitle')}
          </p>
        </div>

        {/* Quick Territory Focus Bar (Text only, no icons) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap mr-1">
            {t('geo.territory')}:
          </span>
          {TERRITORIES.map((tItem) => (
            <button
              key={tItem.key}
              onClick={() => {
                setFlyToBounds(tItem.bounds)
                if (tItem.key === 'geo.andaman_nicobar' && geoData?.features) {
                  const f = geoData.features.find((feat: any) => (feat.properties?.state || feat.properties?.NAME_1 || '').toLowerCase().includes('andaman'))
                  if (f) setSelectedFeature(f.properties)
                } else if (tItem.key === 'geo.lakshadweep' && geoData?.features) {
                  const f = geoData.features.find((feat: any) => (feat.properties?.state || feat.properties?.NAME_1 || '').toLowerCase().includes('lakshadweep'))
                  if (f) setSelectedFeature(f.properties)
                } else if (tItem.key === 'geo.jk_ladakh' && geoData?.features) {
                  const f = geoData.features.find((feat: any) => {
                    const s = (feat.properties?.state || feat.properties?.NAME_1 || '').toLowerCase()
                    return s.includes('ladakh') || s.includes('jammu')
                  })
                  if (f) setSelectedFeature(f.properties)
                }
              }}
              className="px-2.5 py-1 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] hover:bg-[var(--surface-alt)] text-[var(--text-primary)] font-semibold whitespace-nowrap transition cursor-pointer hover:border-[var(--brand-primary)] text-xs shadow-sm"
            >
              {t(tItem.key)}
            </button>
          ))}
        </div>

        {/* Toggle Controls & Interactive Map Search */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Interactive Map Search Input with Autocomplete */}
          <div ref={searchContainerRef} className="relative min-w-[240px] sm:min-w-[280px]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[var(--text-tertiary)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={mapSearch}
                onFocus={() => setIsSearchOpen(true)}
                onChange={(e) => {
                  setMapSearch(e.target.value)
                  setIsSearchOpen(true)
                }}
                placeholder={layerType === 'pcs' ? t('geo.search_pc_mp') : t('geo.search_district')}
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand-primary)] shadow-sm"
              />
              {mapSearch && (
                <button
                  onClick={() => {
                    setMapSearch('')
                    setIsSearchOpen(false)
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-0.5"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Suggestions Dropdown */}
            {isSearchOpen && mapSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--surface-primary)] border border-[var(--border-primary)] rounded-xl shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto">
                <div className="p-1 space-y-0.5">
                  {mapSuggestions.map((s, idx) => (
                    <button
                      key={`${s.name}-${idx}`}
                      onClick={() => handleSelectSuggestion(s)}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-[var(--surface-alt)] flex items-center justify-between group transition"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-[var(--text-primary)] truncate">{s.name}</div>
                        <div className="text-[10px] text-[var(--text-secondary)] truncate">
                          {s.subtext || `${s.state} ${s.mp ? `• MP: ${s.mp}` : ''}`}
                        </div>
                      </div>
                      <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded shrink-0 ml-1.5 ${s.type === 'Assembly' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'}`}>
                        {s.type}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Layer Selector */}
          <div className="flex items-center rounded-xl bg-[var(--surface-primary)] p-0.5 border border-[var(--border-primary)] text-xs font-bold shadow-sm">
            <button
              onClick={() => {
                setLayerType('pcs')
                setMapSearch('')
                setSelectedFeature(null)
              }}
              className={`px-3 py-1.5 rounded-lg transition ${
                layerType === 'pcs'
                  ? 'bg-[var(--brand-primary)] text-white shadow'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t('map.pcs_layer')}
            </button>
            <button
              onClick={() => {
                setLayerType('districts')
                setMapSearch('')
                setSelectedFeature(null)
              }}
              className={`px-3 py-1.5 rounded-lg transition ${
                layerType === 'districts'
                  ? 'bg-[var(--brand-primary)] text-white shadow'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t('map.districts_layer')}
            </button>
          </div>

          {/* Metric Selector */}
          <div className="flex items-center rounded-xl bg-[var(--surface-primary)] p-0.5 border border-[var(--border-primary)] text-xs font-bold shadow-sm">
            <button
              onClick={() => setMetric('utilization')}
              className={`px-3 py-1.5 rounded-lg transition ${
                metric === 'utilization'
                  ? 'bg-[var(--brand-primary)] text-white shadow'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t('map.metric_utilization')}
            </button>
            <button
              onClick={() => setMetric('works')}
              className={`px-3 py-1.5 rounded-lg transition ${
                metric === 'works'
                  ? 'bg-[var(--brand-primary)] text-white shadow'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t('map.metric_works')}
            </button>
          </div>
        </div>
      </div>

      {/* Map + Detail Sidebar Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Map Container */}
        <div className="lg:col-span-3 lux-card p-2 overflow-hidden h-[680px] lg:h-[720px] relative">
          <MapContainer
            center={INDIA_CENTER}
            zoom={4.3}
            zoomSnap={0.1}
            zoomDelta={0.25}
            minZoom={3.5}
            maxZoom={9}
            maxBounds={INDIA_BOUNDS}
            maxBoundsViscosity={1.0}
            style={{ height: '100%', width: '100%', borderRadius: '12px' }}
            className="z-0"
          >
            <InitialFitBounds />
            <ResetViewControl />
            <MapFocusController bounds={flyToBounds} />
            {geoData && (
              <GeoJSON
                key={`${layerType}-${metric}`}
                data={geoData}
                style={styleFeature}
                onEachFeature={onEachFeature}
              />
            )}
          </MapContainer>

          {loading && (
            <div className="absolute top-4 right-4 z-20 px-3 py-1.5 rounded-xl bg-[var(--surface-primary)]/90 border border-[var(--border-primary)] shadow-lg backdrop-blur text-xs font-bold text-[var(--brand-primary)] flex items-center gap-2 pointer-events-none">
              <span className="w-2 h-2 rounded-full bg-[var(--brand-primary)] animate-ping" />
              <span>{t('geo.rendering_map')}</span>
            </div>
          )}

          {/* Legend (Bottom-Right) */}
          <div className="absolute bottom-4 right-4 z-20 lux-card p-3 shadow-xl backdrop-blur-md text-xs pointer-events-none">
            <div className="font-bold text-[var(--text-primary)] text-[11px] mb-1.5 uppercase tracking-wider">
              {metric === 'utilization' ? 'Utilization / Realization' : 'Completed Projects'}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-[var(--text-secondary)]">{t('geo.low')}</span>
              <div
                className="w-28 h-2 rounded-full shadow-inner"
                style={{
                  background: `linear-gradient(to right, ${ramp[0]}, ${ramp[1]}, ${ramp[2]}, ${ramp[3]}, ${ramp[4]})`
                }}
              />
              <span className="text-[10px] font-bold text-[var(--text-primary)]">{t('geo.high')}</span>
            </div>
          </div>
        </div>

        {/* Side Panel: Selected Feature Inspector */}
        <div className="lg:col-span-1 lux-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[var(--brand-primary)] mb-3 pb-2 border-b border-[var(--border-primary)]">
              <MapPin size={14} />
              <span>{t('geo.inspector')}</span>
            </div>

            {selectedFeature ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-extrabold text-[var(--text-primary)] tracking-tight">
                    {selectedFeature.pc_name ||
                      selectedFeature.NAME_2 ||
                      selectedFeature.district ||
                      t('geo.geospatial_zone')}
                  </h3>
                  <div className="text-xs text-[var(--text-secondary)] font-medium">
                    {t('geo.state')}: <strong className="text-[var(--text-primary)]">{translateState(selectedFeature.state || selectedFeature.NAME_1, lang) || 'India'}</strong>
                  </div>
                  {selectedFeature.mp_name && (
                    <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {t('geo.mp')}: <strong className="text-[var(--text-primary)]">{selectedFeature.mp_name}</strong>
                    </div>
                  )}
                </div>

                {(() => {
                  const completedWorks = Number(selectedFeature.completed_works_count ?? selectedFeature.completed_works ?? 0)
                  const rawRecommended = Number(selectedFeature.remaining_works ?? selectedFeature.recommended_works ?? selectedFeature.ongoing_works ?? 0)
                  // Total works: If explicit total_works exists and is >= completed, use it; otherwise compute completed + rawRecommended
                  const totalWorks = (selectedFeature.total_works != null && Number(selectedFeature.total_works) >= completedWorks)
                    ? Number(selectedFeature.total_works)
                    : (completedWorks + rawRecommended)
                  const remainedWorks = Math.max(0, totalWorks - completedWorks)
                  const completionRate = totalWorks > 0 ? Math.min(100, Math.max(0, (completedWorks / totalWorks) * 100)).toFixed(1) : '0.0'
                  const allocated = selectedFeature.total_allocated ?? selectedFeature.allocated_amount
                  const spent = selectedFeature.total_expenditure
                  const utilRate = selectedFeature.utilization_pct ?? (allocated && spent ? ((spent / allocated) * 100).toFixed(1) : null)

                  return (
                    <div className="space-y-3">
                      {/* Works Execution Breakdown */}
                      <div className="p-3.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] space-y-2.5 text-xs">
                        <div className="font-bold text-[var(--text-secondary)] text-[11px] uppercase tracking-wider flex items-center justify-between">
                          <span>{t('geo.works_progress')}</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{toNativeDigits(completionRate, lang)}% {t('status.completed')}</span>
                        </div>

                        {/* Dual-tone Progress Bar */}
                        <div className="w-full h-2 rounded-full bg-[var(--surface-primary)] overflow-hidden flex">
                          <div
                            className="h-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${Math.min(100, Number(completionRate))}%` }}
                            title={`Completed: ${completedWorks} works`}
                          />
                          <div
                            className="h-full bg-amber-500 transition-all duration-500"
                            style={{ width: `${Math.max(0, 100 - Number(completionRate))}%` }}
                            title={`Remained: ${remainedWorks} works`}
                          />
                        </div>

                        <div className="space-y-1.5 pt-1">
                          <div className="flex justify-between items-center">
                            <span className="text-[var(--text-tertiary)] flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-blue-500" />
                              {t('kpi.completed')} + {t('kpi.pending')}:
                            </span>
                            <span className="font-extrabold text-[var(--text-primary)] tabular-nums">
                              {toNativeDigits(totalWorks.toLocaleString(), lang)}
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-[var(--text-tertiary)] flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              {t('kpi.completed')}:
                            </span>
                            <span className="font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                              {toNativeDigits(completedWorks.toLocaleString(), lang)}
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-[var(--text-tertiary)] flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              {t('kpi.pending')}:
                            </span>
                            <span className="font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
                              {toNativeDigits(remainedWorks.toLocaleString(), lang)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Financial Outlay & Spend */}
                      {(allocated || utilRate) && (
                        <div className="py-2 space-y-2 text-xs">
                          <div className="font-bold text-[var(--text-secondary)] text-[11px] uppercase tracking-wider">
                            {t('kpi.allocated')} & {t('kpi.used')}
                          </div>
                          {allocated && (
                            <div className="flex justify-between">
                              <span className="text-[var(--text-tertiary)]">{t('kpi.allocated')}:</span>
                              <span className="font-extrabold text-[var(--text-primary)] tabular-nums">
                                ₹{toNativeDigits((Number(allocated) / 10000000).toFixed(2), lang)} {t('unit.cr')}
                              </span>
                            </div>
                          )}
                          {spent && (
                            <div className="flex justify-between">
                              <span className="text-[var(--text-tertiary)]">{t('kpi.used')}:</span>
                              <span className="font-extrabold text-[var(--text-primary)] tabular-nums">
                                ₹{toNativeDigits((Number(spent) / 10000000).toFixed(2), lang)} {t('unit.cr')}
                              </span>
                            </div>
                          )}
                          {utilRate && (
                            <div className="flex justify-between">
                              <span className="text-[var(--text-tertiary)]">{t('kpi.utilization')}:</span>
                              <span className="font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                {toNativeDigits(Number(utilRate).toFixed(1), lang)}%
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Active Representatives */}
                      {selectedFeature.mp_count != null || selectedFeature.mps_active ? (
                        <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] text-xs flex items-center justify-between">
                          <span className="font-bold text-[var(--text-secondary)] text-[11px] uppercase tracking-wider">
                            {t('nav.browse_mps')}
                          </span>
                          <span className="font-extrabold text-[var(--brand-primary)] tabular-nums">
                            {toNativeDigits(selectedFeature.mp_count ?? (selectedFeature.mps_active ? selectedFeature.mps_active.split(',').filter(Boolean).length : 0), lang)} {t('unit.mps')}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  )
                })()}

                {selectedFeature.state && (
                  <Link
                    to={`/states/${encodeURIComponent(selectedFeature.state)}`}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
                    style={{ color: '#ffffff', textDecoration: 'none' }}
                  >
                    <span style={{ color: '#ffffff' }} className="font-bold text-white">{t('geo.view_state_report')}</span>
                    <ArrowRight size={14} style={{ color: '#ffffff' }} className="text-white" />
                  </Link>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-[var(--text-secondary)] space-y-2">
                <Info size={24} className="mx-auto text-[var(--text-tertiary)]" />
                <p>{t('geo.click_to_inspect')}</p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[var(--border-primary)] text-[11px] text-[var(--text-tertiary)]">
            {t('geo.gis_alignment_notice')}
          </div>
        </div>
      </div>
    </div>
  )
}
