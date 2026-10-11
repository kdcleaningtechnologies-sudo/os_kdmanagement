import { useMyClients } from '../../hooks/useAssignments'
import { SiteLocationCard } from '../../components/SiteLocationCard'
import { PageHeader } from '../../components/layout/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'

export function ClientLocationsPage() {
  const { sites, loading } = useMyClients()

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader
        title="Locations"
        subtitle="Contracted sites with address, shift, service lines, and GPS used for staff geofencing."
      />
      {sites.length === 0 ? (
        <EmptyState title="No sites on your contract yet" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sites.map((site) => (
            <SiteLocationCard key={site.id} site={site} />
          ))}
        </div>
      )}
    </div>
  )
}
