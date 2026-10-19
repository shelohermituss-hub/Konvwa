#!/usr/bin/env node
// KONVWA motion engine — command line.   node videos/_engine/bin/motion.mjs <command> [project]
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { ENGINE, M } from '../lib/runtime.mjs'
import { loadBrief, validateBrief, voicePrompt, VOICE_STYLES } from '../lib/brief.mjs'
import { schedule, placeSfx, hookReport, sceneId } from '../lib/schedule.mjs'
import { emitProject, HYPERFRAMES_VERSION } from '../lib/emit.mjs'
import { duration, hasFfmpeg, run } from '../lib/media.mjs'
import { qa, printChecks } from '../lib/qa.mjs'
import { analyze } from '../lib/ref.mjs'
import { findRef, formatCard, formatLine, loadCatalog, newEntry, nextNumber, refDir, saveCatalog } from '../lib/references.mjs'
import { cutout, getAsset, source } from '../lib/assets.mjs'

const VIDEOS = path.resolve(ENGINE, '..')
const [cmd, ...rest] = process.argv.slice(2)
const flags = Object.fromEntries(rest.filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true] }))
const args = rest.filter((a) => !a.startsWith('--'))
const log = console.log
const die = (msg, code = 1) => { console.error(msg); process.exit(code) }

function projectDir(arg) {
  if (!arg) die('Indiquez le projet : node videos/_engine/bin/motion.mjs ' + cmd + ' <nom-du-projet>')
  const direct = path.resolve(arg)
  if (fs.existsSync(path.join(direct, 'brief.json'))) return direct
  const named = path.join(VIDEOS, arg)
  if (fs.existsSync(path.join(named, 'brief.json'))) return named
  die(`Projet introuvable : ${arg} (attendu : ${named}/brief.json). Créez-le avec « new ».`)
}

/** Length of every voice-over file already generated for this project. */
function measureVo(dir, count) {
  const out = {}
  for (let i = 0; i < count; i++) {
    const id = sceneId(i)
    for (const ext of ['wav', 'mp3', 'm4a']) {
      const f = path.join(dir, 'assets/vo', `${id}.${ext}`)
      if (fs.existsSync(f)) { const d = duration(f); if (d) out[id] = Number(d.toFixed(2)); break }
    }
  }
  return out
}

function existsFor(dir) {
  return (ref) => (ref.startsWith('lib:') ? fs.existsSync(path.join(ENGINE, 'library', ref.slice(4))) : fs.existsSync(path.join(dir, ref)))
}

function plan(dir) {
  const { brief, brand } = loadBrief(path.join(dir, 'brief.json'))
  brief.name = brief.name || path.basename(dir)
  const { errors, warnings } = validateBrief(brief, existsFor(dir))
  const catalog = loadCatalog(ENGINE)
  for (const x of brief.references) if (!findRef(catalog, x)) errors.push(`reference ${x} inconnue (numéros : ${catalog.map((r) => r.n).join(', ')} — « ref » pour la liste)`)
  const voDur = hasFfmpeg() ? measureVo(dir, brief.scenes.length) : {}
  let tl = null
  let sfx = []
  if (!errors.length) {
    tl = schedule(brief, voDur)
    sfx = placeSfx(brief, tl)
    const hook = tl.scenes[0]
    if (hook.vo && hook.vo.measured && hook.natural > M.HOOK.maxDur + 0.05) errors.push(`scène 1 : la voix du hook dure ${hook.vo.dur} s : elle déborde des 3 s (${hook.natural} s nécessaires). Raccourcissez la phrase`)
    tl.scenes.forEach((s) => { if (s.natural > s.def.max + 0.6 && s.def.kind === 'scene') warnings.push(`scène ${s.i + 1} : ${s.natural} s pour un maximum conseillé de ${s.def.max} s (${s.spec.type}) — scindez la phrase`) })
    const avg = tl.total / tl.scenes.length
    if (avg > M.PACE.sceneAvg[1]) warnings.push(`rythme mou : ${avg.toFixed(1)} s par scène en moyenne (cible ${M.PACE.sceneAvg.join('–')} s)`)
    if (tl.total < M.LIMITS.minTotal || tl.total > M.LIMITS.maxTotal) warnings.push(`durée totale ${tl.total} s hors de la plage ${M.LIMITS.minTotal}–${M.LIMITS.maxTotal} s`)
  }
  return { brief, brand, errors, warnings, tl, sfx, voDur }
}

