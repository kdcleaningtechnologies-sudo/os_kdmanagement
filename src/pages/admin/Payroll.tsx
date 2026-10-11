import { ComingSoon } from '../../components/ComingSoon'
import { PageHeader } from '../../components/layout/PageHeader'

export function AdminPayrollPage() {
  return (
    <div>
      <PageHeader title="Payroll" />
      <ComingSoon
        title="Payroll processing"
        description="Salary runs, tax calculation, and payouts are intentionally not built yet. Attendance and leave data will feed this module later."
      />
    </div>
  )
}
