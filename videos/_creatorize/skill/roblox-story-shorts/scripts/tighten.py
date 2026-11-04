"""Roblox story shorts: cut the dead air out of the voiceover (run after the timeline step, BEFORE the scenes are built).

  python tighten.py <project> [--max-gap 0.08] [--keep 0.05] [--lead 0.04] [--tail 1.5] [--undo]

From the word times in audio/timeline.json (the app's; audio/clean.json as a fallback) every pause between words longer
than --max-gap, and every silent run inside the audio (10 ms frames 38 dB under the loud speech, e.g. an aligner that
stretched a word over a pause), is cut down to --keep seconds (half after one word, half before the next, so words never
collide). Leading silence -> --lead. After the last word the voice keeps 0.12 s and is padded with silence to --tail
(default 1.5 s), so the closing vine boom rings out (the app's mix ends with the voice). Each join is a 10 ms equal-power crossfade.

Writes (the originals are kept once: re-running starts from them, so it is idempotent; a NEW clean.wav from the app's
clean step is detected by its fingerprint and becomes the new original):
  audio/clean.orig.wav, audio/timeline.orig.json (+ clean.orig.json, captions.orig.srt, script_timed.orig.txt ...)
  audio/clean.wav                         the tightened voice
  audio/timeline.json, clean.json         word / phrase times remapped ("timeline": "tightened" in clean.json)
  audio/captions.srt, clean.srt, clean.words.srt, script_timed.txt   remapped
  audio/timemap.json   {segments: [{o0, o1, n0}], points, oldDuration, newDuration, params, fingerprint}
Prints one line: TIGHTEN <old> s -> <new> s (<n> pauses cut, <s> s removed). Undo: --undo restores every original.
Only python + numpy + ffmpeg on PATH."""
import hashlib, json, os, re, shutil, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rbxaudio import SR, load, save, opt

XF = 0.010
REMAP_JSON = ['timeline.json', 'clean.json']
REMAP_TEXT = ['captions.srt', 'clean.srt', 'clean.words.srt', 'script_timed.txt']


def orig(name): b, e = name.rsplit('.', 1); return f'{b}.orig.{e}'


def fingerprint(p):
    h = hashlib.sha1()
    with open(p, 'rb') as f: h.update(f.read())
    return h.hexdigest()[:16]


def o2n_factory(segs):
    """old -> new: linear inside kept segments, clamped to the join inside removed pauses"""
    def f(t):
        for s in segs:
            if t < s['o0']: return s['n0']
            if t <= s['o1']: return s['n0'] + (t - s['o0'])
        last = segs[-1]; return last['n0'] + (last['o1'] - last['o0'])
    return f


def srt_time(s): h, m, r = s.split(':'); sec, ms = r.replace('.', ',').split(','); return int(h) * 3600 + int(m) * 60 + int(sec) + int(ms) / 1000
def srt_fmt(t): t = max(0.0, t); ms = int(round(t * 1000)); return f'{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}'


def remap_text(path, o2n):
    txt = open(path, encoding='utf-8-sig').read()
    if path.endswith('.srt'):
        txt = re.sub(r'(\d+:\d+:\d+[,.]\d+)\s*-->\s*(\d+:\d+:\d+[,.]\d+)', lambda m: f'{srt_fmt(o2n(srt_time(m.group(1))))} --> {srt_fmt(o2n(srt_time(m.group(2))))}', txt)
    else:   # script_timed.txt: "   0.40  words ..."
        txt = re.sub(r'(?m)^(\s*)(\d+\.\d+)(\s)', lambda m: f'{m.group(1)}{o2n(float(m.group(2))):{len(m.group(2))}.2f}{m.group(3)}', txt)
    open(path, 'w', encoding='utf-8', newline='').write(txt)


def remap_obj(o, o2n):
    """every start/end/s/e number in a json tree, in place"""
    if isinstance(o, list):
        for x in o: remap_obj(x, o2n)
    elif isinstance(o, dict):
        for k, v in list(o.items()):
            if k in ('s', 'e', 'start', 'end') and isinstance(v, (int, float)): o[k] = round(o2n(float(v)), 3)
            elif isinstance(v, (list, dict)): remap_obj(v, o2n)


