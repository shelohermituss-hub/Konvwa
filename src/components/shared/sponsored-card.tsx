import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Megaphone } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { LANG, tr } from '@/lib/i18n'
import { MuteButton, useAdVideo } from '@/components/shared/ad-video'
import { AD_COLUMNS, adMediaUrl, type Ad } from '@/components/shared/ad-banners'

const pick = (fr: string | null, en: string | null) => (LANG === 'en' && en ? en : fr)

/** Ads meant for the product feed (the database only returns the live ones), loaded once per visit. */
let cache: Promise<Ad[]> | null = null
export function useFeedAds(): Ad[] {
  const [ads, setAds] = useState<Ad[]>([])
  useEffect(() => {
    let cancelled = false
    cache ??= Promise.resolve(supabase.from('ad_banners').select(AD_COLUMNS).eq('active', true).in('placement', ['feed', 'both'])
      .order('sort_order', { ascending: true }).order('created_at', { ascending: false }).limit(12))
      .then(({ data }) => (data ?? []) as Ad[]).catch(() => [])
    void cache.then((list) => { if (!cancelled) setAds(list) })
    return () => { cancelled = true }
  }, [])
  return ads
}

/** An ad dressed like a product card (picture, title, text), always marked "Sponsorisé". */
export function SponsoredCard({ ad }: { ad: Ad }) {
  const navigate = useNavigate()
  const video = useAdVideo()
  const src = adMediaUrl(ad.media_path)
  const title = pick(ad.title, ad.title_en) ?? ''
  const subtitle = pick(ad.subtitle, ad.subtitle_en)
  const advertiser = pick(ad.eyebrow, ad.eyebrow_en)

  function open() {
    if (!ad.link_url) return
    if (ad.link_url.startsWith('/')) navigate(ad.link_url)
    else window.open(ad.link_url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="relative mb-3 break-inside-avoid">
      <button
        type="button"
        onClick={open}
        disabled={!ad.link_url}
        aria-label={`${tr('Sponsorisé')} : ${title}`}
        className="block w-full overflow-hidden rounded-2xl border border-gray-100 bg-white text-left shadow-sm transition-transform duration-100 active:scale-[0.98] disabled:cursor-default disabled:active:scale-100"
      >
        <div className="relative min-h-32 bg-gray-50">
          {src && ad.media_type === 'video' ? (
            <video ref={video.ref} src={src} className="block h-auto w-full" muted loop playsInline preload="metadata" aria-hidden />
          ) : src ? (
            <img src={src} alt="" loading="lazy" className="block h-auto w-full" />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center bg-gradient-to-br from-[#F05A28] to-[#0A1628]"><Megaphone className="h-10 w-10 text-white/60" aria-hidden /></div>
          )}
          <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">{tr('Sponsorisé')}</span>
        </div>
        <div className="space-y-1.5 p-3">
          <p className="line-clamp-2 text-[13px] leading-snug text-foreground">{title}</p>
          {subtitle && <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">{subtitle}</p>}
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className="rounded bg-muted px-1 font-semibold uppercase tracking-wide">{tr('Sponsorisé')}</span>
            {advertiser && <span className="truncate">{advertiser}</span>}
          </p>
        </div>
      </button>
      {src && ad.media_type === 'video' && <MuteButton muted={video.muted} onToggle={video.toggle} className="right-2 top-2" />}
    </div>
  )
}
