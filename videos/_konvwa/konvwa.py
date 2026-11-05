#!/usr/bin/env python3
# KONVWA : l'outil de fabrication des vidéos avec TOUS les moteurs du pack Creatorize (videos/_creatorize) :
#   - les styles Blender (blender = 3D cartoon, mega = 3D Informational réaliste) : moteur videos/_creatorize/blender ;
#   - les styles three.js (toon, lowpoly, recon, stickman, stickstory, flat, vox, vox-editorial, pixel, roblox, starter) :
#     leur moteur servi tel quel à un Chrome / Edge sans fenêtre par web.mjs (comme le fait l'application Creatorize).
# Une commande par étape ; le même outil sur le PC Windows du client et sur le serveur cloud de Claude.
#
#   python videos/_konvwa/konvwa.py pack <mots…> [--zone skill|bibliothèque|support|studio|stylekit|blender] [-n 12]   CHERCHE dans tout le pack (à lancer avant chaque étape)
#   python videos/_konvwa/konvwa.py styles                         la liste des styles, leur moteur, leur skill, leurs formats
#   python videos/_konvwa/konvwa.py verifier                       Blender, Python (Pillow, numpy, OpenCV, scipy), ffmpeg, Node, Chrome
#   python videos/_konvwa/konvwa.py installer [--bpy]              crée videos/_konvwa/.venv avec ce qu'il faut
#   python videos/_konvwa/konvwa.py nouveau <projet> --style <id> --mots <words.json> [--voix <voix.wav>] [--format vertical|landscape] [--dim 2d|3d]
#   python videos/_konvwa/konvwa.py mots <projet> <words.json>     (re)fait audio/timeline.json + audio/words.json
#   python videos/_konvwa/konvwa.py test <projet> <s03> [--frames 880,915] [--scale 0.4] [--samples 12]      (Blender)
#   python videos/_konvwa/konvwa.py test <projet> [--temps 1,4.5] [--scale 0.5] [--controle]               (three.js)
#   python videos/_konvwa/konvwa.py image <projet> <nom> <fichier> [--source URL --licence CC0]   une image du film (IMG[nom])
#   python videos/_konvwa/konvwa.py sprite <projet> <perso> <pose-visage> <png détouré> [--desc "…"]  un personnage stickman
#   python videos/_konvwa/konvwa.py planche <dossier d'images> [--cols 6]
#   python videos/_konvwa/konvwa.py son <projet>                   effets sonores (bibliothèque CC0 du pack) + fond + musique, mix -14 LUFS
#   python videos/_konvwa/konvwa.py rendu <projet> [--fps60 dup|interp|non] [--vertical flou|recadre|non] [Blender : --jobs --scale --samples --sans-reglage]
#
# <projet> = le nom d'un dossier de videos/ (ex. jarre-blender) ou un chemin. Le moteur n'est jamais modifié : tout ce qui
# est propre à un film vit dans son dossier (Blender : cast.py, sets.py, sNN.py, assemble.json ; three.js : scenes/*.js,
# models.js ; les deux : project.json, audio/, PLAN.md, sons.json).
import argparse
import glob
import json
import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
VIDEOS = os.path.join(ROOT, 'videos')
ENGINE = os.path.join(VIDEOS, '_creatorize', 'blender')
WIN = os.name == 'nt'
FPS = 30  # le moteur Blender travaille à 30 i/s (toutes ses durées en images sont calées dessus)
PACK = os.path.join(VIDEOS, '_creatorize')
SKILL = os.path.join(PACK, 'skill')
WEB = os.path.join(HERE, 'web.mjs')

# Les styles du pack (les noms de l'application Creatorize, support/kb/video-styles.md). moteur = le dossier du pack ;
# exemple = la scène de départ (un échantillon du Style Studio du pack, sinon modele_web/scenes/<id>.js) ;
# formats = ce que le moteur sait faire (le premier est celui par défaut ; KONVWA veut du vertical).
STYLES = {
    'blender': dict(nom='3D cartoon (moteur Blender)', type='blender', skill='blender-toon-shorts', formats=('vertical', 'landscape')),
    'mega': dict(nom='3D Informational (réaliste, moteur Blender)', type='blender', skill='mega-informational', formats=('vertical', 'landscape'),
                 post=['--capstyle', 'mega']),
    'toon': dict(nom='3D cartoon shorts (three.js)', type='web', moteur='toon', skill='toon-shorts', formats=('vertical', 'landscape')),
    'lowpoly': dict(nom='Low poly shorts', type='web', moteur='lowpoly', skill='lowpoly-shorts', formats=('vertical', 'landscape'),
                    exemple='studio/samples/lowpoly/sample.js'),
    'recon': dict(nom='3D reconstruction (documentaire)', type='web', moteur='recon', skill='recon-reconstruction', formats=('vertical', 'landscape'),
                  exemple='studio/samples/recon/sample.js'),
    'stickman': dict(nom='MS Paint stick figures', type='web', moteur='stickman', skill='stickman-explainer', formats=('landscape',),
                     exemple='studio/samples/stickman/sample.js', musique=False),
    'stickstory': dict(nom='Stick stories (« Et si tu… »)', type='web', moteur='stickstory', skill='stickstory-videos', formats=('vertical', 'landscape')),
    'flat': dict(nom='Flat explainer (vectoriel)', type='web', moteur='flat', skill='flat-explainer-video', formats=('vertical', 'landscape'),
                 exemple='studio/samples/flat/sample.js'),
    'vox': dict(nom='Vox (collage de une de journal)', type='web', moteur='collage', skill='vox-collage-video', formats=('vertical', 'landscape'),
                exemple='studio/samples/collage/sample.js'),
    'vox-editorial': dict(nom='Vox éditorial (ancien)', type='web', moteur='vox', skill='vox-editorial-video', formats=('vertical', 'landscape')),
    'pixel': dict(nom='Pixel art (rétro 16 couleurs)', type='web', moteur='engine', skill='pixel-explainer-video', formats=('landscape',),
                  exemple='studio/samples/pixel-art/sample.js'),
    'roblox': dict(nom='Roblox story shorts', type='web', moteur='roblox', skill='roblox-story-shorts', formats=('vertical', 'landscape'),
                   exemple='skill/roblox-story-shorts/examples/nose.scene.js', mix='roblox', musique=False),
    'starter': dict(nom='Studio starter (2D ou 3D neutre)', type='web', moteur='starter', skill='studio-starter', formats=('vertical', 'landscape'),
                    exemple='studio/samples/starter/{dim}/sample.js'),
}


# ---------------- trouver les outils ----------------
def venv_python():
    p = os.path.join(HERE, '.venv', 'Scripts' if WIN else 'bin', 'python.exe' if WIN else 'python')
    return p if os.path.exists(p) else None


