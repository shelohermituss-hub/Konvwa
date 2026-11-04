# The camera's exact motion, from tools/camreplay.py's per-frame poses (no picture noise): what the viewer sees as
# screen motion in % of the frame height per second, its acceleration and its JERK (the 3rd derivative: a kink in the
# speed ramp, a retime corner, a sudden start), per shot, plus every cut (is the camera at rest on both sides?).
#   python tools/camstats.py <replay.json> [--name film] [--frames]     (--frames: list every frame over the limits)
# Screen motion of the subject (a point at the subject distance on the view axis) and of the far background (rotation
# only), x / y / zoom; the larger of the two counts. Limits = "super smooth" (references/camera.md):
#   jerk <= JERK_LIM %/s^3, edge speed (first / last frame of a shot) <= 12 % of the shot's peak (a cut on rest),
#   sub-frame swing (motion blur between frames) <= 0.5 deg.
import json, math, sys
import numpy as np

JERK_LIM = 900.0      # % of frame height per s^3 (a 25-deg turn eased over 2 s peaks at ~300; v4's retime kinks: 2000+)
ACC_LIM = 120.0       # % / s^2
EDGE_REST = 0.12      # edge speed / peak speed at a cut
FPS = 30


def basis(d, u):
    d = d / np.linalg.norm(d); r = np.cross(d, u); r /= np.linalg.norm(r); u2 = np.cross(r, d)
    return np.stack([r, u2, -d], 1)            # columns: camera x, y, z in world


def rotvec(Ra, Rb):
    Rr = Ra.T @ Rb
    c = max(-1.0, min(1.0, (np.trace(Rr) - 1) / 2)); ang = math.acos(c)
    if ang < 1e-9: return np.zeros(3)
    w = np.array([Rr[2, 1] - Rr[1, 2], Rr[0, 2] - Rr[2, 0], Rr[1, 0] - Rr[0, 1]]) / (2 * math.sin(ang))
    return w * ang


def motion(sh):
    fr = sh['frames']; n = len(fr)
    E = np.array([f['e'] for f in fr]); D = np.array([f['d'] for f in fr]); U = np.array([f['u'] for f in fr])
    L = np.array([f['lens'] for f in fr])
    d0 = sh.get('dist') or 10.0
    # per-frame subject distance when the replay has it (fix round 2026-10-30: the same measure as mega.cam_report)
    DI = [max(0.05, f.get('dist') or d0) for f in fr]
    R = [basis(D[i], U[i]) for i in range(n)]
    sub, far = np.zeros((n, 3)), np.zeros((n, 3))
    for i in range(1, n):
        k = L[i] / 24.0 / 2 * 2       # 1 / (2 tan(vfov / 2)) on the 24 mm vertical sensor = lens / 24
        w = rotvec(R[i - 1], R[i])    # rad / frame in camera axes
        v = R[i - 1].T @ (E[i] - E[i - 1]); dist = DI[i]
        zl = math.log(L[i] / L[i - 1]) * 100
        far[i] = [w[1] * k * 100, -w[0] * k * 100, zl]
        sub[i] = [(w[1] - v[0] / dist) * k * 100, (-w[0] - v[1] / dist) * k * 100, -v[2] / dist * 100 + zl]
    return sub * FPS, far * FPS, L          # % of frame height per second


def deriv(m):
    a = np.zeros_like(m); j = np.zeros_like(m)
    a[1:] = (m[1:] - m[:-1]) * FPS; j[1:] = (a[1:] - a[:-1]) * FPS
    return a, j


