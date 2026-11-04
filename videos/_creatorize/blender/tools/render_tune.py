# render_tune.py - the automatic render tuner (2026-10-30). gruss: "render settings should be always adjusted before the
# render starts. Meaning claude would automatically pick the best render settings for the given machine to minimize
# render time without big perceivable quality loss ... damn near realtime". And: "it's known very well that one render
# task at a time and proper resource management". Code decides, not a prompt; runs before every export render.
#   python tools/render_tune.py <film> [--samples 4] [--scale 1.0] [--jobs-cap 4] [--shots e07,e29] [--force]
#                                      [--ablate] [--no-parallel-test] [--plan-out <film>/render_plan.json]
#                                      [--keep samples]   (knobs never touched: the toon look keeps its 8 samples)
# 1. machine profile (cached per machine: GPU, VRAM / unified memory, cores, OS; free memory read every run)
# 2. probe: 1-2 representative shots, each built ONCE in Blender (engine/tune.py via run.py --tuneprobe): 3 frames at the
#    shot's own settings = the reference, then each candidate setting on top of the kept ones; kept only when every probe
#    frame passes engine/tunemetric.BAR against the reference (mean SSIM >= 0.985, worst 32 px block >= 0.90, PSNR >= 36)
#    AND it is >= 3 % faster (texture limit: when it frees memory at no cost). The second shot re-checks the first's set.
#    Peak memory: the Blender's own (working set / RSS) + the GPU's (nvidia-smi; the Mac's GPU allocation via ioreg).
# 3. parallel Blenders: ONE by default. 2+ only after a measured test (the same shot rendered by 1 and by 2 Blenders at
#    once, as the export renders it) shows >= 15 % more frames a minute AND the memory stays under 80 % with no pressure.
# 4. render_plan.json in the film: settings + jobs + every decision with its numbers (the TUI / export log show it).
#    Reused while the machine, the kit and the probed files are the same. Prints `TUNE PLAN {json}` last.
# Override: CZ_RENDER_TUNE=0 or project.json settings.renderTune = false -> the shot's own settings, 1 Blender;
# settings.renderTune = {"samples": 8, "jobs": 2, ...} forces those values over the tuned ones. Any failure -> the same
# safe fallback (own settings, 1 Blender) with the reason in the plan.
import datetime, hashlib, json, os, platform, re, subprocess, sys, threading, time

LAB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(LAB, 'engine'))
import tunemetric as TM  # noqa: E402

BL = os.environ.get('CZ_BLENDER') or r'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
NOWIN = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
VERSION = 1
GB = 1024 ** 3
# candidates in the order they usually pay (references/render.md: measured on Basement + Cu Chi). A knob the shot does
# not use (no fog, no ray tracing) or already has cheaper is skipped by the probe.
CANDIDATES = [
    # the scene pass first (engine/scenepass.py, docs/SCENE_OPTIMIZER.md): the library placements as GN point instances,
    # then LOD by screen size (k triangles per pixel: 1 = aggressive, 4 = safe), then static joins. Geometry first: every
    # render setting after it is judged on the optimized scene, all against the as-built frames.
    ['scene_gn', {'scene_gn': 1}],
    ['scene_lod_1', {'scene_lod': 1.0}],
    ['scene_lod_4', {'scene_lod': 4.0}],
    ['scene_join', {'scene_join': 1}],
    # shadows first: on the Cu Chi jungle (PC) they are 77 % of a frame (hundreds of library plants re-drawn into the
    # shadow maps of 11 lights every TAA sample); texture limits cost no time and only free memory (1024 left out: no
    # speed, a soft close-up risk)
    ['shadow_half', {'shadow_scale': 0.5}],
    ['shadow_075', {'shadow_scale': 0.75}],
    ['fill_no_shadow', {'area_shadows': 0}],
    ['plant_shadow_lod_25', {'shadow_proxy': 0.25}],
    ['plant_shadow_lod_10', {'shadow_proxy': 0.1}],
    ['lamps_no_shadow', {'point_shadows': 0}],
    ['far_casters_30', {'far_casters': 30}],
    ['light_res_4mm', {'light_res': 0.004}],
    ['light_reach_03', {'light_threshold': 0.03}],
    ['light_reach_10', {'light_threshold': 0.1}],
    ['samples_3', {'samples': 3}],
    ['samples_2', {'samples': 2}],
    ['vol_tile_16', {'vol_tile': 16}],
    ['vol_samples_16', {'vol_samples': 16, 'vol_shadow_samples': 4}],
    ['gi_quarter', {'gi_res': 4, 'rt_res': 4}],
    ['gi_steps_4', {'gi_steps': 4}],
    ['shadow_steps_3', {'shadow_steps': 3}],
    ['tex_2048', {'tex_limit': 2048}],
]
ABLATE = ['no_volumes', 'no_volume_shadows', 'no_library_models', 'no_scatter', 'no_shadows', 'no_local_shadows', 'no_sun_shadows', 'no_raytracing', 'no_dof',
          'no_motion_blur', 'samples_1', 'no_people']


