import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '../../lib/supabaseClient'
import { Logo } from '../../components/brand/Logo'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'

const schema = z
  .object({
    password: z.string().min(8, 'Use at least 8 characters'),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  })

type FormValues = z.infer<typeof schema>

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    setSubmitError(null)
    const { error } = await supabase.auth.updateUser({ password: values.password })
    if (error) {
      setSubmitError('Could not update the password. Open the latest reset link and try again.')
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-[#f3f1eb] px-4 py-10 sm:px-6">
      <Card className="w-full max-w-md space-y-5">
        <Logo />
        <div>
          <h1 className="text-xl font-semibold text-ink-950">Choose a new password</h1>
          <p className="mt-1 text-sm text-ink-600">Open this page from the email link so your recovery session is active.</p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Input label="New password" type="password" error={errors.password?.message} {...register('password')} />
          <Input label="Confirm password" type="password" error={errors.confirm?.message} {...register('confirm')} />
          {submitError ? <p className="text-sm font-medium text-rose-600">{submitError}</p> : null}
          <Button type="submit" full disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Update password'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
