# L0 : analyse des mesures brutes -> ref6/cibles.json + tableau.  /root/bpyenv/bin/python ref6/analyser.py
# Tenue / vol : mêmes définitions que ref/measure.json (vitesse de l'image lissée sur 5 images ; seuil 8 px/image à 360 de
# large, calé pour que le json du moteur redonne ses 51 passages). Un « cadrage » = une tenue. Les coupes = échec RANSAC
# (< 12 inliers) avec saut de gris, ou saut de gris très fort.
import glob, json, os
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SEUIL, LISSE = 8.0, 5


def coupes(mv):
    inl, d = mv[:, 1], mv[:, 7]
    cand = [i for i in range(1, len(mv)) if (inl[i] < 12 and d[i] > 4.0) or d[i] > 25.0]
    out = []
    for i in cand:
        if not out or i - out[-1] > 4:      # un fondu = une seule coupe
            out.append(i)
    return out


def passages(mv, cps):
    """[(genre, debut, fin)] : 'tenue' ou 'vol', hors images de coupe."""
    pix = mv[:, 2].copy()
    bad = np.zeros(len(mv), bool)
    for c in cps:
        bad[max(0, c - 2):c + 4] = True
    ker = np.ones(LISSE) / LISSE
    sm = np.convolve(pix, ker, 'same')
    lab = sm > SEUIL
    runs, i = [], 0
    bounds = [0] + list(cps) + [len(mv)]
    for a, b in zip(bounds[:-1], bounds[1:]):
        j = a
        while j < b:
            k = j
            while k < b and lab[k] == lab[j]:
                k += 1
            if k - j >= 1:
                runs.append(('vol' if lab[j] else 'tenue', j, k))
            j = k
    return runs


def film(path):
    z = np.load(path)
    mv, look = z['mv'], z['look']
    fps = float(z['fps']) or 30.0
    dur = len(mv) / fps
    cps = coupes(mv)
    runs = passages(mv, cps)
    holds = [r[2] - r[1] for r in runs if r[0] == 'tenue']
    flights = [r[2] - r[1] for r in runs if r[0] == 'vol']
    # roulis : rotation cumulée de chaque vol
    rolls = [abs(mv[r[1]:r[2], 6].sum()) for r in runs if r[0] == 'vol' and r[2] - r[1] >= 4]
    segs = np.diff([0] + cps + [len(mv)])
    # palette par plan : teinte dominante des images échantillonnées
    teintes = look[:, 8]
    bins = np.where(teintes < 0, -1, (teintes // 60).astype(int) % 6)
    bounds = np.array([0] + cps + [len(mv)])
    par_plan = []
    for a, b in zip(bounds[:-1], bounds[1:]):
        sel = (look[:, 0] >= a) & (look[:, 0] < b)
        if sel.sum():
            vals = [x for x in bins[sel] if x >= 0]
            par_plan.append((int(np.bincount(vals).argmax()) if vals else -1, float(look[sel, 1].mean())))
    changes = np.mean([par_plan[i][0] != par_plan[i - 1][0] for i in range(1, len(par_plan))]) if len(par_plan) > 1 else 0
    return dict(nom=str(z['nom']), duree_s=round(dur, 1), coupes=len(cps), coupes_par_10s=round(len(cps) / dur * 10, 2),
                cadrages_par_10s=round(len(holds) / dur * 10, 2), tenue_med=float(np.median(holds)) if holds else 0,
                vol_med=float(np.median(flights)) if flights else 0, vols_penches_pct=round(100 * float(np.mean([r > 3 for r in rolls])), 1) if rolls else 0,
                plan_med=float(np.median(segs)) if len(segs) else 0,
                lum=float(look[:, 1].mean()), sat=float(look[:, 2].mean()), con=float(look[:, 3].mean()), nette=float(np.median(look[:, 4])),
                noir=float(look[:, 5].mean()), plat=float(look[:, 6].mean()), nc=float(np.median(look[:, 7])),
                nuit_pct=float(100 * np.mean(look[:, 1] < 80)), groupes_teinte=int(len({b for b, _ in par_plan if b >= 0})),
                changement_teinte_pct=round(100 * changes, 1))


def q(vals):
    v = np.array(vals, float)
    return dict(med=float(np.median(v)), p25=float(np.percentile(v, 25)), p75=float(np.percentile(v, 75)), min=float(v.min()), max=float(v.max()))


if __name__ == '__main__':
    films = [film(p) for p in sorted(glob.glob(os.path.join(HERE, 'raw', '*.npz')))]
    cles = [k for k in films[0] if k != 'nom']
    cibles = {k: q([f[k] for f in films]) for k in cles if isinstance(films[0][k], (int, float))}
    json.dump(dict(films=films, cibles=cibles), open(os.path.join(HERE, 'cibles.json'), 'w'), ensure_ascii=False, indent=1)
    print(f"{'film':<26}" + ''.join(f'{k[:9]:>10}' for k in cles if k not in ('nom', 'duree_s')))
    for f in films:
        print(f"{f['nom']:<26}" + ''.join(f'{f[k]:>10.1f}' for k in cles if k not in ('nom', 'duree_s')))
    print(f"{'MEDIANE':<26}" + ''.join(f"{cibles[k]['med']:>10.1f}" for k in cles if k not in ('nom', 'duree_s')))
    print(f"{'P25':<26}" + ''.join(f"{cibles[k]['p25']:>10.1f}" for k in cles if k not in ('nom', 'duree_s')))
    print(f"{'P75':<26}" + ''.join(f"{cibles[k]['p75']:>10.1f}" for k in cles if k not in ('nom', 'duree_s')))