def say(*a): print(*a, flush=True)


# ---------------------------------------------------------------- machine
def _run(cmd, timeout=10):
    try: return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, creationflags=NOWIN).stdout
    except Exception: return ''


def _win_mem():
    import ctypes
    class MS(ctypes.Structure):
        _fields_ = [('dwLength', ctypes.c_ulong), ('dwMemoryLoad', ctypes.c_ulong), ('ullTotalPhys', ctypes.c_ulonglong),
                    ('ullAvailPhys', ctypes.c_ulonglong), ('ullTotalPageFile', ctypes.c_ulonglong), ('ullAvailPageFile', ctypes.c_ulonglong),
                    ('ullTotalVirtual', ctypes.c_ulonglong), ('ullAvailVirtual', ctypes.c_ulonglong), ('x', ctypes.c_ulonglong)]
    m = MS(); m.dwLength = ctypes.sizeof(m); ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m))
    return m.ullTotalPhys, m.ullAvailPhys


def _mac_vm():
    """(free-ish bytes: free + inactive + speculative + purgeable, compressor bytes, swap used bytes)"""
    t = _run(['/usr/bin/vm_stat']); ps = int((re.search(r'page size of (\d+)', t) or [0, 16384])[1])
    g = lambda k: int((re.search(rf'{k}:\s+(\d+)', t) or [0, 0])[1])
    free = (g('Pages free') + g('Pages inactive') + g('Pages speculative') + g('Pages purgeable')) * ps
    comp = g('Pages occupied by compressor') * ps
    sw = _run(['/usr/sbin/sysctl', '-n', 'vm.swapusage']); m = re.search(r'used = ([\d.]+)M', sw)
    return free, comp, int(float(m.group(1)) * 1024 ** 2) if m else 0


def gpu_sample():
    """(gpu memory in use bytes, utilization %) machine-wide, or (None, None)."""
    if sys.platform == 'darwin':
        t = _run(['/usr/sbin/ioreg', '-r', '-d', '1', '-w', '0', '-c', 'IOAccelerator'], 5)
        m = re.search(r'"In use system memory"=(\d+)', t); u = re.search(r'"Device Utilization %"=(\d+)', t)
        return (int(m.group(1)) if m else None), (int(u.group(1)) if u else None)
    t = _run(['nvidia-smi', '--query-gpu=memory.used,utilization.gpu', '--format=csv,noheader,nounits'], 5)
    try:
        a, b = t.strip().splitlines()[0].split(','); return int(a) * 1024 ** 2, int(b)
    except Exception: return None, None


def memory_now():
    """{avail, total, vram_total, vram_used, compressor, swap} bytes: what is free for Blenders right now."""
    out = {}
    if sys.platform == 'win32':
        out['total'], out['avail'] = _win_mem()
    elif sys.platform == 'darwin':
        out['total'] = int(_run(['/usr/sbin/sysctl', '-n', 'hw.memsize']).strip() or 0)
        out['avail'], out['compressor'], out['swap'] = _mac_vm()
    else:
        try:
            mi = open('/proc/meminfo').read(); g = lambda k: int(re.search(rf'{k}:\s+(\d+)', mi).group(1)) * 1024
            out['total'], out['avail'] = g('MemTotal'), g('MemAvailable')
        except Exception: pass
    if sys.platform != 'darwin':
        t = _run(['nvidia-smi', '--query-gpu=memory.total,memory.used', '--format=csv,noheader,nounits'], 5)
        try: a, b = t.strip().splitlines()[0].split(','); out['vram_total'], out['vram_used'] = int(a) * 1024 ** 2, int(b) * 1024 ** 2
        except Exception: pass
    return out


