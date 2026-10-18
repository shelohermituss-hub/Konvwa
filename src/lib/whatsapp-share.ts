// Sharing a poster and its text on WhatsApp from the admin: the phone's share sheet when the browser can send a picture (the person picks the contact or group),
// otherwise the picture is downloaded and WhatsApp opens with the text. WhatsApp channels cannot be posted to by a program: the picture is downloaded, the text
// copied, and the channel opened so that the admin only has to paste.

export interface Shareable { text: string; image: Blob; filename: string }

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export const whatsappTextLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`

/** 'shared' (share sheet used), 'cancelled' (the person closed it), 'fallback' (picture downloaded, WhatsApp opened with the text); `blocked` = the browser stopped the new tab. */
export async function shareOnWhatsApp(s: Shareable): Promise<{ result: 'shared' | 'cancelled' | 'fallback'; link: string; blocked: boolean }> {
  const link = whatsappTextLink(s.text)
  const file = new File([s.image], s.filename, { type: s.image.type || 'image/jpeg' })
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: s.text })
      return { result: 'shared', link, blocked: false }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return { result: 'cancelled', link, blocked: false }
      // another error (no permission after a long wait, unsupported target): the download + link below still works
    }
  }
  downloadBlob(s.image, s.filename)
  const w = window.open(link, '_blank', 'noopener,noreferrer')
  return { result: 'fallback', link, blocked: !w }
}

/** For the channel: downloads the picture, copies the text and opens the channel. `copied` tells whether the text is on the clipboard. */
export async function prepareChannelPost(s: Shareable, channelUrl: string): Promise<{ copied: boolean; blocked: boolean }> {
  downloadBlob(s.image, s.filename)
  const copied = await navigator.clipboard.writeText(s.text).then(() => true, () => false)
  const w = window.open(channelUrl, '_blank', 'noopener,noreferrer')
  return { copied, blocked: !w }
}
