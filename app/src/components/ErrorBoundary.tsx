// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Last line of defence: an unexpected error shows a message and a reload button instead of a blank page.
import { Component, type ErrorInfo, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Spark 1 stopped:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="load-screen" role="alert">
        <p className="load-title">Spark 1</p>
        <p>Something went wrong, so the page stopped. Reloading usually helps; if it happens again, the data files may be damaged.</p>
        <p className="small muted">Details: {error.message}</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Reload the page</button>
      </div>
    )
  }
}
