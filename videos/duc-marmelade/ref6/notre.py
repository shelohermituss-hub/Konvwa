# L0 : les mêmes mesures sur NOTRE film.  /root/bpyenv/bin/python ref6/notre.py
#   - grammaire caméra lue dans s01.py..s11.py (appels c.shot / c.frame : t, fly, taille, pitch, roll, lens, fstop) ;
#   - image : sur les images de contrôle déjà rendues (renders/test/**.png, à 30 % de la taille : netteté et surfaces plates
#     sont à relativiser) ; mêmes formules que extraire.regard().
import glob, json, os, re, sys
import numpy as np, cv2

HERE = os.path.dirname(os.path.abspath(__file__))
FILM = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from extraire import regard

SPAN = {'ecu': 0.78, 'cu': 1.75, 'mcu': 2.5, 'ms': 3.7, 'mws': 5.2, 'ws': 9.0, 'xws': 14.0}


def appels(src):
    """[(genre, args_texte)] pour chaque c.shot(...) / c.frame(...) du fichier, parenthèses équilibrées."""
    out = []
    for m in re.finditer(r'\bc\.(shot|frame)\(', src):
        i, d = m.end(), 1
        while d and i < len(src):
            d += (src[i] == '(') - (src[i] == ')')
            i += 1
        out.append((m.group(1), src[m.end():i - 1]))
    return out


def kw(txt, nom, defaut=None):
    m = re.search(r'\b' + nom + r'\s*=\s*(-?[\d.]+)', txt)
    return float(m.group(1)) if m else defaut


def grammaire():
    cad = []
    for p in sorted(glob.glob(os.path.join(FILM, 's[0-9][0-9].py'))):
        for genre, a in appels(open(p, encoding='utf-8').read()):
            t = float(re.match(r'\s*([\d.]+)', a).group(1))
            taille = re.search(r"'(ecu|cu|mcu|ms|mws|ws|xws)'", a)
            cad.append(dict(seq=os.path.basename(p)[:3], t=t, fly=kw(a, 'fly', 13.0), genre=genre, taille=taille.group(1) if taille else ('large' if genre == 'frame' else '?'),
                            pitch=kw(a, 'pitch', 8.0 if genre == 'shot' else None), roll=kw(a, 'roll', 0.0), lens=kw(a, 'lens'), fstop=kw(a, 'fstop')))
    cad.sort(key=lambda c: c['t'])
    holds = [max(0, (cad[i + 1]['t'] - cad[i + 1]['fly'] / 30) - cad[i]['t']) * 30 for i in range(len(cad) - 1)]
    dur = float(json.load(open(os.path.join(FILM, 'project.json'), encoding='utf-8'))['end'])
    pitchs = [abs(c['pitch']) for c in cad if c['pitch'] is not None]
    return dict(cadrages=len(cad), cadrages_par_10s=round(len(cad) / dur * 10, 2), tenue_med=float(np.median(holds)), vol_med=float(np.median([c['fly'] for c in cad if c['fly'] > 0])),
                pitch_fort_pct=round(100 * np.mean([p > 8 for p in pitchs]), 1), penches_pct=round(100 * np.mean([abs(c['roll']) > 3 for c in cad]), 1),
                gros_plans_pct=round(100 * np.mean([c['taille'] in ('ecu', 'cu', 'mcu') for c in cad]), 1),
                ouverture_med=float(np.median([c['fstop'] for c in cad if c['fstop']])) if any(c['fstop'] for c in cad) else None)


def image():
    fs = {}
    for p in sorted(glob.glob(os.path.join(FILM, 'renders', 'test', 's[0-9][0-9]_r*', '[0-9][0-9][0-9][0-9].png')), key=os.path.getmtime):
        fs[(os.path.basename(os.path.dirname(p))[:3], os.path.basename(p))] = p        # le plus récent par (plan, image)
    L = []
    for p in fs.values():
        im = cv2.imread(p)
        im = cv2.resize(im, (360, int(im.shape[0] * 360 / im.shape[1])), interpolation=cv2.INTER_AREA)
        d = regard(im)
        L.append([d[x] for x in ('lum', 'sat', 'con', 'nette', 'noir', 'plat', 'nc', 'lumdom')])
    a = np.array(L)
    return dict(n_images=len(a), lum=a[:, 0].mean(), sat=a[:, 1].mean(), con=a[:, 2].mean(), nette=float(np.median(a[:, 3])), noir=a[:, 4].mean(), plat=a[:, 5].mean(),
                nc=float(np.median(a[:, 6])), nuit_pct=float(100 * np.mean(a[:, 0] < 80)))


if __name__ == '__main__':
    nous = dict(**grammaire(), **image())
    cib = json.load(open(os.path.join(HERE, 'cibles.json')))['cibles']
    print(f"{'grandeur':<22}{'nous':>10}{'réf méd':>10}{'P25':>9}{'P75':>9}  verdict")
    cle = {'cadrages_par_10s': 'cadrages_par_10s', 'tenue_med': 'tenue_med', 'vol_med': 'vol_med', 'lum': 'lum', 'sat': 'sat', 'con': 'con', 'nette': 'nette',
           'noir': 'noir', 'plat': 'plat', 'nc': 'nc', 'nuit_pct': 'nuit_pct'}
    for k in cle:
        v = nous.get(k)
        if v is None or cle[k] not in cib:
            continue
        c = cib[cle[k]]
        dedans = c['p25'] <= v <= c['p75']
        proche = abs(v - c['med']) <= 0.15 * abs(c['med'])
        print(f"{k:<22}{v:>10.2f}{c['med']:>10.2f}{c['p25']:>9.2f}{c['p75']:>9.2f}  {'OK' if dedans or proche else 'ÉCART'}")
    print({k: v for k, v in nous.items() if k in ('cadrages', 'pitch_fort_pct', 'penches_pct', 'gros_plans_pct', 'ouverture_med', 'n_images')})
    json.dump(nous, open(os.path.join(HERE, 'nous.json'), 'w'), indent=1, ensure_ascii=False)