def has_modules(py, mods):
    try:
        r = subprocess.run([py, '-c', 'import ' + ','.join(mods)], capture_output=True, timeout=120)
        return r.returncode == 0
    except Exception:
        return False


def find_py():
    """Le Python des visages et des outils (Pillow + numpy + OpenCV) : CZ_PY, sinon le .venv de konvwa, sinon celui-ci."""
    for p in [os.environ.get('CZ_PY'), venv_python(), os.environ.get('KONVWA_BPY_PY'), sys.executable]:
        if p and os.path.exists(p) and has_modules(p, ['PIL', 'numpy', 'cv2']):
            return p
    return None


def find_blender():
    """(genre, chemin) : ('exe', blender.exe) si Blender est installé, sinon ('bpy', python) si le module bpy est là."""
    env = os.environ.get('CZ_BLENDER')
    if env and os.path.exists(env):
        return 'exe', env
    cands = sorted(glob.glob(r'C:\Program Files\Blender Foundation\Blender 5.*\blender.exe'), reverse=True) if WIN else []
    w = shutil.which('blender')
    if w:
        cands.append(w)
    if cands:
        return 'exe', cands[0]
    for p in [os.environ.get('KONVWA_BPY_PY'), venv_python(), '/root/bpyenv/bin/python', sys.executable]:
        if p and os.path.exists(p) and has_modules(p, ['bpy']):
            return 'bpy', p
    return None, None


def blender_exe():
    """Un exécutable « blender » pour le moteur (render_queue.py l'appelle comme un .exe) : le vrai, ou un petit lanceur
    qui fait tourner le module bpy (fichier généré, ignoré par git)."""
    kind, path = find_blender()
    if kind == 'exe':
        return path
    if kind == 'bpy':
        d = os.path.join(HERE, '.cache')
        os.makedirs(d, exist_ok=True)
        if WIN:
            sh = os.path.join(d, 'blender-bpy.cmd')
            open(sh, 'w').write(f'@"{path}" "{os.path.join(HERE, "bpy_blender.py")}" %*\n')
        else:
            sh = os.path.join(d, 'blender-bpy')
            open(sh, 'w').write(f'#!/bin/sh\nexec "{path}" "{os.path.join(HERE, "bpy_blender.py")}" "$@"\n')
            os.chmod(sh, 0o755)
        return sh
    return None


def find_browser():
    """Le Chrome / Edge que web.mjs pilotera (même ordre que stylekit/tools/cdp.mjs)."""
    env = os.environ.get('CZ_BROWSER')
    if env and os.path.exists(env):
        return env
    if WIN:
        for b in [os.environ.get('PROGRAMFILES', r'C:\Program Files'), os.environ.get('PROGRAMFILES(X86)', r'C:\Program Files (x86)'),
                  os.path.join(os.environ.get('LOCALAPPDATA', ''), '')]:
            for rel in [r'Google\Chrome\Application\chrome.exe', r'Microsoft\Edge\Application\msedge.exe']:
                f = os.path.join(b or '', rel)
                if os.path.exists(f):
                    return f
        return None
    for n in ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']:
        w = shutil.which(n)
        if w:
            return w
    g = sorted(glob.glob('/opt/pw-browsers/chromium-*/chrome-linux/chrome'))
    return g[-1] if g else None


def need(x, msg):
    if not x:
        sys.exit('KONVWA : ' + msg + '\n  -> python videos/_konvwa/konvwa.py verifier')
    return x


def project_dir(name):
    p = name if os.path.isdir(name) else os.path.join(VIDEOS, name)
    return os.path.abspath(p)


def env_for(py, bl):
    e = dict(os.environ)
    e['CZ_PY'] = py
    if bl:
        e['CZ_BLENDER'] = bl
    return e


# ---------------- verifier / installer ----------------
def cmd_verifier(a):
    ok = True
    kind, bl = find_blender()
    if kind == 'exe':
        print(f'[ok] Blender : {bl}')
    elif kind == 'bpy':
        print(f'[ok] Blender en module bpy (rendu logiciel, pour les images de contrôle) : {bl}')
    else:
        ok = False
        print('[!!] Blender introuvable. Installe Blender 5.2 (blender.org) : C:\\Program Files\\Blender Foundation\\Blender 5.2\\')
    py = find_py()
    print(f'[ok] Python des outils (Pillow, numpy, OpenCV) : {py}' if py else
          '[!!] Python sans Pillow / numpy / OpenCV -> python videos/_konvwa/konvwa.py installer')
    ok &= bool(py)
    ff = shutil.which('ffmpeg')
    print(f'[ok] ffmpeg : {ff}' if ff else '[!!] ffmpeg introuvable (winget install ffmpeg)')
    ok &= bool(ff)
    print(f'[ok] moteur Blender : {ENGINE}' if os.path.exists(os.path.join(ENGINE, 'engine', 'run.py')) else '[!!] moteur absent : git pull')
    nd = shutil.which('node')
    print(f'[ok] Node (styles three.js) : {nd}' if nd else '[!!] Node introuvable (styles three.js) : winget install OpenJS.NodeJS.LTS')
    br = find_browser()
    print(f'[ok] navigateur (styles three.js) : {br}' if br else '[!!] Chrome / Edge introuvable (styles three.js) : CZ_BROWSER=<chemin de chrome>')
    print('     styles :', ', '.join(STYLES))
    print('\nTout est prêt.' if ok else '\nIl manque des choses (voir [!!]).')
    return 0 if ok else 1


def cmd_installer(a):
    v = os.path.join(HERE, '.venv')
    if not venv_python():
        subprocess.run([sys.executable, '-m', 'venv', v], check=True)
    py = venv_python()
    pk = ['pillow', 'numpy', 'opencv-python-headless', 'scipy'] + (['bpy==5.2.3'] if a.bpy else [])
    subprocess.run([py, '-m', 'pip', 'install', '--no-cache-dir', '-q'] + pk, check=True)
    print('Installé dans', v)
    return cmd_verifier(a)


# ---------------- nouveau projet, mots ----------------
END_PUNCT = re.compile(r'[.!?…]["»”)]*$')


def load_words(path):
    """words.json (KONVWA : [{text|word, start, end}], ou {"words": [...]}, ou les phrases de Creatorize)."""
    d = json.load(open(path, encoding='utf-8-sig'))
    if isinstance(d, dict):
        d = d.get('words', [])
    if d and isinstance(d[0], dict) and 'words' in d[0]:
        d = [w for ph in d for w in ph['words']]
    return [{'word': (w.get('word') or w.get('text') or w.get('w') or '').strip(), 'start': float(w.get('start', w.get('s', 0))),
             'end': float(w.get('end', w.get('e', 0)))} for w in d if (w.get('word') or w.get('text') or w.get('w'))]


