import React from 'react'
import { AlertTriangle, RotateCw, Home } from 'lucide-react'
import { Button } from './Button'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="mx-auto my-12 flex max-w-md flex-col items-center justify-center rounded-2xl border border-line bg-white p-8 text-center shadow-card sm:p-10">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-danger-50 text-danger-600 shadow-sm border border-danger-200">
            <AlertTriangle className="h-7 w-7" />
          </span>
          <h2 className="mt-4 font-display text-xl font-bold text-ink">Something went wrong</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            An unexpected error occurred while loading this section.
          </p>
          {this.state.error?.message ? (
            <p className="mt-3 max-w-sm rounded-lg bg-slate-50 p-2.5 text-xs font-mono text-danger-700 break-words">
              {this.state.error.message}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="primary"
              size="sm"
              icon={RotateCw}
              onClick={() => {
                this.handleReset()
                window.location.reload()
              }}
            >
              Reload page
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Home}
              onClick={() => {
                this.handleReset()
                window.location.href = '/'
              }}
            >
              Back to home
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
