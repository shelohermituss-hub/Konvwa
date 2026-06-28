import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Mail, Phone, MapPin, MessageCircle, Star, Package, Award, Tag } from 'lucide-react'
import { SUPPLIERS } from '@/lib/suppliers-data'
import { useI18n } from '@/lib/i18n-context'
import { cn } from '@/lib/utils'

type Tab = 'products' | 'about'

export function SupplierProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('products')

  const supplier = SUPPLIERS.find((s) => s.id === id)

  if (!supplier) {
    return (
      <div className="min-h-full bg-[#F4F5F7] flex flex-col items-center justify-center p-8 text-center">
        <Package className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <p className="font-semibold text-muted-foreground">Fournisseur introuvable</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-sm font-semibold text-primary">
          ← Retour
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-[#F4F5F7] pb-8">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center h-12 px-4 bg-[#F4F5F7] border-b border-gray-200">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm font-semibold text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {supplier.name}
        </button>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {/* Profile card (ECME style) */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          {/* Cover strip */}
          <div className="h-20 w-full" style={{ background: supplier.coverGradient }} />

          <div className="px-5 pb-5">
            {/* Avatar — overlapping cover */}
            <div className="flex justify-center -mt-9 mb-3">
              <div
                className="h-[72px] w-[72px] rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white text-xl font-black"
                style={{ background: supplier.avatarColor }}
              >
                {supplier.initials}
              </div>
            </div>

            {/* Name + specialty */}
            <div className="text-center mb-4">
              <h1 className="text-lg font-bold tracking-tight">{supplier.name}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{supplier.specialty}</p>
              {/* Stars */}
              <div className="flex items-center justify-center gap-1 mt-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      'h-3.5 w-3.5',
                      i < Math.round(supplier.rating)
                        ? 'fill-amber-400 text-amber-400'
                        : 'fill-gray-200 text-gray-200'
                    )}
                  />
                ))}
                <span className="text-xs font-bold text-foreground ml-1">{supplier.rating.toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">({supplier.reviewCount})</span>
              </div>
            </div>

            {/* Info grid — 2 columns like ECME */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-5 py-4 border-t border-b border-gray-100">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-0.5">
                  Email
                </p>
                <p className="text-xs font-medium text-foreground break-all">{supplier.email}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-0.5">
                  Téléphone
                </p>
                <p className="text-xs font-medium text-foreground">{supplier.phone}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-0.5">
                  Localisation
                </p>
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                  <p className="text-xs font-medium text-foreground">{supplier.location}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-0.5">
                  Expérience
                </p>
                <p className="text-xs font-medium text-foreground">{supplier.yearsActive} ans d'activité</p>
              </div>
            </div>

            {/* Action buttons — full width stacked like ECME */}
            <a
              href={`tel:${supplier.phone}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white mb-2"
              style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
            >
              <Phone className="h-4 w-4" />
              Appeler
            </a>
            <a
              href={`https://wa.me/${supplier.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 py-2.5 text-sm font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>
          </div>
        </div>

        {/* Stats row */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm">
          <div className="grid grid-cols-3 divide-x divide-gray-100">
            {[
              { value: supplier.productCount, label: 'Produits' },
              { value: supplier.yearsActive, label: 'Ans' },
              { value: supplier.reviewCount, label: 'Avis' },
            ].map(({ value, label }) => (
              <div key={label} className="flex flex-col items-center py-4">
                <span className="text-lg font-bold">{value}</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs + content (ECME pattern) */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-gray-100">
            {([
              { key: 'products', label: t('suppliers.profile.products'), icon: Package },
              { key: 'about',    label: t('suppliers.profile.about'),    icon: Award  },
            ] as { key: Tab; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-3.5 text-xs font-semibold transition-colors relative',
                  tab === key
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {tab === key && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{ background: 'linear-gradient(90deg, #F05A28, #D44E21)' }} />
                )}
              </button>
            ))}
          </div>

          {/* Products tab — ECME purchase history style */}
          {tab === 'products' && (
            <div>
              {supplier.products.length === 0 ? (
                <div className="py-12 text-center">
                  <Package className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">{t('suppliers.profile.no_products')}</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {supplier.products.map((product) => (
                    <div key={product.id} className="flex items-center gap-3 px-4 py-3.5">
                      {/* Product icon */}
                      <div className="h-9 w-9 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                        <Package className="h-4 w-4 text-primary" strokeWidth={1.5} />
                      </div>

                      {/* Name + category */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {product.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="inline-flex items-center rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            {product.category}
                          </span>
                        </div>
                      </div>

                      {/* Price */}
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-foreground">{product.price}</p>
                        <p className="text-[10px] text-muted-foreground">{product.currency}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* About tab */}
          {tab === 'about' && (
            <div className="px-4 py-4 space-y-4">
              {/* Description */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-2">
                  Description
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">{supplier.description}</p>
              </div>

              {/* Address */}
              <div className="rounded-xl bg-[#F4F5F7] border border-gray-200 p-3.5 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1">
                  {t('suppliers.profile.location')}
                </p>
                <div className="flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-xs text-foreground">{supplier.address}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <p className="text-xs text-foreground">{supplier.email}</p>
                </div>
              </div>

              {/* Tags */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-2 flex items-center gap-1.5">
                  <Tag className="h-3 w-3" />
                  {t('suppliers.profile.specialty')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {supplier.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-primary/25 bg-primary/6 px-3 py-1 text-xs font-semibold text-primary"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
