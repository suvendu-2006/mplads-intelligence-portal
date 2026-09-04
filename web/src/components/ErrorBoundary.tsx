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
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center p-6">
          <div className="glass-panel p-8 max-w-lg text-center border-rose-500/30">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-500/30">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">View Render Issue Encountered</h2>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              {this.state.error?.message || 'An unexpected rendering error occurred while mounting this data view.'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-2 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Re-attempt Component Render
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
