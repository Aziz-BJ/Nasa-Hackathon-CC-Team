// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { Check, DownloadSimple, Link } from '@phosphor-icons/react'
import { useState } from 'react'
import type { AreaSeries } from '../lib/aggregate'
import type { Area } from '../lib/area'
import { buildCsv, csvFilename } from '../lib/csv'
import { saveFile } from '../lib/download'
import type { Manifest } from '../lib/types'

export function ExportButton({ manifest, area, series, i0, i1, onHotspots }: {
  manifest: Manifest; area: Area; series: AreaSeries; i0: number; i1: number
  /** Builds and saves the hotspots CSV; resolves to a short status line. Missing when the detection files are not available. */
  onHotspots?: () => Promise<string>
}) {
  const [copied, setCopied] = useState(false)
  const [hotspots, setHotspots] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  async function downloadHotspots() {
    if (!onHotspots) return
    setHotspots({ busy: true, note: 'Preparing the hotspots…' })
    try {
      setHotspots({ busy: false, note: await onHotspots() })
    } catch (e) {
      setHotspots({ busy: false, note: `Could not prepare the hotspots: ${e instanceof Error ? e.message : String(e)}` })
    }
  }
  function download() {
    saveFile(csvFilename(area, series.months[i0], series.months[i1]), buildCsv(manifest, area, series, i0, i1), 'text/csv;charset=utf-8')
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div>
      <p>Monthly fire cell-days for this area and these months ({series.months[i0]} to {series.months[i1]}): the harmonized record{series.low ? ' with its 90% range' : ''}, the raw count of every satellite, the source of each month, the comparison with {manifest.baseline_years[0]} to {manifest.baseline_years[1]}, and a header saying how it was made.</p>
      <button type="button" className="btn btn-primary" onClick={download}><DownloadSimple aria-hidden /> Download CSV</button>
      <p className="small muted" style={{ marginTop: '0.75rem' }}>Every chart also has a "Download image" button.</p>
      <h3 style={{ marginTop: '1.25rem' }}>Hotspots in this search</h3>
      <p className="small">Every cleaned NASA FIRMS detection in this area and these months, one row each: position, UTC time, satellite, confidence, fire radiative power and pixel size. Raw detections, not harmonized: counts are not comparable between sensors.</p>
      <button type="button" className="btn" onClick={() => void downloadHotspots()} disabled={!onHotspots || hotspots.busy}>
        <DownloadSimple aria-hidden /> Download hotspots CSV
      </button>
      <p className="small muted" aria-live="polite">{onHotspots ? hotspots.note : 'Hotspots are not available in this build.'}</p>
      <h3 style={{ marginTop: '1.25rem' }}>Share this view</h3>
      <p className="small">The link keeps the area, months, data source, and whether the detections layer is on.</p>
      <label className="small">Link<input type="text" readOnly value={window.location.href} onFocus={(e) => e.target.select()} style={{ width: '100%' }} /></label>
      <button type="button" className="btn" onClick={copyLink} style={{ marginTop: '0.5rem' }}>
        {copied ? <Check aria-hidden /> : <Link aria-hidden />} {copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  )
}