def cache_dir():
    d = os.environ.get('CZ_TUNER_CACHE') or os.path.join(os.path.expanduser('~'), '.cache', 'creatorize', 'render_tuner')
    os.makedirs(d, exist_ok=True); return d


def machine():
    """The machine's fixed profile, cached (cache_dir()/machine.json), + its memory right now."""
    host = platform.node()
    p = os.path.join(cache_dir(), 'machine.json')
    try:
        m = json.load(open(p, encoding='utf-8'))
        if m.get('host') != host or m.get('v') != VERSION: m = None
    except Exception: m = None
    if not m:
        m = dict(v=VERSION, host=host, os=f'{platform.system()} {platform.release()}', arch=platform.machine(), cores=os.cpu_count() or 4)
        if sys.platform == 'darwin':
            m['cpu'] = _run(['/usr/sbin/sysctl', '-n', 'machdep.cpu.brand_string']).strip()
            m['gpu'] = m['cpu'] + ' GPU'; m['unified'] = True
            m['ram_gb'] = round(int(_run(['/usr/sbin/sysctl', '-n', 'hw.memsize']).strip() or 0) / GB, 1); m['vram_gb'] = None
        else:
            m['cpu'] = platform.processor()
            t = _run(['nvidia-smi', '--query-gpu=name,memory.total', '--format=csv,noheader,nounits'])
            try: n, v = t.strip().splitlines()[0].split(','); m['gpu'], m['vram_gb'] = n.strip(), round(int(v) / 1024, 1)
            except Exception: m['gpu'], m['vram_gb'] = None, None
            m['unified'] = False
            mn = memory_now(); m['ram_gb'] = round(mn.get('total', 0) / GB, 1)
        m['id'] = hashlib.sha1(json.dumps([m['host'], m['os'], m['gpu'], m['ram_gb'], m['cores']]).encode()).hexdigest()[:12]
        try: json.dump(m, open(p, 'w', encoding='utf-8'), indent=1)
        except Exception: pass
    return m


# ---------------------------------------------------------------- the film
def shot_range(py):
    m = re.search(r'^F0\s*,\s*F1\s*=\s*(\d+)\s*,\s*(\d+)', open(py, encoding='utf-8-sig').read(), re.M)
    return (int(m.group(1)), int(m.group(2))) if m else None


def film_shots(film):
    cfg = json.load(open(os.path.join(film, 'assemble.json'), encoding='utf-8-sig'))
    out = []
    for s in cfg['shots']:
        r = shot_range(os.path.join(film, s + '.py'))
        if r: out.append((s, r[0], r[1]))
    return out


def pick_probe_shots(film, shots, n=2):
    """The longest shot (it weighs most in the render) and the shot with the most of its own scene code among the rest
    (a proxy for the heaviest set: a jungle crossing, a crowd)."""
    if not shots: return []
    by_len = sorted(shots, key=lambda s: -(s[2] - s[1]))
    pick = [by_len[0]]
    rest = [s for s in shots if s is not by_len[0]]
    if n > 1 and rest:
        pick.append(max(rest, key=lambda s: os.path.getsize(os.path.join(film, s[0] + '.py'))))
    return pick


def probe_frames(f0, f1, k=3):
    n = f1 - f0
    return sorted({f0 + max(1, round(n * x)) for x in ((0.2, 0.5, 0.8) if k == 3 else [i / (k + 1) for i in range(1, k + 1)])})


def kit_key():
    h = hashlib.sha1()
    for f in ('run.py', 'tune.py', 'tunemetric.py', 'scenepass.py', 'mega.py', 'detail.py', 'cz.py', 'assets.py'):
        try: h.update(open(os.path.join(LAB, 'engine', f), 'rb').read())
        except OSError: pass
    try: h.update(open(os.path.abspath(__file__), 'rb').read())
    except OSError: pass
    return h.hexdigest()[:12]


def film_key(film, probe_shots):
    """What the decisions depend on: the shared scene code, assemble.json and the probed shots' own files."""
    h = hashlib.sha1()
    names = sorted(f for f in os.listdir(film) if f.endswith('.py') and not re.fullmatch(r'[a-z]+\d+[a-z]?\.py', f))
    names += [s + '.py' for s in probe_shots] + ['assemble.json']
    for f in names:
        try: h.update(f.encode() + b'|' + open(os.path.join(film, f), 'rb').read())
        except OSError: pass
    return h.hexdigest()[:12]


