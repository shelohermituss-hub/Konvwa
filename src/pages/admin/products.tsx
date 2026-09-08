import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Package, Loader2, ToggleLeft, ToggleRight, Search, Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Product {
  id: string
  name: string
  description: string | null
  price_htg: number
  moq: number
  unit: string
  supplier_name: string | null
  category: string | null
  delivery_days_min: number | null
  delivery_days_max: number | null
  images: string[]
  specifications: Record<string, string>
  active: boolean
  featured: boolean
  stock_available: boolean
  created_at: string
}

type ProductDraft = Omit<Product, 'id' | 'created_at'>

const emptyDraft = (): ProductDraft => ({
  name: '',
  description: '',
  price_htg: 0,
  moq: 1,
  unit: 'unité',
  supplier_name: '',
  category: '',
  delivery_days_min: null,
  delivery_days_max: null,
  images: [],
  specifications: {},
  active: true,
  featured: false,
  stock_available: true,
})

export function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft())
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  // Spec editing helpers
  const [specKey, setSpecKey] = useState('')
  const [specVal, setSpecVal] = useState('')
  // Images as comma-separated URLs
  const [imagesRaw, setImagesRaw] = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setProducts(data as Product[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openAdd() {
    setEditing(null)
    const d = emptyDraft()
    setDraft(d)
    setImagesRaw('')
    setSpecKey('')
    setSpecVal('')
    setDialogOpen(true)
  }

  function openEdit(p: Product) {
    setEditing(p)
    setDraft({
      name: p.name,
      description: p.description ?? '',
      price_htg: p.price_htg,
      moq: p.moq,
      unit: p.unit,
      supplier_name: p.supplier_name ?? '',
      category: p.category ?? '',
      delivery_days_min: p.delivery_days_min,
      delivery_days_max: p.delivery_days_max,
      images: p.images,
      specifications: p.specifications,
      active: p.active,
      featured: p.featured,
      stock_available: p.stock_available,
    })
    setImagesRaw(p.images.join(', '))
    setSpecKey('')
    setSpecVal('')
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditing(null)
  }

  function setField<K extends keyof ProductDraft>(k: K, v: ProductDraft[K]) {
    setDraft(prev => ({ ...prev, [k]: v }))
  }

  function addSpec() {
    if (!specKey.trim()) return
    setDraft(prev => ({ ...prev, specifications: { ...prev.specifications, [specKey.trim()]: specVal.trim() } }))
    setSpecKey('')
    setSpecVal('')
  }

  function removeSpec(key: string) {
    setDraft(prev => {
      const specs = { ...prev.specifications }
      delete specs[key]
      return { ...prev, specifications: specs }
    })
  }

  async function handleSave() {
    if (!draft.name.trim() || draft.price_htg <= 0) {
      toast.error('Veuillez renseigner le nom et un prix valide.')
      return
    }

    setSaving(true)
    const payload = {
      ...draft,
      name: draft.name.trim(),
      supplier_name: draft.supplier_name?.trim() || null,
      category: draft.category?.trim() || null,
      description: (draft.description ?? '').trim() || null,
      images: imagesRaw.split(',').map(s => s.trim()).filter(Boolean),
    }

    if (editing) {
      const { error } = await supabase.from('products').update(payload).eq('id', editing.id)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Produit mis à jour')
    } else {
      const { error } = await supabase.from('products').insert(payload)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Produit ajouté')
    }

    setSaving(false)
    closeDialog()
    load()
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Produit supprimé')
    setDeleteConfirm(null)
    load()
  }

  async function toggleActive(p: Product) {
    await supabase.from('products').update({ active: !p.active }).eq('id', p.id)
    load()
  }

  async function toggleFeatured(p: Product) {
    await supabase.from('products').update({ featured: !p.featured }).eq('id', p.id)
    load()
  }

  const filtered = products.filter(p =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.supplier_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Produits</h1>
          <p className="text-sm text-muted-foreground">Catalogue de sourcing ({products.length} produits)</p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Ajouter un produit
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Package className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {search ? 'Aucun résultat' : 'Aucun produit. Commencez par en ajouter un.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground/60">Produit</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground/60">Prix HTG</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground/60">MOQ</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground/60">Catégorie</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground/60">Statut</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground/60">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                          {p.images.length > 0 ? (
                            <img src={p.images[0]} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Package className="h-5 w-5 text-muted-foreground/30" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold truncate max-w-[200px]">{p.name}</p>
                          {p.supplier_name && <p className="text-xs text-muted-foreground truncate">{p.supplier_name}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-bold text-primary">{p.price_htg.toLocaleString('fr-HT')}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.moq} {p.unit}</td>
                    <td className="px-4 py-3">
                      {p.category ? <Badge variant="secondary">{p.category}</Badge> : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => toggleActive(p)} title={p.active ? 'Désactiver' : 'Activer'}>
                          {p.active
                            ? <ToggleRight className="h-5 w-5 text-emerald-500" />
                            : <ToggleLeft className="h-5 w-5 text-muted-foreground/40" />}
                        </button>
                        <button onClick={() => toggleFeatured(p)} title={p.featured ? 'Retirer vedette' : 'Mettre en vedette'}>
                          <Star className={cn('h-4 w-4', p.featured ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} />
                        </button>
                        {!p.stock_available && (
                          <Badge variant="destructive" className="text-[10px]">Rupture</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => openEdit(p)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/8"
                          onClick={() => setDeleteConfirm(p.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) closeDialog() }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier le produit' : 'Ajouter un produit'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Nom du produit *</Label>
                <Input value={draft.name} onChange={e => setField('name', e.target.value)} placeholder="ex: iPhone 15 Pro Max" />
              </div>
              <div className="space-y-1.5">
                <Label>Prix (HTG) *</Label>
                <Input type="number" min={0} value={draft.price_htg || ''} onChange={e => setField('price_htg', parseFloat(e.target.value) || 0)} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Unité</Label>
                <Input value={draft.unit} onChange={e => setField('unit', e.target.value)} placeholder="unité, kg, paire…" />
              </div>
              <div className="space-y-1.5">
                <Label>Quantité minimum (MOQ)</Label>
                <Input type="number" min={1} value={draft.moq || ''} onChange={e => setField('moq', parseInt(e.target.value) || 1)} />
              </div>
              <div className="space-y-1.5">
                <Label>Catégorie</Label>
                <Input value={draft.category ?? ''} onChange={e => setField('category', e.target.value)} placeholder="Électronique, Mode…" />
              </div>
              <div className="space-y-1.5">
                <Label>Fournisseur</Label>
                <Input value={draft.supplier_name ?? ''} onChange={e => setField('supplier_name', e.target.value)} placeholder="Nom du fournisseur" />
              </div>
              <div className="space-y-1.5">
                <Label>Livraison min (jours)</Label>
                <Input type="number" min={1} value={draft.delivery_days_min ?? ''} onChange={e => setField('delivery_days_min', parseInt(e.target.value) || null)} />
              </div>
              <div className="space-y-1.5">
                <Label>Livraison max (jours)</Label>
                <Input type="number" min={1} value={draft.delivery_days_max ?? ''} onChange={e => setField('delivery_days_max', parseInt(e.target.value) || null)} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Description</Label>
                <Textarea value={draft.description ?? ''} onChange={e => setField('description', e.target.value)} rows={3} placeholder="Description du produit…" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Images (URLs séparées par des virgules)</Label>
                <Input value={imagesRaw} onChange={e => setImagesRaw(e.target.value)} placeholder="https://…, https://…" />
              </div>
            </div>

            {/* Specs */}
            <div className="space-y-2">
              <Label>Spécifications</Label>
              {Object.entries(draft.specifications).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">
                  <span className="font-medium flex-1">{k}</span>
                  <span className="text-muted-foreground">{v}</span>
                  <button onClick={() => removeSpec(k)} className="text-destructive hover:text-destructive/80">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input value={specKey} onChange={e => setSpecKey(e.target.value)} placeholder="Clé (ex: Poids)" className="flex-1" />
                <Input value={specVal} onChange={e => setSpecVal(e.target.value)} placeholder="Valeur (ex: 200g)" className="flex-1" />
                <Button type="button" variant="outline" size="sm" onClick={addSpec}>+</Button>
              </div>
            </div>

            {/* Toggles */}
            <div className="flex gap-6 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={draft.active} onChange={e => setField('active', e.target.checked)} className="h-4 w-4 rounded" />
                <span className="text-sm font-medium">Actif</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={draft.featured} onChange={e => setField('featured', e.target.checked)} className="h-4 w-4 rounded" />
                <span className="text-sm font-medium">Vedette</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={draft.stock_available} onChange={e => setField('stock_available', e.target.checked)} className="h-4 w-4 rounded" />
                <span className="text-sm font-medium">En stock</span>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editing ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={open => { if (!open) setDeleteConfirm(null) }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Supprimer ce produit ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Cette action est irréversible. Le produit sera retiré du catalogue.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Annuler</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
