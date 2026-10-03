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
import { normalizeTiers, type PriceTier } from '@/lib/product-pricing'
import { ProductImportDialog } from '@/components/shared/product-import-dialog'
import { ExportCsvButton } from '@/components/shared/export-csv-button'

import { tr, LOCALE_TAG } from '@/lib/i18n'
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
  price_tiers: PriceTier[]
  supplier_verified: boolean
  supplier_years: number | null
  supplier_country: string | null
  sold_count: number
  rating: number | null
  review_count: number
  repurchase_rate: number | null
  processing_days: number | null
  customization_options: string[]
  tags: string[]
  certifications: string[]
  name_en?: string | null
  description_en?: string | null
  tags_en?: string[]
  customization_options_en?: string[]
  certifications_en?: string[]
  created_at: string
}

type ProductDraft = Omit<Product, 'id' | 'created_at'>

const emptyDraft = (): ProductDraft => ({
  name: '',
  description: '',
  price_htg: 0,
  moq: 1,
  unit: tr('unité'),
  supplier_name: '',
  category: '',
  delivery_days_min: null,
  delivery_days_max: null,
  images: [],
  specifications: {},
  active: true,
  featured: false,
  stock_available: true,
  price_tiers: [],
  supplier_verified: false,
  supplier_years: null,
  supplier_country: 'CN',
  sold_count: 0,
  rating: null,
  review_count: 0,
  repurchase_rate: null,
  processing_days: null,
  customization_options: [],
  tags: [],
  certifications: [],
})

const lines = (raw: string) => raw.split('\n').map(l => l.trim()).filter(Boolean)
const numOrNull = (raw: string) => (raw === '' ? null : Number(raw))

