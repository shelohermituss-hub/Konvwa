#!/usr/bin/env python3
# signoff.py - the 3D Informational sign-off gate (mega v2 package B, 2026-10-30): a film may not be exported while this
# says FAIL. Runs `blender -b -P engine/run.py -- <shot> --check` for every shot of a project (4 at a time, like
# check_layout in the app: src/main/blender/check.ts), reads every check line (contact.py's CZ CONTACT through / floating /
# coplanar / cutaway / camclip / sweep, clipcheck's CZ CLIP / CZ SITCHECK, the camera gate's CZ CAMJERK, a shot that does
# not build) and prints
#   SIGNOFF <project>: PASS (<n> shots, <s> s)           or
#   SIGNOFF <project>: FAIL (<k> issues in <m> of <n> shots) + one line per issue with its fix
# Exit code 0 = PASS, 1 = FAIL, 2 = could not run.
#   python tools/signoff.py <project dir> [--lanes 4] [--blender <path>] [--only e01,e02] [--gate overlap|all] [--json out.json]
# What FAILS (fix round 2026-10-30, exactly check.ts EXPORT_GATE): overlaps (through / floating / coplanar from 12 px /
# cutaway / camclip / sweep / a limb clip, CZ CLIP) and a shot that does not build. Notes only (listed, never a FAIL):
# camera lines, a seat (CZ SITCHECK), faces, people (CZ HOLD / CZ FOOTSLIDE), coplanar under 12 px, a partial overlap
# check (`CZ CONTACT partial`: look at the unchecked frames), a crashed or missing one (checkfail), CZ CONTACTINFO.
# --gate all fails on the notes too.
# For engine developers: a build never runs this by hand (the app runs the same check before the export).
# Plain Python 3 (no Blender modules): Windows and Mac (`python`, not the Windows Store `python3` stub). Blender:
# --blender, else $CZ_BLENDER, else the copy the app installed (<userData>/blender/<ver>/), else the newest
# "Blender Foundation/Blender x.y" (Windows) / /Applications/Blender.app (Mac), else `blender` on PATH.
import argparse, concurrent.futures as cf, glob, json, os, re, shutil, subprocess, sys, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
RUN = HERE.parent / 'engine' / 'run.py'
SEQ = re.compile(r'^[a-z]+\d+\.py$')
RANGE = re.compile(r'^F0\s*,\s*F1\s*=\s*(\d+)\s*,\s*(\d+)', re.M)
CONTACT = re.compile(r'^CZ CONTACT (\w+) (\S+) f=(\d+) (\S+) x (\S+) depth=([\d.]+) px=(\d+) fix: (.*)$')


# = src/main/blender/check.ts EXPORT_GATE + COPLANAR_GATE_PX (agent X, fix round): only overlaps (a sweep and a limb clip
# are `through` there) and shots that do not build block; coplanar under 12 px, camera, seat, faces, HOLD / FOOTSLIDE,
# partial and a crashed / missing contact check (`checkfail`) are notes.
GATE = {'through', 'floating', 'coplanar', 'cutaway', 'camclip', 'sweep', 'limb', 'error'}
COPLANAR_GATE_PX = 12


def _app_blenders():
    """The Blender the Creatorize app installed for itself (src/main/blender/install.ts: <userData>/blender/<version>/),
    newest first."""
    homes = []
    if os.name == 'nt': homes.append(Path(os.environ.get('APPDATA', str(Path.home() / 'AppData/Roaming'))))
    else: homes += [Path.home() / 'Library/Application Support', Path.home() / '.config']
    out = []
    for h in homes:
        for app in ('Creatorize Suite', 'creatorize-suite', 'Creatorize'):
            for v in sorted(glob.glob(str(h / app / 'blender' / '*')), key=lambda s: [int(x) for x in re.findall(r'\d+', Path(s).name)] or [0], reverse=True):
                out += sorted(glob.glob(str(Path(v) / '*' / 'blender.exe'))) if os.name == 'nt' else \
                       [str(Path(v) / 'Blender.app/Contents/MacOS/Blender')]
    return [p for p in out if Path(p).exists()]


