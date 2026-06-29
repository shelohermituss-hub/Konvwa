import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Loader2, ExternalLink, CheckCircle2, SendHorizonal,
  Package, ImagePlus, X, Box, Truck, MapPin, Plus, Trash2,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface AppSettings {
  usd_to_htg_rate: number
  cbm_price_usd: number
  duty_rate_percent: number
  service_margin_percent: number
}

interface ShippingOrigin {
  id: string
  name: string
  flag_emoji: string
  country_code: string
}

interface HaitiRegion {
  id: string
  name: string
}

interface HaitiCity {
  id: string
  region_id: string
  name: string
}

interface ProductType {
  id: string
  name: string
}

interface PackageItem {
  id: string
  length: string
  width: string
  height: string
  weight: string
}

interface Breakdown {
  productUSD: number
  totalCBM: number
  totalWeightKg: number
  shippingUSD: number
  dutyUSD: number
  serviceUSD: number
  totalUSD: number
  totalHTG: number
  unitHTG: number
}

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'clothing',    label: 'Vêtements & accessoires' },
  { value: 'electronics', label: 'Électronique / gadgets' },
  { value: 'cosmetics',   label: 'Cosmétiques / beauté' },
  { value: 'home',        label: 'Maison & cuisine' },
  { value: 'toys',        label: 'Jouets' },
  { value: 'auto',        label: 'Auto & moto' },
  { value: 'sport',       label: 'Sport & loisirs' },
  { value: 'other',       label: 'Autre' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function detectPlatform(url: string): 'alibaba' | 'shein' | 'temu' | 'other' {
  if (url.includes('alibaba.com') || url.includes('1688.com')) return 'alibaba'
  if (url.includes('shein.com')) return 'shein'
  if (url.includes('temu.com')) return 'temu'
  return 'other'
}

const fmt    = (n: number) => Math.round(n).toLocaleString('fr-FR').replace(/ /g, ' ')
const fmtUSD = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtCBM = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })

// totalCBM = somme des CBM de tous les colis (en m³)
function calcBreakdown(
  priceUSD: number,
  qty: number,
  totalCBM: number,
  totalWeightKg: number,
  s: AppSettings
): Breakdown {
  const productUSD  = priceUSD * qty
  const shippingUSD = totalCBM * s.cbm_price_usd
  const cif         = productUSD + shippingUSD
  const dutyUSD     = cif * (s.duty_rate_percent / 100)
  const subtotal    = cif + dutyUSD
  const serviceUSD  = subtotal * (s.service_margin_percent / 100)
  const totalUSD    = subtotal + serviceUSD
  const totalHTG    = totalUSD * s.usd_to_htg_rate
  const unitHTG     = totalHTG / Math.max(1, qty)
  return { productUSD, totalCBM, totalWeightKg, shippingUSD, dutyUSD, serviceUSD, totalUSD, totalHTG, unitHTG }
}

function newPkg(): PackageItem {
  return { id: crypto.randomUUID(), length: '', width: '', height: '', weight: '' }
}