def shot_stats(sh):
    sub, far, L = motion(sh)
    out = {}
    # frames: index 0 = F0-1 (pad), 1 = F0 ... n-2 = F1, n-1 = F1+1 (pad); speeds INTO frame i
    for nm, m in (('sub', sub), ('far', far)):
        a, j = deriv(m)
        sp = np.linalg.norm(m, axis=1); an = np.linalg.norm(a, axis=1); jn = np.linalg.norm(j, axis=1)
        out[nm] = (sp, an, jn)
    sp = np.maximum(out['sub'][0], out['far'][0]); an = np.maximum(out['sub'][1], out['far'][1]); jn = np.maximum(out['sub'][2], out['far'][2])
    n = len(sp); inner = slice(2, n - 1)       # motion of frames F0+1..F1 (inside the shot only)
    peak = float(sp[inner].max()) if n > 3 else 0.0
    # the speed AT the cut: the first frame's motion out of F0 (into F0+1) and the last one (into F1)
    e0, e1 = float(sp[2]) if n > 3 else 0.0, float(sp[n - 2]) if n > 3 else 0.0
    jin = jn[3:n - 1] if n > 5 else np.zeros(1)          # jerk needs 3 frames of the shot
    ain = an[2:n - 1] if n > 4 else np.zeros(1)
    fr = [f['f'] for f in sh['frames']]
    bad = [fr[3 + i] for i, x in enumerate(jin) if x > JERK_LIM]
    # sub-frame swing: the view at f + 0.5 vs the halfway view between f and f + 1 (motion blur sees it)
    swing = 0.0
    D = np.array([f['d'] for f in sh['frames']])
    for i, h in enumerate(sh.get('half', [])):
        if len(h) < 6: break
        a_, b_ = D[1 + i], D[2 + i]; mid = (a_ + b_); mid /= np.linalg.norm(mid)
        hv = np.array(h[3:6]); swing = max(swing, math.degrees(math.acos(max(-1, min(1, float(hv @ mid / np.linalg.norm(hv)))))))
    return dict(shot=sh['shot'], f0=sh['f0'], f1=sh['f1'], peak=peak, e0=e0, e1=e1, acc=float(ain.max()), jerk=float(jin.max()),
                jerk_med=float(np.median(jin)), bad=bad, swing=swing, lens=(float(L.min()), float(L.max())),
                travel=float(sp[inner].sum() / FPS))


def main():
    data = json.load(open(sys.argv[1], encoding='utf-8-sig'))
    name = sys.argv[sys.argv.index('--name') + 1] if '--name' in sys.argv else data.get('film', '')[-40:]
    S = [shot_stats(s) for s in data['shots']]
    if not S:          # (every shot skipped: say why instead of crashing on an empty array)
        print(f"CAMSTATS {name}: no shots measured ({len(data.get('skipped', []))} skipped: "
              + '; '.join(f'{a} {b}' for a, b in data.get('skipped', [])[:6]) + ')')
        return
    if '--frames' in sys.argv or '--shots' in sys.argv:
        for s in S:
            print(f"  {s['shot']} {s['f0']:5d}-{s['f1']:5d} peak {s['peak']:6.1f}%/s edges {s['e0']:5.1f}/{s['e1']:5.1f} acc {s['acc']:7.1f} "
                  f"jerk {s['jerk']:8.0f} (med {s['jerk_med']:5.0f}) swing {s['swing']:.2f} deg  {len(s['bad'])} jerky" +
                  (f" {s['bad'][:12]}" if '--frames' in sys.argv and s['bad'] else ''))
    moving = [s for s in S if s['peak'] > 2.0]
    rest_cut = sum(1 for s in moving if s['e0'] <= EDGE_REST * s['peak']) + sum(1 for s in moving if s['e1'] <= EDGE_REST * s['peak'])
    edge_ratio = [max(s['e0'], s['e1']) / s['peak'] for s in moving]
    jerky = sum(len(s['bad']) for s in S); nfr = sum(s['f1'] - s['f0'] + 1 for s in S)
    J = np.array([s['jerk'] for s in S]); A = np.array([s['acc'] for s in S])
    print(f"CAMSTATS {name}: {len(S)} shots ({len(data.get('skipped', []))} skipped), {nfr} frames | jerk %/s3 median-of-shot-max {np.median(J):.0f}, "
          f"worst {J.max():.0f} ({S[int(J.argmax())]['shot']}) | accel %/s2 median {np.median(A):.0f} worst {A.max():.0f} | "
          f"{jerky} jerky frames ({100 * jerky / max(1, nfr):.1f} %) | cut edges at rest {rest_cut}/{2 * len(moving)}, "
          f"edge/peak speed median {np.median(edge_ratio) if edge_ratio else 0:.2f} | max sub-frame swing {max(s['swing'] for s in S):.2f} deg")
    # every cut between consecutive shots: speed out of A and into B
    seams = []
    for a, b in zip(S, S[1:]):
        seams.append((a['shot'], b['shot'], a['e1'], b['e0']))
    hot = [x for x in seams if x[2] > 8 or x[3] > 8]
    print(f"CAMSEAMS {len(hot)} of {len(seams)} cuts with the camera moving > 8 %/s on a side (median out {np.median([x[2] for x in seams]):.1f}, "
          f"in {np.median([x[3] for x in seams]):.1f} %/s)")


if __name__ == '__main__': main()
