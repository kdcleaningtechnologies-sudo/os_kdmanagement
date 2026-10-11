import type { ComplaintStatus } from '../types/database'

const OPEN: ComplaintStatus[] = ['open', 'assigned', 'in_progress']
const DONE: ComplaintStatus[] = ['resolved', 'client_confirmed', 'closed']

export function isComplaintOpen(status: ComplaintStatus | null | undefined) {
  return Boolean(status && OPEN.includes(status))
}

export function isComplaintResolved(status: ComplaintStatus | null | undefined) {
  return Boolean(status && DONE.includes(status))
}