async function uploadProductImage(file: File, userId: string): Promise<string | null> {
  const ext  = file.name.split('.').pop() ?? 'jpg'
  const path = `${userId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('product-images').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) return null
  const { data } = supabase.storage.from('product-images').getPublicUrl(path)
  return data.publicUrl
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ManifestLine({
  label, sub, value, isAdd = false,
}: { label: string; sub?: string; value: string; isAdd?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-3 border-b border-white/[0.08]">
      <div>
        <span className="text-sm text-[#c8d5d1]">{label}</span>
        {sub && <div className="text-[11px] text-[#6e8882] mt-0.5">{sub}</div>}
      </div>
      <span className="font-mono text-[13px] font-medium text-[#e8f0ed] tabular-nums">
        {isAdd && <span className="text-[#6e8882]">+ </span>}
        {value}
      </span>
    </div>
  )
}

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">{label}</p>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function SubmitPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Settings & reference data
  const [settings,      setSettings]      = useState<AppSettings | null>(null)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [origins,       setOrigins]       = useState<ShippingOrigin[]>([])
  const [regions,       setRegions]       = useState<HaitiRegion[]>([])
  const [cities,        setCities]        = useState<HaitiCity[]>([])
  const [productTypes,  setProductTypes]  = useState<ProductType[]>([])
  const [loadingCities, setLoadingCities] = useState(false)

  // Route info
  const [shipFromId, setShipFromId] = useState('')
  const [regionId,   setRegionId]   = useState('')
  const [cityId,     setCityId]     = useState('')

  // Product info
  const [productUrl,  setProductUrl]  = useState('')
  const [productName, setProductName] = useState('')
  const [category,    setCategory]    = useState('')
  const [quantity,    setQuantity]    = useState('10')
  const [priceUSD,    setPriceUSD]    = useState('')
  const [color,       setColor]       = useState('')
  const [size,        setSize]        = useState('')
  const [urgency,     setUrgency]     = useState<'normal' | 'urgent' | 'express'>('normal')
  const [notes,       setNotes]       = useState('')

  // Parcel info
  const [unitSystem,      setUnitSystem]      = useState<'metric' | 'imperial'>('metric')
  const [productTypeId,   setProductTypeId]   = useState('')
  const [packages,        setPackages]        = useState<PackageItem[]>([newPkg()])
  const [invoiceValueUSD, setInvoiceValueUSD] = useState('')

  // Image upload
  const [imageFile,    setImageFile]    = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // State
  const [submitting, setSubmitting] = useState(false)
  const [success,    setSuccess]    = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('shipping_origins').select('id,name,flag_emoji,country_code').eq('active', true).order('sort_order'),
      supabase.from('haiti_regions').select('id,name').eq('active', true).order('sort_order'),
      supabase.from('product_types').select('id,name').eq('active', true).order('sort_order'),
      supabase.from('app_settings').select('key,value')
        .in('key', ['usd_to_htg_rate', 'cbm_price_usd', 'duty_rate_percent', 'service_margin_percent']),
    ]).then(([originsRes, regionsRes, typesRes, settingsRes]) => {
      setOrigins(originsRes.data as ShippingOrigin[] || [])
      setRegions(regionsRes.data as HaitiRegion[] || [])
      setProductTypes(typesRes.data as ProductType[] || [])
      const map = Object.fromEntries(
        (settingsRes.data ?? []).map((r: { key: string; value: string }) => [r.key, parseFloat(r.value)])
      )
      setSettings({
        usd_to_htg_rate:        map.usd_to_htg_rate        ?? 132,
        cbm_price_usd:          map.cbm_price_usd          ?? 790,
        duty_rate_percent:      map.duty_rate_percent      ?? 20,
        service_margin_percent: map.service_margin_percent ?? 15,
      })
      setLoadingSettings(false)
    })
  }, [])

  const addPackage = useCallback(() => setPackages(prev => [...prev, newPkg()]), [])
  const removePackage = useCallback((id: string) => setPackages(prev => prev.filter(p => p.id !== id)), [])
  const updatePackage = useCallback((id: string, field: keyof Omit<PackageItem, 'id'>, value: string) => {
    setPackages(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  }, [])

  async function handleRegionChange(id: string) {
    setRegionId(id)
    setCityId('')
    setCities([])
    if (!id) return
    setLoadingCities(true)
    const { data } = await supabase
      .from('haiti_cities')
      .select('id,name,region_id')
      .eq('region_id', id)
      .eq('active', true)
      .order('sort_order')
    setCities(data as HaitiCity[] || [])
    setLoadingCities(false)
  }

  // Derived values
  const price = parseFloat(priceUSD) || 0
  const qty   = Math.max(1, parseInt(quantity) || 1)

  const dimFactor    = unitSystem === 'imperial' ? 2.54     : 1
  const weightFactor = unitSystem === 'imperial' ? 0.453592 : 1  // → kg

  // Compute per-package values (always in cm / kg)
  const pkgsComputed = packages.map(p => {
    const l = parseFloat(p.length) || 0
    const w = parseFloat(p.width)  || 0
    const h = parseFloat(p.height) || 0
    const wt = parseFloat(p.weight) || 0
    const l_cm = l * dimFactor
    const w_cm = w * dimFactor
    const h_cm = h * dimFactor
    const cbm  = l_cm > 0 && w_cm > 0 && h_cm > 0 ? (l_cm * w_cm * h_cm) / 1_000_000 : 0
    const weight_kg  = wt * weightFactor
    const weight_lbs = unitSystem === 'imperial' ? wt : wt / 0.453592
    return { l_cm, w_cm, h_cm, cbm, weight_kg, weight_lbs }
  })

  const totalCBM      = pkgsComputed.reduce((s, p) => s + p.cbm, 0)
  const totalWeightKg = pkgsComputed.reduce((s, p) => s + p.weight_kg, 0)
  const totalWeightLbs = pkgsComputed.reduce((s, p) => s + p.weight_lbs, 0)

  const hasDimensions = totalCBM > 0
  const hasCalc       = price > 0 && hasDimensions && !!settings

  const breakdown        = hasCalc ? calcBreakdown(price, qty, totalCBM, totalWeightKg, settings) : null
  const detectedPlatform = productUrl ? detectPlatform(productUrl) : null

  const dimUnit    = unitSystem === 'metric' ? 'cm' : 'in'
  const weightUnit = unitSystem === 'metric' ? 'kg' : 'lbs'

  // Image handlers
  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Image trop lourde (max 5 MB).'); return }
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  function clearImage() {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const fakeEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>
    handleImageChange(fakeEvent)
  }

  function resetForm() {
    setShipFromId(''); setRegionId(''); setCityId(''); setCities([])
    setProductUrl(''); setProductName(''); setCategory('')
    setQuantity('10'); setPriceUSD('')
    setUnitSystem('metric'); setProductTypeId('')
    setPackages([newPkg()])
    setInvoiceValueUSD('')
    setSize(''); setColor(''); setUrgency('normal'); setNotes('')
    clearImage()
  }

  // Submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!productName.trim()) { toast.error('Le nom du produit est requis.');              return }
    if (!category)           { toast.error('La catégorie est requise.');                   return }
    if (!shipFromId)         { toast.error("Sélectionnez l'origine d'expédition.");        return }
    if (!regionId)           { toast.error('Sélectionnez la région de destination.');      return }

    setSubmitting(true)

    let imageUrl: string | null = null
    if (imageFile) {
      imageUrl = await uploadProductImage(imageFile, user.id)
      if (!imageUrl) toast.warning('Image non uploadée, mais la commande sera soumise.')
    }

    // Build packages payload (always in cm / kg)
    const packagesPayload = pkgsComputed
      .map((p, i) => ({
        number:     i + 1,
        length_cm:  p.l_cm      || null,
        width_cm:   p.w_cm      || null,
        height_cm:  p.h_cm      || null,
        weight_kg:  p.weight_kg  || null,
        weight_lbs: p.weight_lbs || null,
        cbm:        p.cbm        || null,
      }))
      .filter(p => p.length_cm || p.weight_kg)  // skip empty rows

    const { error } = await supabase.from('product_requests').insert({
      user_id:          user.id,
      product_url:      productUrl.trim() || null,
      product_name:     productName.trim(),
      category,
      quantity:         qty,
      budget_estimate:  breakdown?.totalHTG || null,
      urgency,
      notes:            notes || null,
      source_platform:  detectedPlatform || 'other',
      status:           'submitted',
      // Route
      ship_from_id:           shipFromId || null,
      destination_region_id:  regionId   || null,
      destination_city_id:    cityId     || null,
      // First package dims for backward compat
      box_length_cm: pkgsComputed[0]?.l_cm || null,
      box_width_cm:  pkgsComputed[0]?.w_cm || null,
      box_height_cm: pkgsComputed[0]?.h_cm || null,
      // Total weight of all packages
      weight_lbs: totalWeightLbs || null,
      weight_kg:  totalWeightKg  || null,
      // All packages detail
      packages: packagesPayload,
      // Parcel details
      unit_system:       unitSystem,
      product_type_id:   productTypeId || null,
      invoice_value_usd: parseFloat(invoiceValueUSD) || null,
      // Image
      product_image_url: imageUrl,
      // Variant info
      variant_info: {
        size:                size  || null,
        color:               color || null,
        unit_price_usd:      price || null,
        estimated_total_htg: breakdown?.totalHTG || null,
      },
    })

    if (error) {
      toast.error('Erreur lors de la soumission.')
    } else {
      setSuccess(true)
    }
    setSubmitting(false)
  }

  const canSubmit = !submitting && !!productName.trim() && !!category && !!shipFromId && !!regionId

  // ── Success screen ──
  if (success) {
    return (
      <div className="min-h-full bg-[#F4F5F7] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 mx-auto mb-5">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">Demande envoyée !</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Notre équipe analyse votre demande et vous enverra un devis sous 24h.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate('/orders')}
              className="w-full rounded-xl py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
            >
              Voir mes commandes
            </button>
            <button
              onClick={() => { setSuccess(false); resetForm() }}
              className="w-full rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              Nouvelle demande
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Form ──
  return (
    <div className="min-h-full bg-[#F4F5F7]">
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Nouvelle commande</h1>
        <p className="text-sm text-muted-foreground">Renseignez le produit pour obtenir une estimation</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="px-4 pb-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">

          {/* ── Left panel ── */}
          <div className="space-y-4">

            {/* ── Section: Informations de route ── */}
            <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-5 space-y-4">
                <SectionHeader icon={Truck} label="Informations de route" />

                {/* Expédier depuis */}
                <div className="space-y-1">
                  <Label className="text-sm font-bold">
                    Expédier depuis <span className="text-destructive">*</span>
                  </Label>
                  <Select value={shipFromId} onValueChange={setShipFromId}>
                    <SelectTrigger className="h-12 rounded-2xl bg-[#F0F1F5] border-0 focus:ring-1 focus:ring-primary/40">
                      <SelectValue placeholder="Sélectionner une origine" />
                    </SelectTrigger>
                    <SelectContent>
                      {origins.map(o => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.flag_emoji} {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Expédier vers (fixed) */}
                <div className="space-y-1">
                  <Label className="text-sm font-bold">Expédier vers</Label>
                  <div className="h-12 rounded-2xl bg-[#F0F1F5] flex items-center px-4 gap-2.5">
                    <span className="text-lg leading-none">🇭🇹</span>
                    <span className="text-sm font-semibold text-foreground">Haïti</span>
                    <span className="ml-auto rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2.5 py-0.5">
                      Disponible
                    </span>
                  </div>
                </div>

                {/* Région */}
                <div className="space-y-1">
                  <Label className="text-sm font-bold">
                    Région <span className="text-destructive">*</span>
                  </Label>
                  <Select value={regionId} onValueChange={handleRegionChange}>
                    <SelectTrigger className="h-12 rounded-2xl bg-[#F0F1F5] border-0 focus:ring-1 focus:ring-primary/40">
                      <SelectValue placeholder="Sélectionner une région" />
                    </SelectTrigger>
                    <SelectContent>
                      {regions.map(r => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Ville */}
                <div className="space-y-1">
                  <Label className="text-sm font-bold">
                    Ville{' '}
                    <span className="text-xs font-normal text-muted-foreground">(optionnel)</span>
                  </Label>
                  <Select
                    value={cityId}
                    onValueChange={setCityId}
                    disabled={!regionId || loadingCities}
                  >
                    <SelectTrigger className="h-12 rounded-2xl bg-[#F0F1F5] border-0 focus:ring-1 focus:ring-primary/40 disabled:opacity-50">
                      <SelectValue
                        placeholder={
                          !regionId
                            ? "Sélectionner d'abord une région"
                            : loadingCities
                            ? 'Chargement…'
                            : 'Toutes les villes'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* ── Section: Le produit ── */}
            <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-5 space-y-4">
                <SectionHeader icon={Package} label="Le produit" />

                {/* URL */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-sm font-bold">Lien produit</Label>
                    <span className="text-xs text-muted-foreground">(Alibaba · Shein · Temu)</span>
                  </div>
                  <Input
                    type="url"
                    placeholder="Colle le lien ici"
                    value={productUrl}
                    onChange={e => setProductUrl(e.target.value)}
                    className="h-12 rounded-2xl bg-[#F0F1F5] border-0 font-mono text-sm focus-visible:ring-1 focus-visible:ring-primary/40"
                  />
                  {detectedPlatform && detectedPlatform !== 'other' && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary capitalize">
                        {detectedPlatform}
                      </span>
                      <a href={productUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1">
                        Voir <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Nom */}
                <div className="space-y-1">
                  <Label className="text-sm font-bold">Nom du produit <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="Ex: Robe d'été fleurie taille M"
                    value={productName}
                    onChange={e => setProductName(e.target.value)}
                    className="h-12 rounded-2xl bg-[#F0F1F5] border-0 focus-visible:ring-1 focus-visible:ring-primary/40"
                  />
                </div>

                {/* Prix + Quantité */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm font-bold">Prix unitaire (USD)</Label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">$</span>
                      <Input
                        type="number" inputMode="decimal" min="0" step="0.01" placeholder="4.50"
                        value={priceUSD} onChange={e => setPriceUSD(e.target.value)}
                        className="h-12 rounded-2xl bg-[#F0F1F5] border-0 pl-7 font-mono focus-visible:ring-1 focus-visible:ring-primary/40"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-bold">Quantité <span className="text-destructive">*</span></Label>
                    <Input
                      type="number" inputMode="numeric" min="1" step="1"
                      value={quantity} onChange={e => setQuantity(e.target.value)}
                      className="h-12 rounded-2xl bg-[#F0F1F5] border-0 font-mono focus-visible:ring-1 focus-visible:ring-primary/40"
                    />
                  </div>
                </div>

                {/* Catégorie */}
                <div className="space-y-1">
                  <Label className="text-sm font-bold">Catégorie <span className="text-destructive">*</span></Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="h-12 rounded-2xl bg-[#F0F1F5] border-0 focus:ring-1 focus:ring-primary/40">
                      <SelectValue placeholder="Choisir une catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* ── Section: Informations des colis ── */}
            <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-5 space-y-4">
                <SectionHeader icon={Box} label="Informations des colis" />

                {/* Unit system toggle */}
                <div>
                  <Label className="text-sm font-bold mb-2 block">Unités de mesure</Label>
                  <RadioGroup
                    value={unitSystem}
                    onValueChange={v => {
                      setUnitSystem(v as 'metric' | 'imperial')
                      setPackages([newPkg()])
                    }}
                    className="grid grid-cols-2 gap-2"
                  >
                    {([
                      ['imperial', 'Impérial', '(lbs, in)'],
                      ['metric',   'Métrique',  '(kg, cm)'],
                    ] as const).map(([val, label, sub]) => (
                      <div key={val} className="relative">
                        <RadioGroupItem value={val} id={`unit-${val}`} className="peer sr-only" />
                        <Label
                          htmlFor={`unit-${val}`}
                          className="flex flex-col items-center py-2.5 px-3 rounded-xl border-2 border-transparent bg-[#F0F1F5] cursor-pointer hover:bg-[#E8E9EE] peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 transition-all"
                        >
                          <span className="font-semibold text-sm">{label}</span>
                          <span className="text-[10px] text-muted-foreground mt-0.5">{sub}</span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                {/* Product type */}
                <div className="space-y-1">
                  <Label className="text-sm font-bold">
                    Type de produit{' '}
                    <span className="text-xs font-normal text-muted-foreground">(optionnel)</span>
                  </Label>
                  <Select value={productTypeId} onValueChange={setProductTypeId}>
                    <SelectTrigger className="h-12 rounded-2xl bg-[#F0F1F5] border-0 focus:ring-1 focus:ring-primary/40">
                      <SelectValue placeholder="Marchandise générale" />
                    </SelectTrigger>
                    <SelectContent>
                      {productTypes.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Dynamic packages list */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold">
                      Colis — dimensions de la boîte ({dimUnit})
                    </Label>
                    <span className="text-[11px] text-muted-foreground font-medium">
                      {packages.length} colis
                    </span>
                  </div>

                  {packages.map((pkg, idx) => {
                    const l  = parseFloat(pkg.length) || 0
                    const w  = parseFloat(pkg.width)  || 0
                    const h  = parseFloat(pkg.height) || 0
                    const wt = parseFloat(pkg.weight) || 0
                    const l_cm = l * dimFactor; const w_cm = w * dimFactor; const h_cm = h * dimFactor
                    const cbm = l_cm > 0 && w_cm > 0 && h_cm > 0 ? (l_cm * w_cm * h_cm) / 1_000_000 : 0
                    return (
                      <div key={pkg.id} className="rounded-xl bg-[#F8F9FB] border border-gray-100 p-3 space-y-2.5">
                        {/* Header row */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            Colis {idx + 1}
                          </span>
                          {packages.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removePackage(pkg.id)}
                              className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10 hover:bg-destructive/20 transition-colors"
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </button>
                          )}
                        </div>

                        {/* Dimensions */}
                        <div className="grid grid-cols-3 gap-2">
                          {([
                            ['L', pkg.length, 'length'],
                            ['l', pkg.width,  'width'],
                            ['H', pkg.height, 'height'],
                          ] as const).map(([lbl, val, field]) => (
                            <div key={field} className="space-y-1">
                              <span className="text-[10px] text-muted-foreground font-semibold">{lbl} ({dimUnit})</span>
                              <Input
                                type="number" inputMode="decimal" min="0" step="0.1"
                                placeholder="0.0"
                                value={val}
                                onChange={e => updatePackage(pkg.id, field, e.target.value)}
                                className="h-10 rounded-xl bg-white border border-gray-200 font-mono text-sm focus-visible:ring-1 focus-visible:ring-primary/40"
                              />
                            </div>
                          ))}
                        </div>

                        {/* Weight */}
                        <div className="relative">
                          <span className="text-[10px] text-muted-foreground font-semibold block mb-1">Poids ({weightUnit})</span>
                          <Input
                            type="number" inputMode="decimal" min="0" step="0.01"
                            placeholder="0.00"
                            value={pkg.weight}
                            onChange={e => updatePackage(pkg.id, 'weight', e.target.value)}
                            className="h-10 rounded-xl bg-white border border-gray-200 pr-12 font-mono text-sm focus-visible:ring-1 focus-visible:ring-primary/40"
                          />
                          <span className="absolute right-3 bottom-2.5 text-xs font-semibold text-muted-foreground">{weightUnit}</span>
                        </div>

                        {/* CBM preview */}
                        {cbm > 0 && (
                          <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/10 px-2.5 py-1.5">
                            <span className="text-[10px] font-semibold text-primary">CBM</span>
                            <span className="font-mono text-xs font-bold text-primary">{fmtCBM(cbm)} m³</span>
                          </div>
                        )}
                        {wt > 0 && unitSystem === 'imperial' && (
                          <p className="text-[10px] text-muted-foreground">≈ {(wt * 0.453592).toFixed(3)} kg</p>
                        )}
                        {wt > 0 && unitSystem === 'metric' && (
                          <p className="text-[10px] text-muted-foreground">≈ {(wt / 0.453592).toFixed(2)} lbs</p>
                        )}
                      </div>
                    )
                  })}

                  {/* Add package button */}
                  <button
                    type="button"
                    onClick={addPackage}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-3 text-sm font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/[0.02] transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Ajouter un colis
                  </button>

                  {/* Total CBM + weight summary */}
                  {(totalCBM > 0 || totalWeightKg > 0) && (
                    <div className="rounded-xl bg-[#0C1413] px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#9FB0AB' }}>
                          {packages.length} colis · Total
                        </p>
                        {totalWeightKg > 0 && (
                          <p className="text-xs mt-0.5" style={{ color: '#6E8882' }}>
                            {totalWeightKg.toFixed(2)} kg ({totalWeightLbs.toFixed(2)} lbs)
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold" style={{ color: '#9FB0AB' }}>CBM total</p>
                        <p className="font-mono text-base font-bold" style={{ color: '#E6A23C' }}>
                          {fmtCBM(totalCBM)} <span className="text-xs font-normal" style={{ color: '#6E8882' }}>m³</span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Invoice value */}
                <div className="space-y-1">
                  <Label className="text-sm font-bold">
                    Valeur déclarée (USD){' '}
                    <span className="text-xs font-normal text-muted-foreground">(optionnel)</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">$</span>
                    <Input
                      type="number" inputMode="decimal" min="0" step="0.01"
                      placeholder="0.00"
                      value={invoiceValueUSD}
                      onChange={e => setInvoiceValueUSD(e.target.value)}
                      className="h-12 rounded-2xl bg-[#F0F1F5] border-0 pl-7 font-mono focus-visible:ring-1 focus-visible:ring-primary/40"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Section: Image du produit ── */}
            <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-5 space-y-3">
                <SectionHeader icon={ImagePlus} label="Photo du produit" />

                {imagePreview ? (
                  <div className="relative rounded-2xl overflow-hidden border border-gray-100">
                    <img
                      src={imagePreview}
                      alt="Aperçu"
                      className="w-full max-h-52 object-contain bg-gray-50"
                    />
                    <button
                      type="button"
                      onClick={clearImage}
                      className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 hover:bg-black/80 transition-colors"
                    >
                      <X className="h-3.5 w-3.5 text-white" />
                    </button>
                    <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
                      <p className="text-xs text-muted-foreground truncate">{imageFile?.name}</p>
                    </div>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/[0.02] transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={e => e.preventDefault()}
                  >
                    <ImagePlus className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-sm font-semibold text-muted-foreground">
                      Glisser une image ou cliquer
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">JPG, PNG, WEBP · max 5 MB</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />
              </div>
            </div>

            {/* ── Section: Variantes & options ── */}
            <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-5 space-y-4">
                <SectionHeader icon={MapPin} label="Variantes & options" />

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm font-bold">Taille <span className="text-xs font-normal text-muted-foreground">(optionnel)</span></Label>
                    <Input placeholder="M, L, XL…" value={size} onChange={e => setSize(e.target.value)}
                      className="h-12 rounded-2xl bg-[#F0F1F5] border-0 focus-visible:ring-1 focus-visible:ring-primary/40" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-bold">Couleur <span className="text-xs font-normal text-muted-foreground">(optionnel)</span></Label>
                    <Input placeholder="Noir, Blanc…" value={color} onChange={e => setColor(e.target.value)}
                      className="h-12 rounded-2xl bg-[#F0F1F5] border-0 focus-visible:ring-1 focus-visible:ring-primary/40" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-bold">Urgence</Label>
                  <RadioGroup value={urgency} onValueChange={v => setUrgency(v as typeof urgency)} className="grid grid-cols-3 gap-2">
                    {([
                      ['normal',  'Normal',  '4–6 sem.'],
                      ['urgent',  'Urgent',  '2–3 sem.'],
                      ['express', 'Express', '1–2 sem.'],
                    ] as const).map(([val, label, sub]) => (
                      <div key={val} className="relative">
                        <RadioGroupItem value={val} id={`urg-${val}`} className="peer sr-only" />
                        <Label htmlFor={`urg-${val}`}
                          className="flex flex-col items-center py-3 px-2 rounded-2xl border-2 border-transparent bg-[#F0F1F5] cursor-pointer hover:bg-[#E8E9EE] peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 transition-all">
                          <span className="font-bold text-sm">{label}</span>
                          <span className="text-[10px] text-muted-foreground mt-0.5">{sub}</span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-bold">Commentaires <span className="text-xs font-normal text-muted-foreground">(optionnel)</span></Label>
                  <Textarea
                    placeholder="Instructions particulières, exigences…"
                    value={notes} onChange={e => setNotes(e.target.value)}
                    rows={3}
                    className="rounded-2xl bg-[#F0F1F5] border-0 resize-none text-sm focus-visible:ring-1 focus-visible:ring-primary/40"
                  />
                </div>
              </div>
            </div>

            {/* Mobile submit */}
            <div className="lg:hidden">
              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                style={{ height: '52px', background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
              >
                {submitting
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Envoi en cours…</>
                  : <><SendHorizonal className="h-4 w-4" />Soumettre la commande</>
                }
              </button>
            </div>
          </div>

          {/* ── Right panel: manifest card ── */}
          <div className="mt-5 lg:mt-0 lg:sticky lg:top-6">
            <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ background: '#0C1413', color: '#FAF8F3' }}>

              {/* Header */}
              <div className="flex items-end justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#9FB0AB' }}>
                    Devis d'importation
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#6E8882' }}>Coût rendu en Haïti</p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold tabular-nums" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{qty}</span>
                  <span className="text-xs ml-1" style={{ color: '#6E8882' }}>unités</span>
                </div>
              </div>

              {/* Route summary (when set) */}
              {(shipFromId || regionId) && (
                <div className="px-5 pt-3 pb-1 flex items-center gap-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <Truck className="h-3.5 w-3.5 shrink-0" style={{ color: '#6E8882' }} />
                  <p className="text-[11px] truncate" style={{ color: '#9FB0AB' }}>
                    {origins.find(o => o.id === shipFromId)?.flag_emoji}{' '}
                    {origins.find(o => o.id === shipFromId)?.name || '…'}
                    {' → '}
                    🇭🇹 Haïti{regions.find(r => r.id === regionId) ? ` · ${regions.find(r => r.id === regionId)!.name}` : ''}
                    {cities.find(c => c.id === cityId) ? ` · ${cities.find(c => c.id === cityId)!.name}` : ''}
                  </p>
                </div>
              )}

              {/* Breakdown */}
              <div className="px-5 pt-1">
                {loadingSettings ? (
                  <div className="space-y-3 py-4">
                    {[1, 2, 3, 4].map(i => (
                      <Skeleton key={i} className="h-10 w-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
                    ))}
                  </div>
                ) : !hasCalc ? (
                  <div className="py-8 text-center">
                    <Package className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm" style={{ color: '#6E8882' }}>
                      Renseignez le prix et les<br />dimensions pour voir l'estimation
                    </p>
                  </div>
                ) : (
                  <>
                    <ManifestLine
                      label="Produit"
                      sub={`${qty} × ${fmtUSD(price)}`}
                      value={fmtUSD(breakdown!.productUSD)}
                    />
                    <ManifestLine
                      label="Fret maritime (CBM)"
                      sub={`${fmtCBM(breakdown!.totalCBM)} m³ × $${settings!.cbm_price_usd}/m³`}
                      value={fmtUSD(breakdown!.shippingUSD)}
                      isAdd
                    />
                    <ManifestLine
                      label="Droits & taxes"
                      sub={`${settings!.duty_rate_percent}% sur CIF`}
                      value={fmtUSD(breakdown!.dutyUSD)}
                      isAdd
                    />
                    <ManifestLine
                      label="Marge de service"
                      sub={`${settings!.service_margin_percent}%`}
                      value={fmtUSD(breakdown!.serviceUSD)}
                      isAdd
                    />
                  </>
                )}
              </div>

              {/* Total */}
              <div className="mx-4 mt-4 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#9FB0AB' }}>
                    Total rendu
                  </p>
                  <div className="text-right">
                    {breakdown ? (
                      <>
                        <p className="text-2xl font-bold tabular-nums leading-none" style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#E6A23C' }}>
                          {fmt(breakdown.totalHTG)}{' '}
                          <span className="text-sm font-normal" style={{ color: '#FAF8F3' }}>HTG</span>
                        </p>
                        <p className="text-xs mt-1 tabular-nums" style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#6E8882' }}>
                          ≈ {fmtUSD(breakdown.totalUSD)}
                        </p>
                      </>
                    ) : (
                      <p className="text-lg font-mono" style={{ color: '#6E8882' }}>—</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Per-unit + CBM total */}
              {breakdown && (
                <div className="mx-4 mt-2 mb-1 grid grid-cols-2 gap-2">
                  <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <p className="text-[10px] uppercase tracking-[0.08em] mb-1" style={{ color: '#6E8882' }}>Coût / unité</p>
                    <p className="text-base font-semibold tabular-nums" style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#FAF8F3' }}>
                      {fmt(breakdown.unitHTG)}{' '}
                      <span className="text-xs font-normal" style={{ color: '#6E8882' }}>HTG</span>
                    </p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: 'rgba(14,122,107,0.12)', border: '1px solid rgba(14,122,107,0.25)' }}>
                    <p className="text-[10px] uppercase tracking-[0.08em] mb-1" style={{ color: '#6E8882' }}>CBM total</p>
                    <p className="text-base font-semibold tabular-nums" style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#0E7A6B' }}>
                      {fmtCBM(breakdown.totalCBM)}{' '}
                      <span className="text-xs font-normal" style={{ color: '#6E8882' }}>m³</span>
                    </p>
                  </div>
                </div>
              )}

              <p className="mx-4 mt-3 text-[11px]" style={{ color: '#4a5c57' }}>
                Estimation basée sur les tarifs actuels. Le devis officiel est établi par notre équipe.
              </p>

              {/* Submit */}
              <div className="p-4 mt-2">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={cn('w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed')}
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    background: canSubmit ? '#0E7A6B' : '#1a3530',
                    color: '#fff',
                    letterSpacing: '0.02em',
                  }}
                >
                  {submitting
                    ? <><Loader2 className="h-4 w-4 animate-spin" />Envoi en cours…</>
                    : <><SendHorizonal className="h-4 w-4" />Soumettre la commande</>
                  }
                </button>
              </div>
            </div>
          </div>

        </div>
      </form>
    </div>
  )
}