def write_words(proj, words):
    """audio/timeline.json (phrases {s, e, text, words: [{w, s, e}]}, ce que lit le moteur) + audio/words.json
    ({"words": [{word, start, end}]}, ce que lit post.py pour les sous-titres) + audio/script_timed.txt (les phrases et
    leur début, ce que lisent les skills)."""
    os.makedirs(os.path.join(proj, 'audio'), exist_ok=True)
    phrases, cur = [], []
    for i, w in enumerate(words):
        cur.append(w)
        gap = words[i + 1]['start'] - w['end'] if i + 1 < len(words) else 9
        if END_PUNCT.search(w['word']) or gap > 0.8:
            phrases.append(cur)
            cur = []
    if cur:
        phrases.append(cur)
    tl = [{'s': round(p[0]['start'], 3), 'e': round(p[-1]['end'], 3), 'text': ' '.join(x['word'] for x in p),
           'words': [{'w': x['word'], 's': round(x['start'], 3), 'e': round(x['end'], 3)} for x in p]} for p in phrases]
    json.dump(tl, open(os.path.join(proj, 'audio', 'timeline.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump({'words': words}, open(os.path.join(proj, 'audio', 'words.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # le texte calé que lisent les skills des styles (le format de l'application, tools/parakeet_timeline.py)
    open(os.path.join(proj, 'audio', 'script_timed.txt'), 'w', encoding='utf-8').write('\n'.join(f"{p['s']:7.2f}  {p['text']}" for p in tl) + '\n')
    end = round(words[-1]['end'] + 1.2, 3)
    pj = os.path.join(proj, 'project.json')
    meta = json.load(open(pj, encoding='utf-8-sig')) if os.path.exists(pj) else {}
    meta.update({'language': 'fr', 'end': end})
    meta.setdefault('settings', {'format': 'vertical'})
    meta.setdefault('konvwa', {'style': 'blender', 'post': ['--sat', '1.15'], 'fps60': 'dup'})
    json.dump(meta, open(pj, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    frames = round(end * FPS)
    print(f'{len(words)} mots, {len(tl)} phrases, fin {end} s = {frames} images à {FPS} i/s')
    return tl, frames


def cmd_mots(a):
    proj = project_dir(a.projet)
    write_words(proj, load_words(a.words))
    return 0


def style_of(proj):
    """L'identifiant du style d'un film (project.json > konvwa > style ; un film Blender d'avant les styles : 'blender')."""
    pj = os.path.join(proj, 'project.json')
    meta = json.load(open(pj, encoding='utf-8-sig')) if os.path.exists(pj) else {}
    sid = meta.get('konvwa', {}).get('style') or ('blender' if os.path.exists(os.path.join(proj, 'assemble.json')) else None)
    if sid not in STYLES:
        sys.exit(f'KONVWA : style inconnu pour {proj} ({sid}) ; project.json > konvwa > style = un de : ' + ', '.join(STYLES))
    return sid, STYLES[sid], meta


def fill(text, proj, sid, st, tl, frames, fmt):
    rep = {'{{PROJET}}': os.path.basename(proj), '{{FRAMES}}': str(frames), '{{DUREE}}': f'{frames / FPS:.2f}', '{{STYLE}}': sid,
           '{{NOMSTYLE}}': st['nom'], '{{SKILL}}': st['skill'], '{{MOTEUR}}': st.get('moteur', 'blender'), '{{FORMAT}}': fmt}
    rep['{{PHRASES}}'] = '\n'.join((f'- f{round(p["s"] * FPS) + 1} ({p["s"]:.2f} s) : {p["text"]}' if st['type'] == 'blender'
                                    else f'- {p["s"]:.2f} s : {p["text"]}') for p in tl)
    for k, v in rep.items():
        text = text.replace(k, v)
    return text


def cmd_styles(a):
    print('Styles du pack Creatorize dans konvwa (nouveau <projet> --style <id>) :\n')
    for sid, st in STYLES.items():
        print(f'  {sid:<14} {st["nom"]:<46} moteur {("blender" if st["type"] == "blender" else st["moteur"]):<10} '
              f'formats {"/".join(st["formats"]):<19} skill {st["skill"]}')
    print('\nRègles KONVWA et méthode de chaque style : .claude/skills/konvwa-styles/SKILL.md')
    return 0


def cmd_nouveau(a):
    proj = project_dir(a.projet)
    sid = a.style
    st = STYLES[sid]
    if os.path.exists(os.path.join(proj, 'PLAN.md')):
        sys.exit(f'KONVWA : {proj} existe déjà (PLAN.md présent)')
    fmt = a.format or st['formats'][0]
    if fmt not in st['formats']:
        sys.exit(f'KONVWA : le style {sid} ne fait que {"/".join(st["formats"])} (le rendu le passe en 9:16 : --vertical flou)')
    os.makedirs(proj, exist_ok=True)
    meta = {'language': 'fr', 'settings': {'format': fmt}}
    if st['type'] == 'blender':
        meta['konvwa'] = {'style': sid, 'post': ['--sat', '1.15'] + st.get('post', []), 'fps60': 'dup'}
    else:
        meta['scenes'] = ['s01']
        meta['konvwa'] = {'style': sid, 'moteur': st['moteur']}
        if sid == 'starter':
            meta['settings']['dim'] = a.dim
        if fmt == 'landscape':
            meta['konvwa']['vertical'] = 'flou'   # KONVWA publie en 9:16 : le 16:9 posé sur une copie floutée de lui-même
    json.dump(meta, open(os.path.join(proj, 'project.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    tl, frames = write_words(proj, load_words(a.mots))
    if a.voix:
        shutil.copy(a.voix, os.path.join(proj, 'audio', 'voice' + os.path.splitext(a.voix)[1]))
        if shutil.which('ffmpeg'):   # la voix telle quelle en 48 kHz mono, là où l'application la met (aperçu, skills, mix)
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', a.voix, '-ar', '48000', '-ac', '1', os.path.join(proj, 'audio', 'clean.wav')])
    T = os.path.join(HERE, 'modele' if st['type'] == 'blender' else 'modele_web')
    for f in os.listdir(T):
        src, dst = os.path.join(T, f), os.path.join(proj, f)
        if os.path.isfile(src) and not os.path.exists(dst):
            open(dst, 'w', encoding='utf-8').write(fill(open(src, encoding='utf-8').read(), proj, sid, st, tl, frames, fmt))
    if sid == 'mega':   # la scène de départ de 3D Informational : le plan 1 de la démo du moteur (rocher, neige, caméra qui monte)
        shutil.copy(os.path.join(ENGINE, 'demo_mega', 'd01.py'), os.path.join(proj, 's01.py'))
    if st['type'] == 'web':
        E = os.path.join(PACK, st['moteur'])
        if os.path.exists(os.path.join(E, 'models.js')) and not os.path.exists(os.path.join(proj, 'models.js')):
            shutil.copy(os.path.join(E, 'models.js'), os.path.join(proj, 'models.js'))   # les aides du film : à lui de les changer
        os.makedirs(os.path.join(proj, 'scenes'), exist_ok=True)
        ex = os.path.join(PACK, st['exemple'].format(dim=a.dim)) if st.get('exemple') else os.path.join(T, 'scenes', sid + '.js')
        dst = os.path.join(proj, 'scenes', 's01.js')
        if not os.path.exists(dst):
            txt = open(ex, encoding='utf-8').read()
            open(dst, 'w', encoding='utf-8').write('// Scène de départ : un exemple du pack qui marche (lire pour la technique, puis remplacer par le film).\n' + txt)
            for m in re.findall(r"from '\./([\w-]+\.js)'", txt):   # les fichiers voisins qu'importe l'exemple
                if os.path.exists(os.path.join(os.path.dirname(ex), m)):
                    shutil.copy(os.path.join(os.path.dirname(ex), m), os.path.join(proj, 'scenes', m))
        if sid == 'stickman' and not os.path.exists(os.path.join(proj, 'assets', 'sprites')):   # le narrateur dessiné du pack
            shutil.copytree(os.path.join(E, 'sprites'), os.path.join(proj, 'assets', 'sprites'))
    print(f'Projet créé : {proj} (style {sid} : {st["nom"]}, {fmt})')
    print(f'Méthode : videos/_creatorize/skill/{st["skill"]}/SKILL.md + .claude/skills/konvwa-styles/SKILL.md')
    print('Ensuite : PLAN.md, puis ' + ('cast.py, sets.py, s01.py…, puis : konvwa test ' + os.path.basename(proj) + ' s01'
                                        if st['type'] == 'blender' else 'scenes/*.js (listées dans project.json), puis : konvwa test ' + os.path.basename(proj)))
    return 0


def cmd_image(a):
    """Une image du film (ce que font make_image / web_image dans l'application) : copiée dans assets/img/, déclarée dans
    project.json > images (les moteurs la chargent sous ce nom : IMG[nom], photo(..., 'nom'), cutout(P, 'nom')…),
    et son crédit dans CREDITS.json (source et licence : CC0, PD, CC-BY…, ou « own » pour une image générée pour le film)."""
    proj = project_dir(a.projet)
    ext = os.path.splitext(a.fichier)[1].lower() or '.png'
    rel = f'img/{a.nom}{ext}'
    os.makedirs(os.path.join(proj, 'assets', 'img'), exist_ok=True)
    shutil.copy(a.fichier, os.path.join(proj, 'assets', rel))
    pj = os.path.join(proj, 'project.json')
    meta = json.load(open(pj, encoding='utf-8-sig'))
    meta.setdefault('images', {})[a.nom] = rel
    json.dump(meta, open(pj, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    cp = os.path.join(proj, 'CREDITS.json')
    cr = json.load(open(cp, encoding='utf-8-sig')) if os.path.exists(cp) else {}
    cr['assets/' + rel] = {'source': a.source or '', 'licence': a.licence or 'own'}
    json.dump(cr, open(cp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'Image « {a.nom} » : assets/{rel} (project.json > images, CREDITS.json)')
    return 0


def cmd_sprite(a):
    """Un personnage dessiné du style stickman (ce que fait make_sprites dans l'application) : un PNG détouré (fond
    transparent) rangé dans assets/sprites/<personnage>/<pose>-<visage>.png et déclaré dans assets/sprites/index.json."""
    from PIL import Image
    proj = project_dir(a.projet)
    d = os.path.join(proj, 'assets', 'sprites')
    os.makedirs(os.path.join(d, a.perso), exist_ok=True)
    ip = os.path.join(d, 'index.json')
    idx = json.load(open(ip, encoding='utf-8-sig')) if os.path.exists(ip) else {}
    im = Image.open(a.png).convert('RGBA')
    bb = im.getchannel('A').getbbox()
    if bb:
        im = im.crop(bb)   # le moteur met à l'échelle sur la hauteur de la figure : pas de marge vide
    f = a.cle + '.png'
    im.save(os.path.join(d, a.perso, f))
    c = idx.setdefault(a.perso, {'kind': 'human', 'desc': a.desc or '', 'sprites': {}})
    if a.desc:
        c['desc'] = a.desc
    c['sprites'][a.cle] = {'file': f, 'w': im.width, 'h': im.height, 'sheet': a.feuille}
    json.dump(idx, open(ip, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'Sprite {a.perso} / {a.cle} : {im.width}x{im.height} (assets/sprites/index.json)')
    return 0


# ---------------- rendus ----------------
def run_engine(proj, seq, out, frames=None, scale='0.4', samples='12', extra=()):
    bl = need(blender_exe(), 'Blender introuvable')
    py = need(find_py(), 'Python des outils introuvable')
    os.makedirs(out, exist_ok=True)
    cmd = [bl, '-b', '--factory-startup', '-P', os.path.join(ENGINE, 'engine', 'run.py'), '--', os.path.join(proj, seq + '.py'),
           '--scale', str(scale), '--samples', str(samples), '--out', out] + (['--frames', frames] if frames else []) + list(extra)
    log = os.path.join(out, 'log.txt')
    with open(log, 'w', encoding='utf-8') as fh:
        r = subprocess.run(cmd, stdout=fh, stderr=subprocess.STDOUT, env=env_for(py, bl), cwd=ENGINE)
    txt = open(log, encoding='utf-8', errors='replace').read()
    keys = ('Traceback', 'Error', 'CZ PROP FAILED', 'CZ PLACEHOLDER', 'CZ DRESS FAILED', 'CZ FACES MISSING', 'CZ POSTER MISSING',
            'CZ SIT', 'CZ CLIP', 'CZ CAM', 'Shadow buffer full', 'CZ built', 'CZ rendered', 'CZ frame')
    for line in txt.splitlines():
        if any(k in line for k in keys) and 'EGL Error' not in line:
            print('  ' + line)
    bad = 'Traceback' in txt or r.returncode
    print(('ÉCHEC' if bad else 'ok') + f' : journal {log}')
    return 0 if not bad else 1


def next_round(proj, seq):
    base = os.path.join(proj, 'renders', 'test')
    n = 1
    while os.path.exists(os.path.join(base, f'{seq}_r{n}')):
        n += 1
    return os.path.join(base, f'{seq}_r{n}')


def make_sheet(folder, cols=6):
    py = find_py()
    if not py:
        return None
    out = os.path.join(folder, 'planche.jpg')
    subprocess.run([py, os.path.join(HERE, 'planche.py'), folder, out, str(cols)], check=False)
    return out if os.path.exists(out) else None


def web(cmd, proj, *args, check=True):
    """node web.mjs <cmd> <projet> … (styles three.js) ; renvoie le code de sortie."""
    node = need(shutil.which('node'), 'Node introuvable (styles three.js)')
    env = dict(os.environ)
    br = find_browser()
    if br:
        env['CZ_BROWSER'] = br
    r = subprocess.run([node, WEB, cmd, proj] + [str(x) for x in args], env=env)
    if check and r.returncode:
        sys.exit(f'KONVWA : web.mjs {cmd} a échoué (voir ci-dessus)')
    return r.returncode


def cmd_test(a):
    proj = project_dir(a.projet)
    sid, st, meta = style_of(proj)
    if st['type'] == 'web':
        if a.controle:
            return web('check', proj, check=False)
        end = float(meta.get('end') or 10)
        ts = a.temps or ','.join(f'{end * k / 6:.2f}' for k in range(1, 6))
        out = next_round(proj, 'web')
        web('stills', proj, '--times', ts, '--scale', a.scale if a.scale != '0.4' else '0.5', '--out', out)
        s = make_sheet(out, a.cols)
        if s:
            print('Planche :', s)
        return 0
    if not a.seq:
        sys.exit('KONVWA : style Blender : konvwa test <projet> <s03> [--frames 880,915]')
    out = next_round(proj, a.seq)
    r = run_engine(proj, a.seq, out, a.frames, a.scale, a.samples)
    s = make_sheet(out, a.cols)
    if s:
        print('Planche :', s)
    return r


def cmd_planche(a):
    s = make_sheet(os.path.abspath(a.dossier), a.cols)
    print('Planche :', s)
    return 0 if s else 1


def render_with_progress(cmd, env, proj):
    """Lance render_queue.py et affiche où il en est toutes les 10 s (images faites / à faire, dernière ligne de Blender),
    puis les erreurs du journal de chaque plan. Renvoie 1 en cas de problème."""
    import threading
    import time
    shots = os.path.join(proj, 'shots')
    p = subprocess.Popen(cmd, env=env, cwd=ENGINE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace')
    out = []
    total = [0]

    def reader():
        for line in p.stdout:
            out.append(line.rstrip())
            m = re.match(r'QUEUE (\d+) frames', line)
            if m:
                total[0] = int(m.group(1))
            print('  ' + line.rstrip(), flush=True)
    th = threading.Thread(target=reader, daemon=True)
    th.start()
    t0, last = time.time(), ''
    while p.poll() is None:
        time.sleep(10)
        done, tail = 0, ''
        for lg in glob.glob(os.path.join(shots, '*_q.log')):
            txt = open(lg, encoding='utf-8', errors='replace').read()
            done += len(re.findall(r'^CZ frame \d+', txt, re.M))
            lines = [x for x in txt.splitlines() if x.strip() and 'EGL Error' not in x]
            if lines:
                tail = lines[-1][:110]
        msg = f'  … {done}/{total[0] or "?"} images ({(time.time() - t0) / 60:.1f} min) | {tail}'
        if msg != last:
            print(msg, flush=True)
            last = msg
    th.join(timeout=5)
    bad = p.returncode != 0 or any('PROBLEMS' in x for x in out)
    for lg in glob.glob(os.path.join(shots, '*_q.log')):
        txt = open(lg, encoding='utf-8', errors='replace').read().splitlines()
        errs = [i for i, x in enumerate(txt) if 'Traceback' in x or 'Error' in x and 'EGL Error' not in x and 'Shadow buffer' not in x]
        if errs:
            bad = True
            print(f'\nERREUR dans {lg} :')
            for x in txt[max(0, errs[0] - 2):errs[0] + 18]:
                print('  ' + x)
    if bad:
        print('\nLe rendu a échoué : envoie ce message (ou le fichier _q.log ci-dessus) à Claude.')
    return 1 if bad else 0


def ass_time(t):
    t = max(0.0, t)
    return f'{int(t // 3600)}:{int(t % 3600 // 60):02d}:{t % 60:05.2f}'


def vertical_captions(words, path, y=0.80):
    """Les sous-titres mot à mot de l'export vertical (même allure que ceux du moteur Blender, post.py) : groupes de
    1-3 mots, CZ Latin blanc à contour sombre, petit « pop », dans la bande sous l'image 16:9."""
    groups, cur = [], []
    for w in words:
        cur.append(w)
        if len(''.join(ch for ch in w['word'] if ch.isalnum())) > 3 or w['word'][-1:] in ',.?!…' or len(cur) >= 3:
            groups.append(cur)
            cur = []
    if cur:
        groups.append(cur)
    L = ['[Script Info]', 'ScriptType: v4.00+', 'PlayResX: 1080', 'PlayResY: 1920', '', '[V4+ Styles]',
         'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, '
         'ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
         'Style: Cap,CZ Latin,74,&H00FFFFFF,&H00FFFFFF,&H00141A1E,&H64000000,0,0,0,0,100,100,0,0,1,6,2,5,40,40,40,1', '',
         '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text']
    for i, g in enumerate(groups):
        st = g[0]['start']
        en = min(groups[i + 1][0]['start'] if i + 1 < len(groups) else g[-1]['end'] + 0.4, g[-1]['end'] + 0.6)
        pop = r'{\pos(540,%d)\fscx82\fscy82\t(0,60,\fscx104\fscy104)\t(60,110,\fscx100\fscy100)}' % round(1920 * y)
        L.append(f'Dialogue: 0,{ass_time(st)},{ass_time(en)},Cap,,0,0,0,,{pop}' + ' '.join(w['word'] for w in g))
    open(path, 'w', encoding='utf-8').write('\n'.join(L) + '\n')


def loudness_only(src, dst):
    """Le son à -14 LUFS (mesure puis correction linéaire, limiteur), l'image copiée telle quelle : finish.py sans le
    passage à 60 i/s (sortie à 30 i/s, project.json > konvwa > fps60 = "non")."""
    m = subprocess.run(['ffmpeg', '-hide_banner', '-i', src, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    j = json.loads(m[m.rindex('{'):m.rindex('}') + 1])
    ln = ('loudnorm=I=-14:TP=-1.5:LRA=11:linear=true:measured_I={input_i}:measured_TP={input_tp}:measured_LRA={input_lra}:'
          'measured_thresh={input_thresh}:offset={target_offset}').format(**j)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af', ln + ',alimiter=limit=0.79:level=disabled', '-c:v', 'copy',
                    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', dst], check=True)


def finish(src, dst, fps=None):
    """La finition, SANS dépendance à l'ancien moteur : son à -14 LUFS (mesure puis correction linéaire, limiteur) et, si fps
    est donné (60), le passage à cette cadence (tmix si la source dépasse 61 i/s). Remplace l'ancien finish.py."""
    if not fps:
        return loudness_only(src, dst)
    m = subprocess.run(['ffmpeg', '-hide_banner', '-i', src, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    j = json.loads(m[m.rindex('{'):m.rindex('}') + 1])
    ln = ('loudnorm=I=-14:TP=-1.5:LRA=11:linear=true:measured_I={input_i}:measured_TP={input_tp}:measured_LRA={input_lra}:'
          'measured_thresh={input_thresh}:offset={target_offset}').format(**j)
    rate = subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', src], text=True).strip()
    n, _, d = rate.partition('/')
    vf = f'tmix=frames=2,fps={fps}' if float(n) / float(d or 1) > fps + 1 else f'fps={fps}'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vf', vf, '-af', ln + ',alimiter=limit=0.79:level=disabled',
                    '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', dst], check=True)


def to_vertical(src, dst, mode, ass=None):
    """Un film 16:9 en 9:16 (comme Export > Vertical 9:16 de l'application) : 'flou' = l'image entière posée sur une copie
    floutée d'elle-même, 'recadre' = le centre agrandi pour remplir le cadre ; ass = les sous-titres à graver dessus."""
    vf = ('split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=40,eq=brightness=-0.08[bg];'
          '[b]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1' if mode == 'flou' else
          'scale=-2:1920,crop=1080:1920,setsar=1')
    cwd = None
    if ass:   # le chemin passé au filtre sans « : » ni « \ » (Windows) : on lance ffmpeg dans le dossier des sous-titres
        cwd = os.path.dirname(ass)
        fd = os.path.join(cwd, 'fonts')   # la police épaisse du pack (OFL), la même sur le PC et le serveur
        os.makedirs(fd, exist_ok=True)
        shutil.copy(os.path.join(ENGINE, 'assets', 'fonts', 'cz-latin.ttf'), fd)
        vf += ',subtitles=' + os.path.basename(ass) + ':fontsdir=fonts'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.abspath(src), '-vf', vf, '-c:v', 'libx264', '-preset', 'medium', '-crf', '17',
                    '-pix_fmt', 'yuv420p', '-c:a', 'copy', os.path.abspath(dst)], check=True, cwd=cwd)


def rendu_web(a, proj, st, meta):
    name = os.path.basename(proj)
    need(shutil.which('ffmpeg'), 'ffmpeg introuvable')
    py = find_py() or sys.executable
    kv = meta.get('konvwa', {})
    voice = next(iter(sorted(glob.glob(os.path.join(proj, 'audio', 'voice.*')))), None)
    if voice and not a.sans_son:
        print('1/4 Son (les sons que posent les scènes + sons.json, fond, mix -14 LUFS)…')
        cmd_son(a)
    else:
        print('1/4 (pas de voix audio/voice.* ou --sans-son : pas de son)')
    print('2/4 Rendu des images (moteur three.js, 60 i/s)…')
    web('video', proj, '--fps', 60, '--name', name)
    src = os.path.join(proj, 'out', name + '.mp4')
    os.makedirs(os.path.join(proj, 'renders'), exist_ok=True)
    vmode = a.vertical or kv.get('vertical', 'non')
    if meta.get('settings', {}).get('format') == 'landscape' and vmode != 'non':
        print(f'3/4 Passage en 9:16 ({vmode})…')
        v = os.path.join(proj, 'renders', f'{name}_9x16.mp4')
        ass = None
        wj = os.path.join(proj, 'audio', 'words.json')
        if not a.sans_sous_titres and kv.get('sous_titres_vertical', True) and os.path.exists(wj):
            ass = os.path.join(proj, 'out', 'vertical.ass')
            vertical_captions(load_words(wj), ass, 0.80 if vmode == 'flou' else 0.72)
        to_vertical(src, v, vmode, ass)
        src = v
    else:
        print('3/4 (format gardé)')
    final = os.path.join(proj, 'renders', f'{name}.mp4')
    if voice:
        print('4/4 Son à -14 LUFS et 60 i/s…')
        finish(src, final, 60)
    else:
        shutil.copy(src, final)
    print('\nVidéo prête :', final)
    return 0


def cmd_pack(a):
    """Cherche dans TOUT le pack Creatorize (skills et références des styles, PITFALLS, bibliothèque, base de connaissances,
    Style Studio, style kit) : à lancer avant chaque étape de travail, pour appliquer ce que le pack sait déjà."""
    mots = [m.lower() for m in a.mots]
    zones = [('skill', 'skill'), ('bibliothèque', 'library'), ('base de connaissances', 'support'), ('studio', 'studio'),
             ('style kit', 'stylekit'), ('blender', 'blender/engine'), ('blender', 'blender/ref')]
    if a.zone:
        zones = [z for z in zones if a.zone.lower() in z[0].lower() or a.zone.lower() in z[1].lower()]
    res = []
    for nom, rel in zones:
        base = os.path.join(PACK, rel)
        for racine, dirs, fichiers in os.walk(base):
            dirs[:] = [d for d in dirs if d not in ('node_modules', '__pycache__', 'assets', 'fonts', 'samples')]
            for f in fichiers:
                if not f.lower().endswith(('.md', '.txt', '.json', '.py')) or f in ('index.js',):
                    continue
                ch = os.path.join(racine, f)
                try:
                    if os.path.getsize(ch) > 400000: continue
                    t = open(ch, encoding='utf-8', errors='ignore').read()
                except OSError:
                    continue
                bas = t.lower()
                sc = sum(bas.count(m) for m in mots if m in bas)
                if all(m in bas or m in ch.lower() for m in mots) and sc:
                    ligne = next((l.strip() for l in t.splitlines() if all(m in l.lower() for m in mots[:1])), '')
                    res.append((sc + (50 if all(m in ch.lower() for m in mots) else 0), os.path.relpath(ch, VIDEOS), nom, ligne[:150]))
    res.sort(reverse=True)
    if not res:
        print('rien dans le pack pour : ' + ' '.join(mots) + '  (essaie un mot plus court, ou en anglais : le pack est en anglais)'); return 0
    print('PACK : %d fichiers pour « %s » (les %d premiers)' % (len(res), ' '.join(mots), min(a.n, len(res))))
    for sc, ch, nom, l in res[:a.n]:
        print('  [%s] %s  (%d)\n      %s' % (nom, ch, sc, l))
    print("LIS les fichiers cités (Read) avant d'écrire ; le pack prime sur la mémoire.")
    return 0


def cmd_rendu(a):
    proj = project_dir(a.projet)
    sid, st, meta0 = style_of(proj)
    if st['type'] == 'web':
        return rendu_web(a, proj, st, meta0)
    name = os.path.basename(proj)
    bl = need(blender_exe(), 'Blender introuvable')
    py = need(find_py(), 'Python des outils introuvable')
    need(shutil.which('ffmpeg'), 'ffmpeg introuvable')
    meta = json.load(open(os.path.join(proj, 'project.json'), encoding='utf-8-sig'))
    kv = meta.get('konvwa', {})
    env = env_for(py, bl)
    T = os.path.join(ENGINE, 'tools')
    # comme l'export de l'application : le réglage du rendu pour cette machine d'abord (render_tune.py : les réglages les
    # plus rapides qui donnent la même image, un seul Blender sauf mesure contraire), puis chaque plan en animation (--anim)
    q = [py, os.path.join(T, 'render_queue.py'), proj, '--scale', str(a.scale), '--samples', str(a.samples)]
    q += (['--jobs', str(a.jobs or 1)] if a.jobs or a.sans_reglage else []) + ([] if a.sans_reglage else ['--tune', '--anim'])
    print('1/5 Rendu des plans (moteur Blender' + ('' if a.sans_reglage else ', réglé pour cette machine') + ')…')
    if render_with_progress(q, env, proj):
        return 1
    print('2/5 Montage (fondus, raccords)…')
    subprocess.run([py, os.path.join(T, 'assemble.py'), proj], env=env, cwd=ENGINE, check=True)
    os.makedirs(os.path.join(proj, 'renders'), exist_ok=True)
    voice = next(iter(sorted(glob.glob(os.path.join(proj, 'audio', 'voice.*')))), None)
    fm = os.path.join(proj, 'audio', 'final_mix.wav')
    if os.path.exists(os.path.join(proj, 'sons.json')):
        print('   Son du film (sons.json : effets, fond, musique)…')
        cmd_son(a)
    if os.path.exists(fm):
        voice = fm   # le mix de « konvwa son » (voix + effets + fond)
    else:
        print('  (pas de audio/final_mix.wav : la voix seule ; « konvwa son » ajoute effets et fond)')
    post_out = os.path.join('renders', f'{name}_post.mp4')
    print('3/5 Finition image, sous-titres, voix…')
    cmd = [py, os.path.join(T, 'post.py'), proj, '--frames', os.path.join(proj, 'frames_final'), '--out', post_out,
           '--words', os.path.join(proj, 'audio', 'words.json')] + (['--vo', voice] if voice else []) + list(kv.get('post', []))
    if a.sans_sous_titres:
        cmd.append('--no-captions')
    subprocess.run(cmd, env=env, cwd=ENGINE, check=True)
    src = os.path.join(proj, post_out)
    mode = a.fps60 or kv.get('fps60', 'dup')
    # 'dup' : finish.py passe lui-même à 60 i/s (chaque image deux fois) ; 'interp' : images intermédiaires calculées
    if mode == 'interp':
        print(f'4/5 Passage à 60 i/s ({mode})…')
        v60 = os.path.join(proj, 'renders', f'{name}_60.mp4')
        vf = 'minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1' if mode == 'interp' else 'fps=60'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vf', vf, '-c:v', 'libx264', '-preset', 'medium', '-crf', '17',
                        '-pix_fmt', 'yuv420p', '-bf', '0', '-g', '120', '-c:a', 'copy', v60], check=True)
        src = v60
    else:
        print('4/5 (60 i/s par finish.py)' if mode == 'dup' else '4/5 (30 i/s gardés)')
    final = os.path.join(proj, 'renders', f'{name}.mp4')
    if voice and mode == 'non':
        print('5/5 Son à -14 LUFS (30 i/s gardés)…')
        loudness_only(src, final)
    elif voice:
        print('5/5 Son à -14 LUFS et 60 i/s…')
        finish(src, final, 60)
    else:
        shutil.copy(src, final)
    print('\nVidéo prête :', final)
    return 0


# ---------------- le son (chaîne du pack : sound_design.py + mix.py, bibliothèque lowpoly/library/sfx) ----------------
def word_time(words, spec):
    """« mot:jarre#2+0.1 » -> le début du 2e « jarre » + 0,1 s (casse et ponctuation ignorées)."""
    m = re.fullmatch(r'mot:(.+?)(?:#(\d+))?([+-][\d.]+)?', spec.strip())   # « vingt-deux » : le trait d'union fait partie du mot
    if not m:
        raise ValueError('temps illisible : ' + spec)
    k = ''.join(ch for ch in m.group(1).lower() if ch.isalnum())
    hits = [w for w in words if ''.join(ch for ch in w['word'].lower() if ch.isalnum()) == k]
    n = int(m.group(2) or 1)
    if len(hits) < n:
        raise KeyError(f'« {m.group(1)} » n°{n} absent de la voix')
    return hits[n - 1]['start'] + float(m.group(3) or 0)


def shot_starts(proj):
    """Le début (s) de chaque plan après le premier, dans l'ordre d'assemble.json : un whoosh à chaque changement de plan."""
    cfg = json.load(open(os.path.join(proj, 'assemble.json'), encoding='utf-8-sig'))
    out = []
    for s in cfg.get('shots', [])[1:]:
        m = re.search(r'^F0\s*,\s*F1\s*=\s*(\d+)\s*,\s*(\d+)', open(os.path.join(proj, s + '.py'), encoding='utf-8-sig').read(), re.M)
        if m:
            out.append((int(m.group(1)) - 1) / FPS)
    return out


def cmd_son(a):
    """Le son du film avec la chaîne du style (son propre scripts/sound_design.py dans le skill du pack) : les effets
    (Blender : sons.json + un whoosh par changement de plan ; three.js : les sons que posent les scènes, relevés dans la
    page par web.mjs events, + sons.json), les fonds, la musique si demandée, puis le mix (voix devant, -14 LUFS)."""
    proj = project_dir(a.projet)
    sid, st, meta = style_of(proj)
    A = os.path.join(proj, 'audio')
    py = need(find_py(), 'Python des outils introuvable')
    need(shutil.which('ffmpeg'), 'ffmpeg introuvable')
    if not has_modules(py, ['scipy']):
        sys.exit('KONVWA : il manque scipy -> python videos/_konvwa/konvwa.py installer')
    voice = next(iter(sorted(glob.glob(os.path.join(A, 'voice.*')))), None)
    need(voice, 'pas de voix (audio/voice.*)')
    words = load_words(os.path.join(A, 'words.json'))
    cfgp = os.path.join(proj, 'sons.json')
    cfg = json.load(open(cfgp, encoding='utf-8-sig')) if os.path.exists(cfgp) else {}
    own = []
    for e in cfg.get('sfx', []):
        e = dict(e)
        t = e.get('t')
        e['t'] = round(word_time(words, t) if isinstance(t, str) else float(t), 3)
        if sid == 'roblox' and 'name' not in e:
            e['name'] = e.get('type')
        own.append(e)
    if st['type'] == 'web':
        print('Les sons que posent les scènes (web.mjs events)…')
        web('events', proj)
        ev = json.load(open(os.path.join(A, 'events.json'), encoding='utf-8-sig')) or {}
        ev['sfx'] = sorted((ev.get('sfx') or []) + own, key=lambda e: e.get('t', 0))
    else:
        if cfg.get('whoosh_plans', True):
            own += [{'t': round(max(0.0, t - 0.12), 3), 'type': 'whoosh', 'gain': -4} for t in shot_starts(proj)]
        ev = {'style': 'toon', 'sfx': sorted(own, key=lambda e: e['t'])}
    json.dump(ev, open(os.path.join(A, 'events.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    end = words[-1]['end'] + 1.5
    music_ok = st.get('musique', True)
    if not music_ok and (cfg.get('musique') or cfg.get('musique_synth')):
        print(f'  (le style {sid} n\'a jamais de musique : la musique de sons.json est ignorée)')
    beds = cfg.get('beds') or [{'from': 0, 'to': round(end, 2), 'type': 'room', 'gain': -45}]
    json.dump({'music': bool(cfg.get('musique_synth')) and music_ok, 'ambience': True, 'beds': beds},
              open(os.path.join(A, 'beds.json'), 'w', encoding='utf-8'), indent=1)
    # la voix telle quelle (les mix la lisent en audio/clean.wav)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', voice, '-ar', '48000', '-ac', '1', os.path.join(A, 'clean.wav')], check=True)
    sd = os.path.join(SKILL, st['skill'], 'scripts', 'sound_design.py')
    print(f'Effets et fond ({st["skill"]}/scripts/sound_design.py)…')
    subprocess.run([py, sd, proj], check=True, cwd=os.path.dirname(sd))
    music = cfg.get('musique') if music_ok else None
    if st.get('mix') == 'roblox':   # le bed de Roblox est déjà calé sur la voix : son propre mix, sans second ducking
        mix = [py, os.path.join(SKILL, 'roblox-story-shorts', 'scripts', 'mix.py'), proj, '--lufs', '-14']
    else:
        mix = [py, os.path.join(SKILL, 'pixel-explainer-video', 'scripts', 'mix.py'), proj, '--lufs', '-14', '--min-ratio', str(cfg.get('min_ratio', 12))]
    if music:
        mp = music if os.path.isabs(music) else os.path.join(proj, music)
        mix += ['--music', mp, '--music-gain', str(cfg.get('musique_gain', -22))]
    print('Mixage (voix devant, fond baissé sous la voix, -14 LUFS)…')
    try:
        subprocess.run(mix, check=True)
    except subprocess.CalledProcessError as ex:
        # filet : le mix du pack a échoué (souvent un ffmpeg plus ancien) -> mix simple, voix pleine + effets sous elle, -14 LUFS
        print('(!) mix du pack échoué (%s) : mix simple de secours (voix + effets sous la voix, -14 LUFS)' % ex)
        bed = os.path.join(A, 'sfx_bed.wav')
        fm = os.path.join(A, 'final_mix.wav')
        if os.path.exists(bed):
            fc = '[1:a]volume=-6dB[b];[0:a][b]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11'
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(A, 'clean.wav'), '-i', bed, '-filter_complex', fc, '-ar', '48000', '-ac', '1', fm], check=True)
        else:
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(A, 'clean.wav'), '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '48000', fm], check=True)
    print('Son prêt :', os.path.join(A, 'final_mix.wav'), '(le rendu l\'utilise à la place de la voix seule)')
    return 0


def main():
    ap = argparse.ArgumentParser(prog='konvwa', description='Fabrication des vidéos KONVWA avec tous les moteurs du pack Creatorize.')
    sp = ap.add_subparsers(dest='cmd', required=True)
    p = sp.add_parser('pack'); p.add_argument('mots', nargs='+'); p.add_argument('--zone'); p.add_argument('-n', type=int, default=12); p.set_defaults(fn=cmd_pack)
    sp.add_parser('styles').set_defaults(fn=cmd_styles)
    sp.add_parser('verifier').set_defaults(fn=cmd_verifier)
    p = sp.add_parser('installer'); p.add_argument('--bpy', action='store_true', help='aussi Blender en module (serveur sans Blender)'); p.set_defaults(fn=cmd_installer)
    p = sp.add_parser('nouveau'); p.add_argument('projet'); p.add_argument('--mots', required=True); p.add_argument('--voix')
    p.add_argument('--style', default='blender', choices=list(STYLES)); p.add_argument('--format', choices=['vertical', 'landscape'])
    p.add_argument('--dim', default='3d', choices=['2d', '3d']); p.set_defaults(fn=cmd_nouveau)
    p = sp.add_parser('image'); p.add_argument('projet'); p.add_argument('nom'); p.add_argument('fichier'); p.add_argument('--source')
    p.add_argument('--licence'); p.set_defaults(fn=cmd_image)
    p = sp.add_parser('sprite'); p.add_argument('projet'); p.add_argument('perso'); p.add_argument('cle', help='pose-visage, ex. walk-angry, talk-happy, XL-smug')
    p.add_argument('png'); p.add_argument('--desc'); p.add_argument('--feuille', default='film'); p.set_defaults(fn=cmd_sprite)
    p = sp.add_parser('mots'); p.add_argument('projet'); p.add_argument('words'); p.set_defaults(fn=cmd_mots)
    p = sp.add_parser('test'); p.add_argument('projet'); p.add_argument('seq', nargs='?'); p.add_argument('--frames'); p.add_argument('--scale', default='0.4')
    p.add_argument('--samples', default='12'); p.add_argument('--cols', type=int, default=6)
    p.add_argument('--temps', help='three.js : secondes, ex. 1,4.5,9'); p.add_argument('--controle', action='store_true', help='three.js : scènes qui plantent + mise en page')
    p.set_defaults(fn=cmd_test)
    p = sp.add_parser('planche'); p.add_argument('dossier'); p.add_argument('--cols', type=int, default=6); p.set_defaults(fn=cmd_planche)
    p = sp.add_parser('son'); p.add_argument('projet'); p.set_defaults(fn=cmd_son)
    p = sp.add_parser('rendu'); p.add_argument('projet'); p.add_argument('--jobs', type=int); p.add_argument('--scale', default='1.0')
    p.add_argument('--samples', default='48'); p.add_argument('--fps60', choices=['dup', 'interp', 'non']); p.add_argument('--sans-sous-titres', action='store_true')
    p.add_argument('--sans-reglage', action='store_true', help='Blender : sans le réglage automatique du rendu (render_tune)')
    p.add_argument('--vertical', choices=['flou', 'recadre', 'non'], help='film 16:9 -> 9:16'); p.add_argument('--sans-son', action='store_true')
    p.set_defaults(fn=cmd_rendu)
    a = ap.parse_args()
    sys.exit(a.fn(a))


if __name__ == '__main__':
    main()
