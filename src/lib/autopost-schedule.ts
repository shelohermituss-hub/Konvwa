// The times (Haiti) of the automatic product posters: one poster per time, so the number of posters a day is the number of times.
// The database validates the same rules (admin_set_autopost_schedule); these helpers are for the form.

export const MAX_SLOTS = 12
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/** The valid times of a list, without duplicates, in order. */
export function normalizeTimes(times: string[]): string[] {
  return [...new Set(times.map((t) => t.trim()).filter((t) => TIME_RE.test(t)))].sort()
}

/** The setting's value ("07:00,10:00") as a list. */
export const parseTimes = (value: string | null | undefined): string[] => normalizeTimes((value ?? '').split(','))

/** `count` times spread evenly from `from` to `to` (inclusive), rounded to 5 minutes. */
export function spreadTimes(count: number, from: string, to: string): string[] {
  const n = Math.min(MAX_SLOTS, Math.max(1, Math.floor(count)))
  if (!TIME_RE.test(from) || !TIME_RE.test(to)) return []
  const a = Math.min(toMinutes(from), toMinutes(to)); const b = Math.max(toMinutes(from), toMinutes(to))
  if (n === 1) return [toTime(a)]
  return normalizeTimes(Array.from({ length: n }, (_, i) => toTime(Math.round((a + ((b - a) * i) / (n - 1)) / 5) * 5)))
}
