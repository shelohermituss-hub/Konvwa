# A cutless group (assemble.json "tours") must be ONE camera: the parts' poses on their shared pad frames must be
# identical and the motion must run through the part boundaries with no kink. From tools/camreplay.py's json:
#   python tools/camseam.py <replay.json> [shot,shot,...]      (default: every shot, as one group)
# Prints per boundary the pose difference on the shared frames (mm / deg) and the speed / jerk around it, and
# CAMSEAM PASS|FAIL plus the whole group's stats measured as one shot.
import json, sys, math
import numpy as np
import camstats as C

d = json.load(open(sys.argv[1], encoding='utf-8-sig'))
names = sys.argv[2].split(',') if len(sys.argv) > 2 else [s['shot'] for s in d['shots']]
have = {s['shot']: s for s in d['shots']}
missing = [n for n in names if n not in have]
if missing or len(names) < 2:        # (a skipped part: say so, not StopIteration)
    print(f"CAMSEAM FAIL not measured: {', '.join(missing) or 'fewer than 2 parts'} missing from the replay "
          f"(skipped: {'; '.join(f'{a} {b}' for a, b in d.get('skipped', [])[:6]) or 'none'})")
    sys.exit(1)
S = [have[n] for n in names]
bad = 0
merged = []
for a, b in zip(S, S[1:]):
    fa = {f['f']: f for f in a['frames']}; fb = {f['f']: f for f in b['frames']}
    common = sorted(set(fa) & set(fb))
    de = max(np.linalg.norm(np.array(fa[f]['e']) - np.array(fb[f]['e'])) for f in common) if common else float('nan')
    # (atan2 of cross / dot: acos of the dot of two float32 unit vectors reads 0.01-0.02 deg for identical views)
    ang = lambda a_, b_: math.degrees(math.atan2(float(np.linalg.norm(np.cross(a_, b_))), float(np.dot(a_, b_))))
    dd = max(ang(np.array(fa[f]['d'], float), np.array(fb[f]['d'], float)) for f in common) if common else float('nan')
    ok = common and de < 1e-3 and dd < 0.01
    bad += not ok
    print(f"  {a['shot']} -> {b['shot']}: shared frames {common}, eye differs {de * 1000:.3f} mm, view {dd:.4f} deg {'ok' if ok else 'SEAM'}")
# the group as one shot: every frame once (the first part that has it)
seen = {}
for s in S:
    for f in s['frames']: seen.setdefault(f['f'], f)
fr = [seen[k] for k in sorted(seen)]
one = {'shot': '+'.join(names), 'f0': fr[1]['f'], 'f1': fr[-2]['f'], 'frames': fr, 'half': [], 'dist': np.mean([s.get('dist') or 10 for s in S])}
st = C.shot_stats(one)
sub, far, L = C.motion(one)
sp = np.maximum(np.linalg.norm(sub, axis=1), np.linalg.norm(far, axis=1))
for a in S[:-1]:
    i = [f['f'] for f in fr].index(a['f1'])
    print(f"  speed around {a['f1']}|{a['f1'] + 1}: " + ' '.join(f'{x:.1f}' for x in sp[i - 3:i + 4]))
print(f"CAMSEAM {'PASS' if not bad else 'FAIL'} {len(S)} parts as one camera: peak {st['peak']:.1f} %/s, accel {st['acc']:.0f} %/s2, "
      f"jerk {st['jerk']:.0f} %/s3 (median {st['jerk_med']:.0f}), {len(st['bad'])} jerky frames, ends {st['e0']:.1f}/{st['e1']:.1f} %/s")
