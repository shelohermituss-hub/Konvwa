// Follows the ship of a shipment from the free aisstream.io feed (the position signals ships broadcast, AIS).
// Admin tool: `find` (looks a ship up by name: it listens to the feed for a minute) and `refresh` (reads one shipment now).
// The job (pg_cron -> database function -> here, header x-cron-secret): `tick` refreshes every shipment that is at sea.
// Needs the secret AISSTREAM_API_KEY (Supabase > Edge Functions > Secrets). The feed allows one connection per key: calls wait their turn.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { nameMatches, parseAisMessage, shouldRecord, vesselEvent, type AisFix, type AisMessage, type AisStatic, type LastPosition } from './ais.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const FEED = 'wss://stream.aisstream.io/v0/stream'
const WORLD = [[[-90, -180], [90, 180]]]
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Filters { FiltersShipMMSI?: string[]; FilterMessageTypes: string[] }

/** Opens the feed, subscribes, and gives every message to `onMessage` until it answers true or `ms` have gone by. Resolves with what went wrong (null: nothing). */
function listen(key: string, filters: Filters, ms: number, onMessage: (m: AisMessage) => boolean): Promise<string | null> {
  return new Promise((resolve) => {
    let over = false
    let timer: number | undefined
    const ws = new WebSocket(FEED)
    ws.binaryType = 'arraybuffer'
    const end = (why: string | null) => {
      if (over) return
      over = true
      clearTimeout(timer)
      try { ws.close() } catch { /* already closed */ }
      resolve(why)
    }
    timer = setTimeout(() => end(null), ms)
    ws.onopen = () => ws.send(JSON.stringify({ APIKey: key, BoundingBoxes: WORLD, ...filters }))
    ws.onmessage = (e) => {
      let data: unknown
      try { data = JSON.parse(typeof e.data === 'string' ? e.data : new TextDecoder().decode(e.data as ArrayBuffer)) } catch { return }
      if (data && typeof data === 'object' && 'error' in data) return end(String((data as { error: unknown }).error))
      const m = parseAisMessage(data)
      if (m && onMessage(m)) end(null)
    }
    ws.onerror = () => end('Connexion au flux AIS impossible.')
    ws.onclose = () => end('Le flux AIS a coupé la connexion.')
  })
}

interface Candidate { mmsi: string; name: string; imo: string | null; destination: string | null; lat: number | null; lng: number | null; speed_kn: number | null; at: string | null }

/** Ships whose name contains `query`, among the ones heard on the feed for up to 45 seconds. */
async function find(key: string, query: string): Promise<Response> {
  const found = new Map<string, Candidate>()
  const started = Date.now()
  const why = await listen(key, { FilterMessageTypes: ['PositionReport', 'ShipStaticData'] }, 45_000, (m) => {
    const mmsi = m.kind === 'position' ? m.fix.mmsi : m.info.mmsi
    const name = m.kind === 'position' ? m.fix.name : m.info.name
    if (!nameMatches(query, name)) return found.size > 0 && Date.now() - started > 20_000
    const c = found.get(mmsi) ?? { mmsi, name, imo: null, destination: null, lat: null, lng: null, speed_kn: null, at: null }
    if (m.kind === 'position') Object.assign(c, { lat: m.fix.lat, lng: m.fix.lng, speed_kn: m.fix.speed_kn, at: m.fix.at })
    else Object.assign(c, { imo: m.info.imo ?? c.imo, destination: m.info.destination ?? c.destination, name: m.info.name || c.name })
    found.set(mmsi, c)
    return found.size > 0 && Date.now() - started > 20_000
  })
  if (why && found.size === 0) return json({ error: why }, 502)
  return json({ candidates: [...found.values()].slice(0, 8) })
}

interface Ship { id: string; vessel_mmsi: string; vessel_imo: string | null }
type Admin = ReturnType<typeof createClient>

