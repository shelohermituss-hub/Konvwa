# Son de « La Grande Puanteur » : fond (musique continue + ambiance du lieu), bruitages calés
# sur les mots (voice/words.json), puis mixage par ../../_engine/style-anime/mix_anime.py (voix devant, aucun trou).
# usage (depuis la racine du dépôt) : python3 -I videos/grande-puanteur/audio/build_mix.py
import json
import os
import subprocess

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
SR = 48000
FPS = 60
W = [w['start'] for w in json.load(open(os.path.join(HERE, '..', 'voice', 'words.json')))]
VOICE_END = 67.12
DUR = round((VOICE_END + 1.6) * FPS) / FPS  # = TOTAL / 60 (story.ts)
at = lambda k: W[k] - 2 / FPS
A = lambda n: os.path.join(HERE, 'sfx', n)
S1 = lambda n: os.path.join(ROOT, 'videos', '_engine', 'style-anime', 'sfx', n)
S3 = lambda n: os.path.join(ROOT, 'videos', '_engine', 'style-3d', 'sfx', n)
TW = lambda n: os.path.join(ROOT, 'videos', 'talkie-walkie', 'audio', 'sfx', n)


def load(path, dur=None):
    cmd = ['ffmpeg', '-v', 'error', '-i', path] + (['-t', str(dur)] if dur else []) + ['-ac', '2', '-ar', str(SR), '-f', 'f32le', '-']
    return np.frombuffer(subprocess.check_output(cmd), np.float32).reshape(-1, 2).copy()


def loop_to(x, n):
    """répète x (fondu de 0,5 s à chaque raccord) jusqu'à n échantillons"""
    out, f = np.zeros((n, 2), np.float32), int(0.5 * SR)
    i = 0
    while i < n:
        seg = x.copy()
        seg[:f] *= np.linspace(0, 1, f)[:, None]
        seg[-f:] *= np.linspace(1, 0, f)[:, None]
        m = min(len(seg), n - i)
        out[i:i + m] += seg[:m]
        i += len(seg) - f
    return out


def rms(x):
    return float(np.sqrt(np.mean(x.astype(np.float64) ** 2)) + 1e-9)


n = int(DUR * SR)
music = load(os.path.join(HERE, 'musique.mp3'))[:n]
music = np.pad(music, ((0, n - len(music)), (0, 0)))
# la musique a des « stop » (silences de 0,5 s) : un gain lent les remonte (au plus +12 dB) pour qu'il n'y ait aucun trou
mono = music.mean(1).astype(np.float64)
k = int(0.25 * SR)
env = np.sqrt(np.convolve(mono ** 2, np.ones(k) / k, mode='same')) + 1e-6
ref = np.median(env)
gain = np.clip(ref / env, 0.6, 4.0)
gain = np.convolve(gain, np.ones(int(0.15 * SR)) / int(0.15 * SR), mode='same')
music *= gain[:, None].astype(np.float32)
music[-int(1.6 * SR):] *= np.linspace(1, 0, int(1.6 * SR))[:, None] ** 1.5  # fin en fondu, sur la dernière image
amb = {k: loop_to(load(p), n) for k, p in
       {'quai': A('quai-1858.mp3'), 'rue': A('rue-1858.mp3'), 'moderne': TW('rue-londres.mp3'), 'salle': S3('ambiance-piece.mp3'), 'egout': A('egout-eau.mp3')}.items()}
for k in amb:  # chaque ambiance 6 dB sous la musique
    amb[k] *= rms(music) / rms(amb[k]) * 10 ** ((-6 + (6 if k == 'salle' else 0)) / 20)  # la salle est très calme : +6 dB
# quelle ambiance quand : le quai (Tamise), la rue de 1858, la rue d'aujourd'hui, la salle des débats, le tunnel
CUTS = [(0, 'quai'), (37, 'rue'), (49, 'quai'), (60, 'moderne'), (81, 'quai'), (98, 'salle'), (113, 'quai'), (123, 'rue'), (139, 'salle'),
        (158, 'rue'), (163, 'egout'), (174, 'quai'), (182, 'rue'), (199, 'quai'), (210, 'moderne')]
