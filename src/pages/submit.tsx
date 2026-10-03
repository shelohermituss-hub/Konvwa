import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Loader2, ExternalLink, CheckCircle2, SendHorizonal,
  Package, ImagePlus, X, Truck, FileText, Zap, Wand2, Calculator,
} from 'lucide-react'
import { DEFAULT_RATES, DEFAULT_WEIGHT_KG, estimateCost, guessCategory, toUsd, type Rates } from '@/lib/cost-estimate'

import { inviteInstall } from '@/lib/pwa'
import { tr, LOCALE_TAG } from '@/lib/i18n'
// ── Types ─────────────────────────────────────────────────────────────────────

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

interface DeliveryOption { id: string; kind: 'pickup' | 'home'; label: string; details: string | null; price_htg: number }

interface HaitiCity {
  id: string
  region_id: string
  name: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'clothing',    label: tr('Vêtements & accessoires') },
  { value: 'electronics', label: tr('Électronique / gadgets') },
  { value: 'cosmetics',   label: tr('Cosmétiques / beauté') },
  { value: 'home',        label: tr('Maison & cuisine') },
  { value: 'toys',        label: tr('Jouets') },
  { value: 'auto',        label: tr('Auto & moto') },
  { value: 'sport',       label: tr('Sport & loisirs') },
  { value: 'other',       label: tr('Autre') },
]