def find_blender(arg=None):
    for p in (arg, os.environ.get('CZ_BLENDER')):
        if p and Path(p).exists(): return str(p)
    own = _app_blenders()
    if own: return own[0]
    if os.name == 'nt':
        c = sorted(glob.glob(r'C:\Program Files\Blender Foundation\Blender *\blender.exe'),
                   key=lambda s: [int(x) for x in re.findall(r'\d+', Path(s).parent.name)] or [0])
        if c: return c[-1]
    for p in ('/Applications/Blender.app/Contents/MacOS/Blender', str(Path.home() / 'Applications/Blender.app/Contents/MacOS/Blender')):
        if Path(p).exists(): return p
    return shutil.which('blender')


def shots(d):
    """The project's sequence files (s01.py, e07.py ...) with a `F0, F1 = a, b` line, in assemble.json's order (else by F0)."""
    names = sorted(f[:-3] for f in os.listdir(d) if SEQ.match(f))
    order = None
    try: order = json.loads(Path(d, 'assemble.json').read_text(encoding='utf-8-sig')).get('shots')
    except Exception: pass
    L = []
    for n in ([s for s in order if s in names] if order else names):
        try: m = RANGE.search(Path(d, n + '.py').read_text(encoding='utf-8', errors='replace'))
        except Exception: m = None
        if m: L.append((n, int(m.group(1)), int(m.group(2))))
    if not order: L.sort(key=lambda s: s[1])
    return L


def parse(out, shot, code):
    """-> issues [(type, frame, what, detail, gates)], summary. gates = it fails the sign-off (GATE); else a note."""
    iss, lines = [], out.splitlines()
    for l in lines:
        m = CONTACT.match(l)
        if m:
            typ, _, f, a, b, dep, px, fix = m.groups()
            if typ == 'partial':      # the check ran out of time: not a pass for those frames, not a failure either
                if not any(i[0] == 'partial' for i in iss): iss.append(('partial', int(f), f'{a} {b} frames', fix, False))
                continue
            if typ == 'coplanar' and int(px) < COPLANAR_GATE_PX: typ = 'coplanar-small'
            iss.append((typ, int(f), f'{a} x {b}', f'{dep} m, {px} px: {fix}', typ in GATE)); continue
        m = re.match(r'^CZ CONTACTWARN partial\b(.*)$', l)
        if m and not any(i[0] == 'partial' for i in iss):
            iss.append(('partial', 0, shot, 'the overlap check ran out of time:' + m.group(1)[:300], False)); continue
        m = re.match(r'^CZ CLIP (\S+?)\.(\w+?)([LR]) f(\d+) in (\S+) ([\d.]+) cm', l)
        if m: iss.append(('limb', int(m.group(4)), f'{m.group(1)} {m.group(2)}{m.group(3)} x {m.group(5)}', f'{m.group(6)} cm into it: move the limb target, the prop or the pose', True)); continue
        m = re.match(r'^CZ SITCHECK (\S+) f(\d+): (.*)$', l)
        if m: iss.append(('seat', int(m.group(2)), m.group(1), m.group(3), False)); continue
        m = re.match(r'^CZ CAMJERK ([\d,]+)', l)
        if m and len(m.group(1).split(',')) >= 3:
            fr = m.group(1).split(','); iss.append(('camera', int(fr[0]), shot, f'jerks at frames {", ".join(fr[:8])}: fewer, smoother Flight keys', False)); continue
        m = re.match(r'^CZ FACES MISSING (\S+)', l)
        if m: iss.append(('faces', 0, m.group(1), 'face pictures not drawn', False)); continue
        # people (package C): holds and foot slides (the OK lines are fine); hidden overlaps are info only
        m = re.match(r'^CZ (HOLD|FOOTSLIDE) (?!OK\b)(?:f?=?(\d+) )?(.*)$', l)
        if m and not any(i[3] == m.group(3) for i in iss):     # (a note: ONE fix at its cause, then move on)
            iss.append((m.group(1).lower(), int(m.group(2) or 0), (m.group(3).split(':')[0] or shot), m.group(3), False)); continue
        m = re.match(r'^CZ CONTACTINFO (\S+) \S+ f=(\d+) (\S+ x \S+) (.*)$', l)
        if m: iss.append(('info', int(m.group(2)), m.group(3), f'{m.group(1)} {m.group(4)}', False))
    tb = next((i for i, l in enumerate(lines) if l.startswith('Traceback')), None)
    if tb is not None or (code and 'CZ CHECKED' not in out):
        tail = [x for x in lines[tb if tb is not None else -12:] if x.strip()][-6:]
        iss.append(('error', 0, shot, 'did not build: ' + ' | '.join(tail)[:500], True))
    elif 'CZ CONTACTCHECK error' in out:      # (a note: one exotic mesh must not block a film; LOOK at the shot instead)
        iss.append(('checkfail', 0, shot, 'the contact check crashed, this shot is NOT checked for overlaps (look at it by eye): ' + ' | '.join(l for l in lines if 'CONTACTCHECK error' in l)[:500], False))
    elif 'CZ CONTACTCHECK' not in out:      # never a silent pass: listed as not checked (a note, like check.ts)
        iss.append(('checkfail', 0, shot, 'the contact check did not run (no CZ CONTACTCHECK line): engine/run.py --check wiring; NOT checked for overlaps', False))
    elif re.search(r'^CZ CONTACTCHECK .*PARTIAL', out, re.M) and not any(i[0] == 'partial' for i in iss):
        iss.append(('partial', 0, shot, 'the overlap check ran out of time before every frame was checked: look at the shot by eye', False))
    m = re.search(r'^CZ CONTACTCHECK (.*)$', out, re.M)
    return iss, (m.group(1) if m else '')


