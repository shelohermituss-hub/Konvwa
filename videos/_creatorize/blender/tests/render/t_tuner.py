# The render tuner's own checks (no Blender): the quality gate's numbers and the tool's safe paths.
#   python tests/render/t_tuner.py            -> one `TUNERTEST ok|FAIL <what>` line per check + `TUNERTEST <n> FAIL`
# The Blender side (probe + plan on a real shot): python tools/render_tune.py <film> --shots <shot> --force, then
# tools/tune_sheet.py on a candidate (references/render.md).
import json, os, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); KIT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(KIT, 'engine')); sys.path.insert(0, os.path.join(KIT, 'tools'))
import numpy as np
import tunemetric as TM
import render_tune as RT

fails = 0


def check(ok, what):
    global fails
    print(f'TUNERTEST {"ok" if ok else "FAIL"} {what}', flush=True); fails += 0 if ok else 1


rng = np.random.default_rng(1)
a = (rng.random((256, 192, 3)) * 0.5 + 0.25)
r = TM.compare(a, a.copy())
check(r['ssim'] == 1.0 and r['block'] == 1.0 and r['psnr'] == 99.0 and TM.passes(r), f'identical frames pass with 1.0 ({r})')
b = a.copy(); b[64:96, 64:96] = 0.0                       # a 32 px hole: the mean barely moves, the worst block must
r = TM.compare(a, b)
check(r['ssim'] > 0.97 and r['block'] < 0.5 and not TM.passes(r) and r['block_at'] == [64, 64], f'a local drop fails on the worst block and is found ({r})')
c = np.clip(a + rng.normal(0, 0.002, a.shape), 0, 1)       # half a grey level of noise: invisible
r = TM.compare(a, c)
check(TM.passes(r), f'half a grey level of noise passes ({r})')
d = np.clip(a + rng.normal(0, 0.05, a.shape), 0, 1)        # heavy noise: visible
check(not TM.passes(TM.compare(a, d)), 'heavy noise fails')
w = TM.worst([dict(ssim=0.99, block=0.95, block_at=[0, 0], psnr=50), dict(ssim=0.995, block=0.91, block_at=[32, 64], psnr=40)])
check(w == dict(ssim=0.99, block=0.91, block_at=[32, 64], psnr=40), f'worst of several frames ({w})')
check(RT.probe_frames(100, 200) == [120, 150, 180], f'probe frames at 20/50/80 % ({RT.probe_frames(100, 200)})')
# the scene pass: its candidates come first (geometry before render settings), and the plan's scene section logs them
check([c[0] for c in RT.CANDIDATES[:4]] == ['scene_gn', 'scene_lod_1', 'scene_lod_4', 'scene_join'], 'scene pass candidates first')
fake = [dict(shot='e29', ref=dict(t=2.0), steps=[
    dict(kind='candidate', name='scene_gn', changes={'scene_gn': 1}, t=1.98, vs_ref=0.99, quality=dict(ssim=0.99998, block=0.9994, psnr=74.9, block_at=[0, 0]), kept=True, why='kept',
         scene=dict(gn=dict(placements=174, instancers=9), before=dict(objects=321))),
    dict(kind='candidate', name='scene_lod_1', changes={'scene_lod': 1.0}, t=0.9, vs_ref=0.45, quality=dict(ssim=0.93, block=0.24, psnr=31, block_at=[0, 0]), kept=False,
         why='quality: ssim 0.93 < 0.985', scene=dict(gn=dict(placements=174, instancers=9), lod=dict(tris_before=14.5e6, tris_after=6.8e6))),
    dict(kind='candidate', name='shadow_half', changes={'shadow_scale': 0.5}, t=1.0, kept=True, why='kept')])]
sec = RT.scene_section(fake)
p0 = sec['probe'][0]
check([d['name'] for d in p0['decisions']] == ['scene_gn', 'scene_lod_1'] and p0['gn']['instancers'] == 9 and p0['decisions'][1]['quality']['ssim'] == 0.93,
      f'scene section: only the scene decisions, with their numbers ({sec["summary"]})')
check('scene_gn' in sec['summary'] and '174 placements -> 9 GN instancers' in sec['summary'] and 'scene_lod_1' not in sec['summary'].split(':', 1)[1].split('(')[0],
      f'scene section summary names what was kept ({sec["summary"]})')

# the tool: tuner off -> the safe plan (own settings, ONE Blender), no Blender started
with tempfile.TemporaryDirectory() as t:
    for n, body in (('a01.py', 'F0, F1 = 1, 40\n'), ('a02.py', 'F0, F1 = 41, 200\n# more scene code here\n' * 3)):
        open(os.path.join(t, n), 'w').write(body)
    json.dump({'shots': ['a01', 'a02']}, open(os.path.join(t, 'assemble.json'), 'w'))
    check([s[0] for s in RT.pick_probe_shots(t, RT.film_shots(t))] == ['a02', 'a01'], 'probe shots: the longest, then the most scene code')
    env = dict(os.environ, CZ_RENDER_TUNE='0', CZ_TUNER_CACHE=os.path.join(t, 'cache'))
    out = subprocess.run([sys.executable, os.path.join(KIT, 'tools', 'render_tune.py'), t], capture_output=True, text=True, env=env).stdout
    line = next((l for l in out.splitlines() if l.startswith('TUNE PLAN ')), None)
    p = json.loads(line[10:]) if line else {}
    check(p.get('jobs') == 1 and p.get('settings') == {} and p.get('fallback') is True, f'CZ_RENDER_TUNE=0: own settings, one Blender ({line})')
    json.dump({'settings': {'renderTune': {'samples': 8, 'jobs': 2}}}, open(os.path.join(t, 'project.json'), 'w'))
    env['CZ_RENDER_TUNE'] = '1'; os.remove(os.path.join(t, 'a01.py')); os.remove(os.path.join(t, 'a02.py'))
    out = subprocess.run([sys.executable, os.path.join(KIT, 'tools', 'render_tune.py'), t], capture_output=True, text=True, env=env).stdout
    line = next((l for l in out.splitlines() if l.startswith('TUNE PLAN ')), None)
    p = json.loads(line[10:]) if line else {}
    check(p.get('fallback') is True and p.get('jobs') == 2 and p.get('settings') == {'samples': 8}, f'no shots -> fallback, project overrides still win ({line})')
print(f'TUNERTEST {fails} FAIL', flush=True)
sys.exit(1 if fails else 0)
