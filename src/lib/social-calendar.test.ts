import { describe, expect, it } from 'vitest'
import { addMonths, dateFr, fromHaitiInput, haitiDay, haitiToUtc, plainHeadline, proposeCalendar, toHaitiInput, type CalendarDraft, type ProposeOptions } from './social-calendar'
import { SOCIAL_ASSETS, assetById } from './social-assets'
import { EVENTS, EVERGREEN, easter, lastWeekday, nthWeekday } from './social-templates'

describe('Haiti time', () => {
  it('converts a Haiti local time to UTC, summer and winter', () => {
    expect(haitiToUtc({ y: 2026, m: 11, d: 27 }, 12).toISOString()).toBe('2026-11-27T17:00:00.000Z')
    expect(haitiToUtc({ y: 2026, m: 7, d: 1 }, 12).toISOString()).toBe('2026-07-01T16:00:00.000Z')
  })
  it('round-trips through the form value, also around the clock changes', () => {
    for (const iso of ['2026-11-27T17:00:00.000Z', '2026-07-01T16:30:00.000Z', '2027-03-14T12:00:00.000Z', '2026-11-01T14:00:00.000Z']) {
      expect(fromHaitiInput(toHaitiInput(iso))).toBe(iso)
    }
    expect(fromHaitiInput('nope')).toBeNull()
  })
  it('knows the Haiti day of an instant (late evening UTC is still the day before in Haiti)', () => {
    expect(haitiDay(new Date('2026-12-25T03:00:00Z'))).toEqual({ y: 2026, m: 12, d: 24 })
    expect(dateFr({ y: 2026, m: 5, d: 31 })).toBe('dimanche 31 mai')
  })
  it('adds months and keeps the last day of a shorter month', () => {
    expect(addMonths({ y: 2026, m: 11, d: 30 }, 3)).toEqual({ y: 2027, m: 2, d: 28 })
    expect(addMonths({ y: 2026, m: 10, d: 18 }, 3)).toEqual({ y: 2027, m: 1, d: 18 })
  })
})

describe('event dates', () => {
  it('computes the moving ones', () => {
    expect(easter(2026)).toEqual({ y: 2026, m: 4, d: 5 })
    expect(easter(2027)).toEqual({ y: 2027, m: 3, d: 28 })
    expect(nthWeekday(2026, 11, 5, 4)).toEqual({ y: 2026, m: 11, d: 27 }) // Black Friday
    expect(lastWeekday(2026, 5, 0)).toEqual({ y: 2026, m: 5, d: 31 }) // Mothers' Day in Haiti
    expect(nthWeekday(2026, 6, 0, 3)).toEqual({ y: 2026, m: 6, d: 21 }) // Fathers' Day
    expect(EVENTS.find((e) => e.id === 'carnival')?.when(2027)).toEqual({ y: 2027, m: 2, d: 7 })
  })
})

const base: ProposeOptions = {
  from: { y: 2026, m: 10, d: 18 }, months: 3, perWeek: 3, kinds: ['event', 'explainer', 'news', 'promo'], channelUrl: null, existing: [], now: new Date('2026-10-18T12:00:00Z'),
}
const dayOf = (d: CalendarDraft) => haitiDay(new Date(d.scheduled_at))
const key = (d: CalendarDraft) => `${dayOf(d).m}-${dayOf(d).d}`

