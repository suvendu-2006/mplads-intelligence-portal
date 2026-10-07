import { ALL_MP_SEATS, type MPSeatItem } from './allMpsData'
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
 * Loads heavy assembly constituency dataset asynchronously in a separate code-split chunk.
 */
export function loadSearchData(): Promise<SearchDataBundle> {
  if (loadedBundle) return Promise.resolve(loadedBundle)
  if (!searchBundlePromise) {
    searchBundlePromise = import('./assemblyConstituencies').then((acModule) => {
      loadedBundle = {
        allMps: ALL_MP_SEATS,
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
