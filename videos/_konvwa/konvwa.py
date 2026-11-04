#!/usr/bin/env python3
# KONVWA : l'outil de fabrication des vidéos 3D (moteur Blender de Creatorize, videos/_creatorize/blender).
# Une commande par étape ; le même outil sur le PC Windows du client (Blender 5.2 installé) et sur le serveur cloud de
# Claude (Blender en module Python « bpy », rendu logiciel, pour les images de contrôle).
#
#   python videos/_konvwa/konvwa.py verifier                       Blender, Python (Pillow, numpy, OpenCV), ffmpeg
#   python videos/_konvwa/konvwa.py installer [--bpy]              crée videos/_konvwa/.venv avec ce qu'il faut
#   python videos/_konvwa/konvwa.py nouveau <projet> --mots <words.json> [--voix <voix.wav>]
#   python videos/_konvwa/konvwa.py mots <projet> <words.json>     (re)fait audio/timeline.json + audio/words.json
#   python videos/_konvwa/konvwa.py test <projet> <s03> [--frames 880,915] [--scale 0.4] [--samples 12]
#   python videos/_konvwa/konvwa.py planche <dossier d'images> [--cols 6]
#   python videos/_konvwa/konvwa.py son <projet>                   effets sonores (bibliothèque CC0 du pack) + fond + musique, mix -14 LUFS
#   python videos/_konvwa/konvwa.py rendu <projet> [--jobs 1] [--scale 1.0] [--samples 48] [--fps60 dup|interp|non]
#
# <projet> = le nom d'un dossier de videos/ (ex. jarre-blender) ou un chemin. Le moteur n'est jamais modifié : tout ce qui
# est propre à un film vit dans son dossier (cast.py, sets.py, sNN.py, assemble.json, PLAN.md…).
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
FINISH = os.path.join(VIDEOS, '_engine', 'style-histoire', 'finish.py')
WIN = os.name == 'nt'
FPS = 30  # le moteur travaille à 30 i/s (toutes ses durées en images sont calées dessus)


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
    print(f'[ok] moteur : {ENGINE}' if os.path.exists(os.path.join(ENGINE, 'engine', 'run.py')) else '[!!] moteur absent : git pull')
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
    ({"words": [{word, start, end}]}, ce que lit post.py pour les sous-titres)."""
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
    end = round(words[-1]['end'] + 1.2, 3)
    pj = os.path.join(proj, 'project.json')
    meta = json.load(open(pj, encoding='utf-8-sig')) if os.path.exists(pj) else {}
    meta.update({'language': 'fr', 'end': end})
    meta.setdefault('settings', {'format': 'portrait'})
    meta.setdefault('konvwa', {'post': ['--sat', '1.15'], 'fps60': 'dup'})
    json.dump(meta, open(pj, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    frames = round(end * FPS)
    print(f'{len(words)} mots, {len(tl)} phrases, fin {end} s = {frames} images à {FPS} i/s')
    return tl, frames


def cmd_mots(a):
    proj = project_dir(a.projet)
    write_words(proj, load_words(a.words))
    return 0


def cmd_nouveau(a):
    proj = project_dir(a.projet)
    if os.path.exists(os.path.join(proj, 'PLAN.md')):
        sys.exit(f'KONVWA : {proj} existe déjà (PLAN.md présent)')
    os.makedirs(proj, exist_ok=True)
    tl, frames = write_words(proj, load_words(a.mots))
    if a.voix:
        shutil.copy(a.voix, os.path.join(proj, 'audio', 'voice' + os.path.splitext(a.voix)[1]))
    T = os.path.join(HERE, 'modele')
    for f in os.listdir(T):
        dst = os.path.join(proj, f)
        if not os.path.exists(dst):
            s = open(os.path.join(T, f), encoding='utf-8').read()
            s = s.replace('{{PROJET}}', os.path.basename(proj)).replace('{{FRAMES}}', str(frames))
            s = s.replace('{{DUREE}}', f'{frames / FPS:.2f}').replace('{{PHRASES}}', '\n'.join(
                f'- f{round(p["s"] * FPS) + 1} ({p["s"]:.2f} s) : {p["text"]}' for p in tl))
            open(dst, 'w', encoding='utf-8').write(s)
    print('Projet créé :', proj)
    print('Ensuite : PLAN.md, puis cast.py, sets.py, s01.py…, puis : konvwa test', os.path.basename(proj), 's01')
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


def cmd_test(a):
    proj = project_dir(a.projet)
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


def cmd_rendu(a):
    proj = project_dir(a.projet)
    name = os.path.basename(proj)
    bl = need(blender_exe(), 'Blender introuvable')
    py = need(find_py(), 'Python des outils introuvable')
    need(shutil.which('ffmpeg'), 'ffmpeg introuvable')
    meta = json.load(open(os.path.join(proj, 'project.json'), encoding='utf-8-sig'))
    kv = meta.get('konvwa', {})
    env = env_for(py, bl)
    T = os.path.join(ENGINE, 'tools')
    print('1/5 Rendu des plans (moteur Blender)…')
    if render_with_progress([py, os.path.join(T, 'render_queue.py'), proj, '--jobs', str(a.jobs), '--scale', str(a.scale), '--samples', str(a.samples)],
                            env, proj):
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
    if voice and os.path.exists(FINISH):
        print('5/5 Son à -14 LUFS (finish.py)…')
        subprocess.run([py, '-I', FINISH, src, final], check=True)
    else:
        shutil.copy(src, final)
    print('\nVidéo prête :', final)
    return 0


# ---------------- le son (chaîne du pack : sound_design.py + mix.py, bibliothèque lowpoly/library/sfx) ----------------
SKILL = os.path.join(VIDEOS, '_creatorize', 'skill')


def word_time(words, spec):
    """« mot:jarre#2+0.1 » -> le début du 2e « jarre » + 0,1 s (casse et ponctuation ignorées)."""
    m = re.fullmatch(r'mot:([^#+\-]+)(?:#(\d+))?([+-][\d.]+)?', spec.strip())
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
    proj = project_dir(a.projet)
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
    # les effets : ceux du film (sons.json, au temps d'un mot ou en secondes) + un whoosh à chaque changement de plan
    sfx = []
    for e in cfg.get('sfx', []):
        e = dict(e)
        t = e.get('t')
        e['t'] = round(word_time(words, t) if isinstance(t, str) else float(t), 3)
        sfx.append(e)
    if cfg.get('whoosh_plans', True):
        sfx += [{'t': round(max(0.0, t - 0.12), 3), 'type': 'whoosh', 'gain': -4} for t in shot_starts(proj)]
    json.dump({'style': 'toon', 'sfx': sorted(sfx, key=lambda e: e['t'])}, open(os.path.join(A, 'events.json'), 'w', encoding='utf-8'), indent=1)
    end = words[-1]['end'] + 1.5
    beds = cfg.get('beds') or [{'from': 0, 'to': round(end, 2), 'type': 'room', 'gain': -45}]
    json.dump({'music': bool(cfg.get('musique_synth')), 'ambience': True, 'beds': beds},
              open(os.path.join(A, 'beds.json'), 'w', encoding='utf-8'), indent=1)
    # la voix telle quelle (mix.py la lit en audio/clean.wav)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', voice, '-ar', '48000', '-ac', '1', os.path.join(A, 'clean.wav')], check=True)
    print('Effets et fond (sound_design.py)…')
    subprocess.run([py, os.path.join(SKILL, 'blender-toon-shorts', 'scripts', 'sound_design.py'), proj], check=True)
    mix = [py, os.path.join(SKILL, 'pixel-explainer-video', 'scripts', 'mix.py'), proj, '--lufs', '-14', '--min-ratio', str(cfg.get('min_ratio', 12))]
    music = cfg.get('musique')
    if music:
        mp = music if os.path.isabs(music) else os.path.join(proj, music)
        mix += ['--music', mp, '--music-gain', str(cfg.get("musique_gain", -22))]
    print('Mixage (voix devant, fond baissé sous la voix, -14 LUFS)…')
    subprocess.run(mix, check=True)
    print('Son prêt :', os.path.join(A, 'final_mix.wav'), '(le rendu l\'utilise à la place de la voix seule)')
    return 0