describe('proposeCalendar', () => {
  const all = proposeCalendar(base)

  it('puts the events of the period on their dates, countdowns included', () => {
    const on = (headline: string) => all.filter((d) => plainHeadline(d.headline) === headline).map(key)
    expect(on('Honneur à Jean-Jacques Dessalines')).toEqual([]) // 17 October is before the start
    expect(on('Anniversaire de la bataille de Vertières')).toEqual(['11-18'])
    expect(on('Le Black Friday approche chez KONVWA')).toEqual(['11-23'])
    expect(on('C’est le Black Friday sur KONVWA')).toEqual(['11-27'])
    expect(on('Noël approche : trouvez vos cadeaux')).toEqual(['12-13'])
    expect(on('Joyeux Noël !')).toEqual(['12-25'])
    expect(on('Bonne année 2027 !')).toEqual(['1-1'])
    expect(on('Bonne fête de l’Indépendance, Haïti !')).toEqual(['1-1'])
  })

  it('is in date order, in the future, and writes the evergreen posters on the chosen weekdays', () => {
    const times = all.map((d) => d.scheduled_at)
    expect(times).toEqual([...times].sort())
    expect(all.every((d) => new Date(d.scheduled_at).getTime() > base.now.getTime())).toBe(true)
    const evergreen = all.filter((d) => EVERGREEN.some((t) => t.headline === d.headline))
    // 3 a week (Mon, Wed, Fri) over 13 weeks, minus the days that hold an event
    expect(evergreen.length).toBeGreaterThan(30)
    expect(evergreen.length).toBeLessThanOrEqual(40)
    for (const d of evergreen) expect([1, 3, 5]).toContain(new Date(`${dayOf(d).y}-${String(dayOf(d).m).padStart(2, '0')}-${String(dayOf(d).d).padStart(2, '0')}T12:00:00Z`).getUTCDay())
  })

  it('never proposes the same evergreen poster twice within three weeks, and no extra poster on an event day', () => {
    const seen = new Map<string, number>()
    const eventDays = new Set(all.filter((d) => !EVERGREEN.some((t) => t.headline === d.headline)).map((d) => `${dayOf(d).y}-${dayOf(d).m}-${dayOf(d).d}`))
    for (const d of all.filter((x) => EVERGREEN.some((t) => t.headline === x.headline))) {
      const n = Math.floor(new Date(d.scheduled_at).getTime() / 86400000)
      expect(n - (seen.get(d.headline) ?? -100)).toBeGreaterThanOrEqual(21)
      seen.set(d.headline, n)
      expect(eventDays.has(`${dayOf(d).y}-${dayOf(d).m}-${dayOf(d).d}`)).toBe(false)
    }
  })

  it('only proposes the selected kinds', () => {
    const explainers = proposeCalendar({ ...base, kinds: ['explainer'] })
    expect(explainers.length).toBeGreaterThan(20)
    expect(explainers.every((d) => d.kind === 'explainer')).toBe(true)
    const events = proposeCalendar({ ...base, kinds: ['event'] })
    expect(events.every((d) => d.kind === 'event')).toBe(true)
    expect(events.some((d) => plainHeadline(d.headline) === 'Joyeux Noël !')).toBe(true)
    expect(proposeCalendar({ ...base, kinds: [] })).toEqual([])
  })

  it('proposes the WhatsApp channel posters only when the channel link is set, with the link in the text', () => {
    expect(all.some((d) => /chaîne WhatsApp|sur WhatsApp/.test(plainHeadline(d.headline)))).toBe(false)
    const withChannel = proposeCalendar({ ...base, channelUrl: 'https://whatsapp.com/channel/abc', months: 6, perWeek: 7 })
    const channel = withChannel.filter((d) => /chaîne WhatsApp|sur WhatsApp/.test(plainHeadline(d.headline)))
    expect(channel.length).toBeGreaterThan(0)
    expect(channel.every((d) => d.caption.includes('https://whatsapp.com/channel/abc'))).toBe(true)
  })

  it('skips what is already in the calendar and counts it for the three-week gap', () => {
    const first = all.find((d) => EVERGREEN.some((t) => t.headline === d.headline))!
    const again = proposeCalendar({ ...base, existing: [{ headline: first.headline, scheduled_at: first.scheduled_at }] })
    expect(again.some((d) => d.headline === first.headline && d.scheduled_at === first.scheduled_at)).toBe(false)
    const sameWeek = proposeCalendar({ ...base, existing: [{ headline: first.headline, scheduled_at: new Date(new Date(first.scheduled_at).getTime() - 2 * 86400000).toISOString() }] })
    const near = sameWeek.filter((d) => d.headline === first.headline && Math.abs(new Date(d.scheduled_at).getTime() - new Date(first.scheduled_at).getTime()) < 19 * 86400000)
    expect(near).toEqual([])
  })

  it('every proposal fits the database limits and goes to both networks', () => {
    const wide = proposeCalendar({ ...base, from: { y: 2026, m: 1, d: 1 }, now: new Date('2025-12-01T00:00:00Z'), months: 12, perWeek: 7, channelUrl: 'https://whatsapp.com/channel/0029VbDA3fdKbYMUMoHenX0d' })
    expect(wide.length).toBeGreaterThan(100)
    for (const d of wide) {
      expect(d.headline.length).toBeGreaterThanOrEqual(3); expect(d.headline.length).toBeLessThanOrEqual(120)
      expect((d.subline ?? '').length).toBeLessThanOrEqual(200)
      expect((d.badge ?? '').length).toBeLessThanOrEqual(40)
      expect(d.bullets.length).toBeLessThanOrEqual(4)
      expect(d.bullets.join('').length).toBeLessThanOrEqual(360)
      expect(d.bullets.every((b) => b.length <= 90)).toBe(true)
      expect(d.caption.length).toBeLessThanOrEqual(2000)
      expect(d.targets).toEqual(['facebook', 'instagram'])
      expect(d.headline.replace(/[^*]/g, '').length % 2).toBe(0)
      expect(['photo', 'studio']).toContain(d.layout)
      const a = assetById(d.asset)
      expect(a, `${d.headline}: unknown photo ${d.asset}`).not.toBeNull()
      expect(a?.layouts, `${d.headline}: the photo does not suit the ${d.layout} layout`).toContain(d.layout)
    }
  })
})

describe('stock photos', () => {
  it('the Edge Function copy of the manifest is identical to the browser source', async () => {
    const { readFileSync } = await import('node:fs')
    expect(readFileSync('supabase/functions/facebook-post/assets.ts', 'utf8')).toBe(readFileSync('src/lib/social-assets.ts', 'utf8'))
  })
  it('every photo of the manifest has its file and a valid studio background', async () => {
    const { existsSync } = await import('node:fs')
    for (const a of SOCIAL_ASSETS) {
      expect(existsSync(`public/social-assets/${a.id}.jpg`), a.id).toBe(true)
      expect(existsSync(`public/social-assets/t/${a.id}.jpg`), `${a.id} thumb`).toBe(true)
      expect(a.id).toMatch(/^[a-z0-9-]{1,60}$/)
      if (a.layouts.includes('studio')) expect(a.bg, a.id).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})
