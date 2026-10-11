import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { withOrg } from '../../lib/orgWrite'
import { useMyAssignments } from '../../hooks/useAssignments'
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
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Select, Textarea } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import {
  TASK_PRIORITIES,
  TASK_RECURRENCES,
  type ChecklistTemplateWithRelations,
  type EmployeeWithRelations,
  type Task,
} from '../../types/database'

const schema = z.object({
  site_id: z.string().min(1),
  assigned_to: z.string().optional(),
  title: z.string().min(2),
  description: z.string().optional(),
  priority: z.enum(TASK_PRIORITIES),
  due_date: z.string().optional(),
  recurrence: z.enum(TASK_RECURRENCES),
  template_id: z.string().optional(),
  checklist_text: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function SupervisorTasksPage() {
  const { user, profile } = useAuth()
  const { sites, loading } = useMyAssignments()
  const [siteId, setSiteId] = useState('')
  const [tasks, setTasks] = useState<Task[]>([])
  const [workers, setWorkers] = useState<EmployeeWithRelations[]>([])
  const [templates, setTemplates] = useState<ChecklistTemplateWithRelations[]>([])
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })

  const selectedSite = useMemo(() => sites.find((site) => site.id === siteId) ?? sites[0], [siteId, sites])

  useEffect(() => {
    if (sites[0] && !siteId) setSiteId(sites[0].id)
  }, [sites, siteId])

  async function load(id: string) {
    const [{ data: taskRows, error: taskError }, { data: crew }, { data: templateRows }] = await Promise.all([
      supabase.from('tasks').select('*').eq('site_id', id).order('created_at', { ascending: false }),
      supabase
        .from('employees')
        .select('*, profiles(*)')
        .eq('site_id', id)
        .in('designation', ['worker', 'security_guard'])
        .eq('employment_status', 'active'),
      supabase.from('checklist_templates').select('*, checklist_template_items(*)').eq('status', 'active').order('name'),
    ])
    if (taskError) setError(taskError.message)
    setTasks((taskRows as Task[]) ?? [])
    setWorkers((crew as EmployeeWithRelations[]) ?? [])
    setTemplates(
      ((templateRows as unknown as ChecklistTemplateWithRelations[]) ?? []).map((row) => ({
        ...row,
        sites: row.sites ?? null,
        checklist_template_items: [...(row.checklist_template_items ?? [])].sort((a, b) => a.sort_order - b.sort_order),
      })),
    )
  }

  useEffect(() => {
    if (selectedSite) void load(selectedSite.id)
  }, [selectedSite])

  function applyTemplate(templateId: string) {
    const template = templates.find((row) => row.id === templateId)
    if (!template) return
    form.setValue('checklist_text', template.checklist_template_items.map((item) => item.label).join('\n'))
    if (!form.getValues('title')) form.setValue('title', template.name)
  }

  async function onSubmit(values: FormValues) {
    const template = templates.find((row) => row.id === values.template_id)
    const { error: insertError } = await supabase.from('tasks').insert(
      withOrg(
        {
          site_id: values.site_id,
          assigned_to: values.assigned_to || null,
          title: values.title,
          description: values.description || values.title,
          checklist: values.checklist_text
            ? parseChecklistLines(values.checklist_text)
            : checklistFromTemplate(template?.checklist_template_items ?? []),
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
      setError(insertError.message)
      return
    }
    setOpen(false)
    form.reset()
    if (selectedSite) await load(selectedSite.id)
  }

  async function setStatus(task: Task, status: 'todo' | 'in_progress' | 'completed') {
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
    if (selectedSite) await load(selectedSite.id)
  }

  if (loading) return <Spinner />
  if (!selectedSite) return <EmptyState title="No managed sites" />

  const visibleTemplates = templates.filter(
    (row) =>
      (!row.site_id || row.site_id === selectedSite.id) &&
      (!row.site_type || row.site_type === selectedSite.site_type),
  )

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle="Create work from a site checklist and track todo → in progress → done."
        action={
          <Button
            onClick={() => {
              form.reset({
                site_id: selectedSite.id,
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
      <Select label="Site" value={selectedSite.id} onChange={(e) => setSiteId(e.target.value)}>
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.name}
          </option>
        ))}
      </Select>
      {error ? <p className="mt-3 text-sm font-medium text-rose-600">{error}</p> : null}
      <div className="mt-4 space-y-3">
        {tasks.length === 0 ? (
          <EmptyState title="No tasks yet" />
        ) : (
          tasks.map((task) => (
            <Card key={task.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink-950">{taskTitle(task)}</p>
                  {task.description && task.description !== task.title ? (
                    <p className="mt-1 text-sm text-ink-700">{task.description}</p>
                  ) : null}
                </div>
                <Badge value={displayTaskStatus(task)} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <Badge value={task.priority ?? 'medium'} />
                {task.recurrence && task.recurrence !== 'none' ? <Badge value={task.recurrence} /> : null}
              </div>
              <p className="mt-1 text-xs text-ink-600">Due {task.due_date ?? '—'}</p>
              <ul className="mt-3 space-y-1 text-sm text-ink-700">
                {(task.checklist ?? []).map((item) => (
                  <li key={item.id} className={item.done ? 'line-through opacity-60' : ''}>
                    {item.done ? '☑' : '☐'} {item.label}
                  </li>
                ))}
              </ul>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {task.status === 'completed' ? (
                  <Button variant="soft" className="col-span-2" onClick={() => void setStatus(task, 'todo')}>
                    Reopen
                  </Button>
                ) : (
                  <>
                    <Button variant="secondary" onClick={() => void setStatus(task, 'in_progress')}>
                      In progress
                    </Button>
                    <Button variant="soft" onClick={() => void setStatus(task, 'completed')}>
                      Complete
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal title="Create task" open={open} onClose={() => setOpen(false)}>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Select label="Site" {...form.register('site_id')}>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </Select>
          <Select label="Assign to" {...form.register('assigned_to')}>
            <option value="">Unassigned</option>
            {workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.profiles?.full_name ?? worker.employee_code}
              </option>
            ))}
          </Select>
          <Input label="Title" error={form.formState.errors.title?.message} {...form.register('title')} />
          <Textarea label="Description" {...form.register('description')} />
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
          <Select
            label="Checklist template"
            {...form.register('template_id', {
              onChange: (event) => applyTemplate(event.target.value),
            })}
          >
            <option value="">Custom list</option>
            {visibleTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </Select>
          <Textarea label="Checklist" hint="One item per line" {...form.register('checklist_text')} />
          <Button type="submit" full>
            Create
          </Button>
        </form>
      </Modal>
    </div>
  )
}
