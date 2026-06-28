import { Link } from 'react-router-dom'
import { Phone, Mail, Star, MapPin, ChevronRight } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { SUPPLIERS } from '@/lib/suppliers-data'

export function SuppliersPage() {
  const { t } = useI18n()

  return (
    <div className="min-h-full bg-[#F4F5F7]">
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">{t('suppliers.title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('suppliers.subtitle')}</p>
      </div>

      {/* Supplier cards */}
      <div className="px-4 pb-6 space-y-3">
        {SUPPLIERS.map((supplier) => (
          <div
            key={supplier.id}
            className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden"
          >
            {/* Cover banner */}
            <div
              className="h-16 w-full"
              style={{ background: supplier.coverGradient }}
            />

            {/* Card body */}
            <div className="px-4 pb-4">
              {/* Avatar + name row */}
              <div className="flex items-end gap-3 -mt-6 mb-3">
                <div
                  className="h-14 w-14 rounded-xl border-2 border-white shadow-md flex items-center justify-center text-white font-bold text-base shrink-0"
                  style={{ background: supplier.avatarColor }}
                >
                  {supplier.initials}
                </div>
                <div className="flex-1 min-w-0 pb-0.5">
                  <p className="font-bold text-sm leading-tight truncate">{supplier.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{supplier.specialty}</p>
                </div>
                {/* Rating badge */}
                <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full shrink-0">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span className="text-xs font-bold text-amber-600">{supplier.rating}</span>
                </div>
              </div>

              {/* Location */}
              <div className="flex items-center gap-1.5 mb-3">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground">{supplier.location}</p>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-3 mb-3">
                <div className="text-center">
                  <p className="text-sm font-bold">{supplier.productCount}</p>
                  <p className="text-[10px] text-muted-foreground">Produits</p>
                </div>
                <div className="w-px h-6 bg-border" />
                <div className="text-center">
                  <p className="text-sm font-bold">{supplier.yearsActive}</p>
                  <p className="text-[10px] text-muted-foreground">Ans</p>
                </div>
                <div className="w-px h-6 bg-border" />
                <div className="text-center">
                  <p className="text-sm font-bold">{supplier.reviewCount}</p>
                  <p className="text-[10px] text-muted-foreground">Avis</p>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {supplier.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-[#F4F5F7] px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
                {supplier.tags.length > 3 && (
                  <span className="rounded-full bg-[#F4F5F7] px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    +{supplier.tags.length - 3}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <a
                  href={`tel:${supplier.phone}`}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/30 transition-colors flex-1"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {t('common.contact')}
                </a>
                <a
                  href={`mailto:${supplier.email}`}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/30 transition-colors flex-1"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </a>
                <Link
                  to={`/suppliers/${supplier.id}`}
                  className="flex items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold text-white flex-1"
                  style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
                >
                  Profil
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
