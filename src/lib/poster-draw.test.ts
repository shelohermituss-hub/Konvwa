import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('poster drawing shared with the server', () => {
  it('the Edge Function copy is identical to the browser source', () => {
    // supabase/functions/facebook-post/poster.ts must be re-copied from src/lib/poster-draw.ts whenever the drawing changes
    const browser = readFileSync('src/lib/poster-draw.ts', 'utf8')
    const server = readFileSync('supabase/functions/facebook-post/poster.ts', 'utf8')
    expect(server).toBe(browser)
  })
})