def main():
    ap = argparse.ArgumentParser(prog='konvwa', description='Fabrication des vidéos 3D KONVWA (moteur Blender).')
    sp = ap.add_subparsers(dest='cmd', required=True)
    sp.add_parser('verifier').set_defaults(fn=cmd_verifier)
    p = sp.add_parser('installer'); p.add_argument('--bpy', action='store_true', help='aussi Blender en module (serveur sans Blender)'); p.set_defaults(fn=cmd_installer)
    p = sp.add_parser('nouveau'); p.add_argument('projet'); p.add_argument('--mots', required=True); p.add_argument('--voix'); p.set_defaults(fn=cmd_nouveau)
    p = sp.add_parser('mots'); p.add_argument('projet'); p.add_argument('words'); p.set_defaults(fn=cmd_mots)
    p = sp.add_parser('test'); p.add_argument('projet'); p.add_argument('seq'); p.add_argument('--frames'); p.add_argument('--scale', default='0.4')
    p.add_argument('--samples', default='12'); p.add_argument('--cols', type=int, default=6); p.set_defaults(fn=cmd_test)
    p = sp.add_parser('planche'); p.add_argument('dossier'); p.add_argument('--cols', type=int, default=6); p.set_defaults(fn=cmd_planche)
    p = sp.add_parser('son'); p.add_argument('projet'); p.set_defaults(fn=cmd_son)
    p = sp.add_parser('rendu'); p.add_argument('projet'); p.add_argument('--jobs', type=int, default=1); p.add_argument('--scale', default='1.0')
    p.add_argument('--samples', default='48'); p.add_argument('--fps60', choices=['dup', 'interp', 'non']); p.add_argument('--sans-sous-titres', action='store_true')
    p.set_defaults(fn=cmd_rendu)
    a = ap.parse_args()
    sys.exit(a.fn(a))


if __name__ == '__main__':
    main()
