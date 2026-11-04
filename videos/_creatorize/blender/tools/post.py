# Finish a film: frames -> bloom on bright practicals, light vignette, film grain, word-by-word captions, the voiceover.
#   .venv/Scripts/python.exe tools/post.py <film_dir> --vo vo/japan.mp3 --words vo/japan.json [--frames <dir>] [--out name.mp4]
#     [--no-captions] [--t0 0 --t1 60.5]
# film_dir/frames/####.png (global frame numbers from 1) -> film_dir/<out>. Captions: white heavy sans with a dark outline,
# centred ~70 % down, one word at a time (short words ride with the next one), like the reference.
import argparse, json, os, shutil, subprocess, sys

ap = argparse.ArgumentParser()
ap.add_argument('film'); ap.add_argument('--vo'); ap.add_argument('--words'); ap.add_argument('--frames')
ap.add_argument('--out', default='film.mp4'); ap.add_argument('--no-captions', action='store_true')
ap.add_argument('--t0', type=float, default=0.0); ap.add_argument('--t1', type=float, default=0.0)
ap.add_argument('--bloom', type=float, default=0.5); ap.add_argument('--grain', type=float, default=5)
ap.add_argument('--sat', type=float, default=1.2); ap.add_argument('--sharpen', type=float, default=0.9)
# per-film value: --gain multiplies (brightens AND keeps contrast: a midtone lift alone flattens it), --lift = the
# midtone curve's output at 0.5 (Jar's saturated red hall + violet nights measured lum 99 / sat 157 vs 131 / 113)
ap.add_argument('--gain', type=float, default=1.0); ap.add_argument('--lift', type=float, default=0.575)
# --curve: the whole tone curve instead of the midtone lift, e.g. "0/0 0.25/0.33 0.5/0.6 0.8/0.86 1/1": lifts darks and
# mids and rolls off before white (a gain washed Jar's bronze out to cream while the metrics passed)
ap.add_argument('--curve', default='')
ap.add_argument('--capstyle', default='toon')   # 'mega': the Everest look's small bold phrases with a soft shadow
# --size WxH: the video's size when the frames were rendered smaller (Creatorize's Render settings > resolution scale):
# they are scaled up first, so the light, grain and captions are made at the video's own size
ap.add_argument('--size', default='')
a = ap.parse_args()
film = os.path.abspath(a.film)
frames = os.path.abspath(a.frames or os.path.join(film, 'frames'))
LAB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def ts(t):
    t = max(0.0, t); h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f'{h}:{m:02d}:{s:05.2f}'


def frame_size(png):
    """(width, height) from a PNG's header."""
    import struct
    with open(png, 'rb') as f: b = f.read(24)
    return struct.unpack('>II', b[16:24])


# the kit's fonts for the letters Arial Black lacks (assets/fonts: Inter Black + Noto Sans 800, SIL OFL 1.1, each with the
# Latin, Latin Extended, Vietnamese and Cyrillic letters too; engine/cz.py script_font picks the same for 3D text)
FAMILY = {'latin': 'CZ Latin', 'thai': 'CZ Thai', 'deva': 'CZ Devanagari', 'jp': 'CZ Japanese', 'kr': 'CZ Korean', 'sc': 'CZ Chinese'}
USED = set()


def _project_lang():
    try: return str(json.load(open(os.path.join(film, 'project.json'), encoding='utf-8-sig')).get('language') or '')[:2]
    except Exception: return ''


def script_font(s):
    has = lambda lo, hi: any(lo <= ord(c) <= hi for c in s)
    if has(0x0E00, 0x0E7F): return 'thai'
    if has(0x0900, 0x097F): return 'deva'
    if has(0x3040, 0x30FF): return 'jp'
    if has(0xAC00, 0xD7AF) or has(0x1100, 0x11FF) or has(0x3130, 0x318F): return 'kr'
    if has(0x3400, 0x9FFF): return 'jp' if _project_lang() == 'ja' else 'sc'
    if any(ord(c) > 0xFF and c.isalpha() for c in s): return 'latin'
    return None


def unspaced(ch):
    return bool(ch) and (0x0E00 <= ord(ch) <= 0x0E7F or 0x3000 <= ord(ch) <= 0x30FF or 0x3400 <= ord(ch) <= 0x9FFF or 0xFF00 <= ord(ch) <= 0xFFEF)


