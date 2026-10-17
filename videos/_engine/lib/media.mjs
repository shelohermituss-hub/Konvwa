// Thin wrappers around ffmpeg / ffprobe (the only external programs the engine needs, and only for sound and quality control).
import { spawnSync } from 'node:child_process'

export function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opts })
  return { ok: r.status === 0, out: r.stdout || '', err: r.stderr || '', status: r.status }
}

export function hasFfmpeg() {
  return run('ffprobe', ['-version']).ok && run('ffmpeg', ['-version']).ok
}

/** Duration in seconds of an audio / video file, or null when it cannot be read. */
export function duration(file) {
  const r = run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])
  const d = parseFloat(r.out)
  return r.ok && Number.isFinite(d) ? d : null
}

/** { width, height, fps, duration, hasAudio } of a video. */
export function probeVideo(file) {
  const r = run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height,r_frame_rate:format=duration', '-of', 'json', file])
  if (!r.ok) return null
  const j = JSON.parse(r.out)
  const v = (j.streams || []).find((s) => s.codec_type === 'video') || {}
  const [n, d] = String(v.r_frame_rate || '0/1').split('/').map(Number)
  return { width: v.width, height: v.height, fps: d ? n / d : 0, duration: parseFloat(j.format?.duration), hasAudio: (j.streams || []).some((s) => s.codec_type === 'audio') }
}
