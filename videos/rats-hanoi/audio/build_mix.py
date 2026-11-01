# Son des « Rats d'Hanoï » : fond (musique continue + ambiance du lieu), bruitages calés
# sur les mots (voice/words.json), puis mixage par ../../_engine/style-anime/mix_anime.py (voix devant, aucun trou).
# usage (depuis la racine du dépôt) : python3 -I videos/rats-hanoi/audio/build_mix.py
import json
import os
import subprocess

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
SR = 48000
FPS = 60
W = [w['start'] for w in json.load(open(os.path.join(HERE, '..', 'voice', 'words.json')))]
VOICE_END = 63.24
DUR = round((VOICE_END + 1.6) * FPS) / FPS  # = TOTAL / 60 (story.ts)
at = lambda k: W[k] - 2 / FPS
A = lambda n: os.path.join(HERE, 'sfx', n)
S1 = lambda n: os.path.join(ROOT, 'videos', '_engine', 'style-anime', 'sfx', n)
S3 = lambda n: os.path.join(ROOT, 'videos', '_engine', 'style-3d', 'sfx', n)
TW = lambda n: os.path.join(ROOT, 'videos', 'talkie-walkie', 'audio', 'sfx', n)
GP = lambda n: os.path.join(ROOT, 'videos', 'grande-puanteur', 'audio', 'sfx', n)


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
gain = np.clip(ref / env, 0.6, 30.0)  # cette musique a de vrais silences (−65 dB) : on la remonte jusqu'à +30 dB
gain = np.convolve(gain, np.ones(int(0.15 * SR)) / int(0.15 * SR), mode='same')
music *= gain[:, None].astype(np.float32)
music[-int(1.6 * SR):] *= np.linspace(1, 0, int(1.6 * SR))[:, None] ** 1.5  # fin en fondu, sur la dernière image
amb = {k: loop_to(load(p), n) for k, p in
       {'rue': A('rue-hanoi.mp3'), 'ferme': A('rizieres.mp3'), 'egout': GP('egout-eau.mp3'), 'salle': S3('ambiance-piece.mp3'), 'jardin': TW('parc.mp3')}.items()}
for k in amb:  # chaque ambiance 6 dB sous la musique (la salle, très calme : +6 dB)
    amb[k] *= rms(music) / rms(amb[k]) * 10 ** ((-6 + (6 if k == 'salle' else 0)) / 20)
# quelle ambiance quand : le bureau, la ferme, le boulevard, la salle de bains, les égouts, le jardin, les archives
CUTS = [(0, 'salle'), (11, 'ferme'), (21, 'rue'), (38, 'egout'), (49, 'salle'), (56, 'rue'), (61, 'egout'), (73, 'salle'),
        (85, 'egout'), (97, 'salle'), (117, 'jardin'), (138, 'rue'), (150, 'egout'), (164, 'ferme'), (177, 'salle'), (181, 'rue'), (188, 'salle')]
ZONES = [(k, 0 if i == 0 else at(w), at(CUTS[i + 1][0]) if i + 1 < len(CUTS) else DUR) for i, (w, k) in enumerate(CUTS)]
bed = music.copy()
t = np.arange(n) / SR
for k, a, b in ZONES:
    g = np.clip((t - a + 0.3) / 0.6, 0, 1) * np.clip((b - t + 0.3) / 0.6, 0, 1)
    bed += amb[k] * g[:, None]
# filet de sécurité : le fond complet (musique + ambiance) ne descend jamais à plus de 8 dB sous son niveau médian
bm = bed.mean(1).astype(np.float64)
kw = int(0.25 * SR)
benv = np.sqrt(np.convolve(bm ** 2, np.ones(kw) / kw, mode='same')) + 1e-6
bref = np.median(benv) * 10 ** (-8 / 20)
bg = np.convolve(np.clip(bref / benv, 1.0, 30.0), np.ones(int(0.15 * SR)) / int(0.15 * SR), mode='same')
bed *= bg[:, None].astype(np.float32)
bed_path = os.path.join(HERE, 'bed.wav')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'pcm_s16le', bed_path],
               input=(bed / max(1.0, np.abs(bed).max() / 0.95)).astype(np.float32).tobytes(), check=True)

E = [  # [fichier, début (s), volume, durée max]
    [A('piece.mp3'), at(6), 0.7, None],                 # accroche : la pièce contre la queue
    [A('couic.mp3'), at(8) + 0.1, 0.5, None],
    [A('rats-egout.mp3'), at(12), 0.5, 2.0],            # la ferme à rats
    [S1('whoosh.mp3'), at(21) - 0.25, 0.5, 0.8],        # flash blanc
    [S1('flash.mp3'), at(21) - 0.05, 0.45, 1.0],
    [S1('whoosh.mp3'), at(31) - 0.3, 0.45, 0.8],        # la salle de bains
    [A('chasse-eau.mp3'), at(31) - 0.1, 0.8, None],     # la chasse d'eau
    [A('rats-egout.mp3'), at(39), 0.7, None],           # la ville des rats
    [S1('ping-carte.mp3'), at(51), 0.5, 1.2],           # la peste sur la carte
    [A('rats-egout.mp3'), at(62), 0.6, 3.0],            # la chasse dans les égouts
    [A('couic.mp3'), at(70), 0.5, None],
    [S1('compteur.mp3'), at(77), 0.5, 1.4],             # 20 112
    [A('rats-egout.mp3'), at(86), 0.6, None],           # ils font des petits
    [A('piece.mp3'), at(100), 0.8, None],               # un centime
    [A('pile.mp3'), at(105), 0.8, None],                # la pile de rats
    [A('couic.mp3'), at(115), 0.55, None],              # la queue
    [A('herbe.mp3'), at(127), 0.8, None],               # la mauvaise herbe
    [A('piece.mp3'), at(129), 0.5, None],
    [S1('whoosh.mp3'), at(138) - 0.3, 0.45, 0.8],       # retour dans la rue
    [A('couic.mp3'), at(145), 0.6, None],               # des rats sans queue
    [A('couic.mp3'), at(148), 0.5, None],
    [A('ciseaux.mp3'), at(152), 0.9, None],             # couper la queue
    [A('couic.mp3'), at(156), 0.55, None],
    [A('rats-egout.mp3'), at(166), 0.5, 2.0],           # la ferme découverte
    [S1('tampon.mp3'), at(179), 0.7, 1.0],              # annulée
    [A('rats-egout.mp3'), at(183), 0.7, None],          # plus de rats qu'avant
    [A('cobra.mp3'), at(197) - 0.3, 0.8, None],         # l'effet cobra
    [S1('ding.mp3'), at(209), 0.4, 1.0],                # l'effet rat
    [A('couic.mp3'), at(210), 0.6, None],
]
plan = {'voice': os.path.join(HERE, '..', 'voice', 'voice.wav'), 'voice_start': 0.0, 'duration': DUR, 'bed': bed_path,
        'sfx_gain': 1.4, 'events': E}
plan_path = os.path.join(HERE, 'plan.json')
json.dump(plan, open(plan_path, 'w'), indent=1)
subprocess.run(['python3', '-I', os.path.join(ROOT, 'videos', '_engine', 'style-anime', 'mix_anime.py'), plan_path, os.path.join(HERE, 'mix.wav')], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(HERE, 'mix.wav'), '-c:a', 'flac', os.path.join(HERE, 'mix.flac')], check=True)
print('durée', DUR, 's')
