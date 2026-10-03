import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, ExternalLink, FileSearch, Loader2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { tr, DATE_LOCALE } from '@/lib/i18n'

interface Row {
  user_id: string
  status: 'pending' | 'approved' | 'rejected'
  doc_type: string
  doc_path: string
  selfie_path: string
  submitted_at: string
  reject_reason: string | null
  full_name?: string
  phone?: string | null
  docUrl?: string
  selfieUrl?: string
}

const DOC_LABEL: Record<string, string> = {
  id_card: tr('Carte d\'identité nationale (CIN)'), passport: tr('Passeport'), driver_license: tr('Permis de conduire'),
}
const FILTERS = [
  { value: 'pending', label: tr('À examiner') },
  { value: 'approved', label: tr('Vérifiés') },
  { value: 'rejected', label: tr('Refusés') },
]

function isImage(path: string) { return /\.(jpe?g|png|webp)$/i.test(path) }

export function AdminKycPage() {
  const [status, setStatus] = useState('pending')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('kyc_submissions')
      .select('user_id, status, doc_type, doc_path, selfie_path, submitted_at, reject_reason')
      .eq('status', status)
      .order('submitted_at', { ascending: true })
      .limit(50)
    const list = (data ?? []) as Row[]
    const ids = list.map((r) => r.user_id)
    const { data: people } = ids.length
      ? await supabase.from('profiles').select('user_id, full_name, phone').in('user_id', ids)
      : { data: [] }
    const byId = Object.fromEntries((people ?? []).map((p) => [p.user_id as string, p]))
    const withUrls = await Promise.all(list.map(async (r) => {
      const [d, s] = await Promise.all([
        supabase.storage.from('kyc-documents').createSignedUrl(r.doc_path, 900),
        supabase.storage.from('kyc-documents').createSignedUrl(r.selfie_path, 900),
      ])
      return { ...r, full_name: byId[r.user_id]?.full_name ?? '—', phone: byId[r.user_id]?.phone ?? null, docUrl: d.data?.signedUrl, selfieUrl: s.data?.signedUrl }
    }))
    setRows(withUrls)
    setLoading(false)
  }, [status])

  useEffect(() => { void load() }, [load])

  async function review(row: Row, approve: boolean) {
    setBusyId(row.user_id)
    const { data, error } = await supabase.rpc('admin_review_kyc', { p_user_id: row.user_id, p_approve: approve, p_reason: reasons[row.user_id] ?? null })
    setBusyId(null)
    const result = data as { success?: boolean; error?: string } | null
    if (error || !result?.success) { toast.error(result?.error ?? error?.message ?? tr('Action impossible.')); return }
    toast.success(approve ? tr('Identité vérifiée.') : tr('Vérification refusée.'))
    void load()
  }

  function Doc({ url, path, label }: { url?: string; path: string; label: string }) {
    return (
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        {url && isImage(path) ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
            <img src={url} alt={label} className="h-48 w-full object-contain" />
          </a>
        ) : url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="flex h-24 items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 text-xs font-semibold text-primary">
            <ExternalLink className="h-3.5 w-3.5" />{tr('Ouvrir le fichier')}
          </a>
        ) : (
          <div className="flex h-24 items-center justify-center rounded-xl border border-dashed text-xs text-muted-foreground">{tr('Fichier indisponible')}</div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{tr('Vérification d\'identité')}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{tr('Examinez les documents envoyés par les clients.')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatus(f.value)}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
              status === f.value ? 'border-primary bg-primary text-white' : 'border-gray-200 bg-white text-muted-foreground hover:border-primary/40',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <FileSearch className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="font-semibold text-muted-foreground">{tr('Aucune demande')}</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.user_id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{r.full_name}</p>
                  <p className="text-xs text-muted-foreground">{r.phone ?? '—'} · {DOC_LABEL[r.doc_type] ?? r.doc_type}</p>
                </div>
                <time className="text-xs text-muted-foreground" dateTime={r.submitted_at}>
                  {new Date(r.submitted_at).toLocaleString(DATE_LOCALE, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </time>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Doc url={r.docUrl} path={r.doc_path} label={tr('Document')} />
                <Doc url={r.selfieUrl} path={r.selfie_path} label={tr('Selfie')} />
              </div>
              {r.status === 'pending' ? (
                <div className="mt-3 space-y-2">
                  <Textarea
                    value={reasons[r.user_id] ?? ''}
                    onChange={(e) => setReasons((p) => ({ ...p, [r.user_id]: e.target.value }))}
                    maxLength={200}
                    placeholder={tr('Motif (obligatoire pour refuser)')}
                    className="rounded-xl"
                  />
                  <div className="flex gap-2">
                    <Button onClick={() => void review(r, true)} disabled={busyId === r.user_id} className="gap-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700">
                      {busyId === r.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}{tr('Valider')}
                    </Button>
                    <Button variant="outline" onClick={() => void review(r, false)} disabled={busyId === r.user_id || !(reasons[r.user_id] ?? '').trim()} className="gap-1.5 rounded-xl text-destructive">
                      <XCircle className="h-4 w-4" />{tr('Refuser')}
                    </Button>
                  </div>
                </div>
              ) : r.reject_reason ? (
                <p className="mt-3 text-xs text-muted-foreground">{tr('Motif')} : {r.reject_reason}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
