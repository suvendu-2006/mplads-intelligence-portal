import type { MPSeatItem } from './allMpsData'
import type { AssemblyItem } from './assemblyConstituencies'

export type { MPSeatItem, AssemblyItem }

interface SearchDataBundle {
  allMps: MPSeatItem[]
  acs: AssemblyItem[]
  findAcs: (query: string, limit?: number) => AssemblyItem[]
}

let searchBundlePromise: Promise<SearchDataBundle> | null = null
let loadedBundle: SearchDataBundle | null = null

/**
 * Loads search datasets asynchronously in a separate code-split chunk.
 * Completely isolates 768 KB of AC data and 135 KB of MP seat records from the initial page bundle.
 */
export function loadSearchData(): Promise<SearchDataBundle> {
  if (loadedBundle) return Promise.resolve(loadedBundle)
  if (!searchBundlePromise) {
    searchBundlePromise = Promise.all([
      import('./allMpsData'),
      import('./assemblyConstituencies')
    ]).then(([mpsModule, acModule]) => {
      loadedBundle = {
        allMps: mpsModule.ALL_MP_SEATS,
        acs: acModule.ASSEMBLY_CONSTITUENCIES,
        findAcs: acModule.findAssemblyConstituencies
      }
      return loadedBundle
    })
  }
  return searchBundlePromise
}

/**
 * Synchronous accessor that returns loaded search data if ready, or null.
 */
export function getLoadedSearchData(): SearchDataBundle | null {
  return loadedBundle
}

/**
 * Background preloader to warm the search chunk during browser idle or on input focus.
 */
export function preloadSearchData(): void {
  if (!loadedBundle && !searchBundlePromise) {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => loadSearchData(), { timeout: 3000 })
    } else {
      setTimeout(() => loadSearchData(), 1500)
    }
  }
}
