// The editorial calendar of the social media section: proposes explainer, news, promo and event posters for the months ahead (the admin edits and validates them),
// and converts Haiti local times to the UTC instants stored in the database. Pure functions: unit-tested.
import type { InfoInput } from '@/lib/poster-draw'
import { assetById } from '@/lib/social-assets'
import { EVENTS, EVERGREEN, addDays, dayNumber, sameDay, weekdayOf, type CalendarKind, type CalendarLayout, type PosterText, type YMD } from '@/lib/social-templates'

export { plainHeadline, type CalendarKind, type CalendarLayout, type YMD } from '@/lib/social-templates'

export const CALENDAR_KINDS: CalendarKind[] = ['event', 'explainer', 'news', 'promo']
export type SocialTarget = 'facebook' | 'instagram'

export type CalendarStatus = 'proposed' | 'approved' | 'rejected' | 'posting' | 'posted' | 'failed'

/** A poster of the calendar as the database stores it (what a proposal is made of). */
export interface CalendarDraft {
  kind: CalendarKind
  layout: CalendarLayout
  /** The id of the stock photo (src/lib/social-assets.ts), null for a plain background. */
  asset: string | null
  badge: string | null
  headline: string
  subline: string | null
  bullets: string[]
  caption: string
  targets: SocialTarget[]
  /** UTC instant (ISO). */
  scheduled_at: string
  batch: string
}

/** A row of `social_calendar`. */
export interface CalendarRow extends Omit<CalendarDraft, 'batch'> {
  id: string
  status: CalendarStatus
  facebook_post_id: string | null
  instagram_media_id: string | null
  error: string | null
  attempts: number
  batch: string | null
  updated_at: string
}
export const CALENDAR_COLUMNS = 'id, kind, layout, asset, badge, headline, subline, bullets, caption, targets, scheduled_at, status, facebook_post_id, instagram_media_id, error, attempts, batch, updated_at'

/** What the drawing needs of a poster (the explainers have numbered steps). */
export function infoInputOf(p: Pick<CalendarDraft, 'kind' | 'layout' | 'asset' | 'badge' | 'headline' | 'subline' | 'bullets'>): InfoInput {
  const a = assetById(p.asset)
  return { layout: p.layout, badge: p.badge, headline: p.headline, subline: p.subline, bullets: p.bullets, numbered: p.kind === 'explainer', focus: a?.focus, bg: a?.bg ?? null }
}

export const HAITI_ZONE = 'America/Port-au-Prince'
const ZONE = HAITI_ZONE
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
/** Hours (Haiti) of the evergreen posts, in turn. */
const EVERGREEN_HOURS = [12, 18]
/** The weekdays (0 = Sunday) used for 1 to 7 posts a week. */
const WEEK_PATTERNS: Record<number, number[]> = { 1: [2], 2: [2, 5], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] }
/** The same poster is not proposed again within this many days. */
const REPEAT_GAP_DAYS = 21
const MAX_DRAFTS = 200

const FOOTER = '👉 Commandez sur konvwa.shop\n💳 Paiement MonCash / NatCash\n\n#Haiti #KONVWA #Importation #ShoppingHaiti'

// ── Haiti time ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Offset (minutes) of Haiti's clock from UTC at an instant. */
function zoneOffset(ms: number): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ms))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  return Math.round((Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - Math.floor(ms / 1000) * 1000) / 60000)
}

/** The UTC instant of a Haiti local date and time (daylight saving time included). */
export function haitiToUtc(day: YMD, hour: number, minute = 0): Date {
  const guess = Date.UTC(day.y, day.m - 1, day.d, hour, minute)
  const first = guess - zoneOffset(guess) * 60000
  return new Date(guess - zoneOffset(first) * 60000)
}

/** The Haiti calendar day of an instant. */
export function haitiDay(at: Date): YMD {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  return { y: get('year'), m: get('month'), d: get('day') }
}

/** "dimanche 31 mai" */
export const dateFr = (d: YMD) => `${DAYS[weekdayOf(d)]} ${d.d} ${MONTHS[d.m - 1]}`

