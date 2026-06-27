import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
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
import { Loader2, ExternalLink, CheckCircle2, SendHorizonal, Package } from 'lucide-react'

interface AppSettings {
  usd_to_htg_rate: number
  freight_per_kg_usd: number
  duty_rate_percent: number
  service_margin_percent: number
}

const CATEGORIES = [
  { value: 'clothing', label: 'Vêtements & accessoires' },
  { value: 'electronics', label: 'Électronique / gadgets' },
  { value: 'cosmetics', label: 'Cosmétiques / beauté' },
  { value: 'home', label: 'Maison & cuisine' },
  { value: 'toys', label: 'Jouets' },
  { value: 'auto', label: 'Auto & moto' },
  { value: 'sport', label: 'Sport & loisirs' },
  { value: 'other', label: 'Autre' },
]

function detectPlatform(url: string): 'alibaba' | 'shein' | 'temu' | 'other' {
  if (url.includes('alibaba.com') || url.includes('1688.com')) return 'alibaba'
  if (url.includes('shein.com')) return 'shein'
  if (url.includes('temu.com')) return 'temu'
  return 'other'
}

const fmt = (n: number) =>
  Math.round(n).toLocaleString('fr-FR').replace(/\u202f/g, '\u00a0')

const fmtUSD = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface Breakdown {
  productUSD: number
  freightUSD: number
  dutyUSD: number
  serviceUSD: number
  totalUSD: number
  totalHTG: number
  unitHTG: number
}

function calcBreakdown(
  price: number,
  weight: number,
  qty: number,
  s: AppSettings
): Breakdown {
  const productUSD = price * qty
  const freightUSD = weight * qty * s.freight_per_kg_usd
  const cif = productUSD + freightUSD
  const dutyUSD = cif * (s.duty_rate_percent / 100)
  const subtotal = productUSD + freightUSD + dutyUSD
  const serviceUSD = subtotal * (s.service_margin_percent / 100)
  const totalUSD = subtotal + serviceUSD
  const totalHTG = totalUSD * s.usd_to_htg_rate
  const unitHTG = totalHTG / Math.max(1, qty)
  return { productUSD, freightUSD, dutyUSD, serviceUSD, totalUSD, totalHTG, unitHTG }
}

