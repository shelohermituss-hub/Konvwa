// Writes a ready-to-render HyperFrames project from a brief + timeline: index.html (scenes, voice, sounds), one composition per scene,
// the engine's runtime scripts and styles, and the assets they use. Re-running it is safe: everything generated is overwritten, nothing else is touched.
import fs from 'node:fs'
import path from 'node:path'
import { ENGINE, RUNTIME_FILES, M } from './runtime.mjs'
import { voicePrompt } from './brief.mjs'
import { placeSfx, voClips } from './schedule.mjs'

export const GSAP_URL = 'https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js'
export const HYPERFRAMES_VERSION = '0.8.168'

const rgba = (hex, a) => {
  const n = parseInt(hex.replace('#', ''), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}
/** JSON that is safe inside a <script> element. */
const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16))
const read = (f) => fs.readFileSync(f, 'utf8')
const write = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s) }

/** CSS variables of the brand: accent + translucent accents on `.mo`, one block per theme (`.mo-light`, `.mo-dark`). */
export function brandCss(brand) {
  let css = `.mo{--brand:${brand.accent};--accent:${brand.accent};--accent2:${brand.accent2};--navy:${brand.navy};--a12:${rgba(brand.accent, 0.12)};--a25:${rgba(brand.accent, 0.25)};--a45:${rgba(brand.accent, 0.45)}}\n`
  for (const [name, t] of Object.entries(brand.themes)) css += `.mo-${name}{${Object.entries(t).map(([k, v]) => `--${k}:${v}`).join(';')}}\n`
  return css
}

/** Real colour values per theme: GSAP cannot tween var(), so scenes read them from here. */
export function palettes(brand) {
  const out = {}
  for (const [name, t] of Object.entries(brand.themes)) out[name] = { bg: t.bg, bg2: t.bg2, ink: t.ink, mute: t.mute, card: t.card, line: t.line, accent: brand.accent, accent2: brand.accent2 }
  return out
}

/** Replaces "lib:products/x.jpg" by "assets/lib/products/x.jpg" in a scene spec and lists the files to copy. */
export function resolveSpec(spec, copies) {
  const walk = (v) => {
    if (typeof v === 'string' && v.startsWith('lib:')) { const rel = v.slice(4); copies.add(rel); return `assets/lib/${rel}` }
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]))
    return v
  }
  return walk(spec)
}

