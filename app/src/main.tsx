// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// MapLibre's CSS comes first so the app's map styles (credits, controls) override it; the globe's code loads later.
import 'maplibre-gl/dist/maplibre-gl.css'
import './styles/theme.css'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
