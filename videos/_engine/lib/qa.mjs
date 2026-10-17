// Quality control of a RENDERED video (the brief checks what we intend, this checks what came out): format, length, sound, and above all
// whether the first 3 seconds really move. Needs ffmpeg. Thresholds are deliberately forgiving: they catch broken renders, not taste.
import { M } from './runtime.mjs'
import { run, probeVideo, hasFfmpeg } from './media.mjs'

/** Per-frame change (0–255) sampled at 10 fps from signalstats' YDIF: how much the picture moves from one sample to the next. */
export function motionCurve(file, fps = 10) {
  const r = run('ffmpeg', ['-v', 'error', '-i', file, '-vf', `fps=${fps},scale=270:-2,signalstats,metadata=print:key=lavfi.signalstats.YDIF:file=-`, '-an', '-f', 'null', '-'])
  const pts = []
  let t = 0
  for (const line of r.out.split('\n')) {
    const a = /pts_time:([\d.]+)/.exec(line)
    if (a) t = parseFloat(a[1])
    const b = /YDIF=([\d.]+)/.exec(line)
    if (b) pts.push({ t, v: parseFloat(b[1]) })
  }
  return pts
}

/** { mean, max } volume in dB over a window of the audio (null when the file has no audio). */
export function volume(file, from = 0, len = null) {
  const args = ['-v', 'info', ...(from ? ['-ss', String(from)] : []), ...(len ? ['-t', String(len)] : []), '-i', file, '-vn', '-af', 'volumedetect', '-f', 'null', '-']
  const r = run('ffmpeg', args)
  const mean = /mean_volume:\s*(-?[\d.]+|-inf)/.exec(r.err)
  const max = /max_volume:\s*(-?[\d.]+|-inf)/.exec(r.err)
  if (!mean || !max) return null
  return { mean: mean[1] === '-inf' ? -91 : parseFloat(mean[1]), max: max[1] === '-inf' ? -91 : parseFloat(max[1]) }
}

