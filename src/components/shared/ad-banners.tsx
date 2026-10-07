import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Megaphone } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { LANG, tr } from '@/lib/i18n'
import { MuteButton, useAdVideo } from '@/components/shared/ad-video'

export interface Ad {
  id: string
  eyebrow: string | null
  eyebrow_en: string | null
  title: string
  title_en: string | null
  subtitle: string | null
  subtitle_en: string | null
  media_type: 'image' | 'video'
  media_path: string | null
  link_url: string | null
  active: boolean
  sort_order: number
  starts_at: string | null
  ends_at: string | null
  placement: 'banner' | 'feed' | 'both'
}

export const AD_COLUMNS = 'id, eyebrow, eyebrow_en, title, title_en, subtitle, subtitle_en, media_type, media_path, link_url, active, sort_order, starts_at, ends_at, placement'

export function adMediaUrl(path: string | null): string | null {
  return path ? supabase.storage.from('ads').getPublicUrl(path).data.publicUrl : null
}

const pick = (fr: string | null, en: string | null) => (LANG === 'en' && en ? en : fr)

/** One advertising card: media on top, small caps label, bold title, grey subtitle (App Store "Today" style). */
export function AdCard({ ad, mediaSrc }: { ad: Ad; mediaSrc?: string | null }) {
  const src = mediaSrc ?? adMediaUrl(ad.media_path)
  const eyebrow = pick(ad.eyebrow, ad.eyebrow_en)
  const subtitle = pick(ad.subtitle, ad.subtitle_en)
  const title = pick(ad.title, ad.title_en) ?? ''
  const video = useAdVideo()

  const body = (
    <article className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-[#F05A28] to-[#0A1628]">
        {src && ad.media_type === 'video' ? (
          <video
            ref={video.ref}
            src={src}
            className="absolute inset-0 h-full w-full object-cover"
            muted loop playsInline preload="metadata"
            aria-label={title}
          />
        ) : src ? (
          <img src={src} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <Megaphone className="absolute inset-0 m-auto h-12 w-12 text-white/60" aria-hidden />
        )}
      </div>
      <div className="space-y-1 px-5 pb-5 pt-4">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{eyebrow}</p>}
        <h3 className="text-xl font-extrabold leading-tight tracking-tight text-foreground">{title}</h3>
        {subtitle && <p className="text-sm leading-snug text-muted-foreground">{subtitle}</p>}
      </div>
    </article>
  )

  const linkClass = 'pressable block rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'
  const wrapped = !ad.link_url ? body
    : ad.link_url.startsWith('/') ? <Link to={ad.link_url} className={linkClass}>{body}</Link>
    : <a href={ad.link_url} target="_blank" rel="noopener noreferrer" className={linkClass}>{body}</a>
  if (!(src && ad.media_type === 'video')) return wrapped
  // the sound button sits next to the link, not inside it, so tapping it never opens the ad
  return (
    <div className="relative">
      {wrapped}
      <MuteButton muted={video.muted} onToggle={video.toggle} className="right-3 top-3" />
    </div>
  )
}

/** Live ads configured in the admin (the database only returns the active ones inside their schedule). */
export function AdBanners() {
  const [ads, setAds] = useState<Ad[]>([])

  useEffect(() => {
    let cancelled = false
    void supabase.from('ad_banners').select(AD_COLUMNS).eq('active', true).in('placement', ['banner', 'both'])
      .order('sort_order', { ascending: true }).order('created_at', { ascending: false }).limit(6)
      .then(({ data }) => { if (!cancelled && data) setAds(data as Ad[]) })
    return () => { cancelled = true }
  }, [])

  if (ads.length === 0) return null
  return (
    <section className="mb-5 space-y-4" aria-label={tr('Publicités')}>
      {ads.map((ad) => <AdCard key={ad.id} ad={ad} />)}
    </section>
  )
}
