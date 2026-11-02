# Son de « La jarre de Zhang Heng » : fond (musique continue + ambiance du lieu), bruitages calés sur les mots
# (voice/words.json, mêmes temps que story.ts), puis mixage par ../../_engine/style-anime/mix_anime.py (voix devant, aucun trou).
# usage (depuis la racine du dépôt) : python3 -I videos/jarre-zhang-heng/audio/build_mix.py
import json
import os
import subprocess

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
SR = 48000
FPS = 60
WJ = json.load(open(os.path.join(HERE, '..', 'voice', 'words.json')))
W = [w['start'] for w in WJ]
VOICE_END = round(WJ[-1]['end'], 3)
DUR = round((VOICE_END + 0.9) * FPS) / FPS  # = TOTAL / 60 (story.ts)
at = lambda k: W[k] - 2 / FPS
A = lambda n: os.path.join(HERE, 'sfx', n)
S1 = lambda n: os.path.join(ROOT, 'videos', '_engine', 'style-anime', 'sfx', n)
S3 = lambda n: os.path.join(ROOT, 'videos', '_engine', 'style-3d', 'sfx', n)
TW = lambda n: os.path.join(ROOT, 'videos', 'talkie-walkie', 'audio', 'sfx', n)
GP = lambda n: os.path.join(ROOT, 'videos', 'grande-puanteur', 'audio', 'sfx', n)
# les temps forts (copie de story.ts)
WHIPS = [W[25] - 0.05, W[36] - 0.05, W[119] - 0.05, W[134] - 0.04, W[147] - 0.05, W[173] - 0.05, W[186] - 0.05, W[197] - 0.06, W[209] - 0.05]
T = dict(ring=at(17), bolt=at(34), dropS=W[102] + 0.02, arrow=at(108), question=at(114), brake=at(126), tilt=at(140), push=at(143) + 0.1,
         dropW=W[149] + 0.02, laugh=at(166))


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
# gain lent : remonte les creux de la musique (aucun trou)
mono = music.mean(1).astype(np.float64)
k = int(0.25 * SR)
env = np.sqrt(np.convolve(mono ** 2, np.ones(k) / k, mode='same')) + 1e-6
gain = np.clip(np.median(env) / env, 0.6, 8.0)
gain = np.convolve(gain, np.ones(int(0.15 * SR)) / int(0.15 * SR), mode='same')
music *= gain[:, None].astype(np.float32)
music[-int(1.2 * SR):] *= np.linspace(1, 0, int(1.2 * SR))[:, None] ** 1.5  # fin en fondu, sur la dernière image
amb = {k: loop_to(load(p), n) for k, p in
       {'salle': S3('ambiance-piece.mp3'), 'orage': S3('tempete.mp3'), 'cour': TW('parc.mp3'), 'bus': TW('bus.mp3'),
        'village': S1('vent-desert.mp3'), 'musee': S1('pas-musee.mp3')}.items()}
for k in amb:  # chaque ambiance 6 dB sous la musique (la salle, très calme : +6 dB ; l'orage et le bus : +2 dB)
    amb[k] *= rms(music) / rms(amb[k]) * 10 ** ((-6 + {'salle': 6, 'orage': 2, 'bus': 2}.get(k, 0)) / 20)
# quel lieu quand (les passages filés de story.ts)
LOCS = ['salle', 'orage', 'salle', 'bus', 'salle', 'salle', 'cour', 'village', 'musee', 'salle']
bounds = [0.0] + WHIPS + [DUR]
bed = music.copy()
t = np.arange(n) / SR
for i, kname in enumerate(LOCS):
    a, b = bounds[i], bounds[i + 1]
    g = np.clip((t - a + 0.15) / 0.3, 0, 1) * np.clip((b - t + 0.15) / 0.3, 0, 1)
    bed += amb[kname] * g[:, None]
