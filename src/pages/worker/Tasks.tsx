import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { todayISODate } from '../../lib/format'
import { completeTaskIfNeeded, displayTaskStatus, statusAfterChecklist, taskTitle } from '../../lib/tasks'
import { useMyAssignments } from '../../hooks/useAssignments'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import type { ChecklistItem, Task } from '../../types/database'

export function WorkerTasksPage() {
  const { assignments, loading } = useMyAssignments()
  const [tasks, setTasks] = useState<Task[]>([])
  const [error, setError] = useState<string | null>(null)
  const ids = assignments.map((row) => row.id)

  async function load() {
    if (!ids.length) {
      setTasks([])
      return
    }
    const { data, error: queryError } = await supabase
      .from('tasks')
      .select('*')
      .in('assigned_to', ids)
      .order('due_date', { ascending: true })
    if (queryError) setError(queryError.message)
    setTasks((data as Task[]) ?? [])
  }

  useEffect(() => {
    if (!loading) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, ids.join(',')])

  async function toggleItem(task: Task, itemId: string) {
    const checklist = (task.checklist ?? []).map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item,
    )
    const nextStatus = statusAfterChecklist(checklist)
    const { error: updateError } = await supabase
      .from('tasks')
      .update({
        checklist,
        status: nextStatus,
      })
      .eq('id', task.id)
    if (updateError) {
      setError(updateError.message)
      return
    }
    try {
      await completeTaskIfNeeded(task, nextStatus)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the next recurring task')
    }
    await load()
  }

  if (loading) return <Spinner />

  const visible = tasks.filter((task) => task.status !== 'completed' || task.due_date === todayISODate())

  return (
    <div>
      <PageHeader title="Today's tasks" subtitle="Tick each area. Finishing the list closes the task." />
      {error ? <p className="mb-3 text-sm font-medium text-rose-600">{error}</p> : null}
      {visible.length === 0 ? (
        <EmptyState title="No assigned tasks" />
      ) : (
        <div className="space-y-3">
          {visible.map((task) => (
            <Card key={task.id}>
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-ink-950">{taskTitle(task)}</p>
                <Badge value={displayTaskStatus(task)} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <Badge value={task.priority ?? 'medium'} />
                {task.recurrence && task.recurrence !== 'none' ? <Badge value={task.recurrence} /> : null}
              </div>
              <p className="mt-1 text-xs text-ink-600">Due {task.due_date ?? 'anytime'}</p>
              <div className="mt-3 space-y-2">
                {(task.checklist ?? []).map((item: ChecklistItem) => (
                  <label key={item.id} className="flex items-center gap-2 text-sm text-ink-800">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => void toggleItem(task, item.id)}
                      className="h-4 w-4 accent-tide-600"
                    />
                    <span className={item.done ? 'line-through opacity-60' : ''}>{item.label}</span>
                  </label>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