ZONES = [(k, 0 if i == 0 else at(w), at(CUTS[i + 1][0]) if i + 1 < len(CUTS) else DUR) for i, (w, k) in enumerate(CUTS)]
bed = music.copy()
t = np.arange(n) / SR
for k, a, b in ZONES:
    g = np.clip((t - a + 0.3) / 0.6, 0, 1) * np.clip((b - t + 0.3) / 0.6, 0, 1)
    bed += amb[k] * g[:, None]
bed_path = os.path.join(HERE, 'bed.wav')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'pcm_s16le', bed_path],
               input=(bed / max(1.0, np.abs(bed).max() / 0.95)).astype(np.float32).tobytes(), check=True)

E = [  # [fichier, début (s), volume, durée max]
    [A('puanteur.mp3'), 0.1, 0.6, None],                # accroche : l'odeur
    [A('deputes-fuient.mp3'), at(7), 0.8, None],        # les députés fuient
    [S1('whoosh.mp3'), at(15) - 0.25, 0.5, 0.8],        # flash blanc
    [S1('flash.mp3'), at(15) - 0.05, 0.5, 1.0],
    [A('egout-eau.mp3'), at(23), 0.55, 2.6],            # les bouches d'égout crachent
    [S1('compteur.mp3'), at(44), 0.45, 1.2],            # le thermomètre monte
    [A('fleuve-bulles.mp3'), at(49), 0.8, None],        # le fleuve fermente
    [S1('whoosh.mp3'), at(60) - 0.25, 0.45, 0.8],       # aujourd'hui
    [S1('mouches.mp3'), at(60), 0.5, 2.0],
    [A('poubelle.mp3'), at(69), 0.8, None],             # le couvercle
    [A('puanteur.mp3'), at(71), 0.5, None],
    [S1('whoosh.mp3'), at(81) - 0.25, 0.45, 0.8],       # retour en 1858
    [A('cloche.mp3'), at(89), 0.4, None],               # le Parlement
    [A('rideau.mp3'), at(99), 0.8, None],               # les rideaux trempés
    [A('rideau.mp3'), at(108) - 0.3, 0.45, 1.4],        # le rideau goutte encore (comble la pause)
    [A('puanteur.mp3'), at(109), 0.55, None],           # ça ne suffit pas
    [A('deputes-fuient.mp3'), at(113), 0.8, None],      # ils sortent en courant
    [S1('malle.mp3'), at(124), 0.5, 1.5],               # la charrette
    [S1('papier.mp3'), at(133), 0.6, 1.2],              # le journal
    [S1('foule.mp3'), at(141), 0.45, 1.6],              # le vote
    [A('calendrier.mp3'), at(148), 0.8, None],          # dix-huit jours
    [S1('tampon.mp3'), at(154), 0.6, 1.0],              # l'argent voté
    [A('pelles.mp3'), at(158), 0.7, None],              # la tranchée
    [A('briques.mp3'), at(163) + 0.2, 0.7, None],       # le tunnel
    [S1('scintille.mp3'), at(174), 0.4, 1.5],           # les égouts vus du ciel
    [S1('ding.mp3'), at(182), 0.35, 1.0],               # « Et le plus fort ? »
    [A('nuage.mp3'), at(186), 0.7, None],               # le mauvais air
    [A('degonfle.mp3'), at(197) + 0.1, 0.8, None],      # c'était faux
    [S1('whoosh.mp3'), at(199) - 0.25, 0.45, 0.8],      # le fleuve propre
    [A('cloche.mp3'), at(203), 0.35, None],
    [S1('whoosh.mp3'), at(210) - 0.25, 0.45, 0.8],      # aujourd'hui
    [A('egout-eau.mp3'), at(212), 0.5, None],
]
plan = {'voice': os.path.join(HERE, '..', 'voice', 'voice.wav'), 'voice_start': 0.0, 'duration': DUR, 'bed': bed_path,
        'sfx_gain': 1.4, 'events': E}
plan_path = os.path.join(HERE, 'plan.json')
json.dump(plan, open(plan_path, 'w'), indent=1)
subprocess.run(['python3', '-I', os.path.join(ROOT, 'videos', '_engine', 'style-anime', 'mix_anime.py'), plan_path, os.path.join(HERE, 'mix.wav')], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(HERE, 'mix.wav'), '-c:a', 'flac', os.path.join(HERE, 'mix.flac')], check=True)
print('durée', DUR, 's')