const STEPS = [
  { label: tr('Demande soumise'),         sub: tr('Votre produit est envoyé'),         done: true  },
  { label: tr('Devis produit'),           sub: tr('Prix du produit sous 24h'),         done: false },
  { label: tr('Mode d\'expédition'),      sub: tr('Frais de port & assurance'),        done: false },
  { label: tr('Paiement & livraison'),    sub: tr('Paiement HTG via MonCash'),         done: false },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function detectPlatform(url: string): 'alibaba' | 'shein' | 'temu' | 'other' {
  if (url.includes('alibaba.com') || url.includes('1688.com')) return 'alibaba'
  if (url.includes('shein.com')) return 'shein'
  if (url.includes('temu.com')) return 'temu'
  return 'other'
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

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function SubmitPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Reference data
  const [origins,       setOrigins]       = useState<ShippingOrigin[]>([])
  const [regions,       setRegions]       = useState<HaitiRegion[]>([])
  const [cities,        setCities]        = useState<HaitiCity[]>([])
  const [loadingCities, setLoadingCities] = useState(false)

  // Route
  const [shipFromId, setShipFromId] = useState('')
  const [regionId,   setRegionId]   = useState('')
  const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>([])
  const [deliveryOptionId, setDeliveryOptionId] = useState('')
  const [cityId,     setCityId]     = useState('')

  // Product
  const [productUrl,  setProductUrl]  = useState('')
  const [productName, setProductName] = useState('')
  const [category,    setCategory]    = useState('')
  const [quantity,    setQuantity]    = useState('1')
  const [priceUSD,    setPriceUSD]    = useState('')
  const [color,       setColor]       = useState('')
  const [size,        setSize]        = useState('')
  const [urgency,     setUrgency]     = useState<'normal' | 'urgent' | 'express'>('normal')
  const [notes,       setNotes]       = useState('')

  // Image
  const [imageFile,    setImageFile]    = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Link import + cost estimate
  const [importing,     setImporting]     = useState(false)
  const [importedImage, setImportedImage] = useState<string | null>(null)
  const [importNote,    setImportNote]    = useState('')
  const [weightKg,      setWeightKg]      = useState('')
  const [rates,         setRates]         = useState<Rates>(DEFAULT_RATES)

  // Shipping option
  const [shippingOption, setShippingOption] = useState<'all_inclusive' | 'separate'>('all_inclusive')

  // State
  const [submitting, setSubmitting] = useState(false)
  const [success,    setSuccess]    = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('shipping_origins').select('id,name,flag_emoji,country_code').eq('active', true).order('sort_order'),
      supabase.from('haiti_regions').select('id,name').eq('active', true).order('sort_order'),
      supabase.from('app_settings').select('key,value').in('key', ['usd_to_htg_rate', 'freight_per_kg_usd', 'duty_rate_percent', 'service_margin_percent', 'cny_to_usd_rate', 'eur_to_usd_rate']),
    ]).then(([originsRes, regionsRes, ratesRes]) => {
      setOrigins(originsRes.data as ShippingOrigin[] || [])
      setRegions(regionsRes.data as HaitiRegion[] || [])
      const v = Object.fromEntries((ratesRes.data ?? []).map(r => [r.key as string, Number(r.value)]))
      const pick = (k: string, fallback: number) => (Number.isFinite(v[k]) && v[k] > 0 ? v[k] : fallback)
      setRates({
        usdToHtg: pick('usd_to_htg_rate', DEFAULT_RATES.usdToHtg),
        freightPerKgUsd: pick('freight_per_kg_usd', DEFAULT_RATES.freightPerKgUsd),
        dutyPct: pick('duty_rate_percent', DEFAULT_RATES.dutyPct),
        servicePct: pick('service_margin_percent', DEFAULT_RATES.servicePct),
        cnyToUsd: pick('cny_to_usd_rate', DEFAULT_RATES.cnyToUsd),
        eurToUsd: pick('eur_to_usd_rate', DEFAULT_RATES.eurToUsd),
      })
    })
  }, [])

  // "Recommander" : start again from a past request (same product, route and options), the customer can edit before sending
  const reorderId = searchParams.get('from')
  useEffect(() => {
    if (!reorderId || !user) return
    void supabase.from('product_requests')
      .select('product_url, product_name, category, quantity, urgency, notes, shipping_option, ship_from_id, destination_region_id, destination_city_id, delivery_option_id, product_image_url, variant_info')
      .eq('id', reorderId).eq('user_id', user.id).maybeSingle()
      .then(({ data: r }) => {
        if (!r) return
        setProductUrl(r.product_url ?? '')
        setProductName(r.product_name ?? '')
        setCategory(r.category ?? '')
        setQuantity(String(r.quantity ?? 1))
        if (r.urgency === 'urgent' || r.urgency === 'express' || r.urgency === 'normal') setUrgency(r.urgency)
        setNotes(r.notes ?? '')
        if (r.shipping_option === 'all_inclusive' || r.shipping_option === 'separate') setShippingOption(r.shipping_option)
        setShipFromId(r.ship_from_id ?? '')
        setImportedImage(r.product_image_url ?? null)
        const v = (r.variant_info ?? {}) as { size?: string | null; color?: string | null; unit_price_usd?: number | null; unit_weight_kg?: number | null }
        setSize(v.size ?? ''); setColor(v.color ?? '')
        setPriceUSD(v.unit_price_usd ? String(v.unit_price_usd) : '')
        setWeightKg(v.unit_weight_kg ? String(v.unit_weight_kg) : '')
        if (r.destination_region_id) {
          void handleRegionChange(r.destination_region_id).then(() => {
            setCityId(r.destination_city_id ?? '')
            setDeliveryOptionId(r.delivery_option_id ?? '')
          })
        }
        toast.success(tr('Demande pré-remplie : vérifiez les informations avant d\'envoyer.'))
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reorderId, user])

  async function handleRegionChange(id: string) {
    setRegionId(id)
    setCityId('')
    setCities([])
    setDeliveryOptions([])
    setDeliveryOptionId('')
    if (!id) return
    void supabase.from('delivery_options').select('id,kind,label,details,price_htg').eq('region_id', id).eq('active', true).order('sort_order')
      .then(({ data }) => setDeliveryOptions((data ?? []) as DeliveryOption[]))
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

  // Image handlers
  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error(tr('Image trop lourde (max 5 MB).')); return }
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  function clearImage() {
    setImageFile(null)
    setImagePreview(null)
    setImportedImage(null)
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
    setProductUrl(''); setProductName(''); setCategory(''); setWeightKg(''); setImportNote('')
    setQuantity('1'); setPriceUSD('')
    setSize(''); setColor(''); setUrgency('normal'); setNotes('')
    setShippingOption('all_inclusive')
    clearImage()
  }

  const detectedPlatform = productUrl ? detectPlatform(productUrl) : null
  const qty = Math.max(1, parseInt(quantity) || 1)
  const price = parseFloat(priceUSD) || 0
  const unitWeight = parseFloat(weightKg) > 0 ? parseFloat(weightKg) : (DEFAULT_WEIGHT_KG[category] ?? DEFAULT_WEIGHT_KG.other)
  const estimate = price > 0 ? estimateCost({ priceUsd: price, quantity: qty, weightKg: unitWeight }, rates) : null
  const shownImage = imagePreview ?? importedImage
  const canSubmit = !submitting && !!productName.trim() && !!category && !!shipFromId && !!regionId

  // Fill the form from a Shein / Temu / Alibaba link (read by the server; the customer can correct everything)
  async function importFromLink() {
    const link = productUrl.trim()
    if (!link || importing) return
    if (detectPlatform(link) === 'other') { toast.error(tr('Lien non pris en charge (Alibaba, Shein ou Temu).')); return }
    setImporting(true)
    setImportNote('')
    const { data, error } = await supabase.functions.invoke('link-preview', { body: { url: link } })
    setImporting(false)
    if (error || !data || data.error) {
      toast.error(typeof data?.error === 'string' ? data.error : tr('Impossible de lire ce lien. Remplissez les champs à la main.'))
      return
    }
    const found: string[] = []
    if (data.name && !productName.trim()) {
      setProductName(String(data.name))
      found.push(tr('nom'))
      const guess = guessCategory(String(data.name))
      if (guess && !category) setCategory(guess)
    }
    if (data.image_url && !imageFile) { setImportedImage(String(data.image_url)); found.push(tr('photo')) }
    if (typeof data.price === 'number' && !priceUSD) {
      const usd = toUsd(data.price, (data.currency as string | null) ?? null, rates)
      if (usd != null) { setPriceUSD(usd.toFixed(2)); found.push(tr('prix')) }
    }
    setImportNote(found.length > 0
      ? tr('Trouvé : {0}. Vérifiez et corrigez si besoin.', found.join(', '))
      : tr('Le site n\'a pas livré d\'informations : remplissez les champs à la main.'))
  }

  // Submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!productName.trim()) { toast.error(tr('Le nom du produit est requis.'));         return }
    if (!category)           { toast.error(tr('La catégorie est requise.'));              return }
    if (!shipFromId)         { toast.error(tr('Sélectionnez l\'origine d\'expédition.'));  return }
    if (!regionId)           { toast.error(tr('Sélectionnez la région de destination.')); return }

    setSubmitting(true)

    let imageUrl: string | null = null
    if (imageFile) {
      imageUrl = await uploadProductImage(imageFile, user.id)
      if (!imageUrl) toast.warning(tr('Image non uploadée, mais la demande sera soumise.'))
    }

    const { error } = await supabase.from('product_requests').insert({
      user_id:                user.id,
      product_url:            productUrl.trim() || null,
      product_name:           productName.trim(),
      category,
      quantity:               qty,
      urgency,
      notes:                  notes || null,
      source_platform:        detectedPlatform || 'other',
      status:                 'submitted',
      shipping_option:        shippingOption,
      ship_from_id:           shipFromId || null,
      destination_region_id:  regionId   || null,
      destination_city_id:    cityId     || null,
      delivery_option_id:     deliveryOptionId || null,
      product_image_url:      imageUrl ?? importedImage,
      variant_info: {
        size:           size  || null,
        color:          color || null,
        unit_price_usd: price || null,
        unit_weight_kg: parseFloat(weightKg) > 0 ? parseFloat(weightKg) : null,
      },
    })

    if (error) {
      toast.error(tr('Erreur lors de la soumission.'))
    } else {
      setSuccess(true)
      inviteInstall()
    }
    setSubmitting(false)
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-full bg-[#F4F5F7] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 mx-auto mb-5">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">{tr('Demande envoyée !')}</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {tr('Notre équipe analyse votre demande et vous enverra un devis sous 24h. Vous pourrez ensuite choisir votre mode d\'expédition.')}
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate('/orders')}
              className="w-full rounded-xl py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
            >
              {tr('Suivre ma demande')}
            </button>
            <button
              onClick={() => { setSuccess(false); resetForm() }}
              className="w-full rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              {tr('Nouvelle demande')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-[#F4F5F7]">
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">{tr('Demande de devis')}</h1>
        <p className="text-sm text-muted-foreground">
          {tr('Renseignez le produit — notre équipe vous envoie le prix sous 24h')}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="px-4 pb-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">

          {/* ── Left panel ─────────────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* ── Section: Le produit ── */}
            <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-5 space-y-4">
                <SectionHeader icon={Package} label={tr('Le produit')} />

                {/* URL */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-sm font-bold">{tr('Lien produit')}</Label>
                    <span className="text-xs text-muted-foreground">(Alibaba · Shein · Temu)</span>
                  </div>
                  <Input
                    type="url"
                    placeholder={tr('Colle le lien ici')}
                    value={productUrl}
                    onChange={e => setProductUrl(e.target.value)}
                    onPaste={e => {
                      const text = e.clipboardData.getData('text').trim()
                      if (/^https:\/\//i.test(text) && detectPlatform(text) !== 'other') setTimeout(() => void importFromLink(), 0)
                    }}
                    className="h-12 rounded-2xl bg-[#F0F1F5] border-0 font-mono text-sm focus-visible:ring-1 focus-visible:ring-primary/40"
                  />
                  {detectedPlatform && detectedPlatform !== 'other' && (
                    <button
                      type="button"
                      onClick={() => void importFromLink()}
                      disabled={importing}
                      className="mt-1.5 inline-flex h-10 items-center gap-2 rounded-xl bg-primary/10 px-4 text-sm font-bold text-primary transition-colors hover:bg-primary/15 disabled:opacity-60"
                    >
                      {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                      {importing ? tr('Lecture du lien…') : tr('Remplir automatiquement')}
                    </button>
                  )}
                  {importNote && <p className="mt-1 text-xs text-muted-foreground" role="status">{importNote}</p>}
                  {detectedPlatform && detectedPlatform !== 'other' && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary capitalize">
                        {detectedPlatform}
                      </span>
                      <a href={productUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1">
                        {tr('Voir')}{' '}<ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Nom */}
                <div className="space-y-1">
                  <Label className="text-sm font-bold">
                    {tr('Nom du produit')}{' '}<span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder={tr('Ex : Robe d\'été fleurie taille M')}
                    value={productName}
                    onChange={e => setProductName(e.target.value)}
                    className="h-12 rounded-2xl bg-[#F0F1F5] border-0 focus-visible:ring-1 focus-visible:ring-primary/40"
                  />
                </div>

                {/* Catégorie + Quantité */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm font-bold">
                      {tr('Catégorie')}{' '}<span className="text-destructive">*</span>
                    </Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="h-12 rounded-2xl bg-[#F0F1F5] border-0 focus:ring-1 focus:ring-primary/40">
                        <SelectValue placeholder={tr('Choisir')} />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-bold">
                      {tr('Quantité')}{' '}<span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="number" inputMode="numeric" min="1" step="1"
                      value={quantity} onChange={e => setQuantity(e.target.value)}
                      className="h-12 rounded-2xl bg-[#F0F1F5] border-0 font-mono focus-visible:ring-1 focus-visible:ring-primary/40"
                    />
                  </div>
                </div>

                {/* Prix indicatif */}
                <div className="space-y-1">
                  <Label className="text-sm font-bold">
                    {tr('Prix affiché sur la plateforme')}{' '}
                    <span className="text-xs font-normal text-muted-foreground">(optionnel)</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">$</span>
                    <Input
                      type="number" inputMode="decimal" min="0" step="0.01"
                      placeholder="4.50"
                      value={priceUSD}
                      onChange={e => setPriceUSD(e.target.value)}
                      className="h-12 rounded-2xl bg-[#F0F1F5] border-0 pl-7 font-mono focus-visible:ring-1 focus-visible:ring-primary/40"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {tr('Aide notre équipe à établir le devis plus vite. Non obligatoire.')}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Section: Origine & destination ── */}
            <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-5 space-y-4">
                <SectionHeader icon={Truck} label={tr('Origine & destination')} />

                {/* Expédier depuis */}
                <div className="space-y-1">
                  <Label className="text-sm font-bold">
                    {tr('Expédier depuis')}{' '}<span className="text-destructive">*</span>
                  </Label>
                  <Select value={shipFromId} onValueChange={setShipFromId}>
                    <SelectTrigger className="h-12 rounded-2xl bg-[#F0F1F5] border-0 focus:ring-1 focus:ring-primary/40">
                      <SelectValue placeholder={tr('Sélectionner une origine')} />
                    </SelectTrigger>
                    <SelectContent>
                      {origins.map(o => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.flag_emoji} {tr(o.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Destination fixe */}
                <div className="space-y-1">
                  <Label className="text-sm font-bold">{tr('Destination')}</Label>
                  <div className="h-12 rounded-2xl bg-[#F0F1F5] flex items-center px-4 gap-2.5">
                    <span className="text-lg leading-none">🇭🇹</span>
                    <span className="text-sm font-semibold text-foreground">{tr('Haïti')}</span>
                    <span className="ml-auto rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2.5 py-0.5">
                      {tr('Disponible')}
                    </span>
                  </div>
                </div>

                {/* Région */}
                <div className="space-y-1">
                  <Label className="text-sm font-bold">
                    {tr('Région')}{' '}<span className="text-destructive">*</span>
                  </Label>
                  <Select value={regionId} onValueChange={handleRegionChange}>
                    <SelectTrigger className="h-12 rounded-2xl bg-[#F0F1F5] border-0 focus:ring-1 focus:ring-primary/40">
                      <SelectValue placeholder={tr('Sélectionner une région')} />
                    </SelectTrigger>
                    <SelectContent>
                      {regions.map(r => (
                        <SelectItem key={r.id} value={r.id}>{tr(r.name)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Ville */}
                <div className="space-y-1">
                  <Label className="text-sm font-bold">
                    {tr('Ville')}{' '}
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
                            ? tr('Sélectionner d\'abord une région')
                            : loadingCities
                            ? tr('Chargement…')
                            : tr('Toutes les villes')
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map(c => (
                        <SelectItem key={c.id} value={c.id}>{tr(c.name)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Retrait / livraison : prix affiché avant de commander */}
                {deliveryOptions.length > 0 && (
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-bold">
                      {tr('Retrait ou livraison')}{' '}
                      <span className="text-xs font-normal text-muted-foreground">(optionnel)</span>
                    </legend>
                    {deliveryOptions.map(o => (
                      <label key={o.id} className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-sm',
                        deliveryOptionId === o.id ? 'border-primary bg-primary/5' : 'border-transparent bg-[#F0F1F5]',
                      )}>
                        <input type="radio" name="delivery_option" value={o.id} checked={deliveryOptionId === o.id}
                          onChange={() => setDeliveryOptionId(o.id)} className="mt-1 accent-[var(--primary)]" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{o.kind === 'pickup' ? tr('Retrait') : tr('Livraison à domicile')} — {o.label}</span>
                          {o.details && <span className="block text-xs text-muted-foreground">{o.details}</span>}
                        </span>
                        <span className="shrink-0 font-bold">{o.price_htg > 0 ? `${o.price_htg.toLocaleString(LOCALE_TAG)} HTG` : tr('Gratuit')}</span>
                      </label>
                    ))}
                  </fieldset>
                )}
              </div>
            </div>

            {/* ── Section: Option d'expédition ── */}
            <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-5 space-y-3">
                <SectionHeader icon={Truck} label={tr('Option d\'expédition')} />
                <p className="text-xs text-muted-foreground">
                  {tr('Choisissez comment vous souhaitez recevoir votre devis.')}
                </p>
                <div className="grid grid-cols-1 gap-3">
                  {/* Tout inclus */}
                  <button
                    type="button"
                    onClick={() => setShippingOption('all_inclusive')}
                    className={cn(
                      'text-left rounded-2xl border-2 px-4 py-3.5 transition-all',
                      shippingOption === 'all_inclusive'
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 bg-[#F0F1F5] hover:border-primary/40'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                        shippingOption === 'all_inclusive'
                          ? 'border-primary bg-primary'
                          : 'border-gray-300 bg-white'
                      )}>
                        {shippingOption === 'all_inclusive' && (
                          <div className="h-2 w-2 rounded-full bg-white" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{tr('Tout inclus')}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          {tr('Un seul devis avec produit, expédition, douane et livraison. Vous payez une fois.')}
                        </p>
                      </div>
                    </div>
                  </button>

                  {/* Expédition séparée */}
                  <button
                    type="button"
                    onClick={() => setShippingOption('separate')}
                    className={cn(
                      'text-left rounded-2xl border-2 px-4 py-3.5 transition-all',
                      shippingOption === 'separate'
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 bg-[#F0F1F5] hover:border-primary/40'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                        shippingOption === 'separate'
                          ? 'border-primary bg-primary'
                          : 'border-gray-300 bg-white'
                      )}>
                        {shippingOption === 'separate' && (
                          <div className="h-2 w-2 rounded-full bg-white" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{tr('Expédition séparée')}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          {tr('Devis produit uniquement. Quand votre colis arrive en entrepôt Chine, vous choisissez vous-même le mode d\'expédition.')}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* ── Section: Photo & variantes ── */}
            <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-5 space-y-4">
                <SectionHeader icon={ImagePlus} label={tr('Photo & variantes')} />

                {/* Image upload */}
                {shownImage ? (
                  <div className="relative rounded-2xl overflow-hidden border border-gray-100">
                    <img
                      src={shownImage}
                      alt={tr('Aperçu')}
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
                      <p className="text-xs text-muted-foreground truncate">{imageFile?.name ?? tr('Photo importée du lien')}</p>
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
                      {tr('Capture d\'écran du produit')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{tr('JPG, PNG, WEBP · max 5 MB')}</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />

                {/* Taille + Couleur */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm font-bold">
                      {tr('Taille')}{' '}<span className="text-xs font-normal text-muted-foreground">(optionnel)</span>
                    </Label>
                    <Input
                      placeholder="M, L, XL…"
                      value={size}
                      onChange={e => setSize(e.target.value)}
                      className="h-12 rounded-2xl bg-[#F0F1F5] border-0 focus-visible:ring-1 focus-visible:ring-primary/40"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-bold">
                      {tr('Couleur')}{' '}<span className="text-xs font-normal text-muted-foreground">(optionnel)</span>
                    </Label>
                    <Input
                      placeholder={tr('Noir, Blanc…')}
                      value={color}
                      onChange={e => setColor(e.target.value)}
                      className="h-12 rounded-2xl bg-[#F0F1F5] border-0 focus-visible:ring-1 focus-visible:ring-primary/40"
                    />
                  </div>
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
                  ? <><Loader2 className="h-4 w-4 animate-spin" />{tr('Envoi en cours…')}</>
                  : <><SendHorizonal className="h-4 w-4" />{tr('Demander le devis')}</>
                }
              </button>
            </div>
          </div>

          {/* ── Right panel: récapitulatif + étapes ────────────────────────── */}
          <div className="mt-5 lg:mt-0 lg:sticky lg:top-6 space-y-4">

            {/* Récapitulatif de la demande */}
            <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-1">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-4 w-4 text-primary" />
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {tr('Récapitulatif')}
                  </p>
                </div>

                <div className="space-y-3 pb-4">
                  {/* Produit */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F0F1F5]">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{tr('Produit')}</p>
                      {productName ? (
                        <p className="text-sm font-semibold text-foreground leading-tight truncate">{productName}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground/40 italic">{tr('Non renseigné')}</p>
                      )}
                      {(category || qty > 1) && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {[CATEGORIES.find(c => c.value === category)?.label, qty > 1 ? `${qty} unités` : '1 unité'].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Route */}
                  {(shipFromId || regionId) && (
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F0F1F5]">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{tr('Trajet')}</p>
                        <p className="text-sm font-semibold text-foreground leading-tight">
                          {origins.find(o => o.id === shipFromId)?.flag_emoji}{' '}
                          {origins.find(o => o.id === shipFromId)?.name || '…'}
                          {' → 🇭🇹 '}
                          {regions.find(r => r.id === regionId)?.name || tr('Haïti')}
                          {cities.find(c => c.id === cityId) ? ` · ${cities.find(c => c.id === cityId)!.name}` : ''}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Option d'expédition */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F0F1F5]">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{tr('Expédition')}</p>
                      <p className="text-sm font-semibold text-foreground">
                        {shippingOption === 'all_inclusive' ? tr('Tout inclus') : tr('Séparée')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {shippingOption === 'all_inclusive'
                          ? tr('Devis complet avec tous les frais')
                          : tr('Choix du mode à l\'entrepôt Chine')}
                      </p>
                    </div>
                  </div>

                  {/* Prix indicatif */}
                  {price > 0 && (
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <Zap className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{tr('Prix affiché')}</p>
                        <p className="text-sm font-bold text-foreground">
                          ${price.toFixed(2)}{qty > 1 ? <span className="font-normal text-muted-foreground"> × {qty}</span> : null}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Estimated total */}
                <div className="mb-5 rounded-xl border border-gray-100 bg-[#F4F5F7] p-4">
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Calculator className="h-3.5 w-3.5" aria-hidden />{tr('Coût total estimé')}
                  </p>
                  {estimate ? (
                    <>
                      <p className="text-2xl font-extrabold tabular-nums text-foreground">
                        {Math.round(estimate.totalHtg).toLocaleString(LOCALE_TAG)} <span className="text-sm font-semibold text-muted-foreground">HTG</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tr('soit environ {0} HTG par unité · {1} $', Math.round(estimate.perUnitHtg).toLocaleString(LOCALE_TAG), estimate.totalUsd.toFixed(2))}
                      </p>
                      <dl className="mt-3 space-y-1 text-xs">
                        {[
                          [tr('Produits'), estimate.productUsd],
                          [tr('Fret ({0} kg/unité)', unitWeight), estimate.freightUsd],
                          [tr('Douane ({0} %)', rates.dutyPct), estimate.dutyUsd],
                          [tr('Service ({0} %)', rates.servicePct), estimate.serviceUsd],
                        ].map(([label, usd]) => (
                          <div key={String(label)} className="flex justify-between"><dt className="text-muted-foreground">{label}</dt><dd className="font-mono">{Number(usd).toFixed(2)} $</dd></div>
                        ))}
                      </dl>
                      <div className="mt-3 space-y-1">
                        <Label htmlFor="unit-weight" className="text-[11px] font-semibold">{tr('Poids d\'une unité (kg)')}</Label>
                        <Input
                          id="unit-weight" type="number" inputMode="decimal" min="0" step="0.01"
                          placeholder={String(DEFAULT_WEIGHT_KG[category] ?? DEFAULT_WEIGHT_KG.other)}
                          value={weightKg} onChange={e => setWeightKg(e.target.value)}
                          className="h-10 rounded-xl bg-white border-gray-200 font-mono"
                        />
                      </div>
                      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                        {tr('Estimation à titre indicatif (taux : 1 $ = {0} HTG). Le devis officiel peut différer.', rates.usdToHtg)}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">{tr('Indiquez le prix affiché pour voir le coût total estimé en gourdes.')}</p>
                  )}
                </div>

                {/* Info box */}
                <div className="rounded-xl bg-primary/5 border border-primary/10 px-4 py-3 mb-5">
                  <p className="text-[11px] font-semibold text-primary mb-1">{tr('Devis sous 24h')}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {tr('Notre équipe vérifie la disponibilité du produit et vous envoie le prix définitif. Vous choisissez ensuite votre mode d\'expédition.')}
                  </p>
                </div>
              </div>

              {/* Submit button */}
              <div className="px-4 pb-4 hidden lg:block">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white'
                  )}
                  style={{ background: canSubmit ? 'linear-gradient(135deg, #F05A28, #D44E21)' : '#d1d5db' }}
                >
                  {submitting
                    ? <><Loader2 className="h-4 w-4 animate-spin" />{tr('Envoi en cours…')}</>
                    : <><SendHorizonal className="h-4 w-4" />{tr('Demander le devis')}</>
                  }
                </button>
              </div>
            </div>

            {/* Étapes du flux */}
            <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-5">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
                  {tr('Comment ça marche')}
                </p>
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-[17px] top-5 bottom-5 w-px bg-gray-100" />

                  <div className="space-y-0">
                    {STEPS.map((step, i) => (
                      <div key={i} className="flex items-start gap-3 relative py-2.5">
                        <div className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 relative z-10',
                          i === 0
                            ? 'bg-primary border-primary'
                            : 'bg-white border-gray-200'
                        )}>
                          {i === 0 ? (
                            <CheckCircle2 className="h-4 w-4 text-white" />
                          ) : (
                            <span className="text-xs font-bold text-muted-foreground">{i + 1}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1 pt-1.5">
                          <p className={cn(
                            'text-sm font-semibold leading-tight',
                            i === 0 ? 'text-primary' : 'text-foreground'
                          )}>
                            {step.label}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{step.sub}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </form>
    </div>
  )
}
