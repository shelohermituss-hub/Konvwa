# usage: python3 -I finish.py raw120.mp4 out.mp4
# 120 fps render -> 60 fps with 2-subframe motion blur, loudness -14 LUFS, then a scan for single-frame pops.
import json, subprocess, sys, numpy as np

src, out = sys.argv[1], sys.argv[2]
# two-pass loudnorm: measure first, then apply linearly so the result lands on -14 LUFS
m = subprocess.run(['ffmpeg', '-hide_banner', '-i', src, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
j = json.loads(m[m.rindex('{'):m.rindex('}') + 1])
ln = ('loudnorm=I=-14:TP=-1.5:LRA=11:linear=true:measured_I={input_i}:measured_TP={input_tp}:'
      'measured_LRA={input_lra}:measured_thresh={input_thresh}:offset={target_offset}').format(**j)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src,
                '-vf', 'tmix=frames=2,fps=60', '-af', ln,
                '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p',
                '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', out], check=True)

# single-frame pop: a frame far from both neighbours while the neighbours are close to each other
W, H = 135, 240
raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', out, '-vf', f'scale={W}:{H},format=gray', '-f', 'rawvideo', '-'])
f = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)
d = lambda a, b: float(np.mean(np.abs(f[a] - f[b])))
pops = []
for i in range(1, len(f) - 1):
    a, b, c = d(i - 1, i), d(i, i + 1), d(i - 1, i + 1)
    if min(a, b) > 6 and min(a, b) > 3 * max(c, 1):
        pops.append((round(i / 60, 3), round(min(a, b), 1)))
print('frames', len(f), 'pops', pops if pops else 'none')
