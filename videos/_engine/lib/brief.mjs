// Brief = the only thing a person (or Claude) writes for a video: a JSON file listing the scenes, what is said and what is shown.
// This file loads it, fills the defaults and checks the rules that make the video work (the 3-second law first).
import fs from 'node:fs'
import path from 'node:path'
import { ENGINE, M } from './runtime.mjs'

/** How the voice should sound, as a short French phrase placed in front of each line ("Dis avec … : texte"). The voice may change from one video
 * to the next, the energy may not: even `premium` has to hold attention. */
export const VOICE_STYLES = {
  punchy: 'énergie, un rythme rapide et le sourire dans la voix',
  premium: 'une voix posée, chaleureuse et sûre d’elle',
  urgent: 'urgence et enthousiasme, comme une vente flash',
  friendly: 'chaleur et naturel, comme un ami qui donne un bon plan',
  story: 'le ton d’un conteur, intrigant puis rassurant',
}

/** The exact prompt sent to the text-to-speech model for one line. */
export const voicePrompt = (brief, text) => `Dis avec ${brief.voice.direction} : ${text}`

export const TRANSITION_CYCLE = ['whip', 'up', 'scale', 'circle']

export function loadBrand(id) {
  const file = path.join(ENGINE, 'brands', `${id}.json`)
  if (!fs.existsSync(file)) throw new Error(`Marque introuvable : ${id} (attendu : ${file})`)
  const brand = JSON.parse(fs.readFileSync(file, 'utf8'))
  const logoFile = path.join(ENGINE, 'brands', brand.logo || '')
  brand.logoSvg = brand.logo && fs.existsSync(logoFile) ? fs.readFileSync(logoFile, 'utf8').replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim() : ''
  return brand
}

/** Reads brief.json (or accepts an object) and fills in the defaults. */
export function loadBrief(input) {
  const raw = typeof input === 'string' ? JSON.parse(fs.readFileSync(input, 'utf8')) : structuredClone(input)
  const brand = loadBrand(raw.brand || 'konvwa')
  const brief = {
    name: raw.name,
    title: raw.title || raw.name,
    format: raw.format || '9:16',
    theme: raw.theme || 'light',
    brand: brand.id,
    seed: raw.seed ?? 7,
    voice: { mode: 'vo', name: brand.voice?.name || 'Algieba', style: 'punchy', ...(raw.voice || {}) },
    music: raw.music || null,
    sfx: { level: 1, ...(raw.sfx || {}) },
    scenes: (raw.scenes || []).map((s) => ({ ...s })),
    needs: Array.isArray(raw.needs) ? raw.needs : [],
  }
  brief.voice.direction = brief.voice.direction || VOICE_STYLES[brief.voice.style] || VOICE_STYLES.punchy
  return { brief, brand }
}

/** Image fields of a scene (they have to exist on disk). */
export function imageRefs(spec) {
  return [spec.image, spec.image2, ...(Array.isArray(spec.images) ? spec.images : []), ...(Array.isArray(spec.reactions) ? spec.reactions : []), ...[spec.left, spec.right].flatMap((x) => (x && typeof x === 'object' ? [x.screen, x.image] : [])), ...M.depthRefs(spec), ...M.paperRefs(spec)].filter(Boolean)
}

const MARKUP = /[*_|]/g
const plainLen = (t) => M.plain(t).replace(MARKUP, '').length

/** Rough spoken length of a sentence in seconds (used until the real voice-over exists). */
export function estimateVo(text) {
  const t = String(text || '').trim()
  if (!t) return 0
  const words = t.split(/\s+/).length
  const pauses = (t.match(/[,;:.!?…]/g) || []).length
  return M.r2(Math.max(0.8, words / M.PACE.voEstimate + pauses * 0.12))
}

/**
 * Static checks (no timeline yet). Returns { errors, warnings }.
 * `exists(ref)` tells whether a referenced image file is available.
 */
