# Son de « La tour qui faisait fondre les voitures » : fond (musique continue + ambiance du lieu), bruitages calés
# sur les mots (voice/words.json), puis mixage par ../../_engine/style-anime/mix_anime.py (voix devant, aucun trou).
# usage (depuis la racine du dépôt) : python3 -I videos/talkie-walkie/audio/build_mix.py
import json
import os
import subprocess

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
SR = 48000
FPS = 60
W = [w['start'] for w in json.load(open(os.path.join(HERE, '..', 'voice', 'words.json')))]
VOICE_END = 64.888
DUR = round((VOICE_END + 1.6) * FPS) / FPS  # = TOTAL / 60 (story.ts)
at = lambda k: W[k] - 2 / FPS
A = lambda n: os.path.join(HERE, 'sfx', n)
S1 = lambda n: os.path.join(ROOT, 'videos', '_engine', 'style-anime', 'sfx', n)
S3 = lambda n: os.path.join(ROOT, 'videos', '_engine', 'style-3d', 'sfx', n)


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
       {'rue': A('rue-londres.mp3'), 'pluie': S1('pluie.mp3'), 'parc': A('parc.mp3'), 'piscine': A('piscine.mp3')}.items()}
for k in amb:  # chaque ambiance 6 dB sous la musique
    amb[k] *= rms(music) / rms(amb[k]) * 10 ** (-6 / 20)
# quelle ambiance quand (s) : rue, pluie (plan 16), parc (18-19), rue (20-24), Las Vegas (25-26)
ZONES = [('rue', 0, at(111)), ('pluie', at(111), at(121)), ('rue', at(121), at(128)), ('parc', at(128), at(152)),
         ('rue', at(152), at(190)), ('piscine', at(190), DUR)]
bed = music.copy()
t = np.arange(n) / SR
for k, a, b in ZONES:
    g = np.clip((t - a + 0.3) / 0.6, 0, 1) * np.clip((b - t + 0.3) / 0.6, 0, 1)
    bed += amb[k] * g[:, None]
bed_path = os.path.join(HERE, 'bed.wav')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'pcm_s16le', bed_path],
               input=(bed / max(1.0, np.abs(bed).max() / 0.95)).astype(np.float32).tobytes(), check=True)

E = [  # [fichier, début (s), volume, durée max]
    [A('metal-fond.mp3'), 0.05, 0.8, None],            # accroche : la voiture fond
    [S1('whoosh.mp3'), at(12) - 0.25, 0.5, 0.8],        # flash blanc
    [S1('flash.mp3'), at(12) - 0.05, 0.5, 1.0],
    [S3('onde-radio.mp3'), at(48) - 0.1, 0.45, 1.2],    # « le Talkie-Walkie »
    [S3('vent.mp3'), 7.4, 0.7, 1.6],                   # coup de vent en levant les yeux (comble le « stop » de la musique)
    [A('bus.mp3'), 14.45, 0.6, None],                    # le bus arrive puis passe
    [A('loupe.mp3'), at(60) - 0.2, 0.7, None],          # la tache de lumière apparaît
    [S3('bulles.mp3'), at(70), 0.6, 1.4],               # la selle cloque
    [S1('feu.mp3'), at(75), 0.45, 1.3],                 # le paillasson fume
    [A('metal-fond.mp3'), at(84), 0.7, 2.0],            # le rétroviseur fond
    [S1('goutte.mp3'), at(88) + 0.2, 0.6, 0.8],         # le logo coule
    [A('metal-fond.mp3'), at(92), 0.8, 2.2],            # la carrosserie gondole
    [S3('coque-craque.mp3'), at(93), 0.5, 1.2],
    [A('photos.mp3'), at(96) + 0.1, 0.8, None],         # les journalistes
    [A('oeuf.mp3'), at(108), 0.9, None],                # l'œuf cuit
    [S1('whoosh.mp3'), at(111) - 0.2, 0.4, 0.8],        # gris
    [S1('scintille.mp3'), at(121), 0.5, 1.5],           # le soleil revient
    [S1('whoosh.mp3'), at(128) - 0.2, 0.45, 0.8],       # le parc
    [A('loupe.mp3'), at(146) - 0.3, 0.8, None],         # la loupe serre la lumière
    [S1('feu.mp3'), at(151), 0.5, 1.2],
    [S1('riser.mp3'), at(152) + 0.2, 0.45, 2.2],        # la tour en miroir, les rayons
    [S1('scintille.mp3'), at(158), 0.5, 1.5],
    [S1('pieces.mp3'), at(173), 0.6, 1.2],              # « ont payé »
    [A('pare-soleil.mp3'), at(181), 0.8, None],         # les pare-soleil
    [S3('onde-radio.mp3'), at(186) - 0.1, 0.45, 1.0],   # « Et le plus fort ? »
    [S1('whoosh.mp3'), at(190) - 0.25, 0.5, 0.8],       # Las Vegas
    [A('cheveux.mp3'), at(207) - 0.05, 0.9, None],      # les cheveux roussissent
]
plan = {'voice': os.path.join(HERE, '..', 'voice', 'voice.wav'), 'voice_start': 0.0, 'duration': DUR, 'bed': bed_path,
        'sfx_gain': 1.4, 'events': E}
plan_path = os.path.join(HERE, 'plan.json')
json.dump(plan, open(plan_path, 'w'), indent=1)
subprocess.run(['python3', '-I', os.path.join(ROOT, 'videos', '_engine', 'style-anime', 'mix_anime.py'), plan_path, os.path.join(HERE, 'mix.wav')], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(HERE, 'mix.wav'), '-c:a', 'flac', os.path.join(HERE, 'mix.flac')], check=True)
print('durée', DUR, 's')
