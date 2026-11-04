"""Shared audio helpers for the Roblox story shorts scripts (tighten.py, sound_design.py, mix.py). Self-contained:
python stdlib + numpy + scipy (both installed by the Creatorize installer on Windows and Mac) + ffmpeg on PATH.

Project layout (the app's): <project>/audio/clean.wav (the voice), audio/timeline.json [{s,e,text,words:[{w,s,e}]}],
audio/events.json (the app's event pass: shots + the scene's sfx() cues), optional <project>/sfx.json or audio/sfx.json
(cues Claude wrote by hand). The SFX library: --sfx DIR, else the first of the places in sfx_dirs() that has catalog.json."""
import json, os, re, subprocess, sys, wave
import numpy as np

SR = 48000
BOOM_REL, LAYER_REL, DUCK_DB = 9.0, -4.0, 3.0   # dB vs the speech level (100 ms RMS): booms +9 (refs +8..+10), layers -4 then ducked 3 = ~-7
HERE = os.path.dirname(os.path.abspath(__file__))
NOWIN = {'creationflags': 0x08000000} if os.name == 'nt' else {}   # no console window on Windows


def opt(argv, k, d=None, cast=str):
    """--k VALUE from argv (last one wins), else d"""
    v = d
    for i, a in enumerate(argv[:-1]):
        if a == '--' + k: v = cast(argv[i + 1])
    return v


def sfx_dirs(project, argv):
    """where the library may be: --sfx DIR, CZ_ROBLOX_SFX, the project's own engine copy, the app's templates/roblox/sfx
    (scripts live in templates/skill/roblox-story-shorts/scripts), the lab's engine/sfx"""
    out = [opt(argv, 'sfx'), os.environ.get('CZ_ROBLOX_SFX')]
    out += [os.path.join(project, *p) for p in (('sfx',), ('engine', 'sfx'), ('lib', 'sfx'), ('roblox', 'sfx'))]
    out += [os.path.normpath(os.path.join(HERE, *p)) for p in (('..', 'sfx'), ('..', '..', '..', 'roblox', 'sfx'), ('..', '..', '..', 'engine', 'sfx'))]
    return [d for d in out if d]


def find_sfx(project, argv):
    for d in sfx_dirs(project, argv):
        if os.path.exists(os.path.join(d, 'catalog.json')): return d
    return None


class Catalog:
    def __init__(self, d):
        self.dir = d; self.sounds = json.load(open(os.path.join(d, 'catalog.json'), encoding='utf-8-sig'))['sounds']
        self.by, short = {}, {}
        for s in self.sounds:
            self.by[s['name']] = s; self.by.setdefault(s['file'].rsplit('.', 1)[0], s)
            short.setdefault(s['file'].split('/')[-1].rsplit('.', 1)[0], []).append(s)
        for k, v in short.items():
            if len(v) == 1: self.by.setdefault(k, v[0])
        self.by.setdefault('boom', self.by.get('vine_boom'))
        self._cache = {}

    def get(self, name):
        return self.by.get(str(name or '').strip().lower().replace('\\', '/'))

    def audio(self, s):
        if s['file'] not in self._cache:
            d = load(os.path.join(self.dir, s['file'])); self._cache[s['file']] = (d, rms100(d).max())
        return self._cache[s['file']]


def load(path):
    """any file ffmpeg reads -> float64 (n, 2) at 48 kHz"""
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True, **NOWIN).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)


def save(path, x, float32=False):
    """float (n, 2) -> 48 kHz stereo wav: 16-bit (stdlib wave), or 32-bit float (no clipping, exact levels; ffmpeg reads both)"""
    x = np.asarray(x); x = np.stack([x, x], 1) if x.ndim == 1 else x
    if float32:
        from scipy.io import wavfile
        wavfile.write(path, SR, x.astype(np.float32)); return
    w = wave.open(path, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(x, -1, 1) * 32767).round().astype('<i2').tobytes()); w.close()


