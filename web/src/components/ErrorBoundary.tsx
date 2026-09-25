import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertOctagon, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component tree:', error, errorInfo)

    // Check for chunk / dynamic import load failure (happens after new deployments)
    const isChunkError =
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('error loading dynamically imported module') ||
      error?.message?.includes('Loading chunk') ||
      error?.name === 'ChunkLoadError'

    if (isChunkError && typeof window !== 'undefined') {
      try {
        const lastReload = sessionStorage.getItem('last_chunk_reload')
        const now = Date.now()
        if (!lastReload || now - parseInt(lastReload, 10) > 8000) {
          sessionStorage.setItem('last_chunk_reload', now.toString())
          window.location.reload()
        }
      } catch {
        window.location.reload()
      }
    }
  }

  public render() {
    if (this.state.hasError) {
      const isChunkError =
        this.state.error?.message?.includes('Failed to fetch dynamically imported module') ||
        this.state.error?.message?.includes('error loading dynamically imported module') ||
        this.state.error?.message?.includes('Loading chunk') ||
        this.state.error?.name === 'ChunkLoadError'

      return (
        <div className="min-h-[50vh] flex items-center justify-center p-6">
          <div className="glass-panel p-8 max-w-lg text-center border-rose-500/30">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-500/30">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">
              {isChunkError ? 'Application Update Available' : 'View Render Issue Encountered'}
            </h2>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              {isChunkError
                ? 'A new version of the portal has been deployed. Please reload to access the latest parliamentary records and views.'
                : this.state.error?.message || 'An unexpected rendering error occurred while mounting this data view.'}
            </p>
            <button
              onClick={() => {
                if (isChunkError) {
                  window.location.reload()
                } else {
                  this.setState({ hasError: false, error: null })
                }
              }}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-2 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {isChunkError ? 'Reload Application' : 'Re-attempt Component Render'}
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