def captions(words, path, t0, size=(1080, 1920)):
    # the same 74 px words on the frame's short side either way; ~70 % down a vertical frame, ~82 % down a wide one
    W, H = size; px, py = W // 2, round(H * (0.703 if H > W else 0.82))
    groups, cur = [], []
    mega = a.capstyle == 'mega'
    k = min(W, H) / 1080   # caption size follows the frame (preview renders at 0.35 got 3x too big words)
    if mega: py = round(H * (0.78 if H > W else 0.86))
    for w in words:
        cur.append(w)
        txt = ''.join(ch for ch in w['word'] if ch.isalnum())
        if mega:   # the megaproject look: 2-3 word phrases, a break on punctuation or ~16 letters
            n = sum(len(x['word']) for x in cur)
            if len(cur) >= 3 or n >= 16 or w['word'][-1:] in ',.?!': groups.append(cur); cur = []
        elif len(txt) > 3 or w['word'][-1:] in ',.?!' : groups.append(cur); cur = []
    if cur: groups.append(cur)
    lines = ['[Script Info]', 'ScriptType: v4.00+', f'PlayResX: {W}', f'PlayResY: {H}', '',
             '[V4+ Styles]',
             'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
             (f'Style: Cap,Arial,{round(76 * k)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H78000000,-1,0,0,0,100,100,0,0,1,0,{max(1, round(4 * k))},5,40,40,40,1' if mega else
              f'Style: Cap,Arial Black,{round(74 * k)},&H00FFFFFF,&H00FFFFFF,&H00141A1E,&H64000000,0,0,0,0,100,100,0,0,1,{max(1, round(6 * k))},{max(1, round(2 * k))},5,40,40,40,1'), '',
             '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text']
    for i, g in enumerate(groups):
        s = g[0]['start'] - t0; e = (groups[i + 1][0]['start'] - t0) if i + 1 < len(groups) else g[-1]['end'] - t0 + 0.4
        e = min(e, g[-1]['end'] - t0 + 0.6)
        # (Thai, Japanese and Chinese words sit together without a space)
        text = ''.join((w['word'] if j == 0 or (unspaced(g[j - 1]['word'][-1:]) and unspaced(w['word'][:1])) else ' ' + w['word'])
                       for j, w in enumerate(g))
        # letters Arial Black / Arial can't write: the kit's own font for that script (heavy, no faux bold)
        fk = script_font(text); fn = (r'\fn%s\b0' % FAMILY[fk]) if fk else ''
        if fk: USED.add(fk)
        # a 3-frame pop: 80 % -> 104 % -> 100 %
        pop = r'{\pos(%d,%d)%s\fscx82\fscy82\t(0,60,\fscx104\fscy104)\t(60,110,\fscx100\fscy100)}' % (px, py, fn)
        lines.append(f'Dialogue: 0,{ts(s)},{ts(e)},Cap,,0,0,0,,{pop}{text}')
        GROUPS.append((max(0.0, s), e, text, fk))
    open(path, 'w', encoding='utf8').write('\n'.join(lines) + '\n')


GROUPS = []


def has_filter(name):
    try: out = subprocess.run(['ffmpeg', '-hide_banner', '-filters'], capture_output=True).stdout.decode('utf8', 'replace')
    except OSError: return False
    return any(l.split()[1:2] == [name] for l in out.splitlines() if l.strip())


