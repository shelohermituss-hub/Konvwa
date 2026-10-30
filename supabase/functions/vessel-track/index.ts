// Follows the ship of a shipment. Two sources of positions: MyShipTracking (secret MYSHIPTRACKING_API_KEY: the latest known position, even a few hours old,
// satellite included; paid by credits) when it is set, else the free aisstream.io feed (the signals ships broadcast, heard live only).
// Admin tool: `find` (looks a ship up by name) and `refresh` (reads one shipment now; the live feed listens up to 100 seconds).
// `live` (a client with the page open): reads the ship, at most once every 3 minutes (20 with MyShipTracking, which is paid by credits) per shipment, for the clients whose shipment it is.
// The job (pg_cron -> database function -> here, header x-cron-secret): `tick` refreshes every shipment not arrived yet.
// Needs the secret MYSHIPTRACKING_API_KEY or AISSTREAM_API_KEY (Supabase > Edge Functions > Secrets). The live feed allows one connection per key: calls wait their turn.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parseMstSearch, parseMstVessel } from './mst.ts'
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
function listen(key: string, filters: Filters, ms: number, onMessage: (m: AisMessage) => boolean, stats?: { raw: number }, ctl?: { stop?: () => void }): Promise<string | null> {
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
    if (ctl) ctl.stop = () => end(null)
    ws.onopen = () => ws.send(JSON.stringify({ APIKey: key, BoundingBoxes: WORLD, ...filters }))
    ws.onmessage = (e) => {
      let data: unknown
      try { data = JSON.parse(typeof e.data === 'string' ? e.data : new TextDecoder().decode(e.data as ArrayBuffer)) } catch { return }
      if (data && typeof data === 'object' && 'error' in data) return end(String((data as { error: unknown }).error))
      if (stats) stats.raw += 1
      const m = parseAisMessage(data)
      if (m && onMessage(m)) end(null)
    }
    ws.onerror = () => end('Connexion au flux AIS impossible.')
    ws.onclose = () => end('Le flux AIS a coupé la connexion.')
  })
}

interface Candidate { mmsi: string; name: string; imo: string | null; destination: string | null; lat: number | null; lng: number | null; speed_kn: number | null; at: string | null }

/** Ships whose name contains `query`, among the ones heard on the feed for up to 90 seconds (a ship at the quay only sends a position every 3 minutes). */
async function find(key: string, query: string): Promise<Response> {
  const found = new Map<string, Candidate>()
  const seen = new Set<string>()
  const stats = { raw: 0 }
  const started = Date.now()
  const why = await listen(key, { FilterMessageTypes: ['PositionReport', 'ShipStaticData'] }, 90_000, (m) => {
    const mmsi = m.kind === 'position' ? m.fix.mmsi : m.info.mmsi
    const name = m.kind === 'position' ? m.fix.name : m.info.name
    seen.add(mmsi)
    if (!nameMatches(query, name)) return found.size > 0 && Date.now() - started > 15_000
    const c = found.get(mmsi) ?? { mmsi, name, imo: null, destination: null, lat: null, lng: null, speed_kn: null, at: null }
    if (m.kind === 'position') Object.assign(c, { lat: m.fix.lat, lng: m.fix.lng, speed_kn: m.fix.speed_kn, at: m.fix.at })
    else Object.assign(c, { imo: m.info.imo ?? c.imo, destination: m.info.destination ?? c.destination, name: m.info.name || c.name })
    found.set(mmsi, c)
    return found.size > 0 && Date.now() - started > 15_000
  }, stats)
  if (why && found.size === 0) return json({ error: why }, 502)
  return json({ candidates: [...found.values()].slice(0, 8), heard: { messages: stats.raw, ships: seen.size } })
}

interface Ship { id: string; vessel_mmsi: string; vessel_imo: string | null }
type Admin = ReturnType<typeof createClient>

/** Saves what was heard of one ship (the position when it is new, with the destination and ETA announced) and notes the reading on the shipment. */
async function settle(admin: Admin, ship: Ship, fix: AisFix | null, info: AisStatic | null, error: string | null): Promise<{ fix: AisFix | null; saved: boolean }> {
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
  return { fix, saved }
}

