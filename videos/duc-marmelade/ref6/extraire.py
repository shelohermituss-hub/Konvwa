# L0 : extraction brute des six vidéos de référence (mouvement de l'image, couleurs, netteté, surfaces plates).
#   /root/bpyenv/bin/python ref6/extraire.py [dossier_des_mp4]   ->  ref6/raw/<film>.npz + ref6/shots/<film>/ (images)
# Une ligne par image : inl (inliers RANSAC), pix (déplacement moyen des points, px à 360 de large), tx, ty (% cadre), zoom,
# rot (degrés), dmean (variation moyenne de gris à 45x80 : repère de coupe), puis, toutes les 15 images : lum, sat, con,
# nette (Laplacien), noir (part de pixels < 45), plat (part de blocs 16x16 d'écart-type < 3), nc (netteté centre / bords),
# teinte et luminosité dominantes.
import glob, os, re, sys
import numpy as np, cv2

SRC = sys.argv[1] if len(sys.argv) > 1 else '/root/.claude/uploads/b8ea60a1-7860-579c-8340-9b58df7c9cf6'
HERE = os.path.dirname(os.path.abspath(__file__))
W = 360
os.makedirs(os.path.join(HERE, 'raw'), exist_ok=True)


def regard(img):
    """Mesures d'image sur une image BGR de 360 de large."""
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    lap = cv2.Laplacian(g, cv2.CV_64F)
    h, w = g.shape
    c = lap[h // 4:3 * h // 4, w // 4:3 * w // 4].var()
    e = np.concatenate([lap[:h // 6].ravel(), lap[-h // 6:].ravel(), lap[:, :w // 6].ravel(), lap[:, -w // 6:].ravel()]).var()
    bh, bw = h // 16, w // 16
    blocs = g[:bh * 16, :bw * 16].reshape(bh, 16, bw, 16).std(axis=(1, 3))
    sat_mask = hsv[..., 1] > 60
    teinte = float(np.median(hsv[..., 0][sat_mask])) * 2 if sat_mask.mean() > 0.05 else -1.0
    return dict(lum=g.mean(), sat=hsv[..., 1].mean(), con=g.std(), nette=lap.var(), noir=(g < 45).mean(),
                plat=(blocs < 3).mean(), nc=c / max(e, 1e-6), teinte=teinte, lumdom=float(np.median(g)))


def un_film(path):
    nom = re.sub(r'^[0-9a-f]{8}-', '', os.path.basename(path))[:24].strip('_')
    out = os.path.join(HERE, 'raw', nom + '.npz')
    cap = cv2.VideoCapture(path)
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    orb = cv2.ORB_create(1500)
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    prev = None
    prevg = None
    mv, look, lookf = [], [], []
    f = 0
    while True:
        ok, im = cap.read()
        if not ok:
            break
        f += 1
        h = int(im.shape[0] * W / im.shape[1])
        im = cv2.resize(im, (W, h), interpolation=cv2.INTER_AREA)
        g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
        small = cv2.resize(g, (45, 80), interpolation=cv2.INTER_AREA).astype(np.float32)
        dmean = float(np.abs(small - prevg).mean()) if prevg is not None else 0.0
        prevg = small
        k, ds = orb.detectAndCompute(g, None)
        r = [f, 0, 0.0, 0.0, 0.0, 1.0, 0.0, dmean]       # f, inl, pix, tx, ty, zoom, rot, dmean
        if prev is not None and ds is not None and prev[1] is not None:
            ms = sorted(bf.match(prev[1], ds), key=lambda x: x.distance)[:400]
            if len(ms) > 20:
                p0 = np.float32([prev[0][m.queryIdx].pt for m in ms])
                p1 = np.float32([k[m.trainIdx].pt for m in ms])
                M, inl = cv2.estimateAffinePartial2D(p0, p1, method=cv2.RANSAC, ransacReprojThreshold=2.0)
                if M is not None:
                    sel = inl.ravel().astype(bool)
                    sc = float(np.hypot(M[0, 0], M[1, 0]))
                    r[1] = int(sel.sum())
                    r[2] = float(np.linalg.norm(p1[sel] - p0[sel], axis=1).mean()) if sel.any() else 0.0
                    r[3] = float((M[0, 2] + (sc - 1) * W / 2) / W * 100)
                    r[4] = float((M[1, 2] + (sc - 1) * h / 2) / h * 100)
                    r[5] = sc
                    r[6] = float(np.degrees(np.arctan2(M[1, 0], M[0, 0])))
        prev = (k, ds)
        mv.append(r)
        if f % 15 == 1:
            d = regard(im)
            look.append([f] + [d[x] for x in ('lum', 'sat', 'con', 'nette', 'noir', 'plat', 'nc', 'teinte', 'lumdom')])
        if f % 150 == 0:
            print(f'  {nom} {f}/{n}', flush=True)
    np.savez_compressed(out, mv=np.array(mv), look=np.array(look), fps=cap.get(cv2.CAP_PROP_FPS), nom=nom)
    print('ok', nom, f, 'images ->', out, flush=True)


if __name__ == '__main__':
    for p in sorted(glob.glob(os.path.join(SRC, '*720P_HD.mp4'))):
        un_film(p)
