import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { withOrg } from '../../lib/orgWrite'
import { formatDateTime } from '../../lib/format'
import { seedPatrolChecks } from '../../lib/security'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Select, Textarea } from '../../components/ui/Input'
import { FormError } from '../../components/ui/FormError'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { Table, Td } from '../../components/ui/Table'
import {
  INCIDENT_STATUSES,
  PATROL_STATUSES,
  type EmployeeWithRelations,
  type IncidentStatus,
  type PatrolStatus,
  type SecurityCheckpointWithSite,
  type SecurityIncidentWithRelations,
  type SecurityPatrolWithRelations,
  type Site,
  type VisitorWithRelations,
} from '../../types/database'

const TABS = ['Guards', 'Checkpoints', 'Patrols', 'Incidents', 'Visitors'] as const
type Tab = (typeof TABS)[number]

const checkpointSchema = z.object({
  site_id: z.string().min(1),
  name: z.string().min(2),
  location_hint: z.string().optional(),
})

const patrolSchema = z.object({
  site_id: z.string().min(1),
  guard_id: z.string().optional(),
  notes: z.string().optional(),
})

type CheckpointValues = z.infer<typeof checkpointSchema>
type PatrolValues = z.infer<typeof patrolSchema>

export function AdminSecurityPage() {
  const { profile } = useAuth()
  const [tab, setTab] = useState<Tab>('Guards')
  const [sites, setSites] = useState<Site[]>([])
  const [guards, setGuards] = useState<EmployeeWithRelations[]>([])
  const [checkpoints, setCheckpoints] = useState<SecurityCheckpointWithSite[]>([])
  const [patrols, setPatrols] = useState<SecurityPatrolWithRelations[]>([])
  const [incidents, setIncidents] = useState<SecurityIncidentWithRelations[]>([])
  const [visitors, setVisitors] = useState<VisitorWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [checkpointOpen, setCheckpointOpen] = useState(false)
  const [patrolOpen, setPatrolOpen] = useState(false)

  const checkpointForm = useForm<CheckpointValues>({ resolver: zodResolver(checkpointSchema) })
  const patrolForm = useForm<PatrolValues>({ resolver: zodResolver(patrolSchema) })

  async function load() {
    setLoading(true)
    const [siteRes, guardRes, pointRes, patrolRes, incidentRes, visitorRes] = await Promise.all([
      supabase.from('sites').select('*').eq('status', 'active').order('name'),
      supabase
        .from('employees')
        .select('*, profiles(*), sites!site_id(*)')
        .eq('designation', 'security_guard')
        .order('created_at', { ascending: false }),
      supabase.from('security_checkpoints').select('*, sites(*)').order('sort_order'),
      supabase
        .from('security_patrols')
        .select('*, sites(*), employees(*, profiles(*)), security_patrol_checks(*, security_checkpoints(*))')
        .order('created_at', { ascending: false }),
      supabase
        .from('security_incidents')
        .select('*, sites(*), employees(*, profiles(*))')
        .order('created_at', { ascending: false }),
      supabase.from('visitors').select('*, sites(*)').order('entry_time', { ascending: false }),
    ])
    const firstError =
      siteRes.error || guardRes.error || pointRes.error || patrolRes.error || incidentRes.error || visitorRes.error
    if (firstError) setError(firstError.message)
    setSites((siteRes.data as Site[]) ?? [])
    setGuards((guardRes.data as unknown as EmployeeWithRelations[]) ?? [])
    setCheckpoints((pointRes.data as unknown as SecurityCheckpointWithSite[]) ?? [])
    setPatrols((patrolRes.data as unknown as SecurityPatrolWithRelations[]) ?? [])
    setIncidents((incidentRes.data as unknown as SecurityIncidentWithRelations[]) ?? [])
    setVisitors((visitorRes.data as unknown as VisitorWithRelations[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const siteOptions = useMemo(() => sites, [sites])

  async function addCheckpoint(values: CheckpointValues) {
    setFormError(null)
    const { error: insertError } = await supabase.from('security_checkpoints').insert(
      withOrg(
        {
          site_id: values.site_id,
          name: values.name,
          location_hint: values.location_hint || null,
        },
        profile?.organization_id,
      ),
    )
    if (insertError) {
      setFormError(insertError.message)
      setError(insertError.message)
      return
    }
    setCheckpointOpen(false)
    checkpointForm.reset()
    await load()
  }

  async function addPatrol(values: PatrolValues) {
    const { data, error: insertError } = await supabase
      .from('security_patrols')
      .insert(
        withOrg(
          {
            site_id: values.site_id,
            guard_id: values.guard_id || null,
            notes: values.notes || null,
            status: 'scheduled',
          },
          profile?.organization_id,
        ),
      )
      .select('*')
      .single()
    if (insertError || !data) {
      const message = insertError?.message ?? 'Could not create patrol'
      setFormError(message)
      setError(message)
      return
    }
    try {
      await seedPatrolChecks(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Patrol created without checkpoints')
    }
    setPatrolOpen(false)
    patrolForm.reset()
    await load()
  }

  async function setPatrolStatus(id: string, status: PatrolStatus) {
    const payload: { status: PatrolStatus; started_at?: string; completed_at?: string } = { status }
    if (status === 'in_progress') payload.started_at = new Date().toISOString()
    if (status === 'completed' || status === 'missed') payload.completed_at = new Date().toISOString()
    const { error: updateError } = await supabase.from('security_patrols').update(payload).eq('id', id)
    if (updateError) setError(updateError.message)
    else await load()
  }

  async function setIncidentStatus(id: string, status: IncidentStatus) {
    const { error: updateError } = await supabase.from('security_incidents').update({ status }).eq('id', id)
    if (updateError) setError(updateError.message)
    else await load()
  }

  async function markExited(id: string) {
    const { error: updateError } = await supabase
      .from('visitors')
      .update({ status: 'exited', exit_time: new Date().toISOString() })
      .eq('id', id)
    if (updateError) setError(updateError.message)
    else await load()
  }

  return (
    <div>
      <PageHeader
        title="Security"
        subtitle="Guards, checkpoint rounds, incidents, and visitor logs."
        action={
          tab === 'Checkpoints' ? (
            <Button onClick={() => setCheckpointOpen(true)}>Add checkpoint</Button>
          ) : tab === 'Patrols' ? (
            <Button onClick={() => setPatrolOpen(true)}>Schedule patrol</Button>
          ) : null
        }
      />
      {error ? <p className="mb-4 text-sm font-medium text-rose-600">{error}</p> : null}
      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              tab === item ? 'bg-ink-900 text-white' : 'bg-white text-ink-700 ring-1 ring-sand-100'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : tab === 'Guards' ? (
        guards.length === 0 ? (
          <EmptyState title="No guards yet" body="Create a staff record with designation Security Guard." />
        ) : (
          <Table headers={['Guard', 'Code', 'Site', 'Status']}>
            {guards.map((row) => (
              <tr key={row.id}>
                <Td>
                  <p className="font-medium">{row.profiles?.full_name ?? '—'}</p>
                  <p className="text-xs text-ink-600">{row.job_title ?? 'Security Guard'}</p>
                </Td>
                <Td>{row.employee_code ?? '—'}</Td>
                <Td>{row.sites?.name ?? '—'}</Td>
                <Td>
                  <Badge value={row.employment_status} />
                </Td>
              </tr>
            ))}
          </Table>
        )
      ) : tab === 'Checkpoints' ? (
        checkpoints.length === 0 ? (
          <EmptyState title="No checkpoints" body="Add the doors, lobbies, and gates a patrol must verify." />
        ) : (
          <Table headers={['Site', 'Checkpoint', 'Hint']}>
            {checkpoints.map((row) => (
              <tr key={row.id}>
                <Td>{row.sites?.name ?? '—'}</Td>
                <Td className="font-medium">{row.name}</Td>
                <Td>{row.location_hint ?? '—'}</Td>
              </tr>
            ))}
          </Table>
        )
      ) : tab === 'Patrols' ? (
        patrols.length === 0 ? (
          <EmptyState title="No patrols" />
        ) : (
          <Table headers={['When', 'Site', 'Guard', 'Checkpoints', 'Status']}>
            {patrols.map((row) => {
              const checks = row.security_patrol_checks ?? []
              const done = checks.filter((item) => item.status === 'verified').length
              return (
                <tr key={row.id}>
                  <Td>{formatDateTime(row.started_at ?? row.created_at)}</Td>
                  <Td>{row.sites?.name ?? '—'}</Td>
                  <Td>{row.employees?.profiles?.full_name ?? 'Unassigned'}</Td>
                  <Td>
                    {done}/{checks.length || '—'}
                  </Td>
                  <Td>
                    <Select
                      value={row.status}
                      onChange={(e) => void setPatrolStatus(row.id, e.target.value as PatrolStatus)}
                    >
                      {PATROL_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </Select>
                  </Td>
                </tr>
              )
            })}
          </Table>
        )
      ) : tab === 'Incidents' ? (
        incidents.length === 0 ? (
          <EmptyState title="No incidents" />
        ) : (
          <Table headers={['When', 'Site', 'Type', 'Severity', 'Status']}>
            {incidents.map((row) => (
              <tr key={row.id}>
                <Td>{formatDateTime(row.created_at)}</Td>
                <Td>
                  <p className="font-medium">{row.sites?.name ?? '—'}</p>
                  <p className="text-xs text-ink-600">{row.description}</p>
                </Td>
                <Td>
                  <Badge value={row.incident_type} />
                </Td>
                <Td>
                  <Badge value={row.severity} />
                </Td>
                <Td>
                  <Select
                    value={row.status}
                    onChange={(e) => void setIncidentStatus(row.id, e.target.value as IncidentStatus)}
                  >
                    {INCIDENT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </Select>
                </Td>
              </tr>
            ))}
          </Table>
        )
      ) : visitors.length === 0 ? (
        <EmptyState title="No visitors" />
      ) : (
        <Table headers={['Visitor', 'Site', 'Host / purpose', 'In', 'Out', '']}>
          {visitors.map((row) => (
            <tr key={row.id}>
              <Td>
                <p className="font-medium">{row.visitor_name}</p>
                <p className="text-xs text-ink-600">{row.phone ?? row.vehicle_number ?? '—'}</p>
              </Td>
              <Td>{row.sites?.name ?? '—'}</Td>
              <Td>
                {row.host ?? '—'}
                <p className="text-xs text-ink-600">{row.purpose ?? ''}</p>
              </Td>
              <Td>{formatDateTime(row.entry_time)}</Td>
              <Td>
                <Badge value={row.status} />
                <p className="text-xs text-ink-600">{formatDateTime(row.exit_time)}</p>
              </Td>
              <Td>
                {row.status === 'on_site' ? (
                  <Button variant="secondary" onClick={() => void markExited(row.id)}>
                    Mark exit
                  </Button>
                ) : null}
              </Td>
            </tr>
          ))}
        </Table>
      )}

      <Modal title="Add checkpoint" open={checkpointOpen} onClose={() => setCheckpointOpen(false)}>
        <form
          className="space-y-3"
          onSubmit={checkpointForm.handleSubmit(addCheckpoint, () =>
            setFormError('Fill the required fields: site and name.'),
          )}
        >
          <FormError message={formError} />
          <Select label="Site" error={checkpointForm.formState.errors.site_id?.message} {...checkpointForm.register('site_id')}>
            <option value="">Select site</option>
            {siteOptions.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </Select>
          <Input label="Name" error={checkpointForm.formState.errors.name?.message} {...checkpointForm.register('name')} />
          <Input label="Location hint" {...checkpointForm.register('location_hint')} />
          <Button type="submit" full>
            Save checkpoint
          </Button>
        </form>
      </Modal>

      <Modal title="Schedule patrol" open={patrolOpen} onClose={() => setPatrolOpen(false)}>
        <form
          className="space-y-3"
          onSubmit={patrolForm.handleSubmit(addPatrol, () => setFormError('Select a site for the patrol.'))}
        >
          <FormError message={formError} />
          <Select label="Site" error={patrolForm.formState.errors.site_id?.message} {...patrolForm.register('site_id')}>
            <option value="">Select site</option>
            {siteOptions.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </Select>
          <Select label="Guard" {...patrolForm.register('guard_id')}>
            <option value="">Unassigned</option>
            {guards
              .filter((row) => row.employment_status === 'active')
              .map((row) => (
                <option key={row.id} value={row.id}>
                  {row.profiles?.full_name ?? row.employee_code} · {row.sites?.name}
                </option>
              ))}
          </Select>
          <Textarea label="Notes" {...patrolForm.register('notes')} />
          <Button type="submit" full>
            Schedule
          </Button>
        </form>
      </Modal>
    </div>
  )
}
