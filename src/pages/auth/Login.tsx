import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../../contexts/AuthContext'
import { hasSoftwareAccess, PORTAL_HOME } from '../../lib/auth/roles'
import { clearLoginFailures, loginLockMessage, recordLoginFailure } from '../../lib/auth/lockout'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import { InstallAppCard } from '../../components/InstallAppBanner'
import { Logo } from '../../components/brand/Logo'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'

const schema = z.object({
  email: z.string().email('Enter a valid work email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const { signIn, session, role, profile, loading } = useAuth()
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  if (loading) return <Spinner label="Loading" />
  if (session && profile && !hasSoftwareAccess(profile)) return <Navigate to="/pending" replace />
  if (session && role && hasSoftwareAccess(profile)) return <Navigate to={PORTAL_HOME[role]} replace />

  async function onSubmit(values: FormValues) {
    const locked = loginLockMessage()
    if (locked) {
      setSubmitError(locked)
      return
    }
    setSubmitError(null)
    try {
      const next = await signIn(values.email, values.password)
      clearLoginFailures()
      navigate(hasSoftwareAccess(next) ? PORTAL_HOME[next.role] : '/pending', { replace: true })
    } catch {
      setSubmitError(recordLoginFailure() ?? 'Unable to sign in. Check your email and password.')
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink-950 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.28),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(15,138,122,0.35),transparent_40%)]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Logo light />
          <div>
            <p className="text-sm font-semibold tracking-[0.2em] text-tide-300 uppercase">Facility operations</p>
            <h1 className="mt-3 max-w-md text-4xl font-semibold tracking-tight">
              One platform for sites, staff, and service quality.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-ink-100/80">
              Attendance, inspections, complaints, and client reporting — scoped by role and site.
            </p>
          </div>
          <p className="text-xs text-ink-100/50">KD FacilityOS</p>
        </div>
      </div>

      <div className="flex items-center justify-center overflow-x-hidden bg-[#f3f1eb] px-4 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h2 className="text-2xl font-semibold text-ink-950">Sign in</h2>
          <p className="mt-1 text-sm text-ink-600">
            Workers, supervisors, and guards: tap Install App on your phone, then sign in. Same login as the website.
          </p>
          <InstallAppCard className="mt-5 lg:hidden" />

          {!isSupabaseConfigured ? (
            <p className="mt-6 rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-900">
              Add <span className="font-mono">VITE_SUPABASE_URL</span> and{' '}
              <span className="font-mono">VITE_SUPABASE_ANON_KEY</span> in a local{' '}
              <span className="font-mono">.env</span> file, or in Vercel Project Settings → Environment Variables, then
              redeploy.
            </p>
          ) : null}

          <form className="mt-8 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register('password')}
            />
            {submitError ? <p className="text-sm font-medium text-rose-600">{submitError}</p> : null}
            <Button type="submit" full disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Continue'}
            </Button>
          </form>

          <p className="mt-6 text-sm text-ink-600">
            New to FacilityOS?{' '}
            <Link to="/signup" className="font-semibold text-tide-600 hover:text-ink-800">
              Request access
            </Link>
          </p>
          <p className="mt-2 text-sm text-ink-600">
            Forgot your password?{' '}
            <Link to="/forgot-password" className="font-semibold text-tide-600 hover:text-ink-800">
              Reset it
            </Link>
          </p>

          <div className="mt-6 rounded-2xl border border-tide-100 bg-tide-50 px-4 py-3 text-sm text-ink-800 lg:hidden">
            <p className="font-semibold text-ink-950">Install the phone app</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-ink-700">
              <li>Android Chrome: menu (⋮) → Add to Home screen / Install app.</li>
              <li>iPhone Safari: Share → Add to Home Screen.</li>
              <li>Open the FacilityOS icon. Check-in GPS works best from there.</li>
            </ol>
          </div>

        </div>
      </div>
    </div>
  )
}
