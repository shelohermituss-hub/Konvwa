import { useCallback, useEffect, useState } from 'react'
import { VerifiedBadge } from '@/components/shared/verified-badge'
import { Loader2, Trash2, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { RESTRICTIONS, type AccountStatus, type Restriction } from '@/lib/account-access'
import { cn } from '@/lib/utils'
import { tr, trServer, DATE_LOCALE, LOCALE_TAG } from '@/lib/i18n'
import type { UserRole } from '@/types'

interface RecentOrder { id: string; code: string; status: string; amount: number; created_at: string; kind: 'order' | 'catalog' }
interface RecentTx { id: string; type: string; amount: number; status: string; description: string | null; created_at: string }
interface Overview {
  profile: {
    user_id: string; full_name: string; phone: string | null; role: UserRole; created_at: string
    account_status: AccountStatus; status_reason: string | null; status_until: string | null; restrictions: Restriction[]
    is_reseller: boolean | null; language: string | null
  }
  email: string | null
  last_sign_in_at: string | null
  email_confirmed: boolean
  wallet_balance: number
  kyc_status: string | null
  counts: { orders: number; catalog_orders: number; requests: number; open_tickets: number }
  total_spent: number
  recent_orders: RecentOrder[]
  recent_catalog_orders: RecentOrder[]
  recent_transactions: RecentTx[]
  note: string
}

const RESTRICTION_LABEL: Record<Restriction, () => { title: string; hint: string }> = {
  orders: () => ({ title: tr('Passer des commandes'), hint: tr('Acheter au catalogue, accepter un devis') }),
  payments: () => ({ title: tr('Payer'), hint: tr('Payer une commande, une expédition, un paiement échelonné') }),
  deposits: () => ({ title: tr('Recharger le portefeuille'), hint: tr('MonCash, NatCash et dépôts manuels') }),
  requests: () => ({ title: tr('Demander un devis ou une expédition'), hint: tr('Soumettre un lien produit, envoyer un colis') }),
  support: () => ({ title: tr('Écrire au support'), hint: tr('Ouvrir un ticket ou répondre') }),
}

const ROLE_LABEL: Record<UserRole, string> = { client: tr('Client'), agent: 'Agent', manager: 'Manager', admin: 'Admin' }

function fmt(n: number) { return n.toLocaleString(LOCALE_TAG) }
function day(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}
function toLocalInput(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

/** Complete management of one user: key figures, access (status + restrictions), role, internal note, recent activity. */
export function AdminUserSheet({ userId, onClose, onChanged }: { userId: string | null; onClose: () => void; onChanged: () => void }) {
  const { profile: me, user } = useAuth()
  const [data, setData] = useState<Overview | null>(null)
  const [status, setStatus] = useState<AccountStatus>('active')
  const [reason, setReason] = useState('')
  const [until, setUntil] = useState('')
  const [restrictions, setRestrictions] = useState<Restriction[]>([])
  const [note, setNote] = useState('')
  const [role, setRole] = useState<UserRole>('client')
  const [busy, setBusy] = useState<'access' | 'note' | 'role' | 'delete' | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState('')
  const [acceptLoss, setAcceptLoss] = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
    const { data: res } = await supabase.rpc('admin_user_overview', { p_user: userId })
    const o = res as Overview
    if (!o?.profile) { toast.error(tr('Utilisateur introuvable.')); onClose(); return }
    setData(o)
    setStatus(o.profile.account_status)
    setReason(o.profile.status_reason ?? '')
    setUntil(toLocalInput(o.profile.status_until))
    setRestrictions(o.profile.restrictions ?? [])
    setNote(o.note ?? '')
    setRole(o.profile.role)
  }, [userId, onClose])

  useEffect(() => { setData(null); void load() }, [load])

  const target = data?.profile
  const isSelf = !!target && target.user_id === user?.id
  const iAmAdmin = me?.role === 'admin'
  const locked = !target || isSelf || target.role === 'admin' || (target.role !== 'client' && !iAmAdmin)

  /** Permanently deletes the client account and everything attached to it (administrators only, done by the server). */
  async function deleteAccount() {
    if (!target) return
    setBusy('delete')
    const { data: res, error } = await supabase.functions.invoke('admin-delete-user', {
      body: { user_id: target.user_id, confirm_email: confirmEmail, accept_balance_loss: acceptLoss },
    })
    setBusy(null)
    if (error) {
      const ctx = (error as { context?: Response }).context
      const detail = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) as { error?: string } | null : null
      toast.error(detail?.error ? trServer(detail.error) : tr('Suppression impossible.'))
      return
    }
    if (!res?.success) { toast.error(res?.error ? trServer(String(res.error)) : tr('Suppression impossible.')); return }
    toast.success(tr('Compte supprimé.'))
    setDeleteOpen(false)
    onChanged()
    onClose()
  }

  async function saveAccess() {
    if (!target) return
    setBusy('access')
    const untilIso = status === 'suspended' && until ? new Date(`${until}T23:59:59`).toISOString() : null
    const { data: res, error } = await supabase.rpc('admin_set_user_access', {
      p_user: target.user_id, p_status: status, p_reason: reason || null, p_until: untilIso, p_restrictions: restrictions,
    })
    setBusy(null)
    if (error || !res?.success) { toast.error(trServer((res?.error as string | undefined) ?? error?.message ?? 'Erreur')); return }
    toast.success(tr('Accès mis à jour.'))
    onChanged()
    void load()
  }

  async function saveNote() {
    if (!target) return
    setBusy('note')
    const { error } = await supabase.from('user_admin_notes').upsert({ user_id: target.user_id, note: note.trim(), updated_by: user?.id, updated_at: new Date().toISOString() })
    setBusy(null)
    if (error) { toast.error(tr('Erreur lors de l\'enregistrement.')); return }
    toast.success(tr('Note enregistrée.'))
  }

  async function saveRole() {
    if (!target) return
    setBusy('role')
    const { data: row, error } = await supabase.from('profiles').update({ role }).eq('user_id', target.user_id).select('role').maybeSingle()
    setBusy(null)
    if (error) { toast.error(tr('Erreur lors de la mise à jour du rôle.')); return }
    // the database keeps the old role when the caller is not an administrator
    if (row?.role !== role) { toast.error(tr('Seul un administrateur peut changer les rôles.')); return }
    toast.success(tr('Rôle mis à jour.'))
    onChanged()
    void load()
  }

  function toggle(r: Restriction, on: boolean) {
    setRestrictions((cur) => on ? Array.from(new Set([...cur, r])) : cur.filter((x) => x !== r))
  }

  const orders = data ? [...data.recent_orders, ...data.recent_catalog_orders].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6) : []
  const accessChanged = !!target && (status !== target.account_status || reason !== (target.status_reason ?? '') ||
    until !== toLocalInput(target.status_until) || restrictions.slice().sort().join() !== (target.restrictions ?? []).slice().sort().join())

  return (
    <Sheet open={!!userId} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="inline-flex items-center gap-1.5">{target?.full_name ?? tr('Utilisateur')}{data?.kyc_status === 'approved' && <VerifiedBadge className="h-5 w-5" label={tr('Identité vérifiée')} />}</SheetTitle>
          <SheetDescription>{data?.email ?? ''}</SheetDescription>
        </SheetHeader>

        {!data || !target ? (
          <div className="space-y-3 px-4 pb-6"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-40 rounded-xl" /></div>
        ) : (
          <div className="space-y-5 px-4 pb-8">
            {/* Identity */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-gray-50 p-3.5 text-sm">
              <div><p className="text-[11px] text-muted-foreground">{tr('Téléphone')}</p><p className="font-medium">{target.phone || '—'}</p></div>
              <div><p className="text-[11px] text-muted-foreground">{tr('Rôle')}</p><p className="font-medium">{ROLE_LABEL[target.role]}{target.is_reseller ? ` · ${tr('Revendeur')}` : ''}</p></div>
              <div><p className="text-[11px] text-muted-foreground">{tr('Inscrit le')}</p><p className="font-medium">{day(target.created_at)}</p></div>
              <div><p className="text-[11px] text-muted-foreground">{tr('Dernière connexion')}</p><p className="font-medium">{day(data.last_sign_in_at)}</p></div>
              <div><p className="text-[11px] text-muted-foreground">{tr('Vérification d\'identité')}</p>
                <p className="font-medium">{data.kyc_status === 'approved' ? tr('Vérifiée') : data.kyc_status === 'pending' ? tr('En attente') : data.kyc_status === 'rejected' ? tr('Refusée') : tr('Non soumise')}</p></div>
              <div><p className="text-[11px] text-muted-foreground">{tr('E-mail confirmé')}</p><p className="font-medium">{data.email_confirmed ? tr('Oui') : tr('Non')}</p></div>
            </div>

            {/* Figures */}
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                [tr('Solde'), `${fmt(data.wallet_balance)} HTG`],
                [tr('Dépensé'), `${fmt(data.total_spent)} HTG`],
                [tr('Commandes'), String(data.counts.orders + data.counts.catalog_orders)],
                [tr('Demandes'), String(data.counts.requests)],
                [tr('Tickets ouverts'), String(data.counts.open_tickets)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-gray-100 p-2.5">
                  <p className="text-sm font-bold tabular-nums">{v}</p>
                  <p className="text-[10px] text-muted-foreground">{k}</p>
                </div>
              ))}
            </div>

            {/* Access */}
            <section className="space-y-3 rounded-xl border border-gray-100 p-3.5">
              <h3 className="text-sm font-bold">{tr('Accès au compte')}</h3>
              {locked && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {isSelf ? tr('Vous ne pouvez pas modifier votre propre accès.') : tr('L\'accès de ce compte ne peut pas être modifié ici.')}
                </p>
              )}
              <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={tr('Statut du compte')}>
                {([['active', tr('Actif')], ['suspended', tr('Suspendu')], ['banned', tr('Désactivé')]] as const).map(([k, label]) => (
                  <button key={k} type="button" role="radio" aria-checked={status === k} disabled={locked} onClick={() => setStatus(k)}
                    className={cn('rounded-lg border py-2 text-xs font-semibold transition-colors disabled:opacity-50',
                      status === k ? (k === 'active' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-destructive bg-destructive/10 text-destructive') : 'border-gray-200 text-muted-foreground')}>
                    {label}
                  </button>
                ))}
              </div>
              {status !== 'active' && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="ua-reason" className="text-xs">{tr('Motif (visible par le client)')}</Label>
                    <Textarea id="ua-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={2} disabled={locked} className="rounded-xl" />
                  </div>
                  {status === 'suspended' && (
                    <div className="space-y-1.5">
                      <Label htmlFor="ua-until" className="text-xs">{tr('Jusqu\'au (facultatif)')}</Label>
                      <Input id="ua-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} disabled={locked} className="h-10 rounded-xl" />
                    </div>
                  )}
                </>
              )}
              {status === 'active' && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">{tr('Restreindre certaines actions (le compte reste utilisable) :')}</p>
                  {RESTRICTIONS.map((r) => {
                    const l = RESTRICTION_LABEL[r]()
                    const blocked = restrictions.includes(r)
                    return (
                      <div key={r} className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{l.title}</p>
                          <p className="text-[11px] text-muted-foreground">{l.hint}</p>
                        </div>
                        <span className={cn('text-[11px] font-semibold', blocked ? 'text-destructive' : 'text-emerald-700')}>{blocked ? tr('Bloqué') : tr('Autorisé')}</span>
                        <Switch checked={!blocked} disabled={locked} onCheckedChange={(on) => toggle(r, !on)} aria-label={l.title} />
                      </div>
                    )
                  })}
                </div>
              )}
              <Button onClick={() => void saveAccess()} disabled={locked || busy === 'access' || !accessChanged} className="h-10 w-full rounded-xl font-semibold">
                {busy === 'access' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{tr('Enregistrer l\'accès')}
              </Button>
            </section>

            {/* Role */}
            <section className="space-y-2 rounded-xl border border-gray-100 p-3.5">
              <h3 className="text-sm font-bold">{tr('Rôle')}</h3>
              <div className="flex gap-2">
                <Select value={role} onValueChange={(v) => setRole(v as UserRole)} disabled={!iAmAdmin || isSelf}>
                  <SelectTrigger className="flex-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['client', 'agent', 'manager', 'admin'] as UserRole[]).map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" className="rounded-xl" disabled={!iAmAdmin || isSelf || role === target.role || busy === 'role'} onClick={() => void saveRole()}>
                  {tr('Enregistrer')}
                </Button>
              </div>
              {!iAmAdmin && <p className="text-[11px] text-muted-foreground">{tr('Seul un administrateur peut changer les rôles.')}</p>}
            </section>

            {/* Danger zone: permanent deletion of the account */}
            {iAmAdmin && !isSelf && target.role === 'client' && (
              <section className="space-y-2.5 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5">
                <h3 className="text-sm font-bold text-destructive">{tr('Supprimer le compte')}</h3>
                <p className="text-[11px] text-muted-foreground">
                  {tr('Supprime définitivement le compte et toutes ses données : profil, portefeuille et historique, commandes, demandes, adresses, documents. Impossible à annuler.')}
                </p>
                {!deleteOpen ? (
                  <Button variant="outline" className="h-10 w-full gap-2 rounded-xl border-destructive/40 font-semibold text-destructive hover:bg-destructive/10" onClick={() => { setDeleteOpen(true); setConfirmEmail(''); setAcceptLoss(false) }}>
                    <Trash2 className="h-4 w-4" />{tr('Supprimer ce compte…')}
                  </Button>
                ) : (
                  <div className="space-y-2.5">
                    <p className="text-xs">
                      {tr('Ce compte a {0} commande(s), {1} demande(s) et un solde de {2} HTG.', data.counts.orders + data.counts.catalog_orders, data.counts.requests, fmt(data.wallet_balance))}
                    </p>
                    {data.wallet_balance > 0 && (
                      <label className="flex items-start gap-2 text-xs font-medium">
                        <input type="checkbox" checked={acceptLoss} onChange={(e) => setAcceptLoss(e.target.checked)} className="mt-0.5 h-4 w-4 rounded" />
                        {tr('Je comprends que le solde de ce portefeuille sera perdu.')}
                      </label>
                    )}
                    <div className="space-y-1.5">
                      <Label htmlFor="del-email" className="text-xs">{tr('Pour confirmer, saisissez l\'e-mail du compte :')} <span className="font-mono">{data.email}</span></Label>
                      <Input id="del-email" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} autoComplete="off" className="h-10 rounded-xl" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" className="rounded-xl" onClick={() => setDeleteOpen(false)} disabled={busy === 'delete'}>{tr('Annuler')}</Button>
                      <Button
                        className="gap-2 rounded-xl bg-destructive font-semibold text-white hover:bg-destructive/90"
                        disabled={busy === 'delete' || confirmEmail.trim().toLowerCase() !== (data.email ?? '').toLowerCase() || !data.email || (data.wallet_balance > 0 && !acceptLoss)}
                        onClick={() => void deleteAccount()}
                      >
                        {busy === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}{tr('Supprimer définitivement')}
                      </Button>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Internal note */}
            <section className="space-y-2 rounded-xl border border-gray-100 p-3.5">
              <h3 className="text-sm font-bold">{tr('Note interne')}</h3>
              <p className="text-[11px] text-muted-foreground">{tr('Visible uniquement par l\'équipe.')}</p>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={3} className="rounded-xl" aria-label={tr('Note interne')} />
              <Button variant="outline" className="rounded-xl" disabled={busy === 'note' || note === (data.note ?? '')} onClick={() => void saveNote()}>{tr('Enregistrer la note')}</Button>
            </section>

            {/* Activity */}
            <section className="space-y-2">
              <h3 className="text-sm font-bold">{tr('Dernières commandes')}</h3>
              {orders.length === 0 ? <p className="text-xs text-muted-foreground">{tr('Aucune commande.')}</p> : (
                <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                  {orders.map((o) => (
                    <li key={`${o.kind}-${o.id}`} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1 truncate font-mono text-xs">{o.code}{o.kind === 'catalog' ? ` · ${tr('Catalogue')}` : ''}</span>
                      <span className="text-xs text-muted-foreground">{o.status}</span>
                      <span className="w-20 text-right text-xs font-semibold tabular-nums">{fmt(o.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <h3 className="flex items-center gap-1.5 pt-2 text-sm font-bold"><Wallet className="h-3.5 w-3.5" aria-hidden="true" />{tr('Dernières opérations du portefeuille')}</h3>
              {data.recent_transactions.length === 0 ? <p className="text-xs text-muted-foreground">{tr('Aucune opération.')}</p> : (
                <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                  {data.recent_transactions.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1 truncate text-xs">{t.description ? trServer(t.description) : t.type}</span>
                      <span className="text-[11px] text-muted-foreground">{day(t.created_at)}</span>
                      <span className={cn('w-20 text-right text-xs font-semibold tabular-nums', t.status !== 'completed' && 'text-amber-600')}>{fmt(t.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