/** Listens for the given ships, then saves what is new (the position, with the destination and ETA the ship announced). Returns what was heard for each. */
async function track(admin: Admin, key: string, ships: Ship[], ms: number): Promise<{ results: Record<string, { fix: AisFix | null; saved: boolean }>; error: string | null; messages: number }> {
  const wanted = new Set(ships.map((s) => s.vessel_mmsi))
  const fixes = new Map<string, AisFix>()
  const infos = new Map<string, AisStatic>()
  const stats = { raw: 0 }
  const ctl: { stop?: () => void } = {}
  let grace: number | undefined
  const error = await listen(key, { FiltersShipMMSI: [...wanted], FilterMessageTypes: ['PositionReport', 'ShipStaticData'] }, ms, (m) => {
    if (m.kind === 'position') { const old = fixes.get(m.fix.mmsi); if (!old || m.fix.at > old.at) fixes.set(m.fix.mmsi, m.fix) }
    else infos.set(m.info.mmsi, m.info)
    // the position is what matters: once every ship has one, wait a few more seconds for the destination (sent only every 6 minutes), then stop
    if (fixes.size >= wanted.size) {
      grace ??= setTimeout(() => ctl.stop?.(), 15_000)
      return infos.size >= wanted.size
    }
    return false
  }, stats, ctl)
  clearTimeout(grace)

  const results: Record<string, { fix: AisFix | null; saved: boolean }> = {}
  for (const ship of ships) results[ship.id] = await settle(admin, ship, fixes.get(ship.vessel_mmsi) ?? null, infos.get(ship.vessel_mmsi) ?? null, error)
  return { results, error, messages: stats.raw }
}

type Reading = { results: Record<string, { fix: AisFix | null; saved: boolean }>; error: string | null; messages: number }

const MST = 'https://api.myshiptracking.com/api/v2'

/** One call to MyShipTracking: the answer, or what to tell the team. */
async function mstGet(key: string, path: string, params: Record<string, string>): Promise<{ body: unknown } | { error: string }> {
  try {
    const res = await fetch(`${MST}${path}?${new URLSearchParams(params)}`, { headers: { Authorization: `Bearer ${key}`, 'x-api-key': key, Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) })
    const text = await res.text()
    if (res.status === 401 || res.status === 403) return { error: 'La clé MyShipTracking est refusée : vérifiez le secret MYSHIPTRACKING_API_KEY.' }
    if (res.status === 402 || res.status === 429) return { error: 'Crédits MyShipTracking épuisés, ou limite de requêtes atteinte.' }
    if (res.status === 404) return { error: 'Bateau introuvable chez MyShipTracking.' }
    if (!res.ok) return { error: `Erreur MyShipTracking (${res.status}) : ${text.slice(0, 160)}` }
    let body: unknown = null
    try { body = JSON.parse(text) } catch { /* not JSON: reported below */ }
    return { body }
  } catch {
    return { error: 'MyShipTracking ne répond pas.' }
  }
}

/** Reads the latest known position of each ship from MyShipTracking (1 credit; 3 for the extended answer, which also gives the destination and ETA: asked for the first reading and on the team's request). */
async function trackMst(admin: Admin, key: string, ships: Ship[], extended: boolean): Promise<Reading> {
  const results: Reading['results'] = {}
  let lastError: string | null = null
  for (const ship of ships) {
    let wide = extended
    if (!wide) {
      const { count } = await admin.from('vessel_positions').select('id', { count: 'exact', head: true }).eq('shipment_id', ship.id)
      wide = !count
    }
    const r = await mstGet(key, '/vessel', { mmsi: ship.vessel_mmsi, response: wide ? 'extended' : 'simple' })
    let fix: AisFix | null = null
    let info: AisStatic | null = null
    let error: string | null = null
    if ('error' in r) error = r.error
    else {
      const v = parseMstVessel(r.body)
      if (!v) error = `Réponse MyShipTracking inattendue : ${JSON.stringify(r.body)?.slice(0, 200)}`
      else { fix = v.fix; info = v.info; if (!fix) error = 'MyShipTracking n\'a aucune position pour ce bateau.' }
    }
    if (error) lastError = error
    results[ship.id] = await settle(admin, ship, fix, info, error)
  }
  return { results, error: lastError, messages: ships.length }
}

