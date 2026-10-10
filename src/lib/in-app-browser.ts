/** Apps that open links in their own embedded browser (Facebook, Instagram, Messenger, TikTok, Snapchat, Line): no app install, no push, and Google sign-in is refused there. */
const IN_APP = /(FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger|TikTok|musical_ly|Snapchat|Line\/)/i

export function isInAppBrowser(ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): boolean {
  return IN_APP.test(ua)
}

/** Android can hand the page to Chrome with an intent link; iOS has no such link (the person must use the menu → "Open in Safari"). */
export function chromeIntentUrl(href: string): string | null {
  try {
    const u = new URL(href)
    return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(':', '')};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(href)};end`
  } catch { return null }
}

export function isAndroid(ua: string = navigator.userAgent): boolean {
  return /Android/i.test(ua)
}
