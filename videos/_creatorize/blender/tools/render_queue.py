# ONE render queue across several films, N Blenders in total (night 2: three films' pools side by side = 8-10 Blenders
# overflowed the 16 GB card and a frame took 90 s instead of 2 s). Renders only what is MISSING on disk (dissolve pads
# + prerender from each assemble.json, like render_film.py) plus explicit redo ranges for shots whose files changed.
#   .venv/Scripts/python.exe tools/render_queue.py film/lottery film/bell film/tickets [--jobs 1]
#       [--redo film/bell:b01,film/bell:b07,film/tickets:t03:267-400] [--scale 1.0] [--samples 48] [--dry]
#       [--tune | --plan <render_plan.json> | --plan auto]
#       [--mb 0|1] (motion blur off / on, else as each shot built it) [--gpu-backend vulkan] (Blender's GPU backend, or
#       CZ_GPU_BACKEND: a laptop whose OpenGL lands on the built-in graphics reaches its graphics card through Vulkan;
#       Creatorize decides, src/main/blender/gpu.ts)
# ONE Blender at a time by default (gruss 2026-10-30: "one render task at a time and proper resource management"; the
# Cu Chi export ran 4 on the mini: 19 s a frame each, ~15 frames/min in all vs 12/min for one alone, memory full).
# --tune: the render tuner first (tools/render_tune.py: the fastest settings that look the same on this machine, and
# more Blenders only when it measured a real gain with no memory pressure; --jobs is then the upper bound);
# --plan <file>: render with a plan made before; --plan auto: each film's own render_plan.json when it has one.
import json, os, re, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

LAB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BL = os.environ.get('CZ_BLENDER') or r'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'   # Creatorize passes CZ_BLENDER
a = sys.argv[1:]
opt = lambda k, d: a[a.index(k) + 1] if k in a else d
films = [os.path.abspath(x) for x in a if not x.startswith('--') and os.path.isdir(x)]
jobs, scale, samples = int(opt('--jobs', '1')), opt('--scale', '1.0'), opt('--samples', '48')
PLAN = opt('--plan', '')
plans = {}
# --anim: each shot as animation renders with persistent data (run.py --anim; the 2026-10-28 speed pass, identical frames)
ANIM = ['--anim', '1'] if '--anim' in a else []
MB = ['--mb', opt('--mb', '1')] if '--mb' in a else []                                       # (run.py --mb)
_gb = opt('--gpu-backend', os.environ.get('CZ_GPU_BACKEND', ''))
GPUB = ['--gpu-backend', _gb] if _gb else []                                                 # (Blender's own option, before -P)
redo = {}
for r in opt('--redo', '').split(','):
    if not r: continue
    parts = r.split(':'); key = (os.path.abspath(parts[0]), parts[1])
    redo[key] = tuple(int(v) for v in parts[2].split('-')) if len(parts) > 2 else 'all'


def rng(py):
    m = re.search(r'^F0\s*,\s*F1\s*=\s*(\d+)\s*,\s*(\d+)', open(py, encoding='utf-8-sig').read(), re.M)
    return (int(m.group(1)), int(m.group(2))) if m else None


def ok(p):
    """A frame on disk counts only if it is a whole PNG (a render stopped mid-write leaves a truncated file)."""
    if not os.path.exists(p) or os.path.getsize(p) < 2000: return False
    try:
        from PIL import Image
        with Image.open(p) as im: im.verify()
        return True
    except Exception: return False


PART = '.rendering'   # Blender writes into <shot>/.rendering/ and only whole frames move into <shot>/ (a killed or crashed
                      # render once left a half-written 0841.png that stopped a 3-hour export in assemble.py)


def settle(out):
    """Move every whole frame from <out>/.rendering into <out> (a stopped run's finished frames are kept), drop the rest."""
    tmp = os.path.join(out, PART); n = 0
    if not os.path.isdir(tmp): return 0
    for f in os.listdir(tmp):
        p = os.path.join(tmp, f)
        if re.fullmatch(r'\d{4}\.png', f) and ok(p):
            try: os.replace(p, os.path.join(out, f)); n += 1; continue
            except OSError: pass
        try: os.remove(p)
        except OSError: pass
    return n


def spans(fr):
    """[3, 4, 5, 9] -> '3-5,9'"""
    out, s = [], None
    for f in sorted(fr):
        if s is None: s = e = f
        elif f == e + 1: e = f
        else: out.append(f'{s}-{e}' if e > s else str(s)); s = e = f
    if s is not None: out.append(f'{s}-{e}' if e > s else str(s))
    return ','.join(out)