/** Listens for the given ships, then saves what is new (the position, with the destination and ETA the ship announced). Returns what was heard for each. */
async function track(admin: Admin, key: string, ships: Ship[], ms: number): Promise<{ results: Record<string, { fix: AisFix | null; saved: boolean }>; error: string | null }> {
  const wanted = new Set(ships.map((s) => s.vessel_mmsi))
  const fixes = new Map<string, AisFix>()
  const infos = new Map<string, AisStatic>()
  const error = await listen(key, { FiltersShipMMSI: [...wanted], FilterMessageTypes: ['PositionReport', 'ShipStaticData'] }, ms, (m) => {
    if (m.kind === 'position') { const old = fixes.get(m.fix.mmsi); if (!old || m.fix.at > old.at) fixes.set(m.fix.mmsi, m.fix) }
    else infos.set(m.info.mmsi, m.info)
    return fixes.size >= wanted.size && infos.size >= wanted.size
  })

  const results: Record<string, { fix: AisFix | null; saved: boolean }> = {}
  for (const ship of ships) {
    const fix = fixes.get(ship.vessel_mmsi) ?? null
    const info = infos.get(ship.vessel_mmsi) ?? null
    let saved = false
    if (fix) {
      const { data: row } = await admin.from('vessel_positions')
        .select('lat, lng, speed_kn, destination, eta, recorded_at').eq('shipment_id', ship.id).order('recorded_at', { ascending: false }).limit(1).maybeSingle()
      const prev: LastPosition | null = row ? { lat: Number(row.lat), lng: Number(row.lng), speed_kn: row.speed_kn === null ? null : Number(row.speed_kn), destination: row.destination, at: row.recorded_at } : null
      // the destination and ETA are only broadcast now and then: the last ones announced stay until the ship announces new ones
      const destination = info?.destination ?? prev?.destination ?? null
      const eta = info?.eta ?? (row?.eta ?? null)
      const event = vesselEvent(prev, { speed_kn: fix.speed_kn, destination })
      if (shouldRecord(prev, fix, event)) {
        const { error: insertError } = await admin.from('vessel_positions').insert({
          shipment_id: ship.id, recorded_at: fix.at, lat: fix.lat, lng: fix.lng, speed_kn: fix.speed_kn, course: fix.course, nav_status: fix.nav_status, destination, eta, event,
        })
        saved = !insertError
      }
    }
    const patch: Record<string, unknown> = { ais_synced_at: new Date().toISOString(), ais_error: fix ? null : (error ?? 'Aucun signal reçu : le bateau est peut-être hors de portée des récepteurs AIS.') }
    if (info?.imo && !ship.vessel_imo) patch.vessel_imo = info.imo
    await admin.from('shipments').update(patch).eq('id', ship.id)
    results[ship.id] = { fix, saved }
  }
  return { results, error }
}

function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const SHIP_FIELDS = 'id, vessel_mmsi, vessel_imo'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const supaUrl = Deno.env.get('SUPABASE_URL')!
    const admin = createClient(supaUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const key = Deno.env.get('AISSTREAM_API_KEY')
    const notConfigured = () => json({ error: 'Le suivi AIS n\'est pas configuré : ajoutez le secret AISSTREAM_API_KEY dans Supabase (Edge Functions > Secrets).', code: 'not_configured' }, 503)

    // the job: proved by the shared secret, never by a user session. Only the ships at sea, one minute of listening for all of them.
    const cron = req.headers.get('x-cron-secret')
    if (cron) {
      const { data: s } = await admin.from('app_settings').select('value').eq('key', 'auto_post_secret').maybeSingle()
      if (!s?.value || !sameSecret(cron, String(s.value))) return json({ error: 'Unauthorized' }, 401)
      if (!key) return notConfigured()
      const { data: ships } = await admin.from('shipments').select(SHIP_FIELDS).eq('ais_enabled', true).not('vessel_mmsi', 'is', null).in('status', ['shipped', 'in_transit']).limit(50)
      if (!ships?.length) return json({ tracked: 0 })
      const { results } = await track(admin, key, ships as Ship[], 60_000)
      return json({ tracked: ships.length, heard: Object.values(results).filter((r) => r.fix).length })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)
    const { data: { user }, error: authError } = await admin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    // staff only: is_admin() is evaluated with the caller's own token (it also enforces the MFA rule)
    const asUser = createClient(supaUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const { data: isStaff } = await asUser.rpc('is_admin')
    if (isStaff !== true) return json({ error: 'Accès réservé à l\'équipe.' }, 403)

    const { data: allowed } = await admin.rpc('check_rate_limit', { p_key: `vessel-track:${user.id}`, p_max: 30, p_window_seconds: 3600 })
    if (allowed === false) return json({ error: 'Trop de recherches, réessayez dans quelques minutes.' }, 429)
    if (!key) return notConfigured()

    const body = await req.json().catch(() => ({})) as { action?: unknown; name?: unknown; shipment_id?: unknown }

    if (body.action === 'find') {
      const name = String(body.name ?? '').trim().slice(0, 40)
      if (name.replace(/[^A-Za-z0-9]/g, '').length < 3) return json({ error: 'Tapez au moins 3 lettres du nom du bateau.' }, 400)
      return await find(key, name)
    }

    if (body.action === 'refresh') {
      const id = String(body.shipment_id ?? '')
      if (!UUID.test(id)) return json({ error: 'Expédition inconnue.' }, 400)
      const { data: ship } = await admin.from('shipments').select(SHIP_FIELDS).eq('id', id).maybeSingle()
      if (!ship?.vessel_mmsi) return json({ error: 'Choisissez d\'abord le bateau (son MMSI) pour cette expédition.' }, 400)
      const { results, error } = await track(admin, key, [ship as Ship], 40_000)
      const r = results[id]
      if (!r.fix && error) return json({ error }, 502)
      return json({ heard: !!r.fix, saved: r.saved, lat: r.fix?.lat ?? null, lng: r.fix?.lng ?? null, at: r.fix?.at ?? null })
    }

    return json({ error: 'Action inconnue.' }, 400)
  } catch (e) {
    console.error('vessel-track failed', e)
    return json({ error: 'Erreur du suivi AIS.' }, 500)
  }
})