/** Stretches of silence longer than `min` seconds. */
export function silences(file, min = 1.2, noise = -42) {
  const r = run('ffmpeg', ['-v', 'info', '-i', file, '-vn', '-af', `silencedetect=n=${noise}dB:d=${min}`, '-f', 'null', '-'])
  const out = []
  let start = null
  for (const line of r.err.split('\n')) {
    const s = /silence_start:\s*(-?[\d.]+)/.exec(line)
    if (s) start = Math.max(0, parseFloat(s[1]))
    const e = /silence_end:\s*([\d.]+)/.exec(line)
    if (e && start != null) { out.push({ from: start, to: parseFloat(e[1]) }); start = null }
  }
  if (start != null) out.push({ from: start, to: null })
  return out
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

/** @returns { checks:[{level:'ok'|'warn'|'fail', label, detail}], stats } */
export function qa(file, plan, opts = {}) {
  if (!hasFfmpeg()) return { checks: [{ level: 'fail', label: 'ffmpeg manquant', detail: 'installez ffmpeg pour contrôler le rendu' }], stats: {} }
  const checks = []
  const add = (level, label, detail = '') => checks.push({ level, label, detail })
  const fmt = M.FORMATS[plan.format]
  const info = probeVideo(file)
  if (!info) return { checks: [{ level: 'fail', label: 'fichier illisible', detail: file }], stats: {} }

  add(info.width === fmt.W && info.height === fmt.H ? 'ok' : 'fail', 'format', `${info.width}×${info.height} (attendu ${fmt.W}×${fmt.H})`)
  const dd = Math.abs(info.duration - plan.total)
  add(dd <= 0.3 ? 'ok' : dd <= 1 ? 'warn' : 'fail', 'durée', `${info.duration.toFixed(2)} s (prévu ${plan.total} s)`)
  if (info.fps && info.fps < 29) add('warn', 'images par seconde', `${info.fps.toFixed(1)} i/s — visez 30 pour TikTok / Reels`)

  // ----- sound -----
  const stats = { video: info }
  if (!info.hasAudio) add('fail', 'son', 'aucune piste audio')
  else {
    const all = volume(file)
    stats.volume = all
    if (all) {
      add(all.mean >= -30 ? 'ok' : all.mean >= -38 ? 'warn' : 'fail', 'niveau moyen', `${all.mean} dB (cible −24 à −16 dB)`)
      add(all.max <= -0.3 ? 'ok' : 'warn', 'saturation', `crête ${all.max} dB${all.max > -0.3 ? ' — risque d’écrêtage, baissez les effets' : ''}`)
    }
    const head = volume(file, 0, 0.6)
    add(head && head.max >= -34 ? 'ok' : 'fail', 'son dès l’ouverture', head ? `crête ${head.max} dB sur les 0,6 premières secondes` : 'illisible')
    if (!opts.musicOnly) {
      const gaps = silences(file, 1.4).filter((g) => g.from < info.duration - 1.2)
      stats.silences = gaps
      add(gaps.length ? 'warn' : 'ok', 'silences', gaps.length ? gaps.map((g) => `${g.from.toFixed(1)}→${g.to == null ? 'fin' : g.to.toFixed(1)} s`).join(', ') : 'aucun trou de plus de 1,4 s')
    }
  }

  // ----- picture: does the opening move, does anything freeze -----
  const curve = motionCurve(file)
  stats.motionSamples = curve.length
  if (curve.length > 8) {
    const hookEnd = Math.min(plan.hookEnd || M.HOOK.maxDur, M.HOOK.maxDur)
    const hook = curve.filter((p) => p.t <= hookEnd)
    const hookMean = mean(hook.map((p) => p.v))
    const bodyMean = mean(curve.filter((p) => p.t > hookEnd).map((p) => p.v))
    stats.hookEnergy = Number(hookMean.toFixed(2))
    stats.bodyEnergy = Number(bodyMean.toFixed(2))
    add(hookMean >= 0.9 ? 'ok' : hookMean >= 0.5 ? 'warn' : 'fail', 'énergie du hook', `${hookMean.toFixed(2)} (corps de la vidéo : ${bodyMean.toFixed(2)}) — le hook doit bouger au moins autant que la suite`)
    add(hookMean >= bodyMean * 0.9 ? 'ok' : 'warn', 'le hook accroche plus que le reste', `${hookMean.toFixed(2)} vs ${bodyMean.toFixed(2)}`)
    const first = curve.filter((p) => p.t > 0.05 && p.t <= 0.5)
    add(first.some((p) => p.v >= 0.8) ? 'ok' : 'fail', 'mouvement dès 0,5 s', first.length ? `pic ${Math.max(...first.map((p) => p.v)).toFixed(2)}` : 'pas assez d’images')
    // frozen stretches: the picture does not change for >1.2 s
    const frozen = []
    let from = null
    for (const p of curve) {
      if (p.v < 0.04) { if (from == null) from = p.t } else { if (from != null && p.t - from > 1.2) frozen.push([from, p.t]); from = null }
    }
    if (from != null && info.duration - from > 1.2) frozen.push([from, info.duration])
    add(frozen.length ? 'warn' : 'ok', 'image figée', frozen.length ? frozen.map(([a, b]) => `${a.toFixed(1)}→${b.toFixed(1)} s`).join(', ') : 'aucune')
  } else add('warn', 'mouvement', 'trop peu d’images analysées')

  return { checks, stats }
}

export function printChecks(checks, log = console.log) {
  const icon = { ok: '✓', warn: '!', fail: '✗' }
  for (const c of checks) log(`  ${icon[c.level]} ${c.label}${c.detail ? ' — ' + c.detail : ''}`)
  const fails = checks.filter((c) => c.level === 'fail').length
  const warns = checks.filter((c) => c.level === 'warn').length
  log(fails ? `\n${fails} échec(s), ${warns} avertissement(s)` : warns ? `\nOK avec ${warns} avertissement(s)` : '\nTout est bon')
  return fails === 0
}
