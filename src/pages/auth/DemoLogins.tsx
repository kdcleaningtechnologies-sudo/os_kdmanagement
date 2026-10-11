import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../../lib/demoAccounts'

type Props = {
  onPick: (email: string, password: string) => void
}

/** Dev-only helper. Vite excludes this chunk from production when Login lazy-loads it behind import.meta.env.DEV. */
export function DemoLogins({ onPick }: Props) {
  return (
    <div className="mt-8 rounded-2xl border border-sand-100 bg-white px-4 py-3 text-sm text-ink-700">
      <p className="font-semibold text-ink-900">Demo portal logins</p>
      <p className="mt-1 text-xs text-ink-600">
        Run <span className="font-mono">003_fix_demo_logins.sql</span> once, then click a role. Password is always{' '}
        <span className="font-mono">{DEMO_PASSWORD}</span>
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {DEMO_ACCOUNTS.map((account) => (
          <button
            key={account.email}
            type="button"
            className="rounded-xl bg-sand-50 px-3 py-2 text-left text-xs font-semibold text-ink-800 hover:bg-tide-50"
            onClick={() => onPick(account.email, DEMO_PASSWORD)}
          >
            {account.label}
          </button>
        ))}
      </div>
    </div>
  )
}
