import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { canEditOrganizationSettings } from '../../lib/permissions'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Textarea } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'

const orgSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  tagline: z.string().optional(),
})

const settingsSchema = z.object({
  timezone: z.string().min(1),
  currency: z.string().min(1),
  default_geofence_meters: z.string().min(1),
})

type OrgValues = z.infer<typeof orgSchema>
type SettingsValues = z.infer<typeof settingsSchema>

export function AdminSettingsPage() {
  const { organization, role, refreshProfile } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  const orgForm = useForm<OrgValues>({ resolver: zodResolver(orgSchema) })
  const settingsForm = useForm<SettingsValues>({ resolver: zodResolver(settingsSchema) })

  useEffect(() => {
    if (!organization) {
      setLoading(false)
      return
    }
    orgForm.reset({
      name: organization.name,
      email: organization.email ?? '',
      phone: organization.phone ?? '',
      website: organization.website ?? '',
      address: organization.address ?? '',
      tagline: organization.tagline ?? '',
    })
    void supabase
      .from('organization_settings')
      .select('*')
      .eq('organization_id', organization.id)
      .maybeSingle()
      .then(({ data }) => {
        settingsForm.reset({
          timezone: data?.timezone ?? 'Asia/Kolkata',
          currency: data?.currency ?? 'INR',
          default_geofence_meters: String(data?.default_geofence_meters ?? 200),
        })
        setLoading(false)
      })
  }, [organization, orgForm, settingsForm])

  if (!canEditOrganizationSettings(role)) {
    return <EmptyState title="No access" body="Organization settings are limited to tenant admins." />
  }

  if (loading) return <Spinner />
  if (!organization) {
    return <EmptyState title="No organization on this profile" body="Ask the platform admin to attach your user to a tenant." />
  }

  const organizationId = organization.id

  async function saveOrg(values: OrgValues) {
    setError(null)
    setSaved(false)
    const { error: updateError } = await supabase
      .from('organizations')
      .update({
        name: values.name,
        email: values.email || null,
        phone: values.phone || null,
        website: values.website || null,
        address: values.address || null,
        tagline: values.tagline || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', organizationId)
    if (updateError) {
      setError(updateError.message)
      return
    }
    await refreshProfile()
    setSaved(true)
  }

  async function saveSettings(values: SettingsValues) {
    setError(null)
    setSaved(false)
    const { error: upsertError } = await supabase.from('organization_settings').upsert({
      organization_id: organizationId,
      timezone: values.timezone,
      currency: values.currency,
      default_geofence_meters: Number(values.default_geofence_meters),
      updated_at: new Date().toISOString(),
    })
    if (upsertError) {
      setError(upsertError.message)
      return
    }
    setSaved(true)
  }

  return (
    <div>
      <PageHeader
        title="Organization settings"
        subtitle="KD Facilities Management Services — tenant profile and attendance geofence default."
      />
      {error ? <p className="mb-4 text-sm font-medium text-rose-600">{error}</p> : null}
      {saved ? <p className="mb-4 text-sm font-medium text-emerald-700">Saved.</p> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold text-ink-950">Company profile</h2>
          <form className="space-y-4" onSubmit={orgForm.handleSubmit(saveOrg)}>
            <Input label="Name" {...orgForm.register('name')} />
            <Input label="Tagline" {...orgForm.register('tagline')} />
            <Input label="Email" type="email" {...orgForm.register('email')} />
            <Input label="Phone" {...orgForm.register('phone')} />
            <Input label="Website" {...orgForm.register('website')} />
            <Textarea label="Address" {...orgForm.register('address')} />
            <Button type="submit">Save profile</Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold text-ink-950">Operations defaults</h2>
          <form className="space-y-4" onSubmit={settingsForm.handleSubmit(saveSettings)}>
            <Input label="Timezone" {...settingsForm.register('timezone')} />
            <Input label="Currency" {...settingsForm.register('currency')} />
            <Input
              label="Default geofence (meters)"
              type="number"
              {...settingsForm.register('default_geofence_meters')}
            />
            <Button type="submit">Save defaults</Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
