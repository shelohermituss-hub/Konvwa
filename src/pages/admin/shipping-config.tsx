import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Plus, Pencil, Trash2, Loader2, Truck, MapPin, Package, Globe, Ship, Plane, DollarSign } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface ShippingOrigin {
  id: string; name: string; country_code: string; city: string
  flag_emoji: string; active: boolean; sort_order: number
}
interface HaitiRegion {
  id: string; name: string; active: boolean; sort_order: number
}
interface HaitiCity {
  id: string; region_id: string; name: string; active: boolean; sort_order: number
}
interface ProductType {
  id: string; name: string; active: boolean; sort_order: number
}
interface ShippingRate {
  id: string; mode: 'ocean' | 'air'; name: string; type_label: string; priority: string
  origin_id: string | null; min_amount_usd: number; max_weight_kg: number | null
  base_fee_usd: number; per_kg_usd: number | null; per_lb_usd: number | null
  per_cbm_usd: number | null; per_cuft_usd: number | null
  transit_days_min: number | null; transit_days_max: number | null
  description: string | null; active: boolean; sort_order: number
  shipping_origins?: { name: string; flag_emoji: string | null } | null
}

// ── Shared helpers ────────────────────────────────────────────────────────────

const BTN_ORANGE = { background: 'linear-gradient(135deg, #F05A28, #D44E21)', color: '#fff' }

function ActiveBadge({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'text-[11px] font-bold px-2.5 py-0.5 rounded-full transition-colors',
        active ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
      )}
    >
      {active ? 'Actif' : 'Inactif'}
    </button>
  )
}

function SectionCard({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
        <p className="font-semibold text-sm text-foreground">{title}</p>
        <span className="text-xs text-muted-foreground">{count} entrée{count !== 1 ? 's' : ''}</span>
      </div>
      {children}
    </div>
  )
}

// ── Tab bar ──────────────────────────────────────────────────────────────────

type Tab = 'origins' | 'regions' | 'cities' | 'types' | 'rates'

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'origins', label: 'Origines',    icon: Globe       },
  { key: 'regions', label: 'Régions',     icon: MapPin      },
  { key: 'cities',  label: 'Villes',      icon: Truck       },
  { key: 'types',   label: 'Types colis', icon: Package     },
  { key: 'rates',   label: 'Tarifs',      icon: DollarSign  },
]

// ── Origins section ───────────────────────────────────────────────────────────

