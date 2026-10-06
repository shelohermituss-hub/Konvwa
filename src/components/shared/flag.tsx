import { flagFor } from '@/lib/supplier-badges'
import { cn } from '@/lib/utils'

/** ISO country code from a flag emoji (two regional-indicator letters), e.g. the value stored in the database. */
export function codeFromEmoji(emoji: string | null | undefined): string | null {
  const pts = Array.from(emoji ?? '').map((c) => c.codePointAt(0) ?? 0)
  if (pts.length < 2 || pts.some((p) => p < 0x1f1e6 || p > 0x1f1ff)) return null
  return String.fromCharCode(pts[0] - 0x1f1e6 + 65, pts[1] - 0x1f1e6 + 65)
}

/** Flag emoji of a country code: kept only to fill the legacy `flag_emoji` column. */
export function emojiFromCode(code: string): string {
  const c = code.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(c) ? String.fromCodePoint(...Array.from(c).map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)) : ''
}

/** A real flag picture (from /public/flags), from a country code or a stored flag emoji. Shows the code when there is no picture. */
export function Flag({ code, emoji, className }: { code?: string | null; emoji?: string | null; className?: string }) {
  const iso = (code ?? codeFromEmoji(emoji) ?? '').toUpperCase()
  const flag = flagFor(iso)
  if (!flag) return iso ? <span className={cn('inline-block rounded bg-muted px-1 text-[10px] font-bold leading-4 text-muted-foreground', className)}>{iso}</span> : null
  return <img src={flag.src} alt={flag.code} loading="lazy" className={cn('inline-block h-[1em] w-auto shrink-0 rounded-[2px] align-[-0.125em] shadow-[0_0_0_1px_rgba(0,0,0,0.08)]', className)} />
}