def project_override(film):
    try: v = json.load(open(os.path.join(film, 'project.json'), encoding='utf-8-sig')).get('settings', {}).get('renderTune')
    except Exception: return None
    return v


# ---------------------------------------------------------------- running Blender
def set_affinity(pid):
    """CZ_RENDER_AFFINITY=0xFFFF0 (hex mask): keep Blender off some cores (the owner's PC leaves 0-3 free). Windows only."""
    mask = os.environ.get('CZ_RENDER_AFFINITY')
    if not mask or sys.platform != 'win32': return
    try:
        import ctypes
        k = ctypes.windll.kernel32; k.OpenProcess.restype = ctypes.c_void_p
        h = k.OpenProcess(0x0200 | 0x0400, False, pid)
        k.SetProcessAffinityMask(ctypes.c_void_p(h), ctypes.c_size_t(int(mask, 16))); k.CloseHandle(ctypes.c_void_p(h))
    except Exception as e: say(f'TUNE affinity not set: {e}')


class GpuWatch:
    """Samples the GPU's memory + utilization in the background; .peak / .util_avg over the watched span."""
    def __init__(self, every=0.5):
        self.every, self.samples, self.stop_ = every, [], False
        self.base = gpu_sample()[0]
        self.t = threading.Thread(target=self._loop, daemon=True); self.t.start()

    def _loop(self):
        while not self.stop_:
            m, u = gpu_sample()
            if m is not None: self.samples.append((time.time(), m, u))
            time.sleep(self.every)

    def stop(self):
        self.stop_ = True; self.t.join(timeout=10)
        mems = [s[1] for s in self.samples]; us = [s[2] for s in self.samples if s[2] is not None]
        busy = [u for u in us if u > 5]
        return dict(base=self.base, peak=max(mems) if mems else None, delta=(max(mems) - self.base) if mems and self.base is not None else None,
                    util=round(sum(busy) / len(busy)) if busy else None)


def blender(args, log_path, timeout, env=None, on_line=None):
    """Run Blender (no window), stream its CZ lines, kill it after timeout s. -> (returncode, seconds, text)"""
    t = time.time()
    with open(log_path, 'w', encoding='utf8') as log:
        # (CZ_GPU_BACKEND: the backend the export's Blenders use on this computer, Creatorize blender/gpu.ts: the probe
        # measures the same graphics card the render will draw on)
        gb = os.environ.get('CZ_GPU_BACKEND', '')
        p = subprocess.Popen([BL, '-b', '--factory-startup'] + (['--gpu-backend', gb] if gb else []) + ['-P', os.path.join(LAB, 'engine', 'run.py'), '--'] + args,
                             stdout=subprocess.PIPE, stderr=subprocess.STDOUT, cwd=LAB, creationflags=NOWIN, env={**os.environ, **(env or {})},
                             text=True, encoding='utf8', errors='replace')
        set_affinity(p.pid)
        kill = threading.Timer(timeout, p.kill); kill.start()
        buf = []
        try:
            for ln in p.stdout:
                log.write(ln); buf.append(ln)
                if on_line and ln.startswith('CZ '): on_line(ln.rstrip())
            p.wait()
        finally: kill.cancel()
    return p.returncode, time.time() - t, ''.join(buf)