function OriginsSection() {
  const [items,   setItems]   = useState<ShippingOrigin[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [open,    setOpen]    = useState(false)
  const [editing, setEditing] = useState<ShippingOrigin | null>(null)
  const [form,    setForm]    = useState({ name: '', country_code: 'CN', city: '', flag_emoji: '🇨🇳' })

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('shipping_origins').select('*').order('sort_order')
    setItems(data as ShippingOrigin[] || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openAdd() {
    setEditing(null)
    setForm({ name: '', country_code: 'CN', city: '', flag_emoji: '🇨🇳' })
    setOpen(true)
  }

  function openEdit(item: ShippingOrigin) {
    setEditing(item)
    setForm({ name: item.name, country_code: item.country_code, city: item.city, flag_emoji: item.flag_emoji })
    setOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.city.trim()) { toast.error('Nom et ville requis.'); return }
    setSaving(true)
    if (editing) {
      const { error } = await supabase.from('shipping_origins').update({
        name: form.name.trim(), country_code: form.country_code.toUpperCase(), city: form.city.trim(), flag_emoji: form.flag_emoji,
      }).eq('id', editing.id)
      if (error) { toast.error('Erreur lors de la mise à jour.'); setSaving(false); return }
      toast.success('Origine mise à jour.')
    } else {
      const maxOrder = items.reduce((m, i) => Math.max(m, i.sort_order), 0)
      const { error } = await supabase.from('shipping_origins').insert({
        name: form.name.trim(), country_code: form.country_code.toUpperCase(), city: form.city.trim(),
        flag_emoji: form.flag_emoji, sort_order: maxOrder + 1,
      })
      if (error) { toast.error('Erreur lors de la création.'); setSaving(false); return }
      toast.success('Origine ajoutée.')
    }
    setSaving(false)
    setOpen(false)
    load()
  }

  async function handleToggle(item: ShippingOrigin) {
    const { error } = await supabase.from('shipping_origins').update({ active: !item.active }).eq('id', item.id)
    if (error) { toast.error('Erreur.'); return }
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, active: !i.active } : i))
  }

  async function handleDelete(item: ShippingOrigin) {
    if (!confirm(`Supprimer "${item.name}" ?`)) return
    const { error } = await supabase.from('shipping_origins').delete().eq('id', item.id)
    if (error) { toast.error('Impossible de supprimer (référencé par des commandes).'); return }
    toast.success('Supprimé.')
    load()
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">Entrepôts de départ disponibles pour les clients</p>
        <Button size="sm" onClick={openAdd} className="rounded-xl gap-1.5" style={BTN_ORANGE}>
          <Plus className="h-3.5 w-3.5" /> Ajouter
        </Button>
      </div>

      <SectionCard title="Origines d'expédition" count={items.length}>
        {loading ? (
          <div className="p-4 space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Aucune origine.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3.5">
                <span className="text-2xl leading-none shrink-0">{item.flag_emoji || '🏳️'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.city} · {item.country_code}</p>
                </div>
                <ActiveBadge active={item.active} onToggle={() => handleToggle(item)} />
                <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button onClick={() => handleDelete(item)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier' : 'Ajouter'} une origine</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Nom complet <span className="text-destructive">*</span></Label>
              <Input placeholder="Shenzhen, CN Warehouse" value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Ville <span className="text-destructive">*</span></Label>
                <Input placeholder="Shenzhen" value={form.city}
                  onChange={e => setForm(p => ({ ...p, city: e.target.value }))} className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Code pays</Label>
                <Input placeholder="CN" value={form.country_code} maxLength={2}
                  onChange={e => setForm(p => ({ ...p, country_code: e.target.value.toUpperCase() }))} className="rounded-xl font-mono" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Emoji drapeau</Label>
              <Input placeholder="🇨🇳" value={form.flag_emoji}
                onChange={e => setForm(p => ({ ...p, flag_emoji: e.target.value }))} className="rounded-xl text-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Annuler</Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl gap-2" style={BTN_ORANGE}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Regions section ───────────────────────────────────────────────────────────

function RegionsSection() {
  const [items,   setItems]   = useState<HaitiRegion[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [open,    setOpen]    = useState(false)
  const [editing, setEditing] = useState<HaitiRegion | null>(null)
  const [form,    setForm]    = useState({ name: '' })

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('haiti_regions').select('*').order('sort_order')
    setItems(data as HaitiRegion[] || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openAdd() { setEditing(null); setForm({ name: '' }); setOpen(true) }
  function openEdit(item: HaitiRegion) { setEditing(item); setForm({ name: item.name }); setOpen(true) }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Nom requis.'); return }
    setSaving(true)
    if (editing) {
      const { error } = await supabase.from('haiti_regions').update({ name: form.name.trim() }).eq('id', editing.id)
      if (error) { toast.error('Erreur.'); setSaving(false); return }
      toast.success('Région mise à jour.')
    } else {
      const maxOrder = items.reduce((m, i) => Math.max(m, i.sort_order), 0)
      const { error } = await supabase.from('haiti_regions').insert({ name: form.name.trim(), sort_order: maxOrder + 1 })
      if (error) { toast.error('Erreur.'); setSaving(false); return }
      toast.success('Région ajoutée.')
    }
    setSaving(false); setOpen(false); load()
  }

  async function handleToggle(item: HaitiRegion) {
    const { error } = await supabase.from('haiti_regions').update({ active: !item.active }).eq('id', item.id)
    if (error) { toast.error('Erreur.'); return }
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, active: !i.active } : i))
  }

  async function handleDelete(item: HaitiRegion) {
    if (!confirm(`Supprimer la région "${item.name}" et toutes ses villes ?`)) return
    const { error } = await supabase.from('haiti_regions').delete().eq('id', item.id)
    if (error) { toast.error('Impossible de supprimer (commandes référencées).'); return }
    toast.success('Région supprimée.'); load()
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">Régions disponibles pour la livraison en Haïti</p>
        <Button size="sm" onClick={openAdd} className="rounded-xl gap-1.5" style={BTN_ORANGE}>
          <Plus className="h-3.5 w-3.5" /> Ajouter
        </Button>
      </div>

      <SectionCard title="Régions Haïti" count={items.length}>
        {loading ? (
          <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Aucune région.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 shrink-0">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                </div>
                <p className="flex-1 text-sm font-semibold">{item.name}</p>
                <ActiveBadge active={item.active} onToggle={() => handleToggle(item)} />
                <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button onClick={() => handleDelete(item)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier' : 'Ajouter'} une région</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-sm font-semibold">Nom de la région <span className="text-destructive">*</span></Label>
            <Input placeholder="Ouest" value={form.name}
              onChange={e => setForm({ name: e.target.value })} className="rounded-xl mt-1.5" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Annuler</Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl gap-2" style={BTN_ORANGE}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Cities section ────────────────────────────────────────────────────────────

function CitiesSection() {
  const [regions,      setRegions]      = useState<HaitiRegion[]>([])
  const [selectedRegion, setSelectedRegion] = useState('')
  const [items,        setItems]        = useState<HaitiCity[]>([])
  const [loading,      setLoading]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [open,         setOpen]         = useState(false)
  const [editing,      setEditing]      = useState<HaitiCity | null>(null)
  const [form,         setForm]         = useState({ name: '', region_id: '' })

  useEffect(() => {
    supabase.from('haiti_regions').select('id,name,active,sort_order').order('sort_order')
      .then(({ data }) => setRegions(data as HaitiRegion[] || []))
  }, [])

  async function loadCities(regionId: string) {
    if (!regionId) { setItems([]); return }
    setLoading(true)
    const { data } = await supabase.from('haiti_cities').select('*').eq('region_id', regionId).order('sort_order')
    setItems(data as HaitiCity[] || [])
    setLoading(false)
  }

  function handleRegionChange(id: string) {
    setSelectedRegion(id)
    loadCities(id)
  }

  function openAdd() {
    setEditing(null)
    setForm({ name: '', region_id: selectedRegion })
    setOpen(true)
  }

  function openEdit(item: HaitiCity) {
    setEditing(item)
    setForm({ name: item.name, region_id: item.region_id })
    setOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Nom requis.'); return }
    if (!form.region_id)   { toast.error('Région requise.'); return }
    setSaving(true)
    if (editing) {
      const { error } = await supabase.from('haiti_cities')
        .update({ name: form.name.trim(), region_id: form.region_id }).eq('id', editing.id)
      if (error) { toast.error('Erreur.'); setSaving(false); return }
      toast.success('Ville mise à jour.')
    } else {
      const maxOrder = items.reduce((m, i) => Math.max(m, i.sort_order), 0)
      const { error } = await supabase.from('haiti_cities')
        .insert({ name: form.name.trim(), region_id: form.region_id, sort_order: maxOrder + 1 })
      if (error) { toast.error('Erreur.'); setSaving(false); return }
      toast.success('Ville ajoutée.')
    }
    setSaving(false); setOpen(false)
    if (form.region_id === selectedRegion) loadCities(selectedRegion)
  }

  async function handleToggle(item: HaitiCity) {
    const { error } = await supabase.from('haiti_cities').update({ active: !item.active }).eq('id', item.id)
    if (error) { toast.error('Erreur.'); return }
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, active: !i.active } : i))
  }

  async function handleDelete(item: HaitiCity) {
    if (!confirm(`Supprimer "${item.name}" ?`)) return
    const { error } = await supabase.from('haiti_cities').delete().eq('id', item.id)
    if (error) { toast.error('Impossible de supprimer.'); return }
    toast.success('Supprimée.'); loadCities(selectedRegion)
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">Villes par région disponibles à la livraison</p>
        <Button size="sm" onClick={openAdd} disabled={!selectedRegion} className="rounded-xl gap-1.5" style={BTN_ORANGE}>
          <Plus className="h-3.5 w-3.5" /> Ajouter
        </Button>
      </div>

      {/* Region filter */}
      <div className="mb-4">
        <Select value={selectedRegion} onValueChange={handleRegionChange}>
          <SelectTrigger className="h-11 rounded-xl bg-white border border-gray-200">
            <SelectValue placeholder="Sélectionner une région" />
          </SelectTrigger>
          <SelectContent>
            {regions.map(r => (
              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <SectionCard title={`Villes${selectedRegion ? ' — ' + (regions.find(r => r.id === selectedRegion)?.name || '') : ''}`} count={items.length}>
        {!selectedRegion ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Sélectionnez une région pour voir ses villes.</p>
        ) : loading ? (
          <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Aucune ville pour cette région.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                <p className="flex-1 text-sm font-semibold">{item.name}</p>
                <ActiveBadge active={item.active} onToggle={() => handleToggle(item)} />
                <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button onClick={() => handleDelete(item)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier' : 'Ajouter'} une ville</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Région <span className="text-destructive">*</span></Label>
              <Select value={form.region_id} onValueChange={v => setForm(p => ({ ...p, region_id: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Choisir une région" /></SelectTrigger>
                <SelectContent>
                  {regions.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Nom de la ville <span className="text-destructive">*</span></Label>
              <Input placeholder="Port-au-Prince" value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Annuler</Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl gap-2" style={BTN_ORANGE}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Product types section ─────────────────────────────────────────────────────

function ProductTypesSection() {
  const [items,   setItems]   = useState<ProductType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [open,    setOpen]    = useState(false)
  const [editing, setEditing] = useState<ProductType | null>(null)
  const [form,    setForm]    = useState({ name: '' })

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('product_types').select('*').order('sort_order')
    setItems(data as ProductType[] || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openAdd() { setEditing(null); setForm({ name: '' }); setOpen(true) }
  function openEdit(item: ProductType) { setEditing(item); setForm({ name: item.name }); setOpen(true) }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Nom requis.'); return }
    setSaving(true)
    if (editing) {
      const { error } = await supabase.from('product_types').update({ name: form.name.trim() }).eq('id', editing.id)
      if (error) { toast.error('Erreur.'); setSaving(false); return }
      toast.success('Type mis à jour.')
    } else {
      const maxOrder = items.reduce((m, i) => Math.max(m, i.sort_order), 0)
      const { error } = await supabase.from('product_types').insert({ name: form.name.trim(), sort_order: maxOrder + 1 })
      if (error) { toast.error('Erreur.'); setSaving(false); return }
      toast.success('Type ajouté.')
    }
    setSaving(false); setOpen(false); load()
  }

  async function handleToggle(item: ProductType) {
    const { error } = await supabase.from('product_types').update({ active: !item.active }).eq('id', item.id)
    if (error) { toast.error('Erreur.'); return }
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, active: !i.active } : i))
  }

  async function handleDelete(item: ProductType) {
    if (!confirm(`Supprimer "${item.name}" ?`)) return
    const { error } = await supabase.from('product_types').delete().eq('id', item.id)
    if (error) { toast.error('Impossible de supprimer.'); return }
    toast.success('Supprimé.'); load()
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">Types de produits disponibles dans le formulaire client</p>
        <Button size="sm" onClick={openAdd} className="rounded-xl gap-1.5" style={BTN_ORANGE}>
          <Plus className="h-3.5 w-3.5" /> Ajouter
        </Button>
      </div>

      <SectionCard title="Types de produit" count={items.length}>
        {loading ? (
          <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Aucun type.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <Package className="h-3.5 w-3.5 text-primary" />
                </div>
                <p className="flex-1 text-sm font-semibold">{item.name}</p>
                <ActiveBadge active={item.active} onToggle={() => handleToggle(item)} />
                <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button onClick={() => handleDelete(item)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier' : 'Ajouter'} un type</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-sm font-semibold">Nom du type <span className="text-destructive">*</span></Label>
            <Input placeholder="Électronique" value={form.name}
              onChange={e => setForm({ name: e.target.value })} className="rounded-xl mt-1.5" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Annuler</Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl gap-2" style={BTN_ORANGE}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Shipping rates section ────────────────────────────────────────────────────

type RateForm = {
  mode: 'ocean' | 'air'
  name: string
  type_label: string
  origin_id: string
  per_cbm_usd: string
  per_kg_usd: string
  min_amount_usd: string
  transit_days_min: string
  transit_days_max: string
  description: string
  active: boolean
  sort_order: string
}

const EMPTY_RATE_FORM: RateForm = {
  mode: 'ocean', name: '', type_label: 'Standard', origin_id: '',
  per_cbm_usd: '', per_kg_usd: '', min_amount_usd: '0',
  transit_days_min: '', transit_days_max: '', description: '', active: true, sort_order: '0',
}

function ShippingRatesSection() {
  const [items,   setItems]   = useState<ShippingRate[]>([])
  const [origins, setOrigins] = useState<ShippingOrigin[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [open,    setOpen]    = useState(false)
  const [editing, setEditing] = useState<ShippingRate | null>(null)
  const [form,    setForm]    = useState<RateForm>(EMPTY_RATE_FORM)

  async function load() {
    setLoading(true)
    const [{ data: rates }, { data: orgs }] = await Promise.all([
      supabase.from('shipping_rates').select('*, shipping_origins(name, flag_emoji)').order('sort_order'),
      supabase.from('shipping_origins').select('*').order('sort_order'),
    ])
    setItems(rates as ShippingRate[] || [])
    setOrigins(orgs as ShippingOrigin[] || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function toForm(r: ShippingRate): RateForm {
    return {
      mode: r.mode, name: r.name, type_label: r.type_label, origin_id: r.origin_id ?? '',
      per_cbm_usd: r.per_cbm_usd?.toString() ?? '', per_kg_usd: r.per_kg_usd?.toString() ?? '',
      min_amount_usd: r.min_amount_usd.toString(),
      transit_days_min: r.transit_days_min?.toString() ?? '', transit_days_max: r.transit_days_max?.toString() ?? '',
      description: r.description ?? '', active: r.active, sort_order: r.sort_order.toString(),
    }
  }

  function openAdd() { setEditing(null); setForm(EMPTY_RATE_FORM); setOpen(true) }
  function openEdit(item: ShippingRate) { setEditing(item); setForm(toForm(item)); setOpen(true) }

  function buildPayload() {
    return {
      mode: form.mode,
      name: form.name.trim(),
      type_label: form.type_label.trim() || 'Standard',
      origin_id: form.origin_id || null,
      per_cbm_usd: form.per_cbm_usd ? parseFloat(form.per_cbm_usd) : null,
      per_kg_usd: form.per_kg_usd ? parseFloat(form.per_kg_usd) : null,
      per_lb_usd: null,
      per_cuft_usd: null,
      base_fee_usd: 0,
      min_amount_usd: parseFloat(form.min_amount_usd) || 0,
      max_weight_kg: null,
      transit_days_min: form.transit_days_min ? parseInt(form.transit_days_min) : null,
      transit_days_max: form.transit_days_max ? parseInt(form.transit_days_max) : null,
      description: form.description.trim() || null,
      active: form.active,
      sort_order: parseInt(form.sort_order) || 0,
    }
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Nom requis.'); return }
    if (form.mode === 'ocean' && !form.per_cbm_usd) { toast.error('Tarif CBM requis pour l\'océan.'); return }
    if (form.mode === 'air'   && !form.per_kg_usd)  { toast.error('Tarif kg requis pour l\'aérien.'); return }
    setSaving(true)
    if (editing) {
      const { error } = await supabase.from('shipping_rates').update(buildPayload()).eq('id', editing.id)
      if (error) { toast.error('Erreur mise à jour.'); setSaving(false); return }
      toast.success('Tarif mis à jour.')
    } else {
      const { error } = await supabase.from('shipping_rates').insert(buildPayload())
      if (error) { toast.error('Erreur création.'); setSaving(false); return }
      toast.success('Tarif ajouté.')
    }
    setSaving(false); setOpen(false); load()
  }

  async function handleToggle(item: ShippingRate) {
    const { error } = await supabase.from('shipping_rates').update({ active: !item.active }).eq('id', item.id)
    if (error) { toast.error('Erreur.'); return }
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, active: !i.active } : i))
  }

  async function handleDelete(item: ShippingRate) {
    if (!confirm(`Supprimer le tarif "${item.name}" ?`)) return
    const { error } = await supabase.from('shipping_rates').delete().eq('id', item.id)
    if (error) { toast.error('Impossible de supprimer.'); return }
    toast.success('Tarif supprimé.'); load()
  }

  const ocean = items.filter(r => r.mode === 'ocean')
  const air   = items.filter(r => r.mode === 'air')

  function RateGroup({ title, icon: Icon, rates, color }: { title: string; icon: React.ElementType; rates: ShippingRate[]; color: string }) {
    if (rates.length === 0) return null
    return (
      <SectionCard title={<span className="flex items-center gap-2"><Icon className={cn('h-4 w-4', color)} />{title}</span> as unknown as string} count={rates.length}>
        <div className="divide-y divide-gray-100">
          {rates.map(item => {
            const org = item.shipping_origins
            const transit = item.transit_days_min != null
              ? `${item.transit_days_min}${item.transit_days_max != null ? '–' + item.transit_days_max : ''} j`
              : null
            const rate = item.mode === 'ocean'
              ? (item.per_cbm_usd != null ? `$${item.per_cbm_usd}/CBM` : '—')
              : (item.per_kg_usd  != null ? `$${item.per_kg_usd}/kg`  : '—')
            return (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-full shrink-0', item.mode === 'ocean' ? 'bg-blue-50' : 'bg-sky-50')}>
                  <Icon className={cn('h-3.5 w-3.5', color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{item.name}</p>
                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full shrink-0">{item.type_label}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    {org && <span>{org.flag_emoji ?? ''} {org.name}</span>}
                    {transit && <span>{transit}</span>}
                    <span className="font-semibold text-foreground">{rate}</span>
                    {item.min_amount_usd > 0 && <span>min ${item.min_amount_usd}</span>}
                  </div>
                </div>
                <ActiveBadge active={item.active} onToggle={() => handleToggle(item)} />
                <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button onClick={() => handleDelete(item)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
            )
          })}
        </div>
      </SectionCard>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">Tarifs de fret utilisés pour calculer le coût d'expédition</p>
        <Button size="sm" onClick={openAdd} className="rounded-xl gap-1.5" style={BTN_ORANGE}>
          <Plus className="h-3.5 w-3.5" /> Ajouter
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl bg-white border border-gray-100 py-14 text-center">
          <p className="text-sm text-muted-foreground">Aucun tarif configuré.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <RateGroup title="Fret maritime" icon={Ship} rates={ocean} color="text-blue-600" />
          <RateGroup title="Fret aérien"   icon={Plane} rates={air}   color="text-sky-500" />
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier' : 'Ajouter'} un tarif</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">

            {/* Mode */}
            <div className="grid grid-cols-2 gap-2">
              {(['ocean', 'air'] as const).map(m => (
                <button key={m} onClick={() => setForm(p => ({ ...p, mode: m }))}
                  className={cn(
                    'flex items-center justify-center gap-2 h-10 rounded-xl border text-sm font-semibold transition-all',
                    form.mode === m ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-muted-foreground hover:border-gray-300'
                  )}
                >
                  {m === 'ocean' ? <Ship className="h-4 w-4" /> : <Plane className="h-4 w-4" />}
                  {m === 'ocean' ? 'Maritime' : 'Aérien'}
                </button>
              ))}
            </div>

            {/* Name + type */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Nom <span className="text-destructive">*</span></Label>
                <Input placeholder="Express Chine" value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Type</Label>
                <Input placeholder="Standard / Express" value={form.type_label}
                  onChange={e => setForm(p => ({ ...p, type_label: e.target.value }))} className="rounded-xl" />
              </div>
            </div>

            {/* Origin */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Origine (optionnel)</Label>
              <Select value={form.origin_id} onValueChange={v => setForm(p => ({ ...p, origin_id: v === '__none' ? '' : v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Toutes origines" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Toutes origines</SelectItem>
                  {origins.map(o => <SelectItem key={o.id} value={o.id}>{o.flag_emoji} {o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Rate fields */}
            {form.mode === 'ocean' ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Tarif / CBM (USD) <span className="text-destructive">*</span></Label>
                  <Input type="number" step="0.01" placeholder="790" value={form.per_cbm_usd}
                    onChange={e => setForm(p => ({ ...p, per_cbm_usd: e.target.value }))} className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Minimum (USD)</Label>
                  <Input type="number" step="0.01" placeholder="0" value={form.min_amount_usd}
                    onChange={e => setForm(p => ({ ...p, min_amount_usd: e.target.value }))} className="rounded-xl" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Tarif / kg (USD) <span className="text-destructive">*</span></Label>
                  <Input type="number" step="0.001" placeholder="10.978" value={form.per_kg_usd}
                    onChange={e => setForm(p => ({ ...p, per_kg_usd: e.target.value }))} className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Minimum (USD)</Label>
                  <Input type="number" step="0.01" placeholder="0" value={form.min_amount_usd}
                    onChange={e => setForm(p => ({ ...p, min_amount_usd: e.target.value }))} className="rounded-xl" />
                </div>
              </div>
            )}

            {/* Transit */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Délai min (jours)</Label>
                <Input type="number" placeholder="60" value={form.transit_days_min}
                  onChange={e => setForm(p => ({ ...p, transit_days_min: e.target.value }))} className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Délai max (jours)</Label>
                <Input type="number" placeholder="70" value={form.transit_days_max}
                  onChange={e => setForm(p => ({ ...p, transit_days_max: e.target.value }))} className="rounded-xl" />
              </div>
            </div>

            {/* Sort order */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Ordre d'affichage</Label>
              <Input type="number" placeholder="0" value={form.sort_order}
                onChange={e => setForm(p => ({ ...p, sort_order: e.target.value }))} className="rounded-xl" />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Description (optionnel)</Label>
              <Input placeholder="Détails sur ce tarif…" value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="rounded-xl" />
            </div>

            {/* Active */}
            <div className="flex items-center gap-3 pt-1">
              <button onClick={() => setForm(p => ({ ...p, active: !p.active }))}
                className={cn('flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-xl transition-colors',
                  form.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                )}
              >
                {form.active ? 'Actif' : 'Inactif'}
              </button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Annuler</Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl gap-2" style={BTN_ORANGE}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AdminShippingConfigPage() {
  const [tab, setTab] = useState<Tab>('origins')

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuration expédition</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gérez les origines, régions, villes, types de produits et tarifs de fret
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold rounded-xl transition-all',
              tab === key
                ? 'bg-white text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'origins' && <OriginsSection />}
      {tab === 'regions' && <RegionsSection />}
      {tab === 'cities'  && <CitiesSection />}
      {tab === 'types'   && <ProductTypesSection />}
      {tab === 'rates'   && <ShippingRatesSection />}
    </div>
  )
}