function printPlan(p) {
  const { tl, sfx, brief, voDur } = p
  log(`\n${brief.name} — ${brief.format}, thème ${brief.theme}, voix ${brief.voice.mode === 'vo' ? brief.voice.name + ' (' + brief.voice.style + ')' : 'aucune (musique)'}`)
  const refs = brief.references.map((x) => findRef(loadCatalog(ENGINE), x)).filter(Boolean)
  if (refs.length) log(`Référence${refs.length > 1 ? 's' : ''} : ${refs.map((r) => `n° ${r.n} ${r.title}`).join(' · ')} (fiche : ref <n>)`)
  log('\n #   type              début   durée   transition   voix')
  for (const s of tl.scenes) {
    const v = s.vo ? `${s.env.vo.start.toFixed(2)} → ${(s.env.vo.start + s.env.vo.dur).toFixed(2)} (${s.vo.measured ? 'mesurée' : 'estimée'})` : '—'
    log(` ${String(s.i + 1).padStart(2)}  ${s.spec.type.padEnd(16)}  ${s.start.toFixed(2).padStart(5)}   ${s.dur.toFixed(2).padStart(5)}   ${(s.env.transIn?.kind || '—').padEnd(10)}   ${v}`)
  }
  const measured = Object.keys(voDur).length
  log(`\nTotal ${tl.total} s · ${sfx.length} effets sonores · voix : ${measured}/${tl.scenes.filter((s) => s.vo).length} fichiers présents`)
  log('\nLoi des 3 secondes :')
  for (const it of hookReport(brief, tl, sfx, p.brand)) log(`  ${it.ok ? '✓' : '✗'} ${it.label} — ${it.detail}`)
}

function hf(dir, hfArgs) {
  const r = spawnSync('npx', ['--yes', `hyperframes@${HYPERFRAMES_VERSION}`, ...hfArgs], { cwd: dir, stdio: 'inherit' })
  return r.status ?? 1
}

