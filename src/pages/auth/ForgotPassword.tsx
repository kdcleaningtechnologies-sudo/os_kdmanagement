import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { passwordResetLockMessage, recordPasswordResetRequest } from '../../lib/auth/lockout'
import { supabase } from '../../lib/supabaseClient'
import { Logo } from '../../components/brand/Logo'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'

const schema = z.object({
  email: z.string().email('Enter the email on your account'),
})

type FormValues = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    const locked = passwordResetLockMessage()
    if (locked) {
      setSubmitError(locked)
      return
    }
    setSubmitError(null)
    await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    recordPasswordResetRequest()
    setSent(true)
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-[#f3f1eb] px-4 py-10 sm:px-6">
      <Card className="w-full max-w-md space-y-5">
        <Logo />
        <div>
          <h1 className="text-xl font-semibold text-ink-950">Reset password</h1>
          <p className="mt-1 text-sm text-ink-600">
            We will email a Supabase reset link. After you open it, you can set a new password.
          </p>
        </div>
        {sent ? (
          <p className="rounded-xl bg-tide-50 px-3 py-3 text-sm text-ink-800">
            If that email exists, a reset link is on its way.
          </p>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
            {submitError ? <p className="text-sm font-medium text-rose-600">{submitError}</p> : null}
            <Button type="submit" full disabled={isSubmitting}>
              {isSubmitting ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        )}
        <Link to="/login" className="inline-block text-sm font-semibold text-tide-600">
          Back to sign in
        </Link>
      </Card>
    </div>
  )
}