# ---------------------------------------------------------------- the probe
def probe_shot(film, shot, f0, f1, samples, scale, verify, ablate, work, timeout, keep=(), only=()):
    cands = [c for c in CANDIDATES if not set(c[1]) & set(keep) and (not only or c[0] in only)]
    req = dict(frames=probe_frames(f0, f1), out=os.path.join(work, shot), result=os.path.join(work, shot, 'result.json'),
               candidates=cands if verify is None else [], verify=verify, ablate=ABLATE if ablate else [], gain=0.03)
    os.makedirs(req['out'], exist_ok=True)
    rp = os.path.join(work, shot, 'req.json'); json.dump(req, open(rp, 'w', encoding='utf8'), indent=1)
    try: os.remove(req['result'])
    except OSError: pass
    gw = GpuWatch()
    built = {}
    def line(ln):
        if ln.startswith('CZ built in'): built['s'] = float(re.search(r'built in ([\d.]+)s', ln).group(1))
        if ln.startswith('CZ TUNE'): say('TUNE ' + shot + ': ' + ln[8:][:240])
        if ln.startswith('CZ SCENE'): say('SCENE ' + shot + ': ' + ln[9:][:240])
    rc, secs, txt = blender([os.path.join(film, shot + '.py'), '--samples', str(samples), '--scale', str(scale), '--tuneprobe', rp],
                            os.path.join(work, shot, 'probe.log'), timeout, on_line=line)
    g = gw.stop()
    try: res = json.load(open(req['result'], encoding='utf-8'))
    except Exception:
        tail = ' | '.join(l for l in txt.splitlines() if 'Error' in l or 'Traceback' in l)[-400:]
        raise RuntimeError(f'probe of {shot} gave no result (exit {rc}, {secs:.0f} s){": " + tail if tail else ""}')
    res.update(shot=shot, seconds_total=round(secs, 1), build_s=built.get('s'), gpu=g)
    return res


def parallel_test(film, shot, f0, f1, samples, scale, plan_path, work, timeout, n=2):
    """The same consecutive frames rendered as the export renders them (--anim, the plan): 1 Blender, then n at once.
    -> {single_fps, multi_fps, gain, pressure, mem}"""
    k = min(f1 - f0 + 1, int(os.environ.get('CZ_TUNE_PARALLEL_FRAMES', '24')))     # (a short run: the test must not cost more than it can save)
    fr = f'{f0}-{f0 + k - 1}'
    args = lambda i: [os.path.join(film, shot + '.py'), '--frames', fr, '--samples', str(samples), '--scale', str(scale), '--anim', '1',
                      '--plan', plan_path, '--out', os.path.join(work, 'par', f'{shot}_{i}')]
    anim = lambda txt: float((re.search(r'CZ anim \d+ frames in \d+ runs ([\d.]+) s/frame', txt) or [0, 'nan'])[1])
    m0 = memory_now(); gw = GpuWatch()
    rc, s1, t1 = blender(args('single'), os.path.join(work, 'par_single.log'), timeout)
    g1 = gw.stop()
    if rc != 0: raise RuntimeError(f'parallel test: the single render failed (exit {rc})')
    gw = GpuWatch(); out, ths, low = {}, [], {'avail': None, 'pressure': False}
    def run(i):
        out[i] = blender(args(i), os.path.join(work, f'par_{i}.log'), timeout)
    def mem_watch():
        while any(t.is_alive() for t in ths):
            m = memory_now(); a = m.get('avail')
            if a is not None: low['avail'] = a if low['avail'] is None else min(low['avail'], a)
            if sys.platform == 'darwin' and (m.get('swap', 0) > m0.get('swap', 0) + 256 * 1024 ** 2 or m.get('compressor', 0) > m0.get('compressor', 0) + GB): low['pressure'] = True
            if m.get('vram_total') and m.get('vram_used', 0) > 0.92 * m['vram_total']: low['pressure'] = True
            if a is not None and m.get('total') and a < 0.1 * m['total']: low['pressure'] = True
            time.sleep(1)
    t = time.time()
    ths = [threading.Thread(target=run, args=(i,)) for i in range(n)]
    for th in ths: th.start()
    mw = threading.Thread(target=mem_watch); mw.start()
    for th in ths: th.join()
    mw.join(); sm = time.time() - t; gm = gw.stop()
    if any(out[i][0] != 0 for i in range(n)): raise RuntimeError('parallel test: a parallel render failed')
    # the frames alone (each Blender's own "CZ anim ... s/frame", builds left out: a 24-frame test would overweight the
    # build overlap that a 70-frame shot has much less of): n Blenders at once give n / t_multi frames a second vs 1 / t1
    ta, tm = anim(t1), max(anim(out[i][2]) for i in range(n))
    gain = n * ta / tm - 1 if ta == ta and tm == tm and tm > 0 else (n * k / sm) / (k / s1) - 1
    return dict(frames=k, single_s=round(s1, 1), multi_s=round(sm, 1), single_fpm=round(60 / ta if ta == ta and ta > 0 else 60 * k / s1, 1),
                multi_fpm=round(60 * n / tm if tm == tm and tm > 0 else 60 * n * k / sm, 1), wall_gain=round((n * k / sm) / (k / s1) - 1, 3),
                gain=round(gain, 3), single_s_per_frame=ta, multi_s_per_frame=tm, pressure=low['pressure'],
                min_avail_gb=round(low['avail'] / GB, 1) if low['avail'] else None, gpu_single=g1, gpu_multi=gm, n=n)


