import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../../contexts/AuthContext'
import { hasSoftwareAccess, PORTAL_HOME, ROLE_LABELS } from '../../lib/auth/roles'
import { recordSignupAttempt, signupLockMessage } from '../../lib/auth/lockout'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import { SIGNUP_ROLES } from '../../types/database'
import { InstallAppCard } from '../../components/InstallAppBanner'
import { Logo } from '../../components/brand/Logo'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'

const schema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name').max(80),
    email: z
      .string()
      .email('Enter a valid work email')
      .refine((value) => !value.toLowerCase().endsWith('@example.com'), 'Use a real inbox, not an example.com address'),
    phone: z.string().optional(),
    requestedRole: z.enum(SIGNUP_ROLES),
    password: z.string().min(8, 'Use at least 8 characters'),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  })

type FormValues = z.infer<typeof schema>

export function SignupPage() {
  const { signUp, session, profile, role, loading } = useAuth()
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [checkEmail, setCheckEmail] = useState(false)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { requestedRole: 'worker', phone: '' },
  })

  if (loading) return <Spinner label="Loading" />
  if (session && profile && !hasSoftwareAccess(profile)) return <Navigate to="/pending" replace />
  if (session && role && hasSoftwareAccess(profile)) return <Navigate to={PORTAL_HOME[role]} replace />

  async function onSubmit(values: FormValues) {
    const locked = signupLockMessage()
    if (locked) {
      setSubmitError(locked)
      return
    }
    setSubmitError(null)
    try {
      const next = await signUp({
        fullName: values.fullName,
        email: values.email,
        password: values.password,
        phone: values.phone,
        requestedRole: values.requestedRole,
      })
      recordSignupAttempt()
      if (!next) {
        setCheckEmail(true)
        return
      }
      navigate('/pending', { replace: true })
    } catch {
      setSubmitError(recordSignupAttempt() ?? 'Unable to create the account. Try again or use a different email.')
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-[#f3f1eb] px-4 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6">
      <div className="w-full max-w-md">
        <Logo />
        <h1 className="mt-8 text-2xl font-semibold text-ink-950">Request access</h1>
        <p className="mt-1 text-sm text-ink-600">
          Create an account. An administrator must approve it before you can use FacilityOS.
        </p>
        <InstallAppCard className="mt-5" />

        {!isSupabaseConfigured ? (
          <p className="mt-6 rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-900">
            Add your Supabase keys to <span className="font-mono">.env</span>, then restart the dev server.
          </p>
        ) : null}

        {checkEmail ? (
          <div className="mt-8 rounded-2xl border border-tide-100 bg-white px-4 py-5 text-sm text-ink-800">
            <p className="font-semibold text-ink-950">Check your email</p>
            <p className="mt-2 text-ink-600">
              If that address can be used, confirm the message, then sign in. Access still waits for admin approval.
            </p>
            <Link to="/login" className="mt-4 inline-block font-semibold text-tide-600">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form className="mt-8 space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <Input label="Full name" autoComplete="name" error={form.formState.errors.fullName?.message} {...form.register('fullName')} />
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              hint="Use a real inbox. You may need to confirm it before signing in."
              error={form.formState.errors.email?.message}
              {...form.register('email')}
            />
            <Input label="Phone" type="tel" autoComplete="tel" hint="Optional" error={form.formState.errors.phone?.message} {...form.register('phone')} />
            <Select label="I am a" error={form.formState.errors.requestedRole?.message} {...form.register('requestedRole')}>
              {SIGNUP_ROLES.map((roleOption) => (
                <option key={roleOption} value={roleOption}>
                  {ROLE_LABELS[roleOption]}
                </option>
              ))}
            </Select>
            <Input
              label="Password"
              type="password"
              autoComplete="new-password"
              error={form.formState.errors.password?.message}
              {...form.register('password')}
            />
            <Input
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              error={form.formState.errors.confirm?.message}
              {...form.register('confirm')}
            />
            {submitError ? <p className="text-sm font-medium text-rose-600">{submitError}</p> : null}
            <Button type="submit" full disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Creating account…' : 'Create account'}
            </Button>
          </form>
        )}

        <p className="mt-6 text-sm text-ink-600">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-tide-600 hover:text-ink-800">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