export function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft())
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  // Spec editing helpers
  const [specKey, setSpecKey] = useState('')
  const [specVal, setSpecVal] = useState('')
  // Images as comma-separated URLs
  const [imagesRaw, setImagesRaw] = useState('')
  // One entry per line
  const [optionsRaw, setOptionsRaw] = useState('')
  const [tagsRaw, setTagsRaw] = useState('')
  const [certsRaw, setCertsRaw] = useState('')
  // English version (shown when the customer uses the app in English)
  const [nameEn, setNameEn] = useState('')
  const [descEn, setDescEn] = useState('')
  const [optionsEnRaw, setOptionsEnRaw] = useState('')
  const [tagsEnRaw, setTagsEnRaw] = useState('')
  const [certsEnRaw, setCertsEnRaw] = useState('')

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
    setOptionsRaw('')
    setTagsRaw('')
    setCertsRaw('')
    setNameEn(''); setDescEn(''); setOptionsEnRaw(''); setTagsEnRaw(''); setCertsEnRaw('')
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
      price_tiers: normalizeTiers(p.price_tiers),
      supplier_verified: p.supplier_verified,
      supplier_years: p.supplier_years,
      supplier_country: p.supplier_country,
      sold_count: p.sold_count,
      rating: p.rating,
      review_count: p.review_count,
      repurchase_rate: p.repurchase_rate,
      processing_days: p.processing_days,
      customization_options: p.customization_options,
      tags: p.tags,
      certifications: p.certifications,
    })
    setOptionsRaw(p.customization_options.join('\n'))
    setTagsRaw(p.tags.join('\n'))
    setCertsRaw(p.certifications.join('\n'))
    setNameEn(p.name_en ?? ''); setDescEn(p.description_en ?? '')
    setOptionsEnRaw((p.customization_options_en ?? []).join('\n'))
    setTagsEnRaw((p.tags_en ?? []).join('\n'))
    setCertsEnRaw((p.certifications_en ?? []).join('\n'))
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

  function setTier(index: number, patch: Partial<PriceTier>) {
    setDraft(prev => ({ ...prev, price_tiers: prev.price_tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)) }))
  }

  async function handleSave() {
    if (!draft.name.trim() || draft.price_htg <= 0) {
      toast.error(tr('Veuillez renseigner le nom et un prix valide.'))
      return
    }
    const tiers = normalizeTiers(draft.price_tiers)
    if (tiers.some(t => t.min_qty <= draft.moq)) {
      toast.error(tr('Chaque palier doit commencer au-dessus de la quantité minimum (MOQ).'))
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
      price_tiers: tiers,
      supplier_country: draft.supplier_country?.trim().toUpperCase() || null,
      customization_options: lines(optionsRaw),
      tags: lines(tagsRaw),
      certifications: lines(certsRaw),
      name_en: nameEn.trim() || null,
      description_en: descEn.trim() || null,
      customization_options_en: lines(optionsEnRaw),
      tags_en: lines(tagsEnRaw),
      certifications_en: lines(certsEnRaw),
    }

    if (editing) {
      const { error } = await supabase.from('products').update(payload).eq('id', editing.id)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success(tr('Produit mis à jour'))
    } else {
      const { error } = await supabase.from('products').insert(payload)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success(tr('Produit ajouté'))
    }

    setSaving(false)
    closeDialog()
    load()
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success(tr('Produit supprimé'))
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
          <h1 className="text-2xl font-bold">{tr('Produits')}</h1>
          <p className="text-sm text-muted-foreground">{tr('Catalogue de sourcing (')}{products.length}{' '}{tr('produits)')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportCsvButton
            filename="produits"
            headers={['name', 'price_htg', 'moq', 'unit', 'category', 'supplier_name', 'active', 'stock_available']}
            rows={() => products.map(p => [p.name, p.price_htg, p.moq, p.unit, p.category, p.supplier_name, p.active, p.stock_available])}
            disabled={products.length === 0}
          />
          <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2 rounded-xl">
            {tr('Importer CSV')}
          </Button>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            {tr('Ajouter un produit')}
          </Button>
        </div>
      </div>
      <ProductImportDialog open={importOpen} onClose={() => setImportOpen(false)} onDone={() => void load()} />

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={tr('Rechercher...')}
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
            {tr('Chargement…')}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Package className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {search ? tr('Aucun résultat') : tr('Aucun produit. Commencez par en ajouter un.')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">{tr('Produit')}</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">{tr('Prix HTG')}</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">{tr('MOQ')}</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">{tr('Catégorie')}</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">{tr('Statut')}</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">{tr('Actions')}</th>
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
                    <td className="px-4 py-3 font-bold text-primary">{p.price_htg.toLocaleString(LOCALE_TAG)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.moq} {p.unit}</td>
                    <td className="px-4 py-3">
                      {p.category ? <Badge variant="secondary">{p.category}</Badge> : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => toggleActive(p)} title={p.active ? tr('Désactiver') : tr('Activer')}>
                          {p.active
                            ? <ToggleRight className="h-5 w-5 text-emerald-500" />
                            : <ToggleLeft className="h-5 w-5 text-muted-foreground/40" />}
                        </button>
                        <button onClick={() => toggleFeatured(p)} title={p.featured ? tr('Retirer vedette') : tr('Mettre en vedette')}>
                          <Star className={cn('h-4 w-4', p.featured ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} />
                        </button>
                        {!p.stock_available && (
                          <Badge variant="destructive" className="text-[10px]">{tr('Rupture')}</Badge>
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
            <DialogTitle>{editing ? tr('Modifier le produit') : tr('Ajouter un produit')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>{tr('Nom du produit *')}</Label>
                <Input value={draft.name} onChange={e => setField('name', e.target.value)} placeholder={tr('ex: iPhone 15 Pro Max')} />
              </div>
              <div className="space-y-1.5">
                <Label>{tr('Prix (HTG) *')}</Label>
                <Input type="number" min={0} value={draft.price_htg || ''} onChange={e => setField('price_htg', parseFloat(e.target.value) || 0)} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>{tr('Unité')}</Label>
                <Input value={draft.unit} onChange={e => setField('unit', e.target.value)} placeholder={tr('unité, kg, paire…')} />
              </div>
              <div className="space-y-1.5">
                <Label>{tr('Quantité minimum (MOQ)')}</Label>
                <Input type="number" min={1} value={draft.moq || ''} onChange={e => setField('moq', parseInt(e.target.value) || 1)} />
              </div>
              <div className="space-y-1.5">
                <Label>{tr('Catégorie')}</Label>
                <Input value={draft.category ?? ''} onChange={e => setField('category', e.target.value)} placeholder={tr('Électronique, Mode…')} />
              </div>
              <div className="space-y-1.5">
                <Label>{tr('Fournisseur')}</Label>
                <Input value={draft.supplier_name ?? ''} onChange={e => setField('supplier_name', e.target.value)} placeholder={tr('Nom du fournisseur')} />
              </div>
              <div className="space-y-1.5">
                <Label>{tr('Livraison min (jours)')}</Label>
                <Input type="number" min={1} value={draft.delivery_days_min ?? ''} onChange={e => setField('delivery_days_min', parseInt(e.target.value) || null)} />
              </div>
              <div className="space-y-1.5">
                <Label>{tr('Livraison max (jours)')}</Label>
                <Input type="number" min={1} value={draft.delivery_days_max ?? ''} onChange={e => setField('delivery_days_max', parseInt(e.target.value) || null)} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>{tr('Description')}</Label>
                <Textarea value={draft.description ?? ''} onChange={e => setField('description', e.target.value)} rows={3} placeholder={tr('Description du produit…')} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>{tr('Images (URLs séparées par des virgules)')}</Label>
                <Input value={imagesRaw} onChange={e => setImagesRaw(e.target.value)} placeholder="https://…, https://…" />
              </div>
            </div>

            {/* Price by quantity */}
            <div className="space-y-2">
              <Label>{tr('Prix par quantité (paliers)')}</Label>
              <p className="text-xs text-muted-foreground">
                {tr('Le prix de base s\'applique dès le MOQ. Chaque palier donne un prix unitaire plus bas à partir d\'une quantité.')}
              </p>
              {draft.price_tiers.map((tier, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input type="number" min={1} value={tier.min_qty || ''} onChange={e => setTier(i, { min_qty: parseInt(e.target.value) || 0 })} placeholder={tr('À partir de (qté)')} className="flex-1" />
                  <Input type="number" min={0} value={tier.price_htg || ''} onChange={e => setTier(i, { price_htg: parseFloat(e.target.value) || 0 })} placeholder={tr('Prix unitaire HTG')} className="flex-1" />
                  <button type="button" onClick={() => setDraft(prev => ({ ...prev, price_tiers: prev.price_tiers.filter((_, j) => j !== i) }))} className="text-destructive hover:text-destructive/80" aria-label={tr('Retirer le palier')}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setDraft(prev => ({ ...prev, price_tiers: [...prev.price_tiers, { min_qty: 0, price_htg: 0 }] }))}>
                {tr('+ Ajouter un palier')}
              </Button>
            </div>

            {/* Supplier + social proof */}
            <div className="grid grid-cols-2 gap-4">
              <label className="col-span-2 flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={draft.supplier_verified} onChange={e => setField('supplier_verified', e.target.checked)} className="h-4 w-4 rounded" />
                <span className="text-sm font-medium">{tr('Fournisseur vérifié')}</span>
              </label>
              <div className="space-y-1.5">
                <Label>{tr('Années d\'activité du fournisseur')}</Label>
                <Input type="number" min={0} value={draft.supplier_years ?? ''} onChange={e => setField('supplier_years', numOrNull(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>{tr('Pays du fournisseur')}</Label>
                <Input value={draft.supplier_country ?? ''} onChange={e => setField('supplier_country', e.target.value)} placeholder="CN" maxLength={2} />
              </div>
              <div className="space-y-1.5">
                <Label>{tr('Nombre de ventes')}</Label>
                <Input type="number" min={0} value={draft.sold_count || ''} onChange={e => setField('sold_count', parseInt(e.target.value) || 0)} />
              </div>
              <div className="space-y-1.5">
                <Label>{tr('Note (0 à 5)')}</Label>
                <Input type="number" min={0} max={5} step={0.1} value={draft.rating ?? ''} onChange={e => setField('rating', numOrNull(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>{tr('Nombre d\'avis')}</Label>
                <Input type="number" min={0} value={draft.review_count || ''} onChange={e => setField('review_count', parseInt(e.target.value) || 0)} />
              </div>
              <div className="space-y-1.5">
                <Label>{tr('Taux de réachat (%)')}</Label>
                <Input type="number" min={0} max={100} value={draft.repurchase_rate ?? ''} onChange={e => setField('repurchase_rate', numOrNull(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>{tr('Temps de traitement (jours)')}</Label>
                <Input type="number" min={0} value={draft.processing_days ?? ''} onChange={e => setField('processing_days', numOrNull(e.target.value))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{tr('Options de personnalisation (une par ligne)')}</Label>
              <Textarea value={optionsRaw} onChange={e => setOptionsRaw(e.target.value)} rows={3} placeholder={tr('Design de logo/graphique\nEmballage\nÉtiquette à accrocher')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{tr('Points forts (un par ligne)')}</Label>
                <Textarea value={tagsRaw} onChange={e => setTagsRaw(e.target.value)} rows={3} placeholder={tr('Retour facile\nExpédition sous 14 jours')} />
              </div>
              <div className="space-y-1.5">
                <Label>{tr('Certifications (une par ligne)')}</Label>
                <Textarea value={certsRaw} onChange={e => setCertsRaw(e.target.value)} rows={3} placeholder={tr('CE certifié')} />
              </div>
            </div>

            {/* English version */}
            <details className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
              <summary className="cursor-pointer text-sm font-semibold">{tr('Version anglaise (optionnelle)')}</summary>
              <div className="mt-3 space-y-3">
                <p className="text-xs text-muted-foreground">{tr('Affichée aux clients qui utilisent l\'application en anglais. Un champ vide reprend le texte français.')}</p>
                <div className="space-y-1.5">
                  <Label>{tr('Nom (anglais)')}</Label>
                  <Input value={nameEn} onChange={e => setNameEn(e.target.value)} maxLength={200} />
                </div>
                <div className="space-y-1.5">
                  <Label>{tr('Description (anglais)')}</Label>
                  <Textarea value={descEn} onChange={e => setDescEn(e.target.value)} rows={4} maxLength={5000} />
                </div>
                <div className="space-y-1.5">
                  <Label>{tr('Options de personnalisation (anglais, une par ligne)')}</Label>
                  <Textarea value={optionsEnRaw} onChange={e => setOptionsEnRaw(e.target.value)} rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{tr('Points forts (anglais, un par ligne)')}</Label>
                    <Textarea value={tagsEnRaw} onChange={e => setTagsEnRaw(e.target.value)} rows={3} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{tr('Certifications (anglais, une par ligne)')}</Label>
                    <Textarea value={certsEnRaw} onChange={e => setCertsEnRaw(e.target.value)} rows={3} />
                  </div>
                </div>
              </div>
            </details>

            {/* Specs */}
            <div className="space-y-2">
              <Label>{tr('Caractéristiques (affichées en grille sur la fiche)')}</Label>
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
                <Input value={specKey} onChange={e => setSpecKey(e.target.value)} placeholder={tr('Clé (ex: Poids)')} className="flex-1" />
                <Input value={specVal} onChange={e => setSpecVal(e.target.value)} placeholder={tr('Valeur (ex: 200g)')} className="flex-1" />
                <Button type="button" variant="outline" size="sm" onClick={addSpec}>+</Button>
              </div>
            </div>

            {/* Toggles */}
            <div className="flex gap-6 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={draft.active} onChange={e => setField('active', e.target.checked)} className="h-4 w-4 rounded" />
                <span className="text-sm font-medium">{tr('Actif')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={draft.featured} onChange={e => setField('featured', e.target.checked)} className="h-4 w-4 rounded" />
                <span className="text-sm font-medium">{tr('Vedette')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={draft.stock_available} onChange={e => setField('stock_available', e.target.checked)} className="h-4 w-4 rounded" />
                <span className="text-sm font-medium">{tr('En stock')}</span>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>{tr('Annuler')}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editing ? tr('Enregistrer') : tr('Ajouter')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={open => { if (!open) setDeleteConfirm(null) }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('Supprimer ce produit ?')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            {tr('Cette action est irréversible. Le produit sera retiré du catalogue.')}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>{tr('Annuler')}</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              {tr('Supprimer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