def raster_captions(outdir, size, nframes):
    """The captions as a band of transparent PNGs (Pillow) + an ffconcat list timed in frames, for ffmpegs without libass.
    Same look as the .ass: white words, dark outline + soft shadow (toon), or bold with a shadow (mega); a 3-frame pop."""
    from PIL import Image, ImageDraw, ImageFont
    W, H = size; k = min(W, H) / 1080; mega = a.capstyle == 'mega'
    py = round(H * ((0.78 if H > W else 0.86) if mega else (0.703 if H > W else 0.82)))
    fsz = round((76 if mega else 74) * k); bh = fsz * 4; by = max(0, min(H - bh, py - bh // 2))
    sysf = [os.path.join(film, FONTS, 'arialbd.ttf' if mega else 'ariblk.ttf'), os.path.join(LAB, 'assets', 'fonts', 'cz-latin.ttf')]
    shutil.rmtree(outdir, ignore_errors=True); os.makedirs(outdir)

    def font(fk, px):
        for p in ([os.path.join(LAB, 'assets', 'fonts', f'cz-{fk}.ttf')] if fk else []) + sysf:
            if os.path.exists(p): return ImageFont.truetype(p, px)
        return ImageFont.load_default(px)

    def card(text, fk, scale, name):
        im = Image.new('RGBA', (W, bh), (0, 0, 0, 0))
        f = font(fk, max(8, round(fsz * scale)))
        while f.getlength(text) > W - 80 and f.size > 12: f = font(fk, f.size - 4)
        ow = 0 if mega else max(1, round(6 * k)); sh = max(1, round((4 if mega else 2) * k))
        sha = Image.new('RGBA', im.size, (0, 0, 0, 0))
        ImageDraw.Draw(sha).text((W / 2 + sh, bh / 2 + sh), text, font=f, anchor='mm', fill=(0, 0, 0, 135 if mega else 155),
                                 stroke_width=ow, stroke_fill=(0, 0, 0, 135 if mega else 155))
        im.alpha_composite(sha)
        ImageDraw.Draw(im).text((W / 2, bh / 2), text, font=f, anchor='mm', fill=(255, 255, 255, 255),
                                stroke_width=ow, stroke_fill=(0x1E, 0x1A, 0x14, 255))
        p = os.path.join(outdir, name); im.save(p, compress_level=1); return p

    blank = os.path.join(outdir, 'blank.png'); Image.new('RGBA', (W, bh), (0, 0, 0, 0)).save(blank)
    ent, f = [], 0                       # (file, frames)
    for i, (s, e, text, fk) in enumerate(GROUPS):
        fs_, fe = round(s * 30), min(nframes, round(e * 30))
        if fe <= max(fs_, f): continue
        if fs_ > f: ent.append((blank, fs_ - f)); f = fs_
        n = fe - f
        for j, sc in enumerate((0.86, 1.04)):
            if n > 2: ent.append((card(text, fk, sc, f'{i:05d}_{j}.png'), 1)); n -= 1; f += 1
        ent.append((card(text, fk, 1.0, f'{i:05d}.png'), n)); f += n
    if f < nframes: ent.append((blank, nframes - f))
    ent.append((blank, 1))               # (concat ignores the last entry's duration)
    lst = os.path.join(outdir, 'caps.ffconcat')
    with open(lst, 'w', encoding='utf8') as o:
        o.write('ffconcat version 1.0\n')
        for p, n in ent: o.write(f"file '{p.replace(chr(92), '/')}'\nduration {n / 30:.6f}\n")
    return lst, by


# the caption font for libass: a copy of the system's Arial Black (in a Creatorize project under .suite/, which its git
# and its shared zips leave out; the lab's films keep their fonts/ folder)
FONTS = '.suite/fonts' if os.path.isdir(os.path.join(film, '.suite')) else 'fonts'
os.makedirs(os.path.join(film, FONTS), exist_ok=True)
fnt = next((p for p in (os.path.join(os.environ.get('WINDIR', 'C:/Windows'), 'Fonts', 'ariblk.ttf'),
                        '/System/Library/Fonts/Supplemental/Arial Black.ttf', '/Library/Fonts/Arial Black.ttf') if os.path.exists(p)), None)
if fnt: shutil.copy(fnt, os.path.join(film, FONTS, 'ariblk.ttf'))
for bd in (os.path.join(os.environ.get('WINDIR', 'C:/Windows'), 'Fonts', 'arialbd.ttf'), '/System/Library/Fonts/Supplemental/Arial Bold.ttf'):
    if os.path.exists(bd): shutil.copy(bd, os.path.join(film, FONTS, 'arialbd.ttf')); break   # the 'mega' captions
gain = f"curves=all='0/0 {1 / a.gain:.4f}/1 1/1'," if a.gain > 1.0 else ''
vf = (f"format=gbrp,split=2[a][b];[b]curves=all='0/0 0.72/0 1/1',gblur=sigma=26[g];[a][g]blend=all_mode=screen:all_opacity={a.bloom}[c];"
      # midtone lift (cut 2 measured luminance 111 vs the reference's 131; the whites stay put)
      # + saturation 1.2 (the final measured 85 vs the reference's 113: the lift and the dressed sets muted it) and a
      # crisper sharpen (the reference's line work is crisp edge to edge)
      f"[c]{gain}curves=all='{a.curve or f'0/0 0.5/{a.lift} 1/1'}',eq=saturation={a.sat},unsharp=5:5:{a.sharpen}:5:5:0.0,vignette=angle=PI/5,"
      f"noise=alls={a.grain}:allf=t,format=yuv420p")
pngs = sorted(int(f[:4]) for f in os.listdir(frames) if f.endswith('.png') and f[:4].isdigit())
first, last = pngs[0], pngs[-1]
t0 = (first - 1) / 30; t1 = last / 30      # global frame numbers are film time: audio + captions follow them
SIZE = tuple(frame_size(os.path.join(frames, f'{first:04d}.png')))
if a.size:
    want = tuple(int(v) for v in a.size.lower().split('x'))
    if want != SIZE: vf = f'scale={want[0]}:{want[1]}:flags=lanczos,' + vf; SIZE = want
cap_in = None
if not a.no_captions and a.words:
    words = json.load(open(a.words, encoding='utf-8-sig'))['words']
    captions([w for w in words if t0 - 0.05 <= w['start'] < t1], os.path.join(film, 'captions.ass'), t0, SIZE)
    for k in USED:
        src = os.path.join(LAB, 'assets', 'fonts', f'cz-{k}.ttf')
        if os.path.exists(src): shutil.copy(src, os.path.join(film, FONTS, f'cz-{k}.ttf'))
    # the caption font (Arial Black): the copy above when there is one, else the system's (every Windows and macOS has
    # it; Creatorize never ships it)
    # Homebrew's ffmpeg (8+, every Mac member) has no libass, so no 'subtitles' filter: the graph failed to parse at the very
    # end of a 5-hour export. Without it the captions are drawn with Pillow and laid over the film (CZ_POST_RASTER=1 forces it)
    if has_filter('subtitles') and not os.environ.get('CZ_POST_RASTER'):
        vf += ',subtitles=captions.ass' + (f':fontsdir={FONTS}' if os.listdir(os.path.join(film, FONTS)) else '')
    else:
        try:
            cap_in = raster_captions(os.path.join(film, '.suite' if os.path.isdir(os.path.join(film, '.suite')) else '.', 'capframes'),
                                     SIZE, last - first + 1)
        except ImportError:
            cap_in = None; print('CAPTIONS SKIPPED: this ffmpeg has no subtitles filter and Pillow is missing')
cmd = ['ffmpeg', '-v', 'error', '-y', '-framerate', '30', '-start_number', str(first), '-i', os.path.join(frames, '%04d.png')]
if a.vo:
    cmd += ['-ss', f'{t0:.3f}', '-i', os.path.abspath(a.vo)]
if cap_in:
    cmd += ['-f', 'concat', '-safe', '0', '-i', cap_in[0]]
    vf = f'[0:v]{vf}[base];[{2 if a.vo else 1}:v]format=rgba[cap];[base][cap]overlay=0:{cap_in[1]}:eof_action=pass:format=auto,format=yuv420p[vout]'
    cmd += ['-filter_complex', vf, '-map', '[vout]']
    if a.vo: cmd += ['-map', '1:a']
else:
    cmd += ['-vf', vf]
# no B-frames and a key frame every 2 s (2026-10-31, Joel's Creatorize exports stuttered on camera moves in Premiere and
# after Discord / Drive uploads): x264's defaults store frames out of order (B-frames), and the app turns this file into a
# raw H.264 stream before adding the sound, where that order is lost: frames played out of order, 148 of 150 kept, an
# average of 29.9 fps. Measured on the demo's frames with grain: medium without B-frames = the same size as slow with
# them (46.5 MB / 5 s), the same SSIM (0.906 vs 0.903) and the encode about 40 % faster.
cmd += ['-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-bf', '0', '-g', '60']
if a.vo: cmd += ['-c:a', 'aac', '-b:a', '192k', '-shortest']
cmd += [a.out]
print(' '.join(cmd))
r = subprocess.run(cmd, cwd=film, stderr=subprocess.PIPE)
if r.returncode:
    err = [l for l in r.stderr.decode('utf8', 'replace').splitlines() if l.strip()][-6:]
    print(f'ffmpeg failed ({r.returncode}): ' + ' | '.join(err)); sys.exit(1)
print('POST', os.path.join(film, a.out))
