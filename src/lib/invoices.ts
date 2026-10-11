import { todayISODate } from './format'
import type { Invoice, InvoiceStatus } from '../types/database'

export function isInvoiceOpen(status: InvoiceStatus | null | undefined) {
  return status === 'draft' || status === 'sent' || status === 'overdue'
}

export function isInvoiceOverdue(row: Pick<Invoice, 'status' | 'due_date'>, today = todayISODate()) {
  if (!row.due_date) return row.status === 'overdue'
  if (row.status === 'paid' || row.status === 'cancelled') return false
  return row.due_date < today
}

export function displayInvoiceStatus(row: Pick<Invoice, 'status' | 'due_date'>) {
  if (isInvoiceOverdue(row) && row.status !== 'overdue') return 'overdue'
  return row.status
}
