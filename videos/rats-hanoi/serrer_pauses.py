# Raccourcit les pauses de la voix (sans toucher au débit) : une pause d de plus de 0,4 s devient 0,4 + 0,5 (d - 0,4).
# (version des rats d'Hanoï : plus douce que celle de la Grande Puanteur, la prise était déjà courte et il y a des sous-titres à lire)
# usage : python3 -I serrer_pauses.py entree.mp3 sortie.wav   (48 kHz mono, 0,3 s de silence au début)
import re, subprocess, sys
import numpy as np
SR = 48000
src, dst = sys.argv[1], sys.argv[2]
x = np.frombuffer(subprocess.check_output(['ffmpeg', '-v', 'error', '-i', src, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-']), np.float32).copy()
log = subprocess.run(['ffmpeg', '-i', src, '-af', 'silencedetect=noise=-40dB:d=0.25', '-f', 'null', '-'], capture_output=True, text=True).stderr
st = [float(v) for v in re.findall(r'silence_start: ([\d.]+)', log)]
en = [float(v) for v in re.findall(r'silence_end: ([\d.]+)', log)]
out, pos = [np.zeros(int(0.3 * SR), np.float32)], 0
for a, b in zip(st, en):
    d = b - a
    keep = 0.4 + 0.5 * (d - 0.4) if d > 0.4 else d
    if b >= len(x) / SR - 0.01:
        keep = 0.15  # fin
    ia, ib = int(a * SR), int(b * SR)
    h = int(keep * SR / 2)
    out.append(x[pos:ia + h])
    pos = ib - h
out.append(x[pos:])
y = np.concatenate(out)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-c:a', 'pcm_s16le', dst], input=y.tobytes(), check=True)
print(f'{len(x) / SR:.2f} s -> {len(y) / SR:.2f} s')