pre, plan = [], []
for film in films:
    cfg = json.load(open(os.path.join(film, 'assemble.json'), encoding='utf-8-sig'))
    sub = cfg.get('dir', 'shots')
    for s, p0, p1 in cfg.get('prerender', []):
        out = os.path.join(film, sub, s); want = set(range(int(p0), int(p1) + 1)); settle(out)
        if redo.get((film, s)) == 'all': todo = want
        else: todo = {f for f in want if not ok(os.path.join(out, f'{f:04d}.png'))}
        if todo: pre.append((film, s, todo, out, '_pre'))
    for s in cfg['shots']:
        py = os.path.join(film, s + '.py'); f0, f1 = rng(py)
        for (x, y, d0, d1) in cfg.get('dissolves', []):
            if s == x: f1 = max(f1, int(d1))
            if s == y: f0 = min(f0, int(d0))
        # a cutless group (one M.Tour across these shots): each part but the last also renders the next part's first
        # frame, so assemble.py can prove the join has no seam (same camera, same set: the two pictures must match)
        for grp in cfg.get('tours', []):
            if s in grp[:-1]: f1 = max(f1, rng(py)[1] + 1)
        out = os.path.join(film, sub, s); os.makedirs(out, exist_ok=True); settle(out)
        want = set(range(f0, f1 + 1)); rd = redo.get((film, s))
        todo = {f for f in want if not ok(os.path.join(out, f'{f:04d}.png'))}
        if rd == 'all': todo = want
        elif rd: todo |= set(range(rd[0], rd[1] + 1)) & want
        if todo: plan.append((film, s, todo, out, ''))
plan.sort(key=lambda p: -len(p[2]))
print(f'QUEUE {sum(len(p[2]) for p in pre + plan)} frames in {len(pre) + len(plan)} jobs, {jobs} at a time:', flush=True)
print(f'  blender: samples {samples}, scale {scale}{", motion blur " + ("on" if MB[1] == "1" else "off") if MB else ""}{", " + " ".join(GPUB) if GPUB else ""}', flush=True)
for p in pre + plan: print(f'  {os.path.basename(p[0])}/{p[1]}{p[4]}: {len(p[2])} frames ({spans(p[2])[:60]})', flush=True)
if '--dry' in a: sys.exit(0)
if '--tune' in a and (pre or plan):
    cap, js = (jobs if '--jobs' in a else 4), []
    for film in films:
        p = subprocess.Popen([sys.executable, os.path.join(LAB, 'tools', 'render_tune.py'), film, '--samples', samples, '--scale', scale,
                              '--jobs-cap', str(cap)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf8',
                             errors='replace', creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        for ln in p.stdout: print(ln.rstrip(), flush=True)
        p.wait()
        try: pl = json.load(open(os.path.join(film, 'render_plan.json'), encoding='utf-8')); plans[film] = os.path.join(film, 'render_plan.json'); js.append(int(pl.get('jobs', 1)))
        except Exception as e: print(f'TUNE no plan for {os.path.basename(film)} ({e}): its own settings, one Blender', flush=True); js.append(1)
    jobs = max(1, min([cap] + js))
elif PLAN == 'auto':
    plans = {f: os.path.join(f, 'render_plan.json') for f in films if os.path.exists(os.path.join(f, 'render_plan.json'))}
elif PLAN:
    plans = {f: os.path.abspath(PLAN) for f in films}
if plans: print(f'PLAN {len(plans)} film(s) with a tuned plan, {jobs} Blender{"s" if jobs > 1 else ""} at a time', flush=True)
T0 = time.time()


def _affinity(pid):
    """CZ_RENDER_AFFINITY (hex core mask, Windows): keep Blender off some cores (render_tune.set_affinity)."""
    if not os.environ.get('CZ_RENDER_AFFINITY'): return
    try:
        sys.path.insert(0, os.path.join(LAB, 'tools')); import render_tune; render_tune.set_affinity(pid)
    except Exception as e: print('affinity', e, flush=True)


def run(p):
    film, s, todo, out, tag = p; t = time.time()
    lg = os.path.join(film, os.path.basename(os.path.dirname(out)), s + tag + '_q.log')
    with open(lg, 'w', encoding='utf8') as log:
        r = subprocess.Popen([BL, '-b', '--factory-startup'] + GPUB + ['-P', os.path.join(LAB, 'engine', 'run.py'), '--', os.path.join(film, s + '.py'),
                              '--frames', spans(todo), '--scale', scale, '--samples', samples, '--out', os.path.join(out, PART)] + ANIM + MB
                             + (['--plan', plans[film]] if film in plans else []), stdout=log, stderr=subprocess.STDOUT,
                             cwd=LAB, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        _affinity(r.pid); r.wait()
    settle(out)
    txt = open(lg, encoding='utf8', errors='replace').read()
    bad = [l for l in txt.splitlines() if 'Traceback' in l or ('Error:' in l and 'Shadow buffer' not in l) or 'CZ FACES MISSING' in l]
    n = sum(1 for f in todo if os.path.exists(os.path.join(out, f'{f:04d}.png')))
    print(f'DONE {os.path.basename(film)}/{s}{tag}: {n}/{len(todo)} frames in {(time.time() - t) / 60:.1f} min ({(time.time() - t) / max(1, n):.1f} s/frame)'
          + (f'  PROBLEMS: {bad[:3]}' if bad or r.returncode else ''), flush=True)
    return n


if pre:
    with ThreadPoolExecutor(jobs) as ex: list(ex.map(run, pre))
with ThreadPoolExecutor(jobs) as ex: total = sum(ex.map(run, plan))
print(f'RENDER_QUEUE {total} frames, {(time.time() - T0) / 60:.1f} min, {total / max(1e-6, time.time() - T0):.2f} frames/s', flush=True)