/** MyShipTracking when its key is set, else the live feed. */
function read(admin: Admin, keys: { ais?: string; mst?: string }, ships: Ship[], ms: number, extended = false): Promise<Reading> {
  return keys.mst ? trackMst(admin, keys.mst, ships, extended) : track(admin, keys.ais!, ships, ms)
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
    const keys = { ais: Deno.env.get('AISSTREAM_API_KEY') || undefined, mst: Deno.env.get('MYSHIPTRACKING_API_KEY') || undefined }
    const configured = !!(keys.ais || keys.mst)
    const notConfigured = () => json({ error: 'Le suivi du bateau n\'est pas configuré : ajoutez le secret MYSHIPTRACKING_API_KEY (ou AISSTREAM_API_KEY) dans Supabase (Edge Functions > Secrets).', code: 'not_configured' }, 503)

    // the job: proved by the shared secret, never by a user session. The ships not arrived yet (from the warehouse on), 90 seconds of listening for all of them.
    const cron = req.headers.get('x-cron-secret')
    if (cron) {
      const { data: s } = await admin.from('app_settings').select('value').eq('key', 'auto_post_secret').maybeSingle()
      if (!s?.value || !sameSecret(cron, String(s.value))) return json({ error: 'Unauthorized' }, 401)
      if (!configured) return notConfigured()
      const { data: ships } = await admin.from('shipments').select(SHIP_FIELDS).eq('ais_enabled', true).not('vessel_mmsi', 'is', null).in('status', ['in_china_warehouse', 'shipped', 'in_transit']).limit(50)
      if (!ships?.length) return json({ tracked: 0 })
      const { results } = await read(admin, keys, ships as Ship[], 90_000)
      return json({ tracked: ships.length, heard: Object.values(results).filter((r) => r.fix).length })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)
    const { data: { user }, error: authError } = await admin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const asUser = createClient(supaUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const body = await req.json().catch(() => ({})) as { action?: unknown; name?: unknown; shipment_id?: unknown }

    // a client watching the map: only for a shipment that is theirs (get_shipment_vessel answers nothing otherwise), and never more than once per 3 minutes
    if (body.action === 'live') {
      const id = String(body.shipment_id ?? '')
      if (!UUID.test(id)) return json({ error: 'Expédition inconnue.' }, 400)
      const { data: mine } = await asUser.rpc('get_shipment_vessel', { p_shipment: id })
      if (!mine) return json({ error: 'Expédition inconnue.' }, 404)
      const { data: allowedLive } = await admin.rpc('check_rate_limit', { p_key: `vessel-live:${user.id}`, p_max: 60, p_window_seconds: 3600 })
      if (allowedLive === false) return json({ throttled: true })
      if (!configured) return json({ throttled: true })
      const { data: ship } = await admin.from('shipments').select(`${SHIP_FIELDS}, ais_synced_at`).eq('id', id).maybeSingle()
      if (!ship?.vessel_mmsi) return json({ throttled: true })
      // the paid source (credits) is read at most every 20 minutes for a client, the free feed every 3 minutes
      if (ship.ais_synced_at && Date.now() - Date.parse(ship.ais_synced_at) < (keys.mst ? 1_200_000 : 180_000)) return json({ throttled: true })
      // mark the reading first: a second client arriving during these seconds is turned away instead of opening a second connection
      await admin.from('shipments').update({ ais_synced_at: new Date().toISOString() }).eq('id', id)
      const { results } = await read(admin, keys, [ship as Ship], 20_000)
      return json({ heard: !!results[id]?.fix, saved: !!results[id]?.saved })
    }

    // staff only: is_admin() is evaluated with the caller's own token (it also enforces the MFA rule)
    const { data: isStaff } = await asUser.rpc('is_admin')
    if (isStaff !== true) return json({ error: 'Accès réservé à l\'équipe.' }, 403)

    const { data: allowed } = await admin.rpc('check_rate_limit', { p_key: `vessel-track:${user.id}`, p_max: 30, p_window_seconds: 3600 })
    if (allowed === false) return json({ error: 'Trop de recherches, réessayez dans quelques minutes.' }, 429)
    if (!configured) return notConfigured()

    if (body.action === 'find') {
      const name = String(body.name ?? '').trim().slice(0, 40)
      if (name.replace(/[^A-Za-z0-9]/g, '').length < 3) return json({ error: 'Tapez au moins 3 lettres du nom du bateau.' }, 400)
      if (keys.mst) {
        const r = await mstGet(keys.mst, '/vessel/search', { name })
        if ('error' in r) return json({ error: r.error }, 502)
        return json({ candidates: parseMstSearch(r.body), heard: { messages: 0, ships: 0, source: 'myshiptracking' } })
      }
      return await find(keys.ais!, name)
    }

    if (body.action === 'refresh') {
      const id = String(body.shipment_id ?? '')
      if (!UUID.test(id)) return json({ error: 'Expédition inconnue.' }, 400)
      const { data: ship } = await admin.from('shipments').select(SHIP_FIELDS).eq('id', id).maybeSingle()
      if (!ship?.vessel_mmsi) return json({ error: 'Choisissez d\'abord le bateau (son MMSI) pour cette expédition.' }, 400)
      const { results, error, messages } = await read(admin, keys, [ship as Ship], 100_000, true)
      const r = results[id]
      if (!r.fix && error) return json({ error }, 502)
      return json({ heard: !!r.fix, saved: r.saved, messages, lat: r.fix?.lat ?? null, lng: r.fix?.lng ?? null, at: r.fix?.at ?? null })
    }

    return json({ error: 'Action inconnue.' }, 400)
  } catch (e) {
    console.error('vessel-track failed', e)
    return json({ error: 'Erreur du suivi AIS.' }, 500)
  }
})
