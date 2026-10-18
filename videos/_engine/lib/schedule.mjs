// Timeline = brief + the real length of each voice-over -> when every scene starts, how long it lasts, which transition joins it
// to the next one and where each sound goes. Nothing is placed by hand: the voice drives the picture, the picture drives the sounds.
import { M } from './runtime.mjs'
import { estimateVo, TRANSITION_CYCLE } from './brief.mjs'

export const sceneId = (i) => `s${String(i + 1).padStart(2, '0')}`
const r2 = M.r2

/** Transition INTO scene i (0 = none). Explicit `transition` wins; otherwise a varied but deterministic choice. */
function transitionInto(brief, i, prevKind) {
  const spec = brief.scenes[i]
  if (i === 0) return null
  if (spec.transition) return spec.transition
  if (M.catalog[spec.type].kind === 'end') return 'circle'
  if (i === 1) return 'whip'
  let k = TRANSITION_CYCLE[(i + brief.seed) % TRANSITION_CYCLE.length]
  if (k === prevKind) k = TRANSITION_CYCLE[(TRANSITION_CYCLE.indexOf(k) + 1) % TRANSITION_CYCLE.length]
  return k
}

/** How long a scene needs when nobody speaks over it (music-only videos, drafts without voice). */
function contentDur(spec, def) {
  const n = (spec.items || spec.labels || spec.steps || spec.images || []).length
  return M.clamp(1.2 + M.wordCount(spec.text || '') * 0.3 + n * 0.55, def.min, def.max)
}

/**
 * @param brief  loaded brief
 * @param voDur  { s01: seconds, ... } measured length of the generated voice-over files (missing id = estimated)
 */
export function schedule(brief, voDur = {}) {
  const fmt = M.FORMATS[brief.format]
  const n = brief.scenes.length
  const kinds = []
  for (let i = 0; i < n; i++) kinds.push(transitionInto(brief, i, kinds[i - 1]))
  const overlap = (i) => (i > 0 && kinds[i] ? M.TRANSITIONS[kinds[i]].dur : 0)
  const speaking = brief.voice.mode === 'vo'
  const H = M.HOOK

  const scenes = []
  let cursor = 0
  brief.scenes.forEach((spec, i) => {
    const def = M.catalog[spec.type]
    const id = sceneId(i)
    const ov = overlap(i)
    const nextOv = i + 1 < n ? overlap(i + 1) : 0
    const talks = speaking && !!spec.vo
    const measured = voDur[id] != null
    const voLen = talks ? (measured ? voDur[id] : estimateVo(spec.vo)) : 0
    const voStart = talks ? (i === 0 ? 0.12 : r2(0.2 + ov * 0.55)) : null
    const tail = spec.tail ?? (def.kind === 'end' ? 0.9 : 0.35)

    let dur = spec.dur ?? (talks ? voStart + voLen + tail + nextOv * 0.6 : contentDur(spec, def))
    dur = Math.max(def.min, dur)
    const natural = r2(dur)
    if (def.kind === 'hook') dur = M.clamp(dur, H.minDur, H.maxDur)
    dur = r2(dur)

    const start = i === 0 ? 0 : r2(cursor - ov)
    cursor = r2(start + dur)
    const env = {
      id,
      W: fmt.W, H: fmt.H, safe: fmt.safe,
      dur,
      seed: brief.seed + i * 17,
      theme: spec.theme || def.theme || brief.theme,
      vo: talks ? { start: voStart, dur: r2(voLen) } : null,
      transIn: ov ? { kind: kinds[i], dur: ov } : null,
      transOut: nextOv ? { kind: kinds[i + 1], dur: nextOv } : null,
    }
    scenes.push({ i, id, spec, def, start, dur, natural, env, vo: talks ? { id, start: r2(start + voStart), dur: r2(voLen), measured } : null })
  })
  const total = r2(scenes[n - 1].start + scenes[n - 1].dur)
  return { W: fmt.W, H: fmt.H, safe: fmt.safe, scenes, total, kinds }
}

/** Sound cues of the whole video, placed in absolute time, with tracks that never overlap. */
export function placeSfx(brief, tl) {
  if (!(brief.sfx.level > 0)) return []
  const events = []
  for (const sc of tl.scenes) {
    const cues = []
    if (sc.env.transIn) { const c = M.TRANSITIONS[sc.env.transIn.kind].sfx; if (c) cues.push({ t: 0.0, cue: c }) }
    cues.push(...sc.def.sfx(sc.spec, sc.env), ...M.depthSfx(sc.spec, sc.env), ...(sc.spec.sfx || []))
    for (const c of cues) {
      const def = M.CUES[c.cue]
      if (!def) throw new Error(`${sc.id} : son inconnu "${c.cue}" (disponibles : ${Object.keys(M.CUES).join(', ')})`)
      const t = r2(sc.start + c.t)
      if (t < 0 || t > tl.total - 0.08) continue
      events.push({ t, cue: c.cue, scene: sc.id })
    }
  }
  events.sort((a, b) => a.t - b.t || a.cue.localeCompare(b.cue))
  // the same sound twice within 0.12 s is one sound too many
  const kept = []
  for (const e of events) if (!kept.some((k) => k.cue === e.cue && Math.abs(k.t - e.t) < 0.12)) kept.push(e)
  const trackEnd = []
  return kept.map((e, n) => {
    const d = M.CUES[e.cue]
    const len = r2(Math.min(d.dur, d.max ?? Infinity, tl.total - e.t))
    let k = trackEnd.findIndex((end) => end <= e.t + 0.001)
    if (k < 0) { k = trackEnd.length; trackEnd.push(0) }
    trackEnd[k] = e.t + len
    return { id: `sfx${String(n + 1).padStart(2, '0')}`, ...e, file: d.file, vol: r2(d.vol * brief.sfx.level), dur: len, track: 20 + k }
  })
}

/** Voice-over clips (only those whose audio file exists: the others are still estimates). */
export function voClips(tl) {
  return tl.scenes.filter((s) => s.vo && s.vo.measured).map((s) => ({ id: `vo-${s.id}`, scene: s.id, t: s.vo.start, dur: s.vo.dur, track: 10 + (s.i % 2) }))
}

/** The 3-second law, as a checklist computed from the timeline. */
export function hookReport(brief, tl, sfx, brand) {
  const sc = tl.scenes[0]
  const H = M.HOOK
  const items = []
  const add = (ok, label, detail) => items.push({ ok, label, detail })
  add(sc.dur <= H.maxDur + 1e-6, 'dure 3 s au plus', `${sc.dur} s`)
  add(sc.natural <= H.maxDur + 0.05 || !sc.vo, 'la voix tient dans les 3 s', sc.vo ? `voix ${sc.vo.dur} s (${sc.vo.measured ? 'mesurée' : 'estimée'}), scène ${sc.natural} s avant plafond` : 'pas de voix')
  const firstSfx = sfx.length ? sfx[0].t : null
  add(firstSfx != null && firstSfx <= H.firstEventMax + 0.05, `un son dès ${H.firstEventMax} s`, firstSfx == null ? 'aucun son' : `premier son à ${firstSfx} s (${sfx[0].cue})`)
  if (sc.vo) add(sc.env.vo.start <= H.voStartMax, `la voix démarre avant ${H.voStartMax} s`, `${sc.env.vo.start} s`)
  if (sc.def.legible) {
    const at = sc.def.legible(sc.spec, { ...sc.env, brand: brand || { name: brief.brand } })
    add(at <= H.legibleBy, `message lisible avant ${H.legibleBy} s`, `net vers ${at} s`)
  }
  return items
}
