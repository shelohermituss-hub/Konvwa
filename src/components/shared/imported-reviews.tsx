import { useEffect, useState } from 'react'
import { ExternalLink, Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { tr, DATE_LOCALE } from '@/lib/i18n'

interface ImportedReview {
  id: string
  source: string
  author_name: string
  rating: number
  title: string
  comment: string
  reviewed_at: string | null
  source_url: string | null
}

const SOURCE_NAMES: Record<string, string> = { amazon: 'Amazon', muscle_strength: 'Muscle & Strength', alibaba: 'Alibaba', shein: 'Shein', temu: 'Temu', walmart: 'Walmart', aliexpress: 'AliExpress', ebay: 'eBay' }

/** Reviews written on the supplier's site, read at import time: shown apart from KONVWA customers' reviews, always with their source. */
export function ImportedReviews({ productId }: { productId: string }) {
  const [reviews, setReviews] = useState<ImportedReview[]>([])

  useEffect(() => {
    let alive = true
    supabase.from('imported_reviews').select('id, source, author_name, rating, title, comment, reviewed_at, source_url')
      .eq('product_id', productId).order('reviewed_at', { ascending: false, nullsFirst: false }).limit(20)
      .then(({ data }) => { if (alive) setReviews((data ?? []) as ImportedReview[]) })
    return () => { alive = false }
  }, [productId])

  if (reviews.length === 0) return null
  const source = SOURCE_NAMES[reviews[0].source] ?? reviews[0].source
  const link = reviews[0].source_url && /^https:\/\//i.test(reviews[0].source_url) ? reviews[0].source_url : null

  return (
    <section id="section-imported-reviews" className="scroll-mt-28 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <h2 className="text-base font-bold tracking-tight">{tr('Avis du site d\'origine')}</h2>
      <p className="mb-3 mt-1 text-xs text-muted-foreground">
        {tr('Avis publiés sur {0}, pas par des clients KONVWA.', source)}
        {link && (
          <>{' '}<a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-primary">{tr('Voir sur {0}', source)}<ExternalLink className="h-3 w-3" aria-hidden /></a></>
        )}
      </p>
      <ul className="divide-y divide-gray-100">
        {reviews.map((r) => (
          <li key={r.id} className="py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold">{r.author_name}</span>
              <span className="inline-flex shrink-0" aria-label={tr('{0} sur 5', r.rating)}>
                {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={cn('h-4 w-4', n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300')} />)}
              </span>
            </div>
            {r.title && <p className="mt-1 text-sm font-semibold">{r.title}</p>}
            {r.comment && <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{r.comment}</p>}
            <p className="mt-1 text-xs text-muted-foreground">
              {SOURCE_NAMES[r.source] ?? r.source}{r.reviewed_at ? ` · ${new Date(r.reviewed_at).toLocaleDateString(DATE_LOCALE)}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
