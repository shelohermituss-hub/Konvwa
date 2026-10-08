/** Only a real WhatsApp channel invitation is accepted (https, whatsapp.com/channel/<code>): the value comes from the database and ends up in a link. */
export function channelUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const v = raw.trim()
  return /^https:\/\/(?:www\.)?whatsapp\.com\/channel\/[A-Za-z0-9_-]{8,64}\/?$/.test(v) ? v : null
}
