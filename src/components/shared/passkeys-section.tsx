import { useCallback, useEffect, useState } from 'react'
import { Fingerprint, Loader2, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { useStepUp } from '@/lib/step-up'
import { hasPlatformAuthenticator, isCancelled, passkeysSupported } from '@/lib/passkeys'
import { tr, DATE_LOCALE } from '@/lib/i18n'

interface PasskeyRow { id: string; friendly_name?: string | null; created_at: string; last_used_at?: string | null }

/** Add, rename and remove the passkeys of the signed-in user. `onChange` lets the setup flow react to the first one. */
export function PasskeysSection({ onChange, compact = false }: { onChange?: (count: number) => void; compact?: boolean }) {
  const [rows, setRows] = useState<PasskeyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [platform, setPlatform] = useState(true)
  const supported = passkeysSupported()
  const { ensureAal2 } = useStepUp()

  const load = useCallback(async () => {
    const { data } = await supabase.auth.passkey.list()
    const list = (data ?? []) as PasskeyRow[]
    setRows(list)
    setLoading(false)
    onChange?.(list.length)
  }, [onChange])

  useEffect(() => { void load() }, [load])
  useEffect(() => { void hasPlatformAuthenticator().then(setPlatform) }, [])

  async function add() {
    if (!(await ensureAal2())) return
    setBusy(true)
    const { error } = await supabase.auth.registerPasskey()
    setBusy(false)
    if (error) {
      if (!isCancelled(error)) toast.error(tr('Impossible d\'ajouter la passkey : {0}', error.message))
      return
    }
    toast.success(tr('Passkey ajoutée. Vous pouvez maintenant vous connecter avec votre empreinte ou Face ID.'))
    await load()
  }

  async function rename(id: string) {
    const friendlyName = name.trim().slice(0, 120)
    if (!friendlyName) { setEditing(null); return }
    if (!(await ensureAal2())) return
    const { error } = await supabase.auth.passkey.update({ passkeyId: id, friendlyName })
    if (error) toast.error(error.message)
    setEditing(null)
    await load()
  }

  async function remove(id: string) {
    if (!window.confirm(tr('Supprimer cette passkey ?'))) return
    if (!(await ensureAal2())) return
    const { error } = await supabase.auth.passkey.delete({ passkeyId: id })
    if (error) toast.error(error.message)
    else toast.success(tr('Passkey supprimée.'))
    await load()
  }

  const fmt = (iso: string) => new Date(iso).toLocaleDateString(DATE_LOCALE, { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className={compact ? '' : 'mt-5 border-t border-border/50 pt-5'}>
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Fingerprint className="h-4 w-4 text-primary" aria-hidden="true" />{tr('Empreinte / Face ID (passkey)')}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {tr('Connectez-vous en un geste avec votre empreinte, Face ID ou le code de votre téléphone, sans mot de passe. Impossible à hameçonner.')}
      </p>

      {!supported ? (
        <p className="mt-3 rounded-xl bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">{tr('Ce navigateur ne gère pas les passkeys. Essayez Chrome ou Safari à jour.')}</p>
      ) : (
        <>
          <div className="mt-3 space-y-2">
            {loading ? <div className="h-12 animate-pulse rounded-xl bg-muted/50" /> : rows.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-2.5">
                <Fingerprint className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  {editing === r.id ? (
                    <form onSubmit={(e) => { e.preventDefault(); void rename(r.id) }} className="flex gap-2">
                      <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus aria-label={tr('Nom de la passkey')} className="h-9 rounded-lg" />
                      <Button type="submit" size="sm" className="rounded-lg">{tr('OK')}</Button>
                    </form>
                  ) : (
                    <>
                      <p className="truncate text-sm font-medium">{r.friendly_name || tr('Passkey')}</p>
                      <p className="text-xs text-muted-foreground">
                        {tr('Ajoutée le {0}', fmt(r.created_at))}{r.last_used_at ? ` · ${tr('utilisée le {0}', fmt(r.last_used_at))}` : ''}
                      </p>
                    </>
                  )}
                </div>
                {editing !== r.id && (
                  <>
                    <button type="button" aria-label={tr('Renommer')} onClick={() => { setEditing(r.id); setName(r.friendly_name ?? '') }} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-white"><Pencil className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label={tr('Supprimer')} onClick={() => void remove(r.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-white hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </>
                )}
              </div>
            ))}
          </div>
          {!platform && <p className="mt-2 text-xs text-amber-700">{tr('Cet appareil n\'a pas d\'empreinte ni de Face ID configuré : une clé de sécurité ou un gestionnaire de mots de passe sera proposé.')}</p>}
          <Button variant="outline" size="sm" onClick={() => void add()} disabled={busy} className="mt-3 rounded-xl">
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Fingerprint className="mr-1.5 h-3.5 w-3.5" />}
            {rows.length ? tr('Ajouter une autre passkey') : tr('Activer l\'empreinte / Face ID')}
          </Button>
        </>
      )}
    </div>
  )
}