# filet de sécurité : le fond complet ne descend jamais à plus de 5 dB sous son niveau médian
bm = bed.mean(1).astype(np.float64)
kw = int(0.25 * SR)
benv = np.sqrt(np.convolve(bm ** 2, np.ones(kw) / kw, mode='same')) + 1e-6
bref = np.median(benv) * 10 ** (-5 / 20)
bg = np.convolve(np.clip(bref / benv, 1.0, 30.0), np.ones(int(0.15 * SR)) / int(0.15 * SR), mode='same')
bed *= bg[:, None].astype(np.float32)
bed_path = os.path.join(HERE, 'bed.wav')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'pcm_s16le', bed_path],
               input=(bed / max(1.0, np.abs(bed).max() / 0.95)).astype(np.float32).tobytes(), check=True)

E = [  # [fichier, début (s), volume, durée max]
    [S1('scintille.mp3'), 0.05, 0.45, 1.2],             # accroche : la bille brille dans la gueule du dragon
    [S1('ding.mp3'), at(11), 0.4, 1.0],                  # « une JARRE »
    [S3('sonar.mp3'), T['ring'], 0.5, 2.0],              # les ondes autour de la jarre
    [A('seisme.mp3'), W[28], 0.7, None],                 # un séisme
    [S1('tonnerre.mp3'), T['bolt'] - 0.05, 0.9, None],   # le Ciel gronde
    [A('galop.mp3'), W[40], 0.3, 2.4],                   # à cheval, sur la carte
    [S1('ding.mp3'), at(56), 0.35, 1.0],                 # Zhang Heng
    [S1('scintille.mp3'), at(73), 0.4, 1.2],             # huit dragons
    [A('pop.mp3'), at(87), 0.5, None],                   # un crapaud
    [A('seisme.mp3'), W[92], 0.75, None],                # quand la terre tremble
    [A('clong.mp3'), T['dropS'] - 0.03, 1.0, None],      # Clong !
    [S1('whoosh.mp3'), T['arrow'] - 0.1, 0.4, 0.8],      # la flèche
    [A('pop.mp3'), T['question'], 0.7, None],            # « Comment ? »
    [S3('freinage.mp3'), T['brake'] - 0.05, 0.8, None],  # le bus freine
    [S3('engrenages.mp3'), T['tilt'], 0.4, 1.0],         # la colonne penche
    [A('clong.mp3'), T['push'] + 0.33, 0.7, None],       # elle pousse une bille
    [A('clong.mp3'), T['dropW'] - 0.03, 1.0, None],      # un jour : clong !
    [A('rires.mp3'), T['laugh'], 0.75, None],            # on se moque
    [A('galop.mp3'), W[173] - 0.1, 0.95, None],          # le messager au galop
    [A('seisme.mp3'), W[186], 0.85, None],               # Longxi
    [GP('briques.mp3'), W[188], 0.6, 1.6],               # les maisons s'effondrent
    [S1('ding.mp3'), at(200), 0.4, 1.0],                 # « Et le plus fort ? »
    [S1('scintille.mp3'), at(209), 0.4, 1.2],            # « que la sienne »
]
for w in WHIPS:  # un whoosh à chaque passage filé
    E.append([S1('whoosh.mp3'), w - 0.22, 0.5, 0.8])
plan = {'voice': os.path.join(HERE, '..', 'voice', 'voice.wav'), 'voice_start': 0.0, 'duration': DUR, 'bed': bed_path,
        'sfx_gain': 1.4, 'events': E}
plan_path = os.path.join(HERE, 'plan.json')
json.dump(plan, open(plan_path, 'w'), indent=1)
subprocess.run(['python3', '-I', os.path.join(ROOT, 'videos', '_engine', 'style-anime', 'mix_anime.py'), plan_path, os.path.join(HERE, 'mix.wav')], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(HERE, 'mix.wav'), '-c:a', 'flac', os.path.join(HERE, 'mix.flac')], check=True)
print('durée', DUR, 's')
