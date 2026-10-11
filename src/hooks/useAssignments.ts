import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import type { Client, EmployeeWithRelations, Site } from '../types/database'

export function useMyAssignments() {
  const { user } = useAuth()
  const [assignments, setAssignments] = useState<EmployeeWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const { data, error: queryError } = await supabase
        .from('employees')
        .select('*, profiles(*)')
        .eq('profile_id', user!.id)
      if (cancelled) return
      if (queryError) {
        setError(queryError.message)
        setAssignments([])
        setLoading(false)
        return
      }

      const rows = (data as EmployeeWithRelations[]) ?? []
      const siteIds = [...new Set(rows.map((row) => row.site_id).filter((id): id is string => Boolean(id)))]
      const employeeIds = rows.map((row) => row.id)
      const [{ data: byId }, { data: bySupervisor }] = await Promise.all([
        siteIds.length
          ? supabase.from('sites').select('*').in('id', siteIds)
          : Promise.resolve({ data: [] as Site[] }),
        employeeIds.length
          ? supabase.from('sites').select('*').in('supervisor_id', employeeIds)
          : Promise.resolve({ data: [] as Site[] }),
      ])
      if (cancelled) return

      const sitesById = new Map<string, Site>()
      for (const site of [...((byId as Site[]) ?? []), ...((bySupervisor as Site[]) ?? [])]) {
        sitesById.set(site.id, site)
      }

      const linked = rows.map((row) => ({
        ...row,
        sites: (row.site_id && sitesById.get(row.site_id)) || null,
      }))
      const linkedIds = new Set(linked.map((row) => row.sites?.id).filter(Boolean))
      const extras =
        rows[0] && sitesById.size
          ? [...sitesById.values()]
              .filter((site) => !linkedIds.has(site.id))
              .map((site) => ({
                ...rows[0],
                site_id: site.id,
                sites: site,
              }))
          : []

      setAssignments([...linked, ...extras])
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user])

  const sites = assignments
    .map((row) => row.sites)
    .filter((site): site is Site => Boolean(site))

  return { assignments, sites, loading, error }
}

export function useMyClients() {
  const { user } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const { data: clientRows, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('profile_id', user!.id)
      if (clientError) {
        if (!cancelled) {
          setError(clientError.message)
          setLoading(false)
        }
        return
      }
      const list = (clientRows as Client[]) ?? []
      const ids = list.map((c) => c.id)
      let siteRows: Site[] = []
      if (ids.length) {
        const { data, error: siteError } = await supabase.from('sites').select('*').in('client_id', ids)
        if (siteError) {
          if (!cancelled) {
            setError(siteError.message)
            setLoading(false)
          }
          return
        }
        siteRows = (data as Site[]) ?? []
      }
      if (cancelled) return
      setClients(list)
      setSites(siteRows)
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user])

  return { clients, sites, loading, error }
}
