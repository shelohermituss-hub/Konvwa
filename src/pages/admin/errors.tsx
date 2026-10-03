import { useCallback, useEffect, useState } from 'react'
import { Bug, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { tr, DATE_LOCALE } from '@/lib/i18n'

interface Row {
  fingerprint: string
  day: string
  message: string
  stack: string | null
  url: string | null
  user_agent: string | null
  occurrences: number
  last_at: string
}

export function AdminErrorsPage() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)
    const { data } = await supabase.from('client_errors').select('*').gte('day', since).order('last_at', { ascending: false }).limit(100)
    setRows((data ?? []) as Row[])
  }, [])

  useEffect(() => { void load() }, [load])

  const total = rows?.reduce((s, r) => s + r.occurrences, 0) ?? 0

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tr('Erreurs de l\'application')}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{tr('Erreurs remontées par les navigateurs des clients (7 derniers jours), regroupées par type.')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} className="gap-1.5 rounded-xl"><RefreshCw className="h-3.5 w-3.5" />{tr('Actualiser')}</Button>
      </div>

      {!rows ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <Bug className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="font-semibold text-muted-foreground">{tr('Aucune erreur sur 7 jours')}</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{tr('{0} occurrence(s) · {1} type(s) d\'erreur', total, rows.length)}</p>
          <ul className="space-y-2">
            {rows.map((r) => {
              const key = `${r.fingerprint}-${r.day}`
              return (
                <li key={key} className="rounded-2xl border border-gray-100 bg-white shadow-sm">
                  <button type="button" onClick={() => setOpen(open === key ? null : key)} className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left" aria-expanded={open === key}>
                    <span className="min-w-0">
                      <span className="block break-words text-sm font-semibold">{r.message}</span>
                      <span className="text-xs text-muted-foreground">{r.url ?? '—'} · {new Date(r.last_at).toLocaleString(DATE_LOCALE, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-bold text-destructive">×{r.occurrences}</span>
                  </button>
                  {open === key && (
                    <div className="border-t border-gray-100 px-4 py-3">
                      <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words text-[11px] text-muted-foreground">{r.stack || tr('Pas de trace')}</pre>
                      {r.user_agent && <p className="mt-2 break-words text-[11px] text-muted-foreground">{r.user_agent}</p>}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
