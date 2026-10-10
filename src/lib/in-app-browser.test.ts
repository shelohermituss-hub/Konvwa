import { describe, expect, it } from 'vitest'
import { chromeIntentUrl, isInAppBrowser } from './in-app-browser'

describe('in-app browser', () => {
  it('detects the Facebook / Instagram browsers', () => {
    expect(isInAppBrowser('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0]')).toBe(true)
    expect(isInAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 300.0')).toBe(true)
  })
  it('lets Chrome and Safari through', () => {
    expect(isInAppBrowser('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36')).toBe(false)
    expect(isInAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1')).toBe(false)
  })
  it('builds a Chrome intent link with a fallback', () => {
    const u = chromeIntentUrl('https://konvwa.shop/products?x=1') ?? ''
    expect(u.startsWith('intent://konvwa.shop/products?x=1#Intent;scheme=https;package=com.android.chrome;')).toBe(true)
    expect(u).toContain('S.browser_fallback_url=https%3A%2F%2Fkonvwa.shop%2Fproducts%3Fx%3D1')
  })
})
