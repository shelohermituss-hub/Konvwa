import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Loader2, ExternalLink, CheckCircle2, SendHorizonal,
  Package, ImagePlus, X, Truck, MapPin, FileText, Zap,
} from 'lucide-react'

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

interface HaitiCity {
  id: string
  region_id: string
  name: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

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

const STEPS = [
  { label: 'Demande soumise',         sub: 'Votre produit est envoyé',         done: true  },
  { label: 'Devis produit',           sub: 'Prix du produit sous 24h',         done: false },
  { label: 'Mode d\'expédition',      sub: 'Frais de port & assurance',        done: false },
  { label: 'Paiement & livraison',    sub: 'Paiement HTG via MonCash',         done: false },
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
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">{label}</p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function SubmitPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Reference data
  const [origins,       setOrigins]       = useState<ShippingOrigin[]>([])
  const [regions,       setRegions]       = useState<HaitiRegion[]>([])
  const [cities,        setCities]        = useState<HaitiCity[]>([])
  const [loadingCities, setLoadingCities] = useState(false)

  // Route
  const [shipFromId, setShipFromId] = useState('')
  const [regionId,   setRegionId]   = useState('')
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

  // Shipping option
  const [shippingOption, setShippingOption] = useState<'all_inclusive' | 'separate'>('all_inclusive')

  // State
  const [submitting, setSubmitting] = useState(false)
  const [success,    setSuccess]    = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('shipping_origins').select('id,name,flag_emoji,country_code').eq('active', true).order('sort_order'),
      supabase.from('haiti_regions').select('id,name').eq('active', true).order('sort_order'),
    ]).then(([originsRes, regionsRes]) => {
      setOrigins(originsRes.data as ShippingOrigin[] || [])
      setRegions(regionsRes.data as HaitiRegion[] || [])
    })
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
    setQuantity('1'); setPriceUSD('')
    setSize(''); setColor(''); setUrgency('normal'); setNotes('')
    setShippingOption('all_inclusive')
    clearImage()
  }

  const detectedPlatform = productUrl ? detectPlatform(productUrl) : null
  const qty = Math.max(1, parseInt(quantity) || 1)
  const price = parseFloat(priceUSD) || 0
  const canSubmit = !submitting && !!productName.trim() && !!category && !!shipFromId && !!regionId

  // Submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!productName.trim()) { toast.error('Le nom du produit est requis.');         return }
    if (!category)           { toast.error('La catégorie est requise.');              return }
    if (!shipFromId)         { toast.error("Sélectionnez l'origine d'expédition.");  return }
    if (!regionId)           { toast.error('Sélectionnez la région de destination.'); return }

    setSubmitting(true)

    let imageUrl: string | null = null
    if (imageFile) {
      imageUrl = await uploadProductImage(imageFile, user.id)
      if (!imageUrl) toast.warning('Image non uploadée, mais la demande sera soumise.')
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
      product_image_url:      imageUrl,
      variant_info: {
        size:           size  || null,
        color:          color || null,
        unit_price_usd: price || null,
      },
    })

    if (error) {
      toast.error('Erreur lors de la soumission.')
    } else {
      setSuccess(true)
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
          <h2 className="text-xl font-bold mb-2">Demande envoyée !</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Notre équipe analyse votre demande et vous enverra un devis sous 24h.
            Vous pourrez ensuite choisir votre mode d'expédition.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate('/orders')}
              className="w-full rounded-xl py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
            >
              Suivre ma demande
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

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-[#F4F5F7]">
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Demande de devis</h1>
        <p className="text-sm text-muted-foreground">
          Renseignez le produit — notre équipe vous envoie le prix sous 24h
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="px-4 pb-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">

          {/* ── Left panel ─────────────────────────────────────────────────── */}
          <div className="space-y-4">

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
                  <Label className="text-sm font-bold">
                    Nom du produit <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="Ex : Robe d'été fleurie taille M"
                    value={productName}
                    onChange={e => setProductName(e.target.value)}
                    className="h-12 rounded-2xl bg-[#F0F1F5] border-0 focus-visible:ring-1 focus-visible:ring-primary/40"
                  />
                </div>

                {/* Catégorie + Quantité */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm font-bold">
                      Catégorie <span className="text-destructive">*</span>
                    </Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="h-12 rounded-2xl bg-[#F0F1F5] border-0 focus:ring-1 focus:ring-primary/40">
                        <SelectValue placeholder="Choisir" />
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
                      Quantité <span className="text-destructive">*</span>
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
                    Prix affiché sur la plateforme{' '}
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
                    Aide notre équipe à établir le devis plus vite. Non obligatoire.
                  </p>
                </div>
              </div>
            </div>

            {/* ── Section: Origine & destination ── */}
            <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-5 space-y-4">
                <SectionHeader icon={Truck} label="Origine & destination" />

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

                {/* Destination fixe */}
                <div className="space-y-1">
                  <Label className="text-sm font-bold">Destination</Label>
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
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
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

            {/* ── Section: Option d'expédition ── */}
            <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-5 space-y-3">
                <SectionHeader icon={Truck} label="Option d'expédition" />
                <p className="text-xs text-muted-foreground">
                  Choisissez comment vous souhaitez recevoir votre devis.
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
                        <p className="text-sm font-bold text-foreground">Tout inclus</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          Un seul devis avec produit, expédition, douane et livraison. Vous payez une fois.
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
                        <p className="text-sm font-bold text-foreground">Expédition séparée</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          Devis produit uniquement. Quand votre colis arrive en entrepôt Chine, vous choisissez vous-même le mode d'expédition.
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
                <SectionHeader icon={ImagePlus} label="Photo & variantes" />

                {/* Image upload */}
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
                      Capture d'écran du produit
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

                {/* Taille + Couleur */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm font-bold">
                      Taille <span className="text-xs font-normal text-muted-foreground">(optionnel)</span>
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
                      Couleur <span className="text-xs font-normal text-muted-foreground">(optionnel)</span>
                    </Label>
                    <Input
                      placeholder="Noir, Blanc…"
                      value={color}
                      onChange={e => setColor(e.target.value)}
                      className="h-12 rounded-2xl bg-[#F0F1F5] border-0 focus-visible:ring-1 focus-visible:ring-primary/40"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Section: Préférences ── */}
            <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-5 space-y-4">
                <SectionHeader icon={MapPin} label="Préférences" />

                <div className="space-y-2">
                  <Label className="text-sm font-bold">Urgence</Label>
                  <RadioGroup
                    value={urgency}
                    onValueChange={v => setUrgency(v as typeof urgency)}
                    className="grid grid-cols-3 gap-2"
                  >
                    {([
                      ['normal',  'Normal',  '4–6 sem.'],
                      ['urgent',  'Urgent',  '2–3 sem.'],
                      ['express', 'Express', '1–2 sem.'],
                    ] as const).map(([val, label, sub]) => (
                      <div key={val} className="relative">
                        <RadioGroupItem value={val} id={`urg-${val}`} className="peer sr-only" />
                        <Label
                          htmlFor={`urg-${val}`}
                          className="flex flex-col items-center py-3 px-2 rounded-2xl border-2 border-transparent bg-[#F0F1F5] cursor-pointer hover:bg-[#E8E9EE] peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 transition-all"
                        >
                          <span className="font-bold text-sm">{label}</span>
                          <span className="text-[10px] text-muted-foreground mt-0.5">{sub}</span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-bold">
                    Commentaires <span className="text-xs font-normal text-muted-foreground">(optionnel)</span>
                  </Label>
                  <Textarea
                    placeholder="Instructions particulières, précisions sur le produit…"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
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
                  : <><SendHorizonal className="h-4 w-4" />Demander le devis</>
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
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                    Récapitulatif
                  </p>
                </div>

                <div className="space-y-3 pb-4">
                  {/* Produit */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F0F1F5]">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-0.5">Produit</p>
                      {productName ? (
                        <p className="text-sm font-semibold text-foreground leading-tight truncate">{productName}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground/40 italic">Non renseigné</p>
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
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-0.5">Trajet</p>
                        <p className="text-sm font-semibold text-foreground leading-tight">
                          {origins.find(o => o.id === shipFromId)?.flag_emoji}{' '}
                          {origins.find(o => o.id === shipFromId)?.name || '…'}
                          {' → 🇭🇹 '}
                          {regions.find(r => r.id === regionId)?.name || 'Haïti'}
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
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-0.5">Expédition</p>
                      <p className="text-sm font-semibold text-foreground">
                        {shippingOption === 'all_inclusive' ? 'Tout inclus' : 'Séparée'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {shippingOption === 'all_inclusive'
                          ? 'Devis complet avec tous les frais'
                          : 'Choix du mode à l\'entrepôt Chine'}
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
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-0.5">Prix affiché</p>
                        <p className="text-sm font-bold text-foreground">
                          ${price.toFixed(2)}{qty > 1 ? <span className="font-normal text-muted-foreground"> × {qty}</span> : null}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Info box */}
                <div className="rounded-xl bg-primary/5 border border-primary/10 px-4 py-3 mb-5">
                  <p className="text-[11px] font-semibold text-primary mb-1">Devis sous 24h</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Notre équipe vérifie la disponibilité du produit et vous envoie le prix définitif. Vous choisissez ensuite votre mode d'expédition.
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
                    ? <><Loader2 className="h-4 w-4 animate-spin" />Envoi en cours…</>
                    : <><SendHorizonal className="h-4 w-4" />Demander le devis</>
                  }
                </button>
              </div>
            </div>

            {/* Étapes du flux */}
            <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-5">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-4">
                  Comment ça marche
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