/** The `<input type="datetime-local">` value (Haiti time) of an instant, and the instant of such a value. */
export function toHaitiInput(iso: string): string {
  const at = new Date(iso)
  const day = haitiDay(at)
  const hm = new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).format(at)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${day.y}-${p(day.m)}-${p(day.d)}T${hm}`
}
export function fromHaitiInput(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  return m ? haitiToUtc({ y: +m[1], m: +m[2], d: +m[3] }, +m[4], +m[5]).toISOString() : null
}

// ── The proposal ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface ProposeOptions {
  /** First Haiti day of the period. */
  from: YMD
  months: number
  /** Evergreen posters a week (1-7). */
  perWeek: number
  kinds: CalendarKind[]
  /** The WhatsApp channel link: posters about the channel are only proposed when it is set. */
  channelUrl: string | null
  /** Posters already in the calendar: the same one is not proposed twice close together. */
  existing: Array<{ headline: string; scheduled_at: string }>
  /** Nothing is proposed before this instant. */
  now: Date
}

const withFooter = (t: PosterText, channelUrl: string | null, channel: boolean) => `${t.caption}${channel && channelUrl ? `\n\n💬 Rejoignez la chaîne : ${channelUrl}` : ''}\n\n${FOOTER}`

function draft(t: PosterText, kind: CalendarKind, day: YMD, hour: number, batch: string, channelUrl: string | null, channel = false): CalendarDraft {
  return {
    kind, layout: t.layout, asset: t.asset, badge: t.badge || null, headline: t.headline, subline: t.subline || null, bullets: t.bullets, caption: withFooter(t, channelUrl, channel),
    targets: ['facebook', 'instagram'], scheduled_at: haitiToUtc(day, hour).toISOString(), batch,
  }
}

/**
 * The calendar proposed for a period: the events of the period (greetings and countdowns on their own dates) and, on `perWeek` days a week, an explainer,
 * a piece of news or a promo in turn. The same evergreen poster is never proposed twice within 3 weeks (existing posters count), nothing falls in the past,
 * and a day that already holds an event poster gets no extra one.
 */
export function proposeCalendar(o: ProposeOptions): CalendarDraft[] {
  const months = Math.min(12, Math.max(1, Math.floor(o.months)))
  const perWeek = Math.min(7, Math.max(1, Math.floor(o.perWeek)))
  const end = addMonths(o.from, months)
  const batch = `${String(o.from.y)}-${String(o.from.m).padStart(2, '0')} · ${months} mois`
  const wantEvents = o.kinds.includes('event')
  const out: CalendarDraft[] = []

  // events, on their own dates
  if (wantEvents || o.kinds.includes('promo')) {
    for (let y = o.from.y; y <= end.y; y++) {
      for (const ev of EVENTS) {
        const when = ev.when(y)
        for (const p of ev.posts(y)) {
          if (!o.kinds.includes(p.kind)) continue
          const day = addDays(when, -p.before)
          if (dayNumber(day) < dayNumber(o.from) || dayNumber(day) >= dayNumber(end)) continue
          out.push(draft(p, p.kind, day, p.hour, batch, o.channelUrl))
        }
      }
    }
  }
  const eventDays = out.map((d) => haitiDay(new Date(d.scheduled_at)))

  // evergreen posters, in turn over the selected kinds (explainers twice as often as news or promos)
  const pool = (['explainer', 'news', 'explainer', 'promo'] as const).filter((k) => o.kinds.includes(k))
  if (pool.length > 0) {
    const days = WEEK_PATTERNS[perWeek]
    const usable = EVERGREEN.filter((t) => !t.needsChannel || o.channelUrl)
    const placed: Array<{ id: string; day: number }> = []
    // an existing poster counts as "placed" when its headline is one of the evergreen ones
    for (const e of o.existing) {
      const t = EVERGREEN.find((x) => x.headline === e.headline)
      if (t) placed.push({ id: t.id, day: dayNumber(haitiDay(new Date(e.scheduled_at))) })
    }
    const cursor: Record<string, number> = { explainer: startOffset(o.from), news: startOffset(o.from), promo: startOffset(o.from) }
    let turn = 0
    let n = 0
    for (let day = o.from; dayNumber(day) < dayNumber(end); day = addDays(day, 1)) {
      if (!days.includes(weekdayOf(day)) || eventDays.some((d) => sameDay(d, day))) continue
      // the next poster of the kind whose turn it is that has not been proposed in the last 3 weeks (the next kinds are tried when it has none left)
      let chosen = null as (typeof usable)[number] | null
      for (let attempt = 0; attempt < pool.length && !chosen; attempt++) {
        const kind = pool[(turn + attempt) % pool.length]
        const list = usable.filter((t) => t.kind === kind)
        for (let k = 0; k < list.length && !chosen; k++) {
          const cand = list[(cursor[kind] + k) % list.length]
          if (!placed.some((p) => p.id === cand.id && Math.abs(p.day - dayNumber(day)) < REPEAT_GAP_DAYS)) { chosen = cand; cursor[kind] = (cursor[kind] + k + 1) % list.length }
        }
      }
      turn++
      if (!chosen) continue
      placed.push({ id: chosen.id, day: dayNumber(day) })
      out.push(draft(chosen, chosen.kind, day, EVERGREEN_HOURS[n++ % EVERGREEN_HOURS.length], batch, o.channelUrl, !!chosen.needsChannel))
    }
  }

  // nothing in the past, nothing already in the calendar (same headline on the same Haiti day), in date order
  const known = new Set(o.existing.map((e) => `${e.headline}|${dayNumber(haitiDay(new Date(e.scheduled_at)))}`))
  return out
    .filter((d) => new Date(d.scheduled_at).getTime() > o.now.getTime() + 5 * 60000 && !known.has(`${d.headline}|${dayNumber(haitiDay(new Date(d.scheduled_at)))}`))
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
    .slice(0, MAX_DRAFTS)
}

/** A start position in each kind's list that depends on the week, so that two runs on different weeks do not start with the same poster. */
function startOffset(from: YMD): number { return Math.floor(dayNumber(from) / 7) % 97 }

/** The same day `months` months later (the last day of a shorter month is kept). */
export function addMonths(a: YMD, months: number): YMD {
  const total = a.y * 12 + (a.m - 1) + months
  const y = Math.floor(total / 12); const m = (total % 12) + 1
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { y, m, d: Math.min(a.d, last) }
}