def rms100(x):
    m = x.mean(1) if x.ndim == 2 else x; k = SR // 10
    if len(m) < k: m = np.pad(m, (0, k - len(m)))
    return 10 * np.log10((m[:len(m) // k * k].reshape(-1, k) ** 2).mean(1) + 1e-12)


def speech_level(voice):
    sp = rms100(voice); return float(np.median(sp[sp > sp.max() - 35]))


def ebur128(path):
    """(integrated LUFS, true peak dBTP) of a file"""
    err = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-'],
                         capture_output=True, text=True, encoding='utf-8', errors='replace', **NOWIN).stderr
    tail = err[err.rfind('Summary:'):]
    I = re.search(r'I:\s+(-?[\d.]+|-inf) LUFS', tail); P = re.search(r'Peak:\s+(-?[\d.]+|-inf) dBFS', tail)
    f = lambda m: float(m.group(1)) if m and m.group(1) != '-inf' else -120.0
    return f(I), f(P)


def lufs_of(x, tmpdir):
    tmp = os.path.join(tmpdir, '_rbx_measure.tmp.wav'); save(tmp, x)
    try: return ebur128(tmp)[0]
    finally: os.remove(tmp)


def follower(env, att, rel):
    """one-pole envelope with separate attack/release (s), run at a 1 kHz control rate"""
    step = SR // 1000; e = env[::step]; o = np.empty_like(e); y = 0.0
    a2, r2 = np.exp(-step / (att * SR)), np.exp(-step / (rel * SR))
    for i, v in enumerate(e):
        y = a2 * y + (1 - a2) * v if v > y else r2 * y + (1 - r2) * v; o[i] = y
    return np.interp(np.arange(len(env)), np.arange(len(e)) * step, o)


def limit(mix, ceil_db=-1.2):
    """true-peak limiter: 4x oversampled peak -> required gain, 3 ms look-ahead min + smoothing (never above required).
    Returns (limited, max gain reduction dB)."""
    from scipy.signal import resample_poly
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    ceil = 10 ** (ceil_db / 20)
    up = np.abs(resample_poly(mix, 4, 1, axis=0)).max(1)
    up = up[:len(mix) * 4].reshape(-1, 4).max(1); up = np.pad(up, (0, len(mix) - len(up)))
    up = np.maximum(up, np.abs(mix).max(1))
    req = np.minimum(1, ceil / np.maximum(up, 1e-9))
    w = int(.003 * SR) | 1
    g = np.minimum(uniform_filter1d(minimum_filter1d(req, w), w), req)
    return mix * g[:, None], float(20 * np.log10(g.min()))


# ---------------------------------------------------------------- timeline + cues
def words_of(project):
    """[(word, start, end)] from audio/timeline.json (the app's), else audio/clean.json"""
    A = os.path.join(project, 'audio')
    try:
        tl = json.load(open(os.path.join(A, 'timeline.json'), encoding='utf-8-sig'))
        w = [(x['w'], float(x['s']), float(x['e'])) for p in tl for x in p.get('words', [])]
        if w: return w
        return [(p.get('text', ''), float(p['s']), float(p['e'])) for p in tl]
    except Exception: pass
    try:
        cj = json.load(open(os.path.join(A, 'clean.json'), encoding='utf-8-sig'))
        return [(x.get('word', x.get('w', '')), float(x['start']), float(x['end'])) for x in cj['words']]
    except Exception: return []


def read_cues(path):
    try: j = json.load(open(path, encoding='utf-8-sig'))
    except Exception: return []
    if isinstance(j, dict): j = j.get('cues', j.get('sfx', []))
    out = []
    for c in j if isinstance(j, list) else []:
        if not isinstance(c, dict): continue
        nm = c.get('name', c.get('type'))
        try: t = float(c.get('t'))
        except Exception: continue
        if nm: out.append({**c, 't': t, 'name': str(nm)})
    return out


def scene_cues(project):
    """every cue placed on purpose: the scene's sfx() calls (audio/events.json "sfx", or audio/sfx_scene.json), sfx.json
    (project root, audio/), out/sfx_scene.json (the lab's render.mjs)"""
    A = os.path.join(project, 'audio'); cues = []
    for f in (os.path.join(A, 'events.json'), os.path.join(project, 'sfx.json'), os.path.join(A, 'sfx.json'),
              os.path.join(A, 'sfx_scene.json'), os.path.join(project, 'out', 'sfx_scene.json')):
        if os.path.exists(f): cues += read_cues(f)
    # the same cue from two sources (events.json and sfx_scene.json both carry the scene's calls): once
    seen, out = set(), []
    for c in sorted(cues, key=lambda c: c['t']):
        k = (round(c['t'], 2), c['name'])
        if k not in seen: seen.add(k); out.append(c)
    return out


def shots_of(project):
    try: ev = json.load(open(os.path.join(project, 'audio', 'events.json'), encoding='utf-8-sig'))
    except Exception: return []
    return [s for s in ev.get('shots', []) if isinstance(s, dict)]


PUNCT_END = re.compile(r'[.!?\u2026]["\')\]]*$')
TELEPORT = re.compile(r'^(teleport|teleported|teleports|poof|poofed|vanish|vanished|vanishes|disappear|disappeared|disappears|appeared|zapped)\b', re.I)


def auto_cues(project, dur):
    """a safe default set when nothing was placed: vine booms on the punchlines (the last sentence always; a short
    sentence (<= 7 words) right after a longer setup (>= 6 words)), pops on teleport/vanish words and on shots named so,
    a short woosh on hard cuts. Spaced out (booms >= 4 s apart, about one per 8 s; nothing within 0.5 s of another)."""
    w = words_of(project); cues = []
    sents, cur = [], []
    for x in w:
        cur.append(x)
        if PUNCT_END.search(x[0].strip()): sents.append(cur); cur = []
    if cur: sents.append(cur)
    booms = []
    for i, s in enumerate(sents):
        last = i == len(sents) - 1
        if last or (i > 0 and len(s) <= 7 and len(sents[i - 1]) >= 6): booms.append((0 if last else 1, s[-1][2] + .05, ' '.join(t[0] for t in s)))
    cap = max(2, int(dur / 8))
    kept = []
    for pri, t, txt in sorted(booms, key=lambda b: (b[0], -b[1])):   # the last line first, then from the end backwards
        if len(kept) < cap and all(abs(t - k[0]) >= 4 for k in kept): kept.append((t, txt))
    cues += [{'t': round(t, 3), 'name': 'vine_boom', 'note': 'auto: ' + txt[-40:]} for t, txt in kept]
    pops = ['pop/pop', 'pop/pop2', 'pop/pop3']; np_ = 0
    for x in w:
        if TELEPORT.match(re.sub(r'^\W+', '', x[0])): cues.append({'t': round(x[2], 3), 'name': pops[np_ % 3], 'note': 'auto: ' + x[0]}); np_ += 1
    for s in shots_of(project):
        t = float(s.get('t0', s.get('t', 0)) or 0)
        if t <= .3 or t >= dur - .3: continue
        nm = str(s.get('name', '') or '')
        if re.search(r'teleport|poof|vanish|appear', nm, re.I): cues.append({'t': round(t, 3), 'name': pops[np_ % 3], 'note': 'auto: shot ' + nm}); np_ += 1
        elif s.get('cut') or s.get('whip'): cues.append({'t': round(t - .08, 3), 'name': 'woosh/short', 'gain': -3, 'note': 'auto: cut'})
    out = []
    for c in sorted(cues, key=lambda c: (c['name'] != 'vine_boom', c['t'])):   # booms win a clash
        if all(abs(c['t'] - o['t']) >= .5 for o in out): out.append(c)
    return sorted(out, key=lambda c: c['t'])


def timemap_o2n(project):
    """old -> new time from audio/timemap.json (tighten.py), or None"""
    try: segs = json.load(open(os.path.join(project, 'audio', 'timemap.json'), encoding='utf-8'))['segments']
    except Exception: return None
    def f(t):
        for s in segs:
            if t < s['o0']: return s['n0']
            if t <= s['o1']: return s['n0'] + t - s['o0']
        return segs[-1]['n0'] + segs[-1]['o1'] - segs[-1]['o0']
    return f


def render_cues(cat, cues, speech, n, voice=None):
    """cues -> (boom bus, layer bus, boom mask, placed lines). Every sound's loudest 100 ms is set to speech + BOOM_REL
    (booms) or speech + LAYER_REL (the rest); a cue's gain on top. With the voice given, layers are ducked up to DUCK_DB
    under it (fast attack, slow release); booms never are (the joke)."""
    boom_bus, lay_bus, mask, placed = np.zeros((n, 2)), np.zeros((n, 2)), np.zeros(n), []
    for c in cues:
        s = cat.get(c['name'])
        if not s: print(f"UNKNOWN sfx '{c['name']}' at {c['t']:.2f}s (names: engine sfx catalog.json)"); continue
        d, pk = cat.audio(s)
        boom = s['category'] == 'boom'
        try: gain = float(c.get('gain', 0) or 0)
        except Exception: gain = 0.0
        x = d * 10 ** ((speech + (BOOM_REL if boom else LAYER_REL) - pk + max(-30, min(12, gain))) / 20)
        i = int(round(c['t'] * SR)) - (len(x) if c.get('align') == 'end' else 0)
        if i < 0: x = x[-i:]; i = 0
        if i >= n: continue
        m = min(len(x), n - i)
        (boom_bus if boom else lay_bus)[i:i + m] += x[:m]
        if boom: mask[i:i + int(.4 * SR)] = 1
        placed.append(f"{c['t']:7.2f}s  {s['name']:14s} recorded")
    if voice is not None:
        v = np.zeros(n); v[:min(n, len(voice))] = np.abs(voice[:n]).max(1)
        env = 20 * np.log10(follower(v, .01, .30) + 1e-9)
        pres = np.clip((env - (speech - 24)) / 20, 0, 1)
        lay_bus *= (10 ** (-DUCK_DB * pres / 20))[:, None]
    return boom_bus, lay_bus, mask[:n], placed
