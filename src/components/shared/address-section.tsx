import { useState } from 'react'
import { Loader2, MapPin, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { tr } from '@/lib/i18n'

interface AddressEntry {
  id: string
  label: string
  address: string
  phone: string
  default: boolean
}

/** Delivery addresses of the signed-in user (profile and account setup). */
export function AddressSection({ onChange }: { onChange?: (count: number) => void } = {}) {
  const { user } = useAuth()
  const [addresses, setAddresses] = useState<AddressEntry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [label, setLabel] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')

  async function load() {
    if (!user || loaded) return
    const { data } = await supabase.from('delivery_addresses').select('*').eq('user_id', user.id).order('created_at')
    if (data) { setAddresses(data as AddressEntry[]); onChange?.(data.length) }
    setLoaded(true)
  }

  if (!loaded) load()

  async function handleAdd() {
    if (!user || !address.trim()) return
    setSaving(true)
    const { error } = await supabase.from('delivery_addresses').insert({
      user_id: user.id, label: label || 'Domicile', address, phone: phone || null, default: addresses.length === 0,
    })
    if (error) toast.error(tr('Erreur lors de l\'ajout.'))
    else { toast.success(tr('Adresse ajoutée.')); setLabel(''); setAddress(''); setPhone(''); setAdding(false); setLoaded(false) }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    await supabase.from('delivery_addresses').delete().eq('id', id)
    setAddresses(prev => { const next = prev.filter(a => a.id !== id); onChange?.(next.length); return next })
    toast.success(tr('Adresse supprimée.'))
  }

  async function handleSetDefault(id: string) {
    if (!user) return
    await supabase.from('delivery_addresses').update({ default: false }).eq('user_id', user.id)
    await supabase.from('delivery_addresses').update({ default: true }).eq('id', id)
    setLoaded(false)
    toast.success(tr('Adresse principale mise à jour.'))
  }

  return (
    <div className="p-5 space-y-3">
      {addresses.map((a) => (
        <div key={a.id} className={cn('rounded-xl border p-3.5 flex gap-3', a.default ? 'border-primary/30 bg-primary/4' : 'border-border bg-muted/20')}>
          <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl shrink-0', a.default ? 'bg-primary/10' : 'bg-muted')}>
            <MapPin className={cn('h-4 w-4', a.default ? 'text-primary' : 'text-muted-foreground')} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm">{a.label}</p>
              {a.default && <span className="rounded-full bg-primary/15 text-primary text-[9px] font-bold px-2 py-0.5">{tr('Principal')}</span>}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{a.address}</p>
            {a.phone && <p className="text-xs text-muted-foreground mt-0.5">{a.phone}</p>}
            {!a.default && (
              <button onClick={() => handleSetDefault(a.id)} className="text-[11px] text-primary font-semibold mt-1.5">
                {tr('Définir par défaut')}
              </button>
            )}
          </div>
          <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {adding ? (
        <div className="rounded-xl border border-border bg-[#F4F5F7] p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{tr('Libellé')}</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={tr('Maison, Bureau…')} className="h-10 rounded-xl bg-white border-0 focus-visible:ring-1 focus-visible:ring-primary/40" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{tr('Téléphone')}</Label>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+509 XXXX" className="h-10 rounded-xl bg-white border-0 focus-visible:ring-1 focus-visible:ring-primary/40" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{tr('Adresse complète')}</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={tr('Rue, Ville, Département')} className="h-10 rounded-xl bg-white border-0 focus-visible:ring-1 focus-visible:ring-primary/40" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setAdding(false)} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted/30 transition-colors">{tr('Annuler')}</button>
            <button
              onClick={handleAdd}
              disabled={saving || !address.trim()}
              className="rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
            >
              {saving && <Loader2 className="inline h-3.5 w-3.5 animate-spin mr-1" />}{tr('Ajouter')}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/25 py-3 text-sm font-semibold text-primary hover:border-primary/40 hover:bg-primary/4 transition-colors"
        >
          <Plus className="h-4 w-4" />{tr('Ajouter une adresse')}
        </button>
      )}
    </div>
  )
}

