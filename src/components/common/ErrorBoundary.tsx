import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw, Copy, Check } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  copied: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, copied: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, copied: false }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, copied: false })
  }

  handleCopy = () => {
    if (!this.state.error) return
    const text = `${this.state.error.message}\n\n${this.state.error.stack || ''}`
    navigator.clipboard?.writeText(text).then(() => {
      this.setState({ copied: true })
      setTimeout(() => this.setState({ copied: false }), 2000)
    })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex items-center justify-center min-h-[400px] animate-fade-in">
          <div className="glass-card p-8 max-w-md text-center">
            <AlertTriangle size={48} className="mx-auto mb-4 text-warning" />
            <h2 className="text-lg font-semibold text-text mb-2">页面出现错误</h2>
            <p className="text-sm text-text-muted mb-4">
              {this.state.error?.message || '发生了未知错误'}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="btn-primary justify-center"
              >
                <RotateCcw size={16} />
                重试
              </button>
              <button
                onClick={this.handleCopy}
                className="btn-secondary justify-center"
              >
                {this.state.copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                {this.state.copied ? '已复制' : '复制错误'}
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
