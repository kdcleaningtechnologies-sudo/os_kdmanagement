import type { ReactNode } from 'react'
import { ExternalLink, MapPin } from 'lucide-react'
import type { Site } from '../types/database'
import { mapsUrl, osmEmbedUrl } from '../lib/maps'
import { titleCase } from '../lib/format'
import { Badge } from './ui/Badge'
import { Card } from './ui/Card'

export function SiteLocationCard({
  site,
  footer,
}: {
  site: Site
  footer?: ReactNode
}) {
  const hasGps = site.latitude != null && site.longitude != null

  return (
    <Card className="space-y-3" padded>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-tide-600 uppercase">
            {site.city ?? 'Site'} · {titleCase(site.site_type)}
          </p>
          <h3 className="mt-1 font-semibold text-ink-950">{site.name}</h3>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-ink-600">
            <MapPin size={14} className="mt-0.5 shrink-0" />
            {site.address ?? 'Address not on file'}
          </p>
        </div>
        <Badge value={site.site_type} />
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-ink-700">
        {site.area_sqft ? (
          <span className="rounded-full bg-sand-50 px-2.5 py-1">{Number(site.area_sqft).toLocaleString('en-IN')} sqft</span>
        ) : null}
        {site.shift_timings ? (
          <span className="rounded-full bg-sand-50 px-2.5 py-1">Shift {site.shift_timings}</span>
        ) : null}
        {(site.services ?? []).map((service) => (
          <span key={service} className="rounded-full bg-tide-50 px-2.5 py-1">
            {titleCase(service)}
          </span>
        ))}
      </div>

      {hasGps ? (
        <div className="overflow-hidden rounded-xl border border-sand-100">
          <iframe
            title={`Map of ${site.name}`}
            src={osmEmbedUrl(site.latitude!, site.longitude!)}
            className="h-40 w-full border-0"
            loading="lazy"
          />
          <a
            href={mapsUrl(site.latitude!, site.longitude!)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between bg-sand-50 px-3 py-2 text-xs font-semibold text-tide-600"
          >
            Open in Google Maps
            <ExternalLink size={12} />
          </a>
        </div>
      ) : (
        <p className="text-xs text-ink-600">GPS pin not stored for this site yet.</p>
      )}

      {footer}
    </Card>
  )
}
