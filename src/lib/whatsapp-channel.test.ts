import { describe, expect, it } from 'vitest'
import { channelUrl } from './whatsapp-channel-url'

describe('channelUrl', () => {
  it('accepts a WhatsApp channel link', () => {
    expect(channelUrl('https://whatsapp.com/channel/0029VaAbCdEf1234')).toBe('https://whatsapp.com/channel/0029VaAbCdEf1234')
    expect(channelUrl(' https://www.whatsapp.com/channel/0029VaAbCdEf1234/ ')).toBe('https://www.whatsapp.com/channel/0029VaAbCdEf1234/')
  })
  it('refuses anything else', () => {
    for (const bad of ['', null, undefined, 'javascript:alert(1)', 'http://whatsapp.com/channel/0029VaAbCdEf1234', 'https://evil.com/channel/0029VaAbCdEf1234', 'https://whatsapp.com.evil.com/channel/0029VaAbCdEf1234', 'https://whatsapp.com/channel/', 'https://wa.me/1234567890', 'https://whatsapp.com/channel/abc'])
      expect(channelUrl(bad)).toBeNull()
  })
})