export function validateBrief(brief, exists = () => true) {
  const errors = []
  const warnings = []
  const E = (i, msg) => errors.push(i == null ? msg : `scène ${i + 1} : ${msg}`)
  const W = (i, msg) => warnings.push(i == null ? msg : `scène ${i + 1} : ${msg}`)

  if (!/^[a-z0-9][a-z0-9-]*$/.test(brief.name || '')) E(null, '`name` obligatoire : minuscules, chiffres et tirets (ex. "promo-livraison")')
  if (!M.FORMATS[brief.format]) E(null, `format inconnu "${brief.format}" (attendu : ${Object.keys(M.FORMATS).join(', ')})`)
  if (!['light', 'dark'].includes(brief.theme)) E(null, 'theme : "light" ou "dark"')
  if (!Array.isArray(brief.scenes) || brief.scenes.length < 3) { E(null, 'au moins 3 scènes (hook, corps, fin)'); return { errors, warnings } }
  if (brief.format !== '9:16') W(null, 'format par défaut du projet : 9:16 (TikTok / Reels / Shorts)')

  const scenes = brief.scenes
  scenes.forEach((s, i) => {
    const def = M.catalog[s.type]
    if (!def) { E(i, `type inconnu "${s.type}" (voir \`motion types\`)`); return }
    for (const k of def.needs) {
      const v = s[k]
      if (v == null || v === '' || (Array.isArray(v) && !v.length)) E(i, `${s.type} exige le champ "${k}"`)
    }
    if (s.transition && !M.TRANSITIONS[s.transition]) E(i, `transition inconnue "${s.transition}" (${Object.keys(M.TRANSITIONS).join(', ')})`)
    if (s.theme && !['light', 'dark'].includes(s.theme)) E(i, 'theme de scène : "light" ou "dark"')
    if (s.anim && !M.TEXT_ANIMS.includes(s.anim)) E(i, `anim inconnue "${s.anim}" (${M.TEXT_ANIMS.join(', ')})`)
    for (const ref of imageRefs(s)) if (!exists(ref)) E(i, `image introuvable : ${ref}`)
    if (s.text) {
      const n = M.wordCount(s.text)
      if (def.words && (n < def.words[0] || n > def.words[1])) W(i, `${s.type} : ${n} mot(s) à l'écran, idéal ${def.words[0]}–${def.words[1]}`)
    }
    if (brief.voice.mode === 'vo' && def.kind !== 'end' && !s.vo && s.vo !== null) W(i, 'pas de voix (`vo`) : la scène sera muette — mettez "vo": null pour l’assumer')
    if (s.vo && estimateVo(s.vo) > def.max) W(i, `la phrase parlée dure ~${estimateVo(s.vo)} s, plus que le maximum de ${s.type} (${def.max} s) : coupez-la en deux scènes`)
  })

  // ----- visuals asked to the client -----
  for (const x of brief.needs || []) {
    if (!x || typeof x.file !== 'string' || !x.what) E(null, 'needs : chaque entrée a un "file" (lib:… ou assets/…) et un "what" (description)')
    else if (!exists(x.file)) W(null, `visuel attendu du client : ${x.what} → ${x.file} (« assets need » pour la liste)`)
  }

  // ----- the 3-second law -----
  const first = scenes[0]
  const H = M.HOOK
  if (!M.isHook(first.type)) E(0, `la première scène doit être un hook (${M.types().filter(M.isHook).join(', ')}), pas "${first.type}"`)
  else {
    const text = first.text || M.paperText(first.lines)
    if (plainLen(text) > H.charsMax) E(0, `hook trop long : ${plainLen(text)} caractères (max ${H.charsMax}) — il doit se lire d’un coup d’œil`)
    if (text && M.wordCount(text) > H.wordsMax) E(0, `hook trop long : ${M.wordCount(text)} mots (max ${H.wordsMax})`)
    if (['hook.statement', 'hook.question', 'hook.collage', 'hook.impact'].includes(first.type) && M.accentIndex(text) < 0) W(0, 'mettez le mot-clé du hook entre *étoiles* : c’est lui qui reçoit la couleur et le coup de son')
    if (brief.voice.mode === 'vo') {
      if (!first.vo) E(0, 'le hook doit être parlé dès les premières images (`vo`)')
      else if (estimateVo(first.vo) > H.maxDur - 0.45) E(0, `phrase de hook trop longue à dire (~${estimateVo(first.vo)} s) : 3 secondes au total, visez ≤ ${M.r2(H.maxDur - 0.45)} s (≈ ${Math.floor((H.maxDur - 0.45) * 2.7)} mots)`)
    }
  }
  scenes.forEach((s, i) => { if (i > 0 && M.isHook(s.type)) W(i, 'un seul hook par vidéo : il ouvre, il ne se répète pas') })
  if (M.catalog[scenes[scenes.length - 1].type]?.kind !== 'end') W(scenes.length - 1, 'terminez par une carte finale (scene.end) : logo, slogan, appel à l’action')

  // ----- rhythm -----
  let run = 1
  for (let i = 1; i < scenes.length; i++) {
    run = scenes[i].type === scenes[i - 1].type ? run + 1 : 1
    if (run > M.LIMITS.sameTypeInRow) W(i, `${run} scènes "${scenes[i].type}" d’affilée : variez les mises en scène`)
  }
  if (scenes.length > 14) W(null, `${scenes.length} scènes : au-delà de 14 le rythme s’essouffle, scindez en deux vidéos`)
  return { errors, warnings }
}
