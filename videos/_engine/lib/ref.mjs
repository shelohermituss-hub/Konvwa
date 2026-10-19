// Reference analyser: drop a video you like into the engine and get what it is made of — length, cut rhythm, sound level, and three contact
// sheets (the first 3 seconds frame by frame, the whole video, and a frame every half second so the motion can be studied without the video). The numbers feed docs/REFERENCES.md; the sheets are what a person (or
// Claude) looks at to describe the style. Needs ffmpeg.
import fs from 'node:fs'
import path from 'node:path'
import { run, probeVideo } from './media.mjs'
import { volume } from './qa.mjs'

/** Seconds at which the picture changes abruptly (hard cuts / flashes / whip pans). */
export function cuts(file, threshold = 0.3) {
  const r = run('ffmpeg', ['-v', 'info', '-i', file, '-vf', `select='gt(scene,${threshold})',showinfo`, '-an', '-f', 'null', '-'])
  const out = []
  for (const line of r.err.split('\n')) { const m = /pts_time:([\d.]+)/.exec(line); if (m && line.includes('Parsed_showinfo')) out.push(parseFloat(m[1])) }
  return out
}

export function sheet(file, out, { from = 0, span = null, step = 1, cols = 6, rows = 2, width = 270 } = {}) {
  const args = ['-v', 'error', '-y', ...(from ? ['-ss', String(from)] : []), ...(span ? ['-t', String(span)] : []), '-i', file, '-vf', `fps=1/${step},scale=${width}:-2,tile=${cols}x${rows}`, '-frames:v', '1', out]
  return run('ffmpeg', args).ok
}

export function analyze(file, outDir) {
  fs.mkdirSync(outDir, { recursive: true })
  const info = probeVideo(file)
  if (!info) throw new Error(`Vidéo illisible : ${file}`)
  const c = cuts(file)
  const hookCuts = c.filter((t) => t <= 3)
  const vol = info.hasAudio ? volume(file) : null
  const frames = 18
  const a = {
    file: path.basename(file),
    width: info.width, height: info.height, fps: Number(info.fps.toFixed(2)), duration: Number(info.duration.toFixed(2)),
    aspect: info.width / info.height < 0.6 ? '9:16' : info.width === info.height ? '1:1' : info.width > info.height ? '16:9' : '4:5',
    cuts: c.map((t) => Number(t.toFixed(2))),
    cutsPer10s: Number(((c.length / info.duration) * 10).toFixed(1)),
    hookCuts: hookCuts.length,
    avgShot: Number((info.duration / (c.length + 1)).toFixed(2)),
    audio: info.hasAudio ? vol : null,
  }
  sheet(file, path.join(outDir, 'hook.png'), { from: 0, span: 3, step: 0.25, cols: 6, rows: 2 })
  sheet(file, path.join(outDir, 'all.png'), { step: Math.max(0.5, info.duration / frames), cols: 6, rows: 3 })
  sheet(file, path.join(outDir, 'timeline.jpg'), { step: 0.5, cols: 8, rows: Math.ceil(info.duration / 0.5 / 8), width: 180 })
  fs.writeFileSync(path.join(outDir, 'analysis.json'), JSON.stringify(a, null, 2) + '\n')
  return a
}
