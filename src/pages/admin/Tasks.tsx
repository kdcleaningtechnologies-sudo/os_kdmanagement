import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { withOrg } from '../../lib/orgWrite'
import { formatDate } from '../../lib/format'
import {
  checklistFromTemplate,
  completeTaskIfNeeded,
  displayTaskStatus,
  parseChecklistLines,
  taskTitle,
} from '../../lib/tasks'
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
  TASK_PRIORITIES,
  TASK_RECURRENCES,
  type ChecklistTemplateWithRelations,
  type EmployeeWithRelations,
  type Site,
  type TaskWithRelations,
} from '../../types/database'

const schema = z.object({
  site_id: z.string().min(1, 'Select a site'),
  assigned_to: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  priority: z.enum(TASK_PRIORITIES),
  due_date: z.string().optional(),
  recurrence: z.enum(TASK_RECURRENCES),
  template_id: z.string().optional(),
  checklist_text: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function AdminTasksPage() {
  const { user, profile } = useAuth()
  const [rows, setRows] = useState<TaskWithRelations[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [employees, setEmployees] = useState<EmployeeWithRelations[]>([])
  const [templates, setTemplates] = useState<ChecklistTemplateWithRelations[]>([])
  const [siteId, setSiteId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function load() {
    setLoading(true)
    let query = supabase
      .from('tasks')
      .select('*, sites(*), employees(*, profiles(*))')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(200)
    if (siteId) query = query.eq('site_id', siteId)
    const [{ data, error: queryError }, { data: siteRows }, { data: employeeRows }, { data: templateRows }] =
      await Promise.all([
        query,
        supabase.from('sites').select('*').order('name'),
        supabase
          .from('employees')
          .select('*, profiles(*), sites!site_id(*)')
          .in('designation', ['worker', 'security_guard'])
          .eq('employment_status', 'active'),
        supabase
          .from('checklist_templates')
          .select('*, checklist_template_items(*)')
          .eq('status', 'active')
          .order('name'),
      ])
    if (queryError) setError(queryError.message)
    setRows((data as TaskWithRelations[]) ?? [])
    setSites((siteRows as Site[]) ?? [])
    setEmployees((employeeRows as EmployeeWithRelations[]) ?? [])
    setTemplates(
      ((templateRows as unknown as ChecklistTemplateWithRelations[]) ?? []).map((row) => ({
        ...row,
        sites: row.sites ?? null,
        checklist_template_items: [...(row.checklist_template_items ?? [])].sort((a, b) => a.sort_order - b.sort_order),
      })),
    )
    setLoading(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId])

  function applyTemplate(templateId: string) {
    const template = templates.find((row) => row.id === templateId)
    if (!template) return
    form.setValue('checklist_text', template.checklist_template_items.map((item) => item.label).join('\n'))
    if (!form.getValues('title')) form.setValue('title', template.name)
  }

  async function onSubmit(values: FormValues) {
    const template = templates.find((row) => row.id === values.template_id)
    const checklist = values.checklist_text
      ? parseChecklistLines(values.checklist_text)
      : checklistFromTemplate(template?.checklist_template_items ?? [])
    setFormError(null)
    const { error: insertError } = await supabase.from('tasks').insert(
      withOrg(
        {
          site_id: values.site_id,
          assigned_to: values.assigned_to || null,
          title: values.title,
          description: values.description || values.title,
          checklist,
          due_date: values.due_date || null,
          status: 'todo',
          priority: values.priority,
          created_by: user?.id ?? null,
          recurrence: values.recurrence,
          checklist_template_id: values.template_id || null,
        },
        profile?.organization_id,
      ),
    )
    if (insertError) {
      setFormError(insertError.message)
      setError(insertError.message)
      return
    }
    setOpen(false)
    setError(null)
    await load()
  }

  async function setStatus(task: TaskWithRelations, status: 'todo' | 'in_progress' | 'completed') {
    const { error: updateError } = await supabase.from('tasks').update({ status }).eq('id', task.id)
    if (updateError) {
      setError(updateError.message)
      return
    }
    try {
      await completeTaskIfNeeded(task, status)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the next recurring task')
    }
    await load()
  }

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle="Assign site work from a reusable checklist. Recurring tasks clone themselves when marked complete."
        action={
          <Button
            onClick={() => {
              setFormError(null)
              form.reset({
                site_id: siteId,
                assigned_to: '',
                title: '',
                description: '',
                priority: 'medium',
                due_date: '',
                recurrence: 'none',
                template_id: '',
                checklist_text: '',
              })
              setOpen(true)
            }}
          >
            New task
          </Button>
        }
      />
      <div className="mb-5 max-w-sm">
        <Select label="Site" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          <option value="">All sites</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </Select>
      </div>
      {error ? <p className="mb-4 text-sm font-medium text-rose-600">{error}</p> : null}
      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState title="No tasks" body="Create a task or apply a checklist template." />
      ) : (
        <Table headers={['Task', 'Site', 'Assigned', 'Due', 'Status', '']}>
          {rows.map((row) => (
            <tr key={row.id}>
              <Td>
                <p className="font-medium">{taskTitle(row)}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge value={row.priority} />
                  {row.recurrence && row.recurrence !== 'none' ? <Badge value={row.recurrence} /> : null}
                </div>
              </Td>
              <Td>{row.sites?.name ?? '—'}</Td>
              <Td>{row.employees?.profiles?.full_name ?? 'Unassigned'}</Td>
              <Td>{formatDate(row.due_date)}</Td>
              <Td>
                <Badge value={displayTaskStatus(row)} />
              </Td>
              <Td>
                {row.status === 'completed' ? (
                  <Button variant="ghost" onClick={() => void setStatus(row, 'todo')}>
                    Reopen
                  </Button>
                ) : (
                  <Button variant="ghost" onClick={() => void setStatus(row, 'completed')}>
                    Complete
                  </Button>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      )}

      <Modal title="New task" open={open} onClose={() => setOpen(false)} wide>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(onSubmit, () => setFormError('Fill the required fields: site and title.'))}
        >
          <FormError message={formError} />
          <Select label="Site" error={form.formState.errors.site_id?.message} {...form.register('site_id')}>
            <option value="">Select site</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </Select>
          <Select label="Assign to" {...form.register('assigned_to')}>
            <option value="">Unassigned</option>
            {employees
              .filter((row) => !form.watch('site_id') || row.site_id === form.watch('site_id'))
              .map((row) => (
                <option key={row.id} value={row.id}>
                  {row.profiles?.full_name ?? row.employee_code}
                </option>
              ))}
          </Select>
          <Input label="Title" error={form.formState.errors.title?.message} {...form.register('title')} />
          <Textarea label="Description" {...form.register('description')} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Select label="Priority" {...form.register('priority')}>
              {TASK_PRIORITIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
            <Input label="Due date" type="date" {...form.register('due_date')} />
            <Select label="Repeat" {...form.register('recurrence')}>
              {TASK_RECURRENCES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </div>
          <Select
            label="Checklist template"
            hint="Fills the items below. You can still edit the list."
            {...form.register('template_id', {
              onChange: (event) => applyTemplate(event.target.value),
            })}
          >
            <option value="">Custom list</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </Select>
          <Textarea label="Checklist" hint="One item per line" {...form.register('checklist_text')} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Saving…' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
