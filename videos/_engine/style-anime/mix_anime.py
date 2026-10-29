# Mix audio du style ANIMÉ : la voix reste devant, la musique et les bruitages passent dessous.
#
# usage : python3 -I mix_anime.py plan.json sortie.wav
# plan.json : {"voice": "vo.wav", "voice_start": 0.2, "duration": 66.0,
#              "bed": "bed.wav", "sfx_gain": 1.6, "events": [["sfx/pop.mp3", 1.25, 0.2, null], ...]}
#   sfx_gain : gain global des bruitages (entre les phrases ; pendant la parole ils restent plafonnés)
#   events : [fichier, début (s), volume (0-1), durée max (s) ou null]
#
# Règles (mesurées sur la vidéo de référence, voir README.md) :
#   - dans la référence, pendant que la voix parle, le fond est environ 17 dB sous elle (26 dB au-dessus de 150 Hz),
#     et l'ensemble musique + bruitages est environ 9 LU sous la voix : les gros sons tombent entre les phrases ;
#   - musique en continu, 18 dB sous la voix, baissée encore de 8 dB pendant qu'elle parle ;
#   - pendant la parole, chaque bruitage est plafonné à 20 dB sous la voix au-dessus de 150 Hz
#     et à 12 dB sous elle en pleine bande (booms) ; 30 ms d'anticipation ;
#   - entre les phrases, les bruitages retrouvent leur pleine force.
import json
import subprocess
import sys

import numpy as np
from scipy.ndimage import minimum_filter1d
from scipy.signal import butter, lfilter

SR = 48000
BED_BELOW_VOICE_DB = 18
BED_DUCK_DB = 8
SFX_BELOW_VOICE_SPEECH_DB = 20  # above 150 Hz, where the voice is understood
SFX_BELOW_VOICE_FULL_DB = 12  # full band (keeps the booms under the voice)


def load(path, start=0.0, dur=None):
    cmd = ['ffmpeg', '-v', 'error', '-i', path]
    if dur:
        cmd += ['-t', str(dur)]
    cmd += ['-ac', '2', '-ar', str(SR), '-f', 'f32le', '-']
    return np.frombuffer(subprocess.check_output(cmd), np.float32).reshape(-1, 2).copy()


def place(buf, x, t0, gain=1.0):
    i = int(round(t0 * SR))
    if i >= len(buf):
        return
    n = min(len(x), len(buf) - i)
    buf[i:i + n] += x[:n] * gain


def rms(mono, win):
    k = max(1, int(win * SR))
    c = np.concatenate([[0.0], np.cumsum(mono.astype(np.float64) ** 2)])
    p = (c[k:] - c[:-k]) / k
    p = np.concatenate([np.full(k // 2, p[0]), p, np.full(len(mono) - len(p) - k // 2, p[-1])])
    return np.sqrt(np.maximum(p, 0))


def smooth(x, attack, release, block=64):
    # one-pole attack/release follower, computed on blocks of 64 samples (time constants are per block)
    a, b = np.exp(-block / (attack * SR)), np.exp(-block / (release * SR))
    out = np.empty_like(x)
    y = float(x[0])
    for j in range(0, len(x), block):
        v = float(x[j:j + block].max())
        y = a * y + (1 - a) * v if v > y else b * y + (1 - b) * v
        out[j:j + block] = y
    return out


def highpass(mono, fc=150.0):
    b, a = butter(2, fc / (SR / 2), 'high')
    return lfilter(b, a, mono)


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)


def main():
    plan = json.load(open(sys.argv[1]))
    out_path = sys.argv[2]
    n = int(plan['duration'] * SR)
    voice = np.zeros((n, 2), np.float32)
    place(voice, load(plan['voice']), plan.get('voice_start', 0.2))
    vmono = voice.mean(1)
    speaking = np.abs(vmono) > 1e-4
    v_level = rms_db(vmono[speaking]) if speaking.any() else -30

    bed = np.zeros((n, 2), np.float32)
    if plan.get('bed'):
        place(bed, load(plan['bed'], dur=plan['duration']), 0.0)
        bed *= 10 ** ((v_level - plan.get('bed_below_voice_db', BED_BELOW_VOICE_DB) - rms_db(bed.mean(1))) / 20)

    sfx = np.zeros((n, 2), np.float32)
    for f, t0, vol, cap in plan['events']:
        x = load(f)
        if cap:
            x = x[:int(cap * SR)]
        fade = min(len(x), int(0.02 * SR))
        x[-fade:] *= np.linspace(1, 0, fade)[:, None]
        place(sfx, x, t0, vol * plan.get('sfx_gain', 1.0))

    venv = smooth(rms(vmono, 0.03), 0.01, 0.2)
    talk = np.clip(venv / (np.percentile(venv[speaking], 50) + 1e-9), 0, 1) if speaking.any() else np.zeros(n)
    bed_gain = 10 ** (-BED_DUCK_DB * talk / 20)

    # cap each effect relative to the voice while it speaks (detector ignores the sub-bass),
    # with 30 ms of look-ahead so a transient is already turned down when it starts
    smono = sfx.mean(1).astype(np.float64)
    vh = rms(highpass(vmono.astype(np.float64)), 0.03)
    need_h = smooth(vh, 0.01, 0.2) * 10 ** (-SFX_BELOW_VOICE_SPEECH_DB / 20) / (rms(highpass(smono), 0.03) + 1e-9)
    need_f = venv * 10 ** (-SFX_BELOW_VOICE_FULL_DB / 20) / (rms(smono, 0.03) + 1e-9)
    g = np.where(talk > 0.15, np.minimum(1.0, np.minimum(need_h, need_f)), 1.0)
    g = minimum_filter1d(g, size=int(0.06 * SR))
    sm = -smooth(-g, 0.002, 0.12)  # falls at once, comes back over 120 ms

    mix = voice + bed * bed_gain[:, None] + sfx * sm[:, None]
    peak = np.abs(mix).max()
    if peak > 0.98:
        mix *= 0.98 / peak
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'pcm_s16le', out_path],
                   input=mix.astype(np.float32).tobytes(), check=True)

    # report: how far the background sits under the voice while it speaks
    back = (bed * bed_gain[:, None] + sfx * sm[:, None]).mean(1)
    w = int(0.4 * SR)
    worst = []
    for j in range(0, n - w, w):
        if speaking[j:j + w].mean() > 0.5:
            worst.append(rms_db(vmono[j:j + w]) - rms_db(back[j:j + w]))
    worst = np.array(worst)
    print(f'voix − fond pendant la parole : médiane {np.median(worst):.1f} dB, pire {worst.min():.1f} dB, '
          f'fenêtres < 6 dB : {(worst < 6).mean() * 100:.0f} %')


if __name__ == '__main__':
    main()