function sceneHtml(sc, spec, prev) {
  const id = sc.id
  const { W, H } = sc.env
  // the object the previous scene throws across (`carry`) lands in this one
  const env = { ...sc.env, ...(prev && prev.carry ? { carryIn: prev.carry } : {}) }
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
  </head>
  <body>
    <template id="${id}-template">
      <style>
        .mo-stage { font-family: "Poppins", sans-serif; }
        .mo-s { font-family: "Playfair Display", serif; font-style: italic; }
        .mo-caps, .mo-ghost { font-family: "Archivo Black", "Poppins", sans-serif; }
      </style>
      <div class="mo" id="${id}-root" data-composition-id="${id}" data-width="${W}" data-height="${H}"></div>
      <script>
        (function () {
          var M = window.MOTION;
          var spec = ${json(spec)};
          var env = ${json(env)};
          env.brand = M.brand;
          env.pal = M.pals[env.theme];
          var root = document.getElementById("${id}-root");
          var tl = gsap.timeline({ paused: true });
          M.mount(root, tl, spec, env);
          window.__timelines = window.__timelines || {};
          window.__timelines["${id}"] = tl;
        })();
      </script>
    </template>
  </body>
</html>
`
}

/**
 * @param o { brief, brand, tl, voDur, projectDir }
 * @returns summary of what was written
 */
export function emitProject({ brief, brand, tl, voDur, projectDir }) {
  const copies = new Set()
  const specs = tl.scenes.map((sc) => resolveSpec(sc.spec, copies))
  const sfx = placeSfx(brief, tl)
  const vo = voClips(tl)

  // ----- engine runtime + styles + assets -----
  for (const f of RUNTIME_FILES) write(path.join(projectDir, 'assets/engine', f), read(path.join(ENGINE, 'runtime', f)))
  const css = brandCss(brand) + read(path.join(ENGINE, 'runtime/motion.css'))
  const used = new Set(sfx.map((e) => e.file))
  for (const f of used) { fs.mkdirSync(path.join(projectDir, 'assets/sfx'), { recursive: true }); fs.copyFileSync(path.join(ENGINE, 'sfx', f), path.join(projectDir, 'assets/sfx', f)) }
  for (const rel of copies) {
    const src = path.join(ENGINE, 'library', rel)
    if (!fs.existsSync(src)) throw new Error(`Fichier de bibliothèque introuvable : lib:${rel}`)
    const dst = path.join(projectDir, 'assets/lib', rel)
    fs.mkdirSync(path.dirname(dst), { recursive: true })
    fs.copyFileSync(src, dst)
  }
  let music = null
  if (brief.music?.file) {
    const src = brief.music.file.startsWith('lib:') ? path.join(ENGINE, 'library', brief.music.file.slice(4)) : path.join(projectDir, brief.music.file)
    if (!fs.existsSync(src)) throw new Error(`Musique introuvable : ${brief.music.file}`)
    const rel = brief.music.file.startsWith('lib:') ? `assets/lib/${brief.music.file.slice(4)}` : brief.music.file
    if (brief.music.file.startsWith('lib:')) { fs.mkdirSync(path.dirname(path.join(projectDir, rel)), { recursive: true }); fs.copyFileSync(src, path.join(projectDir, rel)) }
    music = { src: rel, volume: brief.music.volume ?? 0.14 }
  }

  // ----- scenes -----
  tl.scenes.forEach((sc, i) => write(path.join(projectDir, 'compositions', `${sc.id}.html`), sceneHtml(sc, specs[i], specs[i - 1])))

  const hosts = tl.scenes
    .map((sc) => `      <div id="el-${sc.id}" class="clip" data-composition-id="${sc.id}" data-composition-src="compositions/${sc.id}.html" data-start="${sc.start}" data-duration="${sc.dur}" data-track-index="${1 + (sc.i % 2)}" data-width="${tl.W}" data-height="${tl.H}" style="z-index:${sc.i + 1}"></div>`)
    .join('\n')
  const voTags = vo
    .map((v) => `      <audio id="${v.id}" src="assets/vo/${v.scene}.${voExt(projectDir, v.scene)}" data-start="${v.t}" data-duration="${v.dur}" data-track-index="${v.track}" data-volume="1"></audio>`)
    .join('\n')
  const sfxTags = sfx
    .map((e) => `      <audio id="${e.id}" src="assets/sfx/${e.file}" data-start="${e.t}" data-duration="${e.dur}" data-track-index="${e.track}" data-volume="${e.vol}"></audio>`)
    .join('\n')
  const musicTag = music ? `      <audio id="music" src="${music.src}" data-start="0" data-duration="${tl.total}" data-track-index="5" data-volume="${music.volume}"></audio>\n` : ''
  const bg = brand.themes[brief.theme].bg

  const index = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${tl.W}, height=${tl.H}" />
    <script src="${GSAP_URL}"></script>
${RUNTIME_FILES.map((f) => `    <script src="assets/engine/${f}"></script>`).join('\n')}
    <script>
      window.MOTION.brand = ${json({ name: brand.name, handle: brand.handle, tagline: brand.tagline, cta: brand.cta, audience: brand.audience, logo: brand.logoSvg })};
      window.MOTION.pals = ${json(palettes(brand))};
    </script>
    <style>
      html, body { margin: 0; width: ${tl.W}px; height: ${tl.H}px; overflow: hidden; background: ${bg}; }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; background: ${bg}; font-family: "Poppins", sans-serif; }
      [data-composition-id="main"] > div[data-composition-src] { position: absolute; inset: 0; }
${css.split('\n').map((l) => (l ? '      ' + l : l)).join('\n')}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${tl.total}" data-width="${tl.W}" data-height="${tl.H}">
${hosts}
${voTags ? `\n      <!-- Voix off : ${brief.voice.name} (${brand.voice?.language || 'fr-FR'}) -->\n${voTags}\n` : ''}
      <!-- Effets sonores : placés automatiquement depuis les scènes (sfx/CREDITS.md) -->
${musicTag}${sfxTags}
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      window.__timelines["main"] = gsap.timeline({ paused: true });
    </script>
  </body>
</html>
`
  write(path.join(projectDir, 'index.html'), index)

  // ----- project plumbing (kept if it already exists) -----
  const keep = (f, content) => { const p = path.join(projectDir, f); if (!fs.existsSync(p)) write(p, content) }
  keep('hyperframes.json', JSON.stringify({ $schema: 'https://hyperframes.heygen.com/schema/hyperframes.json', registry: 'https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry', paths: { blocks: 'compositions', components: 'compositions/components', assets: 'assets' }, media: { autoProxy: true }, authoringSkill: 'general-video' }, null, 2) + '\n')
  keep('meta.json', JSON.stringify({ id: brief.name, name: brief.name, createdAt: new Date().toISOString() }, null, 2) + '\n')
  keep('package.json', JSON.stringify({ name: brief.name, private: true, type: 'module', scripts: { check: `npx --yes hyperframes@${HYPERFRAMES_VERSION} check`, render: `npx --yes hyperframes@${HYPERFRAMES_VERSION} render`, dev: `npx --yes hyperframes@${HYPERFRAMES_VERSION} preview`, qa: 'node ../_engine/bin/motion.mjs qa .' } }, null, 2) + '\n')
  keep('.gitignore', 'renders/\n*.mp4\n.hyperframes/\n.snap/\nsnapshots/\n')

  // ----- what the voice-over must say (for the text-to-speech step) and the plan (for QA) -----
  const lines = tl.scenes.filter((s) => s.spec.vo && brief.voice.mode === 'vo').map((s) => ({ id: s.id, scene: s.i + 1, type: s.spec.type, text: s.spec.vo, prompt: voicePrompt(brief, s.spec.vo), file: `assets/vo/${s.id}.wav`, estimatedSeconds: M.r2(s.env.vo ? s.env.vo.dur : 0), measured: !!voDur[s.id] }))
  write(path.join(projectDir, 'vo.json'), JSON.stringify({ voice: { ...brief.voice, language: brand.voice?.language || 'fr-FR', model: brand.voice?.model }, lines }, null, 2) + '\n')
  const plan = { name: brief.name, format: brief.format, total: tl.total, scenes: tl.scenes.map((s) => ({ id: s.id, type: s.spec.type, start: s.start, dur: s.dur, transition: s.env.transIn?.kind || null })), sfx: sfx.length, hookEnd: tl.scenes[0].dur }
  write(path.join(projectDir, 'plan.json'), JSON.stringify(plan, null, 2) + '\n')
  return { sfx, vo, files: copies.size, plan }
}

function voExt(projectDir, id) {
  for (const ext of ['wav', 'mp3', 'm4a']) if (fs.existsSync(path.join(projectDir, 'assets/vo', `${id}.${ext}`))) return ext
  return 'wav'
}
