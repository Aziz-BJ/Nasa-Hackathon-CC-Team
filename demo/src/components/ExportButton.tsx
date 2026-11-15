// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { Check, DownloadSimple, Link } from '@phosphor-icons/react'
import { useState } from 'react'
import type { AreaSeries } from '../lib/aggregate'
import type { Area } from '../lib/area'
import { buildCsv, csvFilename } from '../lib/csv'
import { saveFile } from '../lib/download'
import type { Manifest } from '../lib/types'

export function ExportButton({ manifest, area, series, i0, i1 }: {
  manifest: Manifest; area: Area; series: AreaSeries; i0: number; i1: number
}) {
  const [copied, setCopied] = useState(false)
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
      <p>Monthly hotspot counts for this area and these months ({series.months[i0]} to {series.months[i1]}), with every sensor, the data status and a provenance header.</p>
      <button type="button" className="btn btn-primary" onClick={download}><DownloadSimple aria-hidden /> Download CSV</button>
      <p className="small muted" style={{ marginTop: '0.75rem' }}>Every chart (Trends, Sensors, Reported) also has a "Download image" button.</p>
      <h3 style={{ marginTop: '1.25rem' }}>Share this view</h3>
      <p className="small">The link keeps the area, months and data source.</p>
      <label className="small">Link<input type="text" readOnly value={window.location.href} onFocus={(e) => e.target.select()} style={{ width: '100%' }} /></label>
      <button type="button" className="btn" onClick={copyLink} style={{ marginTop: '0.5rem' }}>
        {copied ? <Check aria-hidden /> : <Link aria-hidden />} {copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  )
}