def check(blender, d, shot, timeout=240):
    env = dict(os.environ, CZ_CLIPCHECK='1', CZ_CLIPSTEP='3')
    t = time.time()
    try:
        p = subprocess.run([blender, '-b', '--factory-startup', '-P', str(RUN), '--', str(Path(d, shot + '.py')), '--check'],
                           cwd=d, env=env, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=timeout,
                           creationflags=0x08000000 if os.name == 'nt' else 0)        # (no console window on Windows)
        out, code = (p.stdout or '') + (p.stderr or ''), p.returncode
    except subprocess.TimeoutExpired:
        out, code = 'Traceback\ntimed out after %d s' % timeout, 1
    return shot, out, code, time.time() - t


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project'); ap.add_argument('--lanes', type=int, default=4); ap.add_argument('--blender')
    ap.add_argument('--only'); ap.add_argument('--gate', default='overlap', choices=('overlap', 'contact', 'all')); ap.add_argument('--json')
    a = ap.parse_args()
    d = str(Path(a.project).resolve())
    bl = find_blender(a.blender)
    if not bl: print('SIGNOFF: no Blender found (--blender or CZ_BLENDER)'); return 2
    L = shots(d)
    if a.only: L = [s for s in L if s[0] in set(a.only.split(','))]
    if not L: print(f'SIGNOFF {Path(d).name}: no shots (files like e01.py with a "F0, F1 = a, b" line)'); return 2
    T = time.time(); res = {}
    with cf.ThreadPoolExecutor(max(1, a.lanes)) as ex:
        for shot, out, code, dt in ex.map(lambda s: check(bl, d, s[0]), L):
            iss, summ = parse(out, shot, code); res[shot] = dict(issues=iss, summary=summ, seconds=round(dt, 1))
    fails, n_iss = [], 0
    for shot, _, _ in L:
        r = res[shot]; bad = [i for i in r['issues'] if i[0] != 'info' and (a.gate == 'all' or i[4])]
        print(f"  {shot}: {'clean' if not bad else str(len(bad)) + ' issues'} ({r['seconds']} s) {r['summary']}")
        for typ, f, what, det, _c in r['issues']:
            print(f"    {'FAIL' if typ != 'info' and (a.gate == 'all' or _c) else 'note'} {typ} f={f} {what}: {det}")
        if bad: fails.append(shot); n_iss += len(bad)
    dt = time.time() - T
    if a.json:
        Path(a.json).write_text(json.dumps({k: dict(v, issues=[list(i) for i in v['issues']]) for k, v in res.items()}, indent=1), encoding='utf-8')
    if fails:
        print(f'SIGNOFF {Path(d).name}: FAIL ({n_iss} issues in {len(fails)} of {len(L)} shots: {", ".join(fails)}; {dt:.0f} s)')
        return 1
    print(f'SIGNOFF {Path(d).name}: PASS ({len(L)} shots, {dt:.0f} s)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
