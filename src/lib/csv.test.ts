import { describe, expect, it } from 'vitest'
import { parseCsv, toCsv } from './csv'

describe('toCsv', () => {
  it('quotes commas, quotes and line breaks', () => {
    expect(toCsv(['a', 'b'], [['x,y', 'say "hi"'], ['l1\nl2', 3]])).toBe('a,b\r\n"x,y","say ""hi"""\r\n"l1\nl2",3')
  })

  it('neutralises spreadsheet formulas', () => {
    const out = toCsv(['v'], [['=HYPERLINK("http://evil")'], ['+1'], ['-2'], ['@cmd'], ['normal']])
    const lines = out.split('\r\n').slice(1)
    expect(lines[0]).toBe('"\'=HYPERLINK(""http://evil"")"')
    expect(lines.slice(1)).toEqual(["'+1", "'-2", "'@cmd", 'normal'])
  })

  it('writes empty cells for null and undefined', () => {
    expect(toCsv(['a', 'b', 'c'], [[null, undefined, 0]])).toBe('a,b,c\r\n,,0')
  })
})

describe('parseCsv', () => {
  it('reads quoted fields with escaped quotes and embedded newlines', () => {
    expect(parseCsv('a,b\r\n"x,y","say ""hi"""\r\n"l1\nl2",3\r\n')).toEqual([
      ['a', 'b'],
      ['x,y', 'say "hi"'],
      ['l1\nl2', '3'],
    ])
  })

  it('detects the semicolon delimiter used by French spreadsheets', () => {
    expect(parseCsv('name;price_htg\nSocks;155')).toEqual([['name', 'price_htg'], ['Socks', '155']])
  })

  it('ignores the BOM and blank lines', () => {
    expect(parseCsv('﻿a,b\n\n1,2\n')).toEqual([['a', 'b'], ['1', '2']])
  })

  it('round-trips what toCsv writes', () => {
    const rows = [['Café, "crème"', '=x'], ['multi\nline', '']]
    const parsed = parseCsv(toCsv(['c1', 'c2'], rows))
    expect(parsed[1][0]).toBe('Café, "crème"')
    expect(parsed[2]).toEqual(['multi\nline', ''])
  })
})
