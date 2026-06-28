import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Star, MapPin, ChevronRight } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { SUPPLIERS } from '@/lib/suppliers-data'
import { cn } from '@/lib/utils'

export function SuppliersPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const filtered = SUPPLIERS.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.specialty.toLowerCase().includes(search.toLowerCase()) ||
      s.location.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-full bg-[#F4F5F7]">
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">{t('suppliers.title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {filtered.length} {t('suppliers.subtitle').toLowerCase()}
        </p>
      </div>

      {/* Search */}
      <div className="px-4 pb-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 h-11 rounded-xl bg-white border border-gray-200 text-sm font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
          />
        </div>
      </div>

      {/* Table card */}
      <div className="px-4 pb-6">
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          {/* Column header */}
          <div className="grid grid-cols-[1fr_auto] items-center px-4 py-2.5 border-b border-gray-100 bg-gray-50/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
              Fournisseur
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
              Note
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="py-14 text-center text-sm text-muted-foreground">
              {t('common.no_result')}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map((supplier) => (
                <button
                  key={supplier.id}
                  onClick={() => navigate(`/suppliers/${supplier.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left"
                >
                  {/* Avatar */}
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ background: supplier.avatarColor }}
                  >
                    {supplier.initials}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {supplier.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                      <p className="text-xs text-muted-foreground truncate">{supplier.location}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">
                      {supplier.specialty}
                    </p>
                  </div>

                  {/* Rating + chevron */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <div className={cn(
                      'flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold',
                      supplier.rating >= 4.8
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-600'
                    )}>
                      <Star className="h-2.5 w-2.5 fill-current" />
                      {supplier.rating}
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