def main():
    args = [a for a in sys.argv[1:]]
    proj = os.path.abspath(args[0] if args and not args[0].startswith('--') else '.')
    A = os.path.join(proj, 'audio'); P = lambda n: os.path.join(A, n)
    files = ['clean.wav'] + REMAP_JSON + REMAP_TEXT
    if '--undo' in args:
        for f in files:
            if os.path.exists(P(orig(f))): shutil.copyfile(P(orig(f)), P(f)); os.remove(P(orig(f)))
        if os.path.exists(P('timemap.json')): os.remove(P('timemap.json'))
        print('TIGHTEN undone'); return
    if not os.path.exists(P('clean.wav')): sys.exit('tighten: no audio/clean.wav (run the voiceover steps first)')
    # per file: one that is not what we wrote last time (a new voiceover from the clean step, a new timeline) becomes
    # the new original; one we wrote is left alone (its original is kept)
    try: tm = json.load(open(P('timemap.json'), encoding='utf-8'))
    except Exception: tm = {}
    wrote = tm.get('wrote') or ({f: fingerprint(P(f)) for f in files if os.path.exists(P(f))}   # (a timemap from before 'wrote')
                                if tm.get('fingerprint') and tm['fingerprint'] == fingerprint(P('clean.wav')) else {})
    for f in files:
        if os.path.exists(P(f)) and (not os.path.exists(P(orig(f))) or wrote.get(f) != fingerprint(P(f))): shutil.copyfile(P(f), P(orig(f)))
    max_gap, keep, lead = opt(args, 'max-gap', .08, float), opt(args, 'keep', .05, float), opt(args, 'lead', .04, float)
    tail, voice_tail = opt(args, "tail", 1.5, float), .12
    x = load(P(orig('clean.wav'))); dur = len(x) / SR
    # the words, in the ORIGINAL time: the transcription (clean.json, the app runs this right after it), else timeline.json
    w = []
    try: w = [(float(t['start']), float(t['end'])) for t in json.load(open(P(orig('clean.json')), encoding='utf-8-sig'))['words']]
    except Exception:
        try:
            tl = json.load(open(P(orig('timeline.json')), encoding='utf-8-sig'))
            w = [(float(t['s']), float(t['e'])) for p in tl for t in p.get('words', [])] or [(float(p['s']), float(p['e'])) for p in tl]
        except Exception: pass
    if not w: sys.exit('tighten: no word times (audio/clean.json or audio/timeline.json): run the transcription first')
    w.sort()
    cuts = [[a[1] + keep / 2, b[0] - keep / 2] for a, b in zip(w, w[1:]) if b[0] - a[1] > max_gap]
    fr = SR // 100; m = x.mean(1); db = 10 * np.log10((m[:len(m) // fr * fr].reshape(-1, fr) ** 2).mean(1) + 1e-12)
    quiet = db < np.percentile(db, 95) - 38
    i = 0
    while i < len(quiet):
        if quiet[i]:
            k = i
            while k < len(quiet) and quiet[k]: k += 1
            a, b = i * .01, k * .01
            if b - a > max_gap: cuts.append([a + keep / 2, b - keep / 2])
            i = k
        else: i += 1
    t_start = max(0.0, w[0][0] - lead); t_end = min(dur, w[-1][1] + voice_tail)
    cuts = sorted(c for c in cuts if c[1] > t_start and c[0] < t_end)
    merged = []
    for c in cuts:
        if merged and c[0] <= merged[-1][1] + .02: merged[-1][1] = max(merged[-1][1], c[1])
        else: merged.append(list(c))
    spans, s0 = [], t_start
    for a, b in merged:
        a, b = max(a, t_start), min(b, t_end)
        if b >= t_end: t_end = a; break
        if a - s0 > .03: spans.append([s0, a])
        s0 = b
    spans.append([s0, t_end])
    xf = int(XF * SR); fin = np.sin(np.linspace(0, np.pi / 2, xf)) ** 2
    fin, fout = np.sqrt(fin)[:, None], np.sqrt(1 - fin)[:, None]      # equal power
    out = np.zeros((int(dur * SR) + xf * 2, 2)); pos = 0; segs = []
    for k, (a, b) in enumerate(spans):
        ia, ib = int(round(a * SR)), int(round(b * SR))
        if k: ia -= xf // 2                                              # crossfade middle exactly at the span edge
        if k < len(spans) - 1: ib += xf // 2
        seg = x[max(0, ia):ib].copy()
        if k: seg[:xf] *= fin; pos -= xf
        if k < len(spans) - 1: seg[-xf:] *= fout
        if k == len(spans) - 1:                                          # the voice's own last 30 ms fade out (no click)
            f = min(len(seg), int(.03 * SR)); seg[-f:] *= np.linspace(1, 0, f)[:, None]
        out[pos:pos + len(seg)] += seg
        segs.append({'o0': round(a, 5), 'o1': round(b, 5), 'n0': round((pos + (xf // 2 if k else 0)) / SR, 5)})
        pos += len(seg)
    out = out[:pos]
    pad = int(max(0.0, tail - voice_tail) * SR)
    out = np.vstack([out, np.zeros((pad, 2))]); ndur = len(out) / SR
    o2n = o2n_factory(segs)
    save(P('clean.wav'), out)
    for f in REMAP_JSON:
        if not os.path.exists(P(orig(f))): continue
        j = json.load(open(P(orig(f)), encoding='utf-8-sig'))
        remap_obj(j, o2n)
        if isinstance(j, dict): j['timeline'] = 'tightened'; j['duration'] = round(ndur, 3)
        json.dump(j, open(P(f), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for f in REMAP_TEXT:
        if os.path.exists(P(orig(f))): shutil.copyfile(P(orig(f)), P(f)); remap_text(P(f), o2n)
    pts = []
    for s in segs: pts += [[s['o0'], s['n0']], [s['o1'], round(s['n0'] + s['o1'] - s['o0'], 5)]]
    json.dump({'segments': segs, 'points': pts, 'oldDuration': round(dur, 4), 'newDuration': round(ndur, 4),
               'params': {'maxGap': max_gap, 'keep': keep, 'lead': lead, 'tail': tail, 'xfade': XF},
               'fingerprint': fingerprint(P('clean.wav')),
               'wrote': {f: fingerprint(P(f)) for f in files if os.path.exists(P(f)) and os.path.exists(P(orig(f)))}},
              open(P('timemap.json'), 'w', encoding='utf-8'), indent=1)
    print(f'TIGHTEN {dur:.2f} s -> {ndur:.2f} s ({len(spans) - 1} pauses cut, {dur - ndur:.2f} s removed)')


if __name__ == '__main__':
    main()