const COMMANDS = {
  types() {
    for (const kind of ['hook', 'scene', 'end']) {
      log(`\n${kind === 'hook' ? 'HOOKS (3 premières secondes)' : kind === 'end' ? 'FIN' : 'SCÈNES'}`)
      for (const t of M.types().filter((x) => M.catalog[x].kind === kind)) {
        const d = M.catalog[t]
        log(`  ${t.padEnd(16)} ${d.min}–${d.max} s   exige : ${d.needs.join(', ') || '—'}\n  ${' '.repeat(16)} ${d.label}`)
      }
    }
    log('\nTransitions : ' + Object.keys(M.TRANSITIONS).join(', '))
    log('Sons : ' + Object.keys(M.CUES).join(', '))
    log('Styles de voix : ' + Object.keys(VOICE_STYLES).join(', '))
    log('Formats : ' + Object.keys(M.FORMATS).join(', '))
  },

  new() {
    const name = args[0]
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name || '')) die('Usage : new <nom> (minuscules, chiffres, tirets)')
    const dir = path.join(VIDEOS, name)
    if (fs.existsSync(path.join(dir, 'brief.json'))) die(`Existe déjà : ${dir}/brief.json`)
    const example = path.join(ENGINE, 'examples', `${flags.example || 'demo'}.brief.json`)
    if (!fs.existsSync(example)) die(`Exemple introuvable : ${example}`)
    const b = JSON.parse(fs.readFileSync(example, 'utf8'))
    b.name = name
    b.title = name
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'brief.json'), JSON.stringify(b, null, 2) + '\n')
    log(`Brief créé : ${path.relative(process.cwd(), dir)}/brief.json\nÉditez-le, puis : check → vo → build → hf check → snap → render → qa`)
  },

  check() {
    const dir = projectDir(args[0])
    const p = plan(dir)
    p.warnings.forEach((w) => log('  ! ' + w))
    p.errors.forEach((e) => log('  ✗ ' + e))
    if (p.tl) printPlan(p)
    if (p.errors.length) die(`\n${p.errors.length} erreur(s) : corrigez le brief.`)
    log(p.warnings.length ? `\nOK avec ${p.warnings.length} avertissement(s)` : '\nBrief valide')
  },

  vo() {
    const dir = projectDir(args[0])
    const p = plan(dir)
    if (p.errors.length) die(p.errors.map((e) => '✗ ' + e).join('\n'))
    const { brief, brand, tl, voDur } = p
    log(`Voix : ${brief.voice.name} · ${brand.voice?.language || 'fr-FR'} · modèle ${brand.voice?.model}`)
    log(`Style : ${brief.voice.style} — « ${brief.voice.direction} »\n`)
    let missing = 0
    for (const s of tl.scenes) {
      if (!s.spec.vo || brief.voice.mode !== 'vo') continue
      const have = voDur[s.id] != null
      if (!have) missing++
      log(`${have ? '✓' : '·'} ${s.id}  assets/vo/${s.id}.wav  ${have ? voDur[s.id] + ' s' : '~' + s.env.vo.dur + ' s (à générer)'}\n    ${voicePrompt(brief, s.spec.vo)}`)
    }
    log(missing ? `\n${missing} voix à générer, puis relancer « build » pour caler l’image sur la voix.` : '\nToutes les voix sont là : « build » cale l’image sur leur durée réelle.')
  },

  /** vo-save <projet> s01=<url|fichier> s02=… : récupère les voix générées, coupe les silences de début et de fin (la voix démarre à la première image). */
  'vo-save'() {
    const dir = projectDir(args[0])
    const pairs = args.slice(1).map((a) => a.split(/=(.+)/)).filter((p) => p[1])
    if (!pairs.length) die('Usage : vo-save <projet> s01=<url ou fichier> s02=<url ou fichier> …')
    fs.mkdirSync(path.join(dir, 'assets/vo'), { recursive: true })
    for (const [id, src] of pairs) {
      const tmp = path.join(dir, 'assets/vo', `${id}.raw`)
      if (/^https?:/.test(src)) { const r = run('curl', ['-sSL', '--fail', '-o', tmp, src]); if (!r.ok) die(`${id} : téléchargement impossible (${r.err.trim()})`) } else fs.copyFileSync(src, tmp)
      const trim = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.04'
      const out = path.join(dir, 'assets/vo', `${id}.wav`)
      const r = run('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-af', `${trim},areverse,${trim},areverse`, '-ar', '48000', '-ac', '1', out])
      fs.rmSync(tmp, { force: true })
      if (!r.ok) die(`${id} : conversion impossible (${r.err.trim()})`)
      log(`✓ ${id}  ${duration(out).toFixed(2)} s  → assets/vo/${id}.wav`)
    }
  },

  build() {
    const dir = projectDir(args[0])
    const p = plan(dir)
    p.warnings.forEach((w) => log('  ! ' + w))
    if (p.errors.length) { p.errors.forEach((e) => log('  ✗ ' + e)); die(`\n${p.errors.length} erreur(s) : rien n’a été généré.`) }
    const r = emitProject({ brief: p.brief, brand: p.brand, tl: p.tl, voDur: p.voDur, projectDir: dir })
    printPlan(p)
    log(`\nProjet généré dans ${path.relative(process.cwd(), dir)} (${r.sfx.length} sons, ${r.vo.length} voix, ${r.files} fichier(s) de bibliothèque).`)
    if (!r.vo.length && p.brief.voice.mode === 'vo') log('Voix absentes : durées estimées (brouillon). « vo » liste ce qu’il faut générer.')
  },

  hf() { process.exit(hf(projectDir(args[0]), args.slice(1))) },
  lint() { process.exit(hf(projectDir(args[0]), ['check'])) },
  snap() {
    const dir = projectDir(args[0])
    const at = flags.at || '0.15,0.6,1.2,2.0,2.8'
    process.exit(hf(dir, ['snapshot', '--at', String(at)]))
  },
  render() {
    const dir = projectDir(args[0])
    const name = path.basename(dir)
    const q = flags.quality || 'looks'
    process.exit(hf(dir, ['render', '--quality', String(q), '--output', `renders/${flags.out || name}.mp4`]))
  },

  qa() {
    const dir = projectDir(args[0])
    const planFile = path.join(dir, 'plan.json')
    if (!fs.existsSync(planFile)) die('plan.json absent : lancez « build » d’abord.')
    const pl = JSON.parse(fs.readFileSync(planFile, 'utf8'))
    const rend = path.join(dir, 'renders')
    const file = args[1] ? path.resolve(args[1]) : fs.existsSync(rend) ? fs.readdirSync(rend).filter((f) => f.endsWith('.mp4')).map((f) => path.join(rend, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] : null
    if (!file || !fs.existsSync(file)) die('Aucun rendu trouvé (renders/*.mp4). Lancez « render ».')
    log(`Contrôle de ${path.relative(process.cwd(), file)}\n`)
    const r = qa(file, pl, { musicOnly: flags['music-only'] })
    if (!printChecks(r.checks)) process.exit(1)
  },

  /**
   * assets search <source> "<requête>" [--type=photo|illustration|vector|video] [--orientation=portrait|landscape|any] [--n=10]
   * assets get <source> <id> --to=library/<dossier>/<nom> [--type=…]   → lib:<dossier>/<nom>.<ext>, crédit dans library/CREDITS.md
   * assets cutout <fichier> [sortie.png]                                → détourage local (rembg)
   * assets need <projet>                                                → les visuels que le brief demande au client (✓ reçus / ✗ manquants)
   */
  assets() {
    const [sub, ...a] = args
    const type = String(flags.type || 'photo')
    try {
      if (sub === 'search') {
        const [src, ...q] = a
        const items = source(src || '').search(q.join(' '), { type, orientation: String(flags.orientation || 'portrait') })
        const n = Math.max(1, Math.min(50, Number(flags.n) || 10))
        if (!items.length) die(`Aucun résultat pour « ${q.join(' ')} » (${type})`)
        for (const x of items.slice(0, n)) log(`${String(x.id).padStart(10)}  ${x.ext}  ${`${x.width}×${x.height}`.padEnd(10)} ${x.tags.slice(0, 60).padEnd(60)}  ${x.page}`)
        log(`\n${Math.min(n, items.length)}/${items.length} · puis : assets get ${src} <id> --type=${type} --to=library/<dossier>/<nom>`)
      } else if (sub === 'get') {
        const [src, id] = a
        if (!src || !id || !flags.to) die('Usage : assets get <source> <id> --to=library/<dossier>/<nom> [--type=photo|illustration|vector|video]')
        const r = getAsset(path.join(ENGINE, 'library'), src, id, { type, to: String(flags.to) })
        log(`✓ ${r.ref}  ${r.item.width}×${r.item.height}  par ${r.item.author}  (crédit ajouté à library/CREDITS.md)`)
      } else if (sub === 'need') {
        // the visuals a brief asks the client for: "needs": [{ "file": "lib:…" | "assets/…", "what": "…", "format": "…" }]
        const pdir = projectDir(a[0])
        const { brief } = loadBrief(path.join(pdir, 'brief.json'))
        const has = existsFor(pdir)
        const needs = brief.needs || []
        if (!needs.length) die('Aucun besoin listé : ajoutez "needs": [{ "file", "what", "format" }] au brief.')
        log(`Visuels à fournir pour ${path.basename(pdir)} :\n`)
        let missing = 0
        needs.forEach((x, i) => { const ok = has(x.file); if (!ok) missing++; log(`${ok ? '✓' : '✗'} ${String(i + 1).padStart(2)}. ${x.what}\n      → ${x.file}${x.format ? '   (' + x.format + ')' : ''}`) })
        log(missing ? `\n${missing} visuel(s) manquant(s) sur ${needs.length}.` : `\nTout est là (${needs.length}).`)
      } else if (sub === 'cutout') {
        if (!a[0]) die('Usage : assets cutout <fichier> [sortie.png]')
        log(`✓ ${path.relative(process.cwd(), cutout(path.resolve(a[0]), a[1] && path.resolve(a[1])))}`)
      } else die('Usage : assets search|get|cutout … (lancez la commande sans argument pour l’aide)')
    } catch (e) { die('✗ ' + e.message) }
  },

  /** ref : liste numérotée · ref <n> : fiche d'une référence · ref add <video> [--name=slug] : analyse et donne le numéro suivant. */
  ref() {
    const catalog = loadCatalog(ENGINE)
    if (!args.length) {
      log('Références (« utilise la référence n° X ») :\n')
      catalog.forEach((r) => log(formatLine(r)))
      log('\nFiche : ref <n> · ajouter une vidéo : ref add <video.mp4> --name=<nom-court>')
      return
    }
    if (args[0] !== 'add') {
      const r = findRef(catalog, args[0])
      if (!r) die(`Référence ${args[0]} inconnue (numéros : ${catalog.map((x) => x.n).join(', ')})`)
      log(formatCard(r))
      return
    }
    const files = args.slice(1)
    if (!files.length) die('Usage : ref add <video.mp4> [autres vidéos] [--name=nom-court]')
    for (const f of files) {
      const n = nextNumber(catalog)
      const dir = refDir(n, flags.name && files.length === 1 ? flags.name : path.basename(f).replace(/\.[^.]+$/, ''))
      const out = path.join(ENGINE, 'references', dir)
      const a = analyze(path.resolve(f), out)
      catalog.push({ ...newEntry(n, dir, a), timeline: true })
      saveCatalog(ENGINE, catalog)
      log(`\nRéférence n° ${n} → references/${dir}/\n  ${a.width}×${a.height} (${a.aspect}) · ${a.duration} s · ${a.fps} i/s · ${a.cuts.length} coupes (${a.cutsPer10s}/10 s, plan moyen ${a.avgShot} s) · ${a.hookCuts} dans les 3 premières secondes`)
      if (a.audio) log(`  son : moyenne ${a.audio.mean} dB, crête ${a.audio.max} dB`)
      log('  planches : hook.png (3 premières secondes), all.png (vue d’ensemble), timeline.jpg (une image par demi-seconde)')
      log('  à faire : regarder les planches, remplir title / look / dna / engine / konvwa dans references/catalog.json')
    }
  },
}

