import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Phone, Mail, MessageCircle, Star, Package, Award, ShoppingBag } from 'lucide-react'
import { SUPPLIERS } from '@/lib/suppliers-data'
import { useI18n } from '@/lib/i18n-context'
import { cn } from '@/lib/utils'

export function SupplierProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useI18n()

  const supplier = SUPPLIERS.find((s) => s.id === id)

  if (!supplier) {
    return (
      <div className="min-h-full bg-[#F4F5F7] flex flex-col items-center justify-center p-8 text-center">
        <Package className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <p className="font-semibold text-muted-foreground">Fournisseur introuvable</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 text-sm font-semibold text-primary"
        >
          ← Retour
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-[#F4F5F7] pb-8">
      {/* Cover + header */}
      <div className="relative">
        {/* Cover gradient */}
        <div
          className="h-40"
          style={{ background: supplier.coverGradient }}
        />

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/25 backdrop-blur-sm text-white hover:bg-black/40 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {/* Avatar overlapping cover */}
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
          <div
            className="h-24 w-24 rounded-2xl border-4 border-white shadow-xl flex items-center justify-center text-white text-2xl font-black"
            style={{ background: supplier.coverGradient }}
          >
            {supplier.initials}
          </div>
        </div>
      </div>

      {/* Profile info */}
      <div className="mt-16 px-5 text-center">
        <h1 className="text-xl font-bold tracking-tight">{supplier.name}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{supplier.specialty}</p>

        {/* Rating */}
        <div className="flex items-center justify-center gap-1.5 mt-2">
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={cn(
                  'h-3.5 w-3.5',
                  i < Math.round(supplier.rating) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/20'
                )}
              />
            ))}
          </div>
          <span className="text-sm font-bold">{supplier.rating.toFixed(1)}</span>
          <span className="text-xs text-muted-foreground">({supplier.reviewCount} avis)</span>
        </div>

        {/* Location */}
        <div className="flex items-center justify-center gap-1.5 mt-2">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{supplier.location}</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="mx-4 mt-5 rounded-2xl bg-white border border-gray-100 shadow-sm">
        <div className="grid grid-cols-3 divide-x divide-border/40">
          <div className="flex flex-col items-center py-4 px-2">
            <span className="text-lg font-bold text-foreground">{supplier.productCount}</span>
            <span className="text-[10px] text-muted-foreground mt-0.5 text-center leading-tight">Produits</span>
          </div>
          <div className="flex flex-col items-center py-4 px-2">
            <span className="text-lg font-bold text-foreground">{supplier.yearsActive}</span>
            <span className="text-[10px] text-muted-foreground mt-0.5 text-center leading-tight">Ans actif</span>
          </div>
          <div className="flex flex-col items-center py-4 px-2">
            <span className="text-lg font-bold text-foreground">{supplier.reviewCount}</span>
            <span className="text-[10px] text-muted-foreground mt-0.5 text-center leading-tight">Avis</span>
          </div>
        </div>
      </div>

      {/* Contact buttons */}
      <div className="px-4 mt-4 flex gap-2.5">
        <a
          href={`tel:${supplier.phone}`}
          className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white shadow-sm"
          style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
        >
          <Phone className="h-4 w-4" />
          Appeler
        </a>
        <a
          href={`https://wa.me/${supplier.whatsapp.replace(/\D/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 py-3 text-sm font-bold text-emerald-700 shadow-sm hover:bg-emerald-100 transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </a>
        <a
          href={`mailto:${supplier.email}`}
          className="flex h-[46px] w-[46px] items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm hover:bg-muted/30 transition-colors shrink-0"
        >
          <Mail className="h-4 w-4 text-muted-foreground" />
        </a>
      </div>

      {/* Tags */}
      <div className="px-4 mt-4 flex flex-wrap gap-2">
        {supplier.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-primary/20 bg-primary/6 px-3 py-1 text-xs font-semibold text-primary"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* About */}
      <div className="mx-4 mt-4 rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
            <Award className="h-4 w-4 text-primary" />
          </div>
          <p className="font-bold text-sm">{t('suppliers.profile.about')}</p>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{supplier.description}</p>

        {/* Address */}
        <div className="mt-3 pt-3 border-t border-border/40">
          <div className="flex items-start gap-2">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">{supplier.address}</p>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">{supplier.email}</p>
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="mx-4 mt-4 rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3.5 border-b border-border/50 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
            <ShoppingBag className="h-4 w-4 text-primary" />
          </div>
          <p className="font-bold text-sm">{t('suppliers.profile.products')}</p>
          <span className="ml-auto text-xs font-semibold text-muted-foreground bg-muted rounded-full px-2 py-0.5">
            {supplier.productCount}
          </span>
        </div>

        {supplier.products.length === 0 ? (
          <div className="p-8 text-center">
            <Package className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">{t('suppliers.profile.no_products')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 divide-x divide-y divide-border/40">
            {supplier.products.map((product) => (
              <div key={product.id} className="p-3.5 flex flex-col gap-1.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                  <Package className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <p className="text-xs font-semibold text-foreground leading-tight line-clamp-2">{product.name}</p>
                <p className="text-[10px] text-muted-foreground">{product.category}</p>
                <p className="text-sm font-bold text-primary">{product.price} {product.currency}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
