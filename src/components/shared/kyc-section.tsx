import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, Clock, Loader2, ShieldAlert, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { tr } from '@/lib/i18n'

interface Kyc {
  status: 'pending' | 'approved' | 'rejected'
  reject_reason: string | null
}

const MAX_BYTES = 8 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

function FilePick({ label, hint, file, onPick }: { label: string; hint: string; file: File | null; onPick: (f: File | null) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-gray-300 px-3 py-3 transition-colors hover:border-primary/50">
      <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{file ? file.name : hint}</span>
      </span>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="sr-only"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
    </label>
  )
}

export function KycSection() {
  const { user } = useAuth()
  const [kyc, setKyc] = useState<Kyc | null>(null)
  const [loading, setLoading] = useState(true)
  const [docType, setDocType] = useState('id_card')
  const [doc, setDoc] = useState<File | null>(null)
  const [selfie, setSelfie] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('kyc_submissions').select('status, reject_reason').eq('user_id', user.id).maybeSingle()
    setKyc((data as Kyc | null) ?? null)
    setLoading(false)
  }, [user])

  useEffect(() => { void load() }, [load])

  function valid(f: File | null) {
    if (!f) return false
    if (!ALLOWED.includes(f.type)) { toast.error(tr('Format non pris en charge (JPG, PNG, WebP ou PDF).')); return false }
    if (f.size > MAX_BYTES) { toast.error(tr('Fichier trop lourd (max 8 Mo).')); return false }
    return true
  }

  async function upload(file: File, kind: string): Promise<string> {
    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg'
    const path = `${user!.id}/${Date.now()}-${kind}.${ext}`
    const { error } = await supabase.storage.from('kyc-documents').upload(path, file, { contentType: file.type, upsert: false })
    if (error) throw new Error(error.message)
    return path
  }

  async function submit() {
    if (!user || !valid(doc) || !valid(selfie)) return
    setBusy(true)
    try {
      const [docPath, selfiePath] = [await upload(doc!, 'doc'), await upload(selfie!, 'selfie')]
      const { data, error } = await supabase.rpc('submit_kyc', { p_doc_type: docType, p_doc_path: docPath, p_selfie_path: selfiePath })
      const result = data as { success?: boolean; error?: string } | null
      if (error || !result?.success) throw new Error(result?.error ?? error?.message ?? tr('Envoi impossible.'))
      toast.success(tr('Documents envoyés. Nous les examinons sous peu.'))
      setDoc(null)
      setSelfie(null)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr('Envoi impossible.'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="mt-5 h-12 animate-pulse rounded-xl bg-muted/50" />

  return (
    <div className="mt-5 border-t border-border/50 pt-5">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        {kyc?.status === 'approved' ? <BadgeCheck className="h-4 w-4 text-emerald-700" />
          : kyc?.status === 'pending' ? <Clock className="h-4 w-4 text-amber-500" />
          : <ShieldAlert className="h-4 w-4 text-muted-foreground" />}
        {tr('Vérification d\'identité')}
      </p>

      {kyc?.status === 'approved' && (
        <p className="mt-1 text-xs text-muted-foreground">{tr('Votre identité est vérifiée. Merci !')}</p>
      )}
      {kyc?.status === 'pending' && (
        <p className="mt-1 text-xs text-muted-foreground">{tr('Vos documents sont en cours d\'examen.')}</p>
      )}

      {kyc?.status !== 'approved' && kyc?.status !== 'pending' && (
        <div className="mt-1 space-y-3">
          <p className="text-xs text-muted-foreground">
            {kyc?.status === 'rejected'
              ? tr('Vérification refusée : {0}. Vous pouvez renvoyer vos documents.', kyc.reject_reason ?? '—')
              : tr('Vérifiez votre identité pour sécuriser votre compte et pouvoir effectuer de gros paiements.')}
          </p>
          <NativeSelect value={docType} onChange={(e) => setDocType(e.target.value)} aria-label={tr('Type de document')} className="w-full">
            <NativeSelectOption value="id_card">{tr('Carte d\'identité nationale (CIN)')}</NativeSelectOption>
            <NativeSelectOption value="passport">{tr('Passeport')}</NativeSelectOption>
            <NativeSelectOption value="driver_license">{tr('Permis de conduire')}</NativeSelectOption>
          </NativeSelect>
          <FilePick label={tr('Photo du document')} hint={tr('Recto lisible, sans reflet')} file={doc} onPick={setDoc} />
          <FilePick label={tr('Selfie avec le document')} hint={tr('Votre visage et le document visibles')} file={selfie} onPick={setSelfie} />
          <Button onClick={() => void submit()} disabled={busy || !doc || !selfie} className="h-11 w-full rounded-xl">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : tr('Envoyer pour vérification')}
          </Button>
          <p className="text-[11px] text-muted-foreground">{tr('Vos documents sont stockés de façon privée et vus uniquement par notre équipe.')}</p>
        </div>
      )}
    </div>
  )
}
