import { Link } from 'react-router-dom'
import { useMyAssignments } from '../../hooks/useAssignments'
import { SiteLocationCard } from '../../components/SiteLocationCard'
import { PageHeader } from '../../components/layout/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'

export function SupervisorSitesPage() {
  const { assignments, loading, error } = useMyAssignments()

  if (loading) return <Spinner label="Loading sites" />

  return (
    <div>
      <PageHeader title="My sites" subtitle="Sites assigned to your supervisor profile." />
      {error ? <p className="mb-3 text-sm font-medium text-rose-600">{error}</p> : null}
      {assignments.length === 0 ? (
        <EmptyState title="No site assignment" body="Ask admin to attach your profile to a site as supervisor." />
      ) : (
        <div className="space-y-3">
          {assignments.map((row) =>
            row.sites ? (
              <SiteLocationCard
                key={row.id}
                site={row.sites}
                footer={
                  <div className="flex gap-2">
                    <Link
                      to="/supervisor/attendance"
                      className="rounded-xl bg-tide-600 px-3 py-2 text-xs font-semibold text-white"
                    >
                      Mark attendance
                    </Link>
                    <Link
                      to="/supervisor/tasks"
                      className="rounded-xl bg-ink-50 px-3 py-2 text-xs font-semibold text-ink-800"
                    >
                      Tasks
                    </Link>
                    <Link
                      to="/supervisor/inspections"
                      className="rounded-xl bg-ink-50 px-3 py-2 text-xs font-semibold text-ink-800"
                    >
                      Inspect
                    </Link>
                  </div>
                }
              />
            ) : null,
          )}
        </div>
      )}
    </div>
  )
}
