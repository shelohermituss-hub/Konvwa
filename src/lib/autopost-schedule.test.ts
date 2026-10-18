import { describe, expect, it } from 'vitest'
import { normalizeTimes, parseTimes, spreadTimes } from './autopost-schedule'

describe('autopost schedule', () => {
  it('keeps valid times only, once each, in order', () => {
    expect(normalizeTimes(['18:30', '07:00', ' 07:00 ', '25:00', '7:00', 'abc', '12:60'])).toEqual(['07:00', '18:30'])
    expect(parseTimes('07:00,10:00, 13:00,xx')).toEqual(['07:00', '10:00', '13:00'])
    expect(parseTimes(null)).toEqual([])
  })
  it('spreads posters over the day', () => {
    expect(spreadTimes(5, '07:00', '19:00')).toEqual(['07:00', '10:00', '13:00', '16:00', '19:00'])
    expect(spreadTimes(1, '09:00', '18:00')).toEqual(['09:00'])
    expect(spreadTimes(3, '20:00', '08:00')).toEqual(['08:00', '14:00', '20:00'])
    expect(spreadTimes(40, '00:00', '23:55')).toHaveLength(12)
    expect(spreadTimes(3, 'nope', '18:00')).toEqual([])
  })
})