function ManifestLine({
  label,
  sub,
  value,
  isAdd = false,
}: {
  label: string
  sub?: string
  value: string
  isAdd?: boolean
}) {
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

export function SubmitPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loadingSettings, setLoadingSettings] = useState(true)

  const [productUrl, setProductUrl] = useState('')
  const [productName, setProductName] = useState('')
  const [category, setCategory] = useState('')
  const [quantity, setQuantity] = useState('10')
  const [priceUSD, setPriceUSD] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [size, setSize] = useState('')
  const [color, setColor] = useState('')
  const [urgency, setUrgency] = useState<'normal' | 'urgent' | 'express'>('normal')
  const [notes, setNotes] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['usd_to_htg_rate', 'freight_per_kg_usd', 'duty_rate_percent', 'service_margin_percent'])
      .then(({ data }) => {
        if (data && data.length > 0) {
          const map = Object.fromEntries(data.map((r: any) => [r.key, parseFloat(r.value)]))
          setSettings({
            usd_to_htg_rate: map.usd_to_htg_rate ?? 132,
            freight_per_kg_usd: map.freight_per_kg_usd ?? 11,
            duty_rate_percent: map.duty_rate_percent ?? 20,
            service_margin_percent: map.service_margin_percent ?? 15,
          })
        } else {
          setSettings({ usd_to_htg_rate: 132, freight_per_kg_usd: 11, duty_rate_percent: 20, service_margin_percent: 15 })
        }
        setLoadingSettings(false)
      })
  }, [])

  const price = parseFloat(priceUSD) || 0
  const weight = parseFloat(weightKg) || 0
  const qty = Math.max(1, parseInt(quantity) || 1)
  const hasCalc = price > 0 && weight > 0 && settings

  const breakdown = hasCalc ? calcBreakdown(price, weight, qty, settings) : null

  const detectedPlatform = productUrl ? detectPlatform(productUrl) : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!productUrl.trim()) { toast.error('Le lien produit est requis.'); return }
    if (!productName.trim()) { toast.error('Le nom du produit est requis.'); return }
    if (!category) { toast.error('La catégorie est requise.'); return }

    setSubmitting(true)
    const { error } = await supabase.from('product_requests').insert({
      user_id: user.id,
      product_url: productUrl.trim(),
      product_name: productName.trim(),
      category,
      quantity: qty,
      budget_estimate: breakdown?.totalHTG || null,
      variant_info: {
        size: size || null,
        color: color || null,
        unit_price_usd: price || null,
        weight_kg: weight || null,
        estimated_total_htg: breakdown?.totalHTG || null,
      },
      urgency,
      notes: notes || null,
      source_platform: detectedPlatform || 'other',
      status: 'submitted',
    })

    if (error) {
      toast.error('Erreur lors de la soumission.')
    } else {
      setSuccess(true)
    }
    setSubmitting(false)
  }

  if (success) {
    return (
      <div className="min-h-full bg-background flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/10 mx-auto mb-5">
            <CheckCircle2 className="h-10 w-10 text-success" />
          </div>
          <h2 className="text-xl font-bold mb-2">Demande envoyée !</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Notre équipe analyse votre demande et vous enverra un devis sous 24h.
          </p>
          <div className="flex flex-col gap-3">
            <Button onClick={() => navigate('/orders')} className="rounded-xl">
              Voir mes commandes
            </Button>
            <Button variant="outline" onClick={() => {
              setSuccess(false)
              setProductUrl(''); setProductName(''); setCategory('')
              setQuantity('10'); setPriceUSD(''); setWeightKg('')
              setSize(''); setColor(''); setUrgency('normal'); setNotes('')
            }} className="rounded-xl">
              Nouvelle demande
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-[#F4F5F7]">
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Nouvelle commande</h1>
        <p className="text-sm text-muted-foreground">Renseignez le produit pour obtenir une estimation</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="px-4 pb-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">

          {/* ─── Left panel: inputs ─── */}
          <div className="space-y-4">

            {/* Section: Le produit */}
            <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-2">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-4">Le produit</p>

                <div className="space-y-1 mb-4">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-sm font-bold text-foreground">Lien produit</Label>
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
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary capitalize">
                        {detectedPlatform}
                      </span>
                      <a
                        href={productUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        Voir <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>

                <div className="space-y-1 mb-4">
                  <Label className="text-sm font-bold text-foreground">
                    Nom du produit <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="Ex: Robe d'été fleurie taille M"
                    value={productName}
                    onChange={e => setProductName(e.target.value)}
                    className="h-12 rounded-2xl bg-[#F0F1F5] border-0 focus-visible:ring-1 focus-visible:ring-primary/40"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="space-y-1">
                    <Label className="text-sm font-bold text-foreground">Prix unitaire</Label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">$</span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        placeholder="4.50"
                        value={priceUSD}
                        onChange={e => setPriceUSD(e.target.value)}
                        className="h-12 rounded-2xl bg-[#F0F1F5] border-0 pl-7 font-mono focus-visible:ring-1 focus-visible:ring-primary/40"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">En USD</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-bold text-foreground">Poids unitaire</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      placeholder="0.25"
                      value={weightKg}
                      onChange={e => setWeightKg(e.target.value)}
                      className="h-12 rounded-2xl bg-[#F0F1F5] border-0 font-mono focus-visible:ring-1 focus-visible:ring-primary/40"
                    />
                    <p className="text-[11px] text-muted-foreground">En kg</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="space-y-1">
                    <Label className="text-sm font-bold text-foreground">
                      Quantité <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      step="1"
                      value={quantity}
                      onChange={e => setQuantity(e.target.value)}
                      className="h-12 rounded-2xl bg-[#F0F1F5] border-0 font-mono focus-visible:ring-1 focus-visible:ring-primary/40"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-bold text-foreground">
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
                </div>
              </div>
            </div>

            {/* Section: Variantes */}
            <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-5">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-4">Variantes & options</p>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-sm font-bold text-foreground">Taille</Label>
                      <span className="text-xs text-muted-foreground">(optionnel)</span>
                    </div>
                    <Input
                      placeholder="M, L, XL…"
                      value={size}
                      onChange={e => setSize(e.target.value)}
                      className="h-12 rounded-2xl bg-[#F0F1F5] border-0 focus-visible:ring-1 focus-visible:ring-primary/40"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-sm font-bold text-foreground">Couleur</Label>
                      <span className="text-xs text-muted-foreground">(optionnel)</span>
                    </div>
                    <Input
                      placeholder="Noir, Blanc…"
                      value={color}
                      onChange={e => setColor(e.target.value)}
                      className="h-12 rounded-2xl bg-[#F0F1F5] border-0 focus-visible:ring-1 focus-visible:ring-primary/40"
                    />
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <Label className="text-sm font-bold text-foreground">Urgence</Label>
                  <RadioGroup
                    value={urgency}
                    onValueChange={v => setUrgency(v as typeof urgency)}
                    className="grid grid-cols-3 gap-2"
                  >
                    {([
                      ['normal', 'Normal', '4–6 sem.'],
                      ['urgent', 'Urgent', '2–3 sem.'],
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
                  <div className="flex items-center gap-1.5">
                    <Label className="text-sm font-bold text-foreground">Commentaires</Label>
                    <span className="text-xs text-muted-foreground">(optionnel)</span>
                  </div>
                  <Textarea
                    placeholder="Instructions particulières, exigences…"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={3}
                    className="rounded-2xl bg-[#F0F1F5] border-0 resize-none text-sm focus-visible:ring-1 focus-visible:ring-primary/40"
                  />
                </div>
              </div>
            </div>

            {/* Submit on mobile */}
            <div className="lg:hidden">
              <Button
                type="submit"
                disabled={submitting || !productName.trim() || !category}
                className="w-full rounded-2xl h-13 text-base font-bold gap-2 shadow-sm"
                style={{ height: '52px' }}
              >
                {submitting
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Envoi en cours…</>
                  : <><SendHorizonal className="h-4 w-4" />Soumettre la commande</>
                }
              </Button>
            </div>
          </div>

          {/* ─── Right panel: manifest card ─── */}
          <div className="mt-5 lg:mt-0 lg:sticky lg:top-6">
            <div
              className="rounded-2xl overflow-hidden shadow-2xl"
              style={{ background: '#0C1413', color: '#FAF8F3' }}
            >
              {/* Manifest header */}
              <div
                className="flex items-end justify-between px-5 py-4 border-b"
                style={{ borderColor: 'rgba(255,255,255,0.08)' }}
              >
                <div>
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[0.1em]"
                    style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#9FB0AB' }}
                  >
                    Devis d'importation
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#6E8882' }}>Coût rendu en Haïti</p>
                </div>
                <div className="text-right">
                  <span
                    className="text-lg font-bold tabular-nums"
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                  >
                    {qty}
                  </span>
                  <span className="text-xs ml-1" style={{ color: '#6E8882' }}>unités</span>
                </div>
              </div>

              {/* Breakdown lines */}
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
                      Renseignez le prix et le poids<br />pour voir l'estimation
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
                      label="Fret aérien"
                      sub={`${(weight * qty).toFixed(2)} kg × ${fmtUSD(settings!.freight_per_kg_usd)}/kg`}
                      value={fmtUSD(breakdown!.freightUSD)}
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

              {/* Total block */}
              <div className="mx-4 mt-4 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center justify-between">
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[0.1em]"
                    style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#9FB0AB' }}
                  >
                    Total rendu
                  </p>
                  <div className="text-right">
                    {breakdown ? (
                      <>
                        <p
                          className="text-2xl font-bold tabular-nums leading-none"
                          style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#E6A23C' }}
                        >
                          {fmt(breakdown.totalHTG)}{' '}
                          <span className="text-sm font-normal" style={{ color: '#FAF8F3' }}>HTG</span>
                        </p>
                        <p
                          className="text-xs mt-1 tabular-nums"
                          style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#6E8882' }}
                        >
                          ≈ {fmtUSD(breakdown.totalUSD)}
                        </p>
                      </>
                    ) : (
                      <p className="text-lg font-mono" style={{ color: '#6E8882' }}>—</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Per-unit row */}
              {breakdown && (
                <div
                  className="mx-4 mt-2 mb-1 grid grid-cols-2 gap-2"
                >
                  <div
                    className="rounded-xl p-3"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <p className="text-[10px] uppercase tracking-[0.08em] mb-1" style={{ color: '#6E8882' }}>Coût / unité</p>
                    <p
                      className="text-base font-semibold tabular-nums"
                      style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#FAF8F3' }}
                    >
                      {fmt(breakdown.unitHTG)}{' '}
                      <span className="text-xs font-normal" style={{ color: '#6E8882' }}>HTG</span>
                    </p>
                  </div>
                  <div
                    className="rounded-xl p-3"
                    style={{ background: 'rgba(14,122,107,0.12)', border: '1px solid rgba(14,122,107,0.25)' }}
                  >
                    <p className="text-[10px] uppercase tracking-[0.08em] mb-1" style={{ color: '#6E8882' }}>Taux USD→HTG</p>
                    <p
                      className="text-base font-semibold tabular-nums"
                      style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#0E7A6B' }}
                    >
                      {settings?.usd_to_htg_rate}
                    </p>
                  </div>
                </div>
              )}

              {/* Info note */}
              <p className="mx-4 mt-3 text-[11px]" style={{ color: '#4a5c57' }}>
                Estimation basée sur les tarifs actuels. Le devis officiel est établi par notre équipe.
              </p>

              {/* Submit button */}
              <div className="p-4 mt-2">
                <button
                  type="submit"
                  disabled={submitting || !productName.trim() || !category}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 rounded-xl py-3.5',
                    'text-sm font-semibold transition-all active:scale-[0.98]',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    background: submitting || !productName.trim() || !category ? '#1a3530' : '#0E7A6B',
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
