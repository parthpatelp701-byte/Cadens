import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'

interface Props {
  children: ReactNode
  fallbackTitle?: string
}

interface State {
  hasError: boolean
  message?: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-[40vh] flex flex-col items-center justify-center text-center px-6 py-12"
          role="alert"
        >
          <h2 className="text-lg font-bold mb-2">
            {this.props.fallbackTitle || 'Something went wrong'}
          </h2>
          <p className="text-sm text-[var(--color-dim)] max-w-sm mb-6">
            {this.state.message || 'An unexpected error occurred. Try reloading this screen.'}
          </p>
          <Button
            onClick={() => {
              this.setState({ hasError: false, message: undefined })
              window.location.reload()
            }}
          >
            Reload
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
