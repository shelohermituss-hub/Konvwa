# The camera's smoothness measured IN THE PICTURE of a finished film (an mp4) or a frame folder - what the viewer sees,
# with no access to the shot files:
#   python tools/camjerk.py <film.mp4 | frames dir> [--json out.json] [--shots film_dir] [--width 360]
# Per frame: ORB features + a RANSAC similarity transform to the previous frame (like measure_dir.py: tx / ty in % of the
# frame, zoom, roll). Cuts are found by the transform failing (< 12 inliers) or the shot ranges of --shots (assemble.json
# + each shot's F0, F1). Per shot: peak screen speed (%/s), the speed on its first / last frames (a cut on rest is
# < 12 % of the peak), and the JITTER (frame-to-frame motion minus its 5-frame smooth, % of the motion): what a smooth
# camera does not have. The json is measure-style ({frames: [{f, tx, ty, zoom, rot, inl}]}) so camsmooth.py,
# cammotion.py and camcurve.py read it too.
import json, os, re, sys
import numpy as np, cv2

a = sys.argv[1:]
src = a[0]; opt = lambda k, d=None: a[a.index(k) + 1] if k in a else d
W = int(opt('--width', '360')); FPS = 30


def frames():
    if os.path.isdir(src):
        fs = sorted(f for f in os.listdir(src) if re.fullmatch(r'\d{4}\.(png|jpg)', f))
        for f in fs: yield int(f[:4]), cv2.imread(os.path.join(src, f), cv2.IMREAD_GRAYSCALE)
    else:
        cap = cv2.VideoCapture(src); i = 0
        while True:
            ok, im = cap.read()
            if not ok: break
            i += 1; yield i, cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)


orb = cv2.ORB_create(1500); bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
prev = None; rec = []
for f, g in frames():
    h = int(g.shape[0] * W / g.shape[1]); g = cv2.resize(g, (W, h), interpolation=cv2.INTER_AREA)
    k, ds = orb.detectAndCompute(g, None)
    r = {'f': f, 'zoom': 1.0, 'tx': 0.0, 'ty': 0.0, 'rot': 0.0, 'inl': 0}
    if prev is not None and ds is not None and prev[1] is not None:
        ms = sorted(bf.match(prev[1], ds), key=lambda x: x.distance)[:400]
        if len(ms) > 20:
            p0 = np.float32([prev[0][m.queryIdx].pt for m in ms]); p1 = np.float32([k[m.trainIdx].pt for m in ms])
            M, inl = cv2.estimateAffinePartial2D(p0, p1, method=cv2.RANSAC, ransacReprojThreshold=2.0)
            if M is not None and int(inl.sum()) >= 12:
                sc = float(np.hypot(M[0, 0], M[1, 0]))
                tx, ty = M[0, 2] + (sc - 1) * W / 2, M[1, 2] + (sc - 1) * h / 2
                r.update(zoom=sc, tx=tx / W * 100, ty=ty / h * 100, rot=float(np.degrees(np.arctan2(M[1, 0], M[0, 0]))), inl=int(inl.sum()))
    rec.append(r); prev = (k, ds)
if opt('--json'): json.dump({'frames': rec}, open(opt('--json'), 'w'))
n = len(rec)
m = np.array([[r['tx'], r['ty'] * 16 / 9 if h > W else r['ty'], (r['zoom'] - 1) * 100, r['rot']] for r in rec])   # % of the frame HEIGHT-ish
ok = np.array([r['inl'] >= 12 for r in rec])
# shot ranges
cuts = []
if opt('--shots'):
    film = opt('--shots'); A = json.load(open(os.path.join(film, 'assemble.json'), encoding='utf-8-sig'))
    for s in A['shots']:
        mm = re.search(r'^F0\s*,\s*F1\s*=\s*(\d+)\s*,\s*(\d+)', open(os.path.join(film, s + '.py'), encoding='utf-8-sig').read(), re.M)
        cuts.append((s, int(mm.group(1)), int(mm.group(2))))
else:
    s0 = 1
    for i in range(1, n):
        if not ok[i]: cuts.append((f'c{len(cuts) + 1:02d}', s0, rec[i - 1]['f'])); s0 = rec[i]['f']
    cuts.append((f'c{len(cuts) + 1:02d}', s0, rec[-1]['f']))
idx = {r['f']: i for i, r in enumerate(rec)}
rows = []
for s, f0, f1 in cuts:
    if f1 - f0 < 8 or f0 not in idx or f1 not in idx: continue
    i0, i1 = idx[f0] + 1, idx[f1]                       # motions INTO frames f0+1 .. f1 (inside the shot)
    seg = m[i0:i1 + 1].copy(); good = ok[i0:i1 + 1]
    if good.sum() < 6: continue
    for c in range(4):                                  # unreliable frames: interpolate
        x = np.arange(len(seg)); seg[~good, c] = np.interp(x[~good], x[good], seg[good, c])
    sp = np.linalg.norm(seg[:, :3], axis=1) * FPS
    ker = np.array([1, 4, 6, 4, 1]) / 16.0
    smooth = np.stack([np.convolve(np.pad(seg[:, c], 2, mode='edge'), ker, 'valid') for c in range(4)], 1)
    jit = np.linalg.norm((seg - smooth)[:, :3], axis=1).sum() / max(1e-6, np.linalg.norm(seg[:, :3], axis=1).sum() + 0.02 * len(seg))
    peak = float(np.percentile(sp, 95))
    e0, e1 = float(sp[:2].mean()), float(sp[-2:].mean())
    rows.append((s, f0, f1, peak, e0, e1, jit))
if '--list' in a:
    for r in rows: print(f'  {r[0]} {r[1]:5d}-{r[2]:5d} peak {r[3]:6.1f} %/s edges {r[4]:5.1f}/{r[5]:5.1f} jitter {100 * r[6]:5.1f} %')
P = np.array([r[3] for r in rows]); moving = [r for r in rows if r[3] > 2]
er = [max(r[4], r[5]) / r[3] for r in moving]
rest = sum((r[4] <= 0.12 * r[3]) + (r[5] <= 0.12 * r[3]) for r in moving)
J = np.array([r[6] for r in rows])
print(f'CAMJERK {os.path.basename(src)}: {n} frames, {len(rows)} shots | peak speed median {np.median(P):.1f} %/s | edge/peak speed median {np.median(er):.2f}, '
      f'cut edges at rest {rest}/{2 * len(moving)} | jitter median {100 * np.median(J):.1f} %, worst {100 * J.max():.1f} % ({rows[int(J.argmax())][0]})')
