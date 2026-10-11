import { supabase } from './supabaseClient'
import { todayISODate } from './format'
import type {
  ChecklistItem,
  ChecklistTemplateItem,
  Task,
  TaskPriority,
  TaskRecurrence,
  TaskStatus,
} from '../types/database'

export function parseChecklistLines(text: string | undefined): ChecklistItem[] {
  return (text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((label, index) => ({ id: `${Date.now()}-${index}`, label, done: false }))
}

export function checklistFromTemplate(items: ChecklistTemplateItem[]): ChecklistItem[] {
  return [...items]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item, index) => ({ id: `${item.id}-${index}`, label: item.label, done: false }))
}

export function checklistToLines(items: ChecklistItem[] | undefined) {
  return (items ?? []).map((item) => item.label).join('\n')
}

export function taskTitle(task: Pick<Task, 'title' | 'description'>) {
  return task.title?.trim() || task.description?.trim() || 'Untitled task'
}

export function displayTaskStatus(task: Pick<Task, 'status' | 'due_date'>): TaskStatus {
  if (task.status === 'completed') return 'completed'
  if (task.due_date && task.due_date < todayISODate()) return 'overdue'
  if (task.status === 'pending') return 'todo'
  return task.status
}

export function isTaskOpen(status: TaskStatus | null | undefined) {
  return status !== 'completed'
}

export function statusAfterChecklist(checklist: ChecklistItem[]): TaskStatus {
  if (checklist.length > 0 && checklist.every((item) => item.done)) return 'completed'
  if (checklist.some((item) => item.done)) return 'in_progress'
  return 'todo'
}

export async function completeTaskIfNeeded(task: Task, nextStatus: TaskStatus) {
  if (nextStatus !== 'completed' || task.status === 'completed') return
  if (!task.recurrence || task.recurrence === 'none') return
  const { error } = await supabase.rpc('spawn_recurring_task', { p_task_id: task.id })
  if (error) throw error
}

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

export const RECURRENCE_LABELS: Record<TaskRecurrence, string> = {
  none: 'One-off',
  daily: 'Daily',
  weekly: 'Weekly',
}