# ---------------------------------------------------------------- the plan
def scene_section(results):
    """render_plan.json 'scene': what the scene pass did on each probe shot (engine/scenepass.py: GN instances, LOD by
    screen size, joins), every scene decision with its numbers; the render Blenders add 'shots' (one per shot)."""
    out = dict(probe=[], summary='')
    for r in results:
        steps = [st for st in r.get('steps', []) if st.get('kind') == 'candidate' and any(k.startswith('scene_') for k in (st.get('changes') or {}))]
        last = next((st.get('scene') for st in reversed(steps) if st.get('kept') and st.get('scene')), None) or \
            next((st.get('scene') for st in reversed(steps) if st.get('scene')), None) or {}
        out['probe'].append(dict(shot=r['shot'], ref_s_per_frame=r['ref']['t'],
                                 decisions=[dict(name=st['name'], changes=st.get('changes'), t=st.get('t'), vs_ref=st.get('vs_ref'),
                                                 quality={k: (st.get('quality') or {}).get(k) for k in ('ssim', 'block', 'psnr')} if st.get('quality') else None,
                                                 kept=st.get('kept'), why=st.get('why') or st.get('skipped')) for st in steps],
                                 before=last.get('before'), gn=last.get('gn'), lod=last.get('lod'), join=last.get('join')))
    parts = []
    for p in out['probe']:
        kept = [d['name'] for d in p['decisions'] if d.get('kept')]
        lod = p.get('lod') or {}
        tri = f", library tris {lod['tris_before'] / 1e6:.1f} M -> {lod['tris_after'] / 1e6:.1f} M" if lod.get('tris_before') and any(k.startswith('scene_lod') for k in kept) else ''
        gn = p.get('gn') or {}
        parts.append(f"{p['shot']}: {', '.join(kept) or 'nothing kept'}" + (f" ({gn.get('placements')} placements -> {gn.get('instancers')} GN instancers{tri})" if gn and kept else ''))
    out['summary'] = 'scene pass ' + '; '.join(parts) if parts else ''
    return out


def fallback(m, why, samples, scale):
    return dict(version=VERSION, made=datetime.datetime.now().isoformat(timespec='seconds'), machine=m, machine_id=m.get('id'),
                settings={}, jobs=1, jobs_why='one Blender at a time (the safe default)', samples=samples, scale=scale,
                fallback=True, why=why, decisions=[])