const fn = COMMANDS[cmd]
if (!fn) {
  log(`KONVWA motion engine\n\nCommandes :\n  types                  les scènes, transitions, sons et formats disponibles\n  new <nom> [--example=demo]   crée videos/<nom>/brief.json\n  check <projet>         valide le brief et affiche le calendrier + la loi des 3 secondes\n  vo <projet>            liste les voix à générer et celles déjà présentes\n  vo-save <projet> s01=<url> …   enregistre les voix générées (silences coupés)\n  build <projet>         génère le projet HyperFrames (image calée sur la voix, sons placés)\n  lint <projet>          hyperframes check\n  snap <projet> [--at=0.15,0.6,…]   captures aux instants donnés\n  render <projet> [--quality=looks|draft|delivery]\n  qa <projet> [rendu.mp4]   contrôle du rendu (format, son, énergie du hook…)\n  assets search pixabay "<requête>" [--type=photo|illustration|vector|video] [--orientation=portrait]   cherche des assets réels\n  assets get pixabay <id> --to=library/<dossier>/<nom> [--type=…]   télécharge (crédit dans library/CREDITS.md)\n  assets cutout <fichier> [sortie.png]   détoure (rembg, local)\n  assets need <projet>   liste des visuels à demander au client (cochée)\n  ref [n]                références numérotées (sans argument : la liste ; avec un numéro : sa fiche)\n  ref add <video…> [--name=…]   ajoute une vidéo de référence (numéro suivant, planches, catalog.json)\n  hf <projet> <args…>    passe la main au CLI hyperframes`)
  process.exit(cmd ? 1 : 0)
}
fn()
