import { useEffect, useState } from 'react'
import { useMyClients } from '../../hooks/useAssignments'
import { supabase } from '../../lib/supabaseClient'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import type { EmployeeWithRelations } from '../../types/database'

export function ClientStaffPage() {
  const { sites, loading } = useMyClients()
  const [rows, setRows] = useState<EmployeeWithRelations[]>([])

  useEffect(() => {
    const ids = sites.map((site) => site.id)
    if (loading) return
    if (!ids.length) {
      setRows([])
      return
    }
    void supabase
      .from('employees')
      .select(
        'id, site_id, employee_code, designation, job_title, department, employment_status, profiles(full_name, photo_url, role), sites!site_id(name)',
      )
      .in('site_id', ids)
      .eq('employment_status', 'active')
      .then(({ data }) => setRows((data as EmployeeWithRelations[]) ?? []))
  }, [loading, sites])

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader title="Assigned staff" subtitle="Workers and supervisors on your sites." />
      {rows.length === 0 ? (
        <EmptyState title="No staff assigned" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <Card key={row.id} className="flex items-center gap-3">
              {row.profiles?.photo_url ? (
                <img src={row.profiles.photo_url} alt="" className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-tide-100 font-semibold text-ink-800">
                  {(row.profiles?.full_name ?? '?').slice(0, 1)}
                </div>
              )}
              <div>
                <p className="font-semibold text-ink-950">{row.profiles?.full_name ?? 'Staff'}</p>
                <p className="text-xs text-ink-600">
                  {row.sites?.name}
                  {row.job_title ? ` · ${row.job_title}` : ''}
                </p>
                <div className="mt-1">
                  <Badge value={row.designation} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