def decide_jobs(m, per_bl_bytes, gpu_bytes, cap):
    """How many Blenders memory would allow (each one's peak: own memory + GPU share; 80 % of what is free now)."""
    mn = memory_now(); avail = mn.get('avail') or 0
    if m.get('unified') or sys.platform == 'darwin':
        need = (per_bl_bytes or 2 * GB) + (gpu_bytes or 2 * GB); by_mem = int(0.8 * avail // max(need, 1))
        why = f'{avail / GB:.1f} GB free, each Blender peaks at {need / GB:.1f} GB (own {(per_bl_bytes or 0) / GB:.1f} + GPU {(gpu_bytes or 0) / GB:.1f})'
    else:
        need = per_bl_bytes or 2 * GB; by_mem = int(0.8 * avail // max(need, 1)); why = f'{avail / GB:.1f} GB RAM free, each Blender peaks at {need / GB:.1f} GB'
        if mn.get('vram_total') and gpu_bytes:
            vfree = mn['vram_total'] - mn.get('vram_used', 0); by_v = int(0.85 * vfree // max(gpu_bytes, 1)); by_mem = min(by_mem, by_v)
            why += f'; {vfree / GB:.1f} GB VRAM free, {gpu_bytes / GB:.1f} GB each'
    return max(1, min(cap, by_mem)), why


def main(argv):
    a = argv
    opt = lambda k, d: a[a.index(k) + 1] if k in a else d
    film = os.path.abspath(next(x for x in a if not x.startswith('--') and os.path.isdir(x)))
    samples, scale, cap = int(opt('--samples', '4')), float(opt('--scale', '1.0')), int(opt('--jobs-cap', '4'))
    plan_path = os.path.abspath(opt('--plan-out', os.path.join(film, 'render_plan.json')))
    m = machine()
    t0 = time.time()
    ov = project_override(film)
    def done(plan):
        if isinstance(ov, dict):          # the project's forced values win (tested or not)
            for k, v in ov.items():
                if k == 'jobs': plan['jobs'] = max(1, int(v)); plan['jobs_why'] = f'forced by project.json settings.renderTune.jobs = {v}'
                else: plan['settings'][k] = v
            plan['forced'] = ov
        plan['tune_seconds'] = round(time.time() - t0, 1)
        json.dump(plan, open(plan_path, 'w', encoding='utf8'), indent=1)
        summary = dict(settings=plan['settings'], per_shot=[c[0] for c in plan.get('shot_candidates') or []], jobs=plan['jobs'], jobs_why=plan.get('jobs_why'), fallback=plan.get('fallback', False),
                       why=plan.get('why'), before=plan.get('before_s_per_frame'), after=plan.get('after_s_per_frame'), cached=plan.get('cached', False),
                       seconds=plan['tune_seconds'], plan=plan_path, scene=(plan.get('scene') or {}).get('summary'))
        say('TUNE PLAN ' + json.dumps(summary)); return plan
    if os.environ.get('CZ_RENDER_TUNE', '1') == '0' or ov is False:
        return done(fallback(m, 'tuner off (' + ('CZ_RENDER_TUNE=0' if ov is not False else 'project.json settings.renderTune = false') + ')', samples, scale))
    try:
        shots = film_shots(film)
        probe = [s for s in shots if s[0] in opt('--shots', '').split(',')] or pick_probe_shots(film, shots, int(opt('--probe-shots', '2')))
        if not probe: raise RuntimeError('no shots with F0, F1 in assemble.json')
    except Exception as e:
        return done(fallback(m, f'no shots to probe ({type(e).__name__}: {e})', samples, scale))
    key = dict(machine=m['id'], kit=kit_key(), film=film_key(film, [s[0] for s in probe]), samples=samples, scale=scale, keep=opt('--keep', ''),
               only=opt('--only', ''))
    if '--force' not in a:
        try:
            old = json.load(open(plan_path, encoding='utf-8'))
            if old.get('key') == key and not old.get('fallback'):
                old['cached'] = True; say(f'TUNE reusing the plan made {old.get("made")} on this machine (same kit, same scenes)')
                return done(old)
        except Exception: pass
    work = os.path.join(film, '.suite', 'tune'); os.makedirs(work, exist_ok=True)
    timeout = float(os.environ.get('CZ_TUNE_TIMEOUT', '1200'))
    try:
        say(f'TUNE machine {m.get("gpu")} | {m.get("ram_gb")} GB{" unified" if m.get("unified") else ""} | {m["cores"]} cores | probing {", ".join(s[0] for s in probe)}')
        results, verify = [], None
        for s, f0, f1 in probe:
            r = probe_shot(film, s, f0, f1, samples, scale, verify, '--ablate' in a, work, timeout, keep=[k for k in opt('--keep', '').split(',') if k],
                           only=[k for k in opt('--only', '').split(',') if k])
            results.append(r); verify = r.get('accepted') or {}      # (the next shot re-checks this set; empty: measures only)
        settings = dict(results[-1].get('accepted') or {})
        # a knob kept on the last shot but not on an earlier one never happens (the later shot only re-checks), but
        # make sure: only what every probed shot kept
        for r in results[:-1]:
            for k in list(settings):
                if k not in (r.get('accepted') or {}): settings.pop(k)
        # per shot (engine/tune.shot_plan in the render's own Blender): what the first probe shot kept, in its order; each
        # shot re-judges it on 2 of its own frames (whole, else knob by knob). `settings` = the set every probed shot
        # passed: used for tiny re-renders and when CZ_TUNE_PER_SHOT=0.
        shot_cands = [[st['name'], st['changes']] for st in results[0].get('steps', [])
                      if st.get('kind') == 'candidate' and st.get('kept') and st.get('name') != 'verify']
        decisions = []
        for r in results:
            for st in r.get('steps', []):
                d = dict(shot=r['shot'], **{k: st.get(k) for k in ('kind', 'name', 'changes', 't', 'vs_ref', 'quality', 'kept', 'why', 'skipped', 'share', 'error') if st.get(k) is not None})
                decisions.append(d)
        before = round(sum(r['ref']['t'] for r in results) / len(results), 3)
        after = round(sum(r['t'] for r in results) / len(results), 3)
        per_rss = max((r.get('peak_rss') or 0) for r in results) or None
        gpu_b = max((r['gpu'].get('delta') or 0) for r in results) or None
        plan = dict(version=VERSION, made=datetime.datetime.now().isoformat(timespec='seconds'), machine=m, machine_id=m['id'], key=key,
                    settings=settings, shot_candidates=shot_cands, samples=samples, scale=scale, fallback=False,
                    before_s_per_frame=before, after_s_per_frame=after, speedup=round(before / max(after, 1e-6), 2),
                    probe=[dict(shot=r['shot'], frames=r['frames'], info=r.get('info'), ref=r['ref'], t=r['t'], speedup=r.get('speedup'),
                                build_s=r.get('build_s'), seconds=r.get('seconds_total'), peak_rss_gb=round((r.get('peak_rss') or 0) / GB, 2),
                                gpu=dict(r['gpu'], delta_gb=round((r['gpu'].get('delta') or 0) / GB, 2)),
                                ablate=[d for d in r.get('steps', []) if d.get('kind') == 'ablate']) for r in results],
                    decisions=decisions, quality_bar=TM.BAR, peak_rss_gb=round((per_rss or 0) / GB, 2), gpu_peak_gb=round((gpu_b or 0) / GB, 2))
        plan['scene'] = scene_section(results)
        # parallel Blenders: one, unless a measured test proves more is faster with no memory pressure (gruss's rule)
        jobs, why = 1, 'one Blender at a time (default: one render task at a time)'
        by_mem, mem_why = decide_jobs(m, per_rss, gpu_b, cap)
        plan['memory'] = mem_why
        if by_mem >= 2 and cap >= 2 and '--no-parallel-test' not in a and os.environ.get('CZ_TUNE_PARALLEL', '1') != '0':
            json.dump(plan, open(plan_path, 'w', encoding='utf8'), indent=1)       # (the test renders with these settings)
            s, f0, f1 = probe[0]
            say(f'TUNE parallel test: {s} as the export renders it, 1 Blender then 2 at once ({mem_why})')
            try:
                pt = parallel_test(film, s, f0, f1, samples, scale, plan_path, work, timeout)
                plan['parallel_test'] = pt
                say(f'TUNE parallel test: 1 Blender {pt["single_fpm"]} frames/min, 2 at once {pt["multi_fpm"]} frames/min ({100 * pt["gain"]:+.0f} %)'
                    + (', memory pressure' if pt['pressure'] else ''))
                if pt['gain'] >= 0.15 and not pt['pressure']:
                    jobs, why = 2, f'2 Blenders: measured {pt["single_fpm"]} -> {pt["multi_fpm"]} frames/min (+{100 * pt["gain"]:.0f} %), no memory pressure ({mem_why})'
                else:
                    why = (f'one Blender: 2 at once measured {100 * pt["gain"]:+.0f} % ({pt["single_fpm"]} -> {pt["multi_fpm"]} frames/min)'
                           + (' with memory pressure' if pt['pressure'] else '') + ', not worth it')
            except Exception as e:
                why = f'one Blender (parallel test failed: {e})'
        elif by_mem < 2:
            why = f'one Blender (memory: {mem_why})'
        plan['jobs'], plan['jobs_why'] = jobs, why
        plan['why'] = f'{before:.2f} -> {after:.2f} s/frame on the probe frames ({plan["speedup"]}x), {jobs} Blender{"s" if jobs > 1 else ""}' + \
            (f'; {plan["scene"]["summary"]}' if plan.get('scene', {}).get('summary') else '')
        return done(plan)
    except Exception as e:
        say(f'TUNE probe failed ({type(e).__name__}: {e}): rendering with the shots\' own settings, one Blender')
        return done(fallback(m, f'probe failed: {type(e).__name__}: {str(e)[:300]}', samples, scale))


if __name__ == '__main__':
    main(sys.argv[1:])
