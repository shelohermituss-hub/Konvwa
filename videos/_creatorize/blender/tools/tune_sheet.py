# tune_sheet.py - look at what the render tuner changed: reference | tuned | difference x8, per probe frame, plus a 3x
# crop of the worst 32 px block (red box). Reads <film>/.suite/tune/<shot>/ (ref/ and one folder per candidate).
#   python tools/tune_sheet.py <film>/.suite/tune/<shot> <candidate> [<out.jpg>]
import os, sys
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'engine'))
import tunemetric as TM  # noqa: E402

d, cand = sys.argv[1], sys.argv[2]
out = sys.argv[3] if len(sys.argv) > 3 else os.path.join(d, f'sheet_{cand}.jpg')
rows = []
for f in sorted(os.listdir(os.path.join(d, 'ref'))):
    p = os.path.join(d, cand, f)
    if not f.endswith('.png') or not os.path.exists(p): continue
    a = np.asarray(Image.open(os.path.join(d, 'ref', f)).convert('RGB')); b = np.asarray(Image.open(p).convert('RGB'))
    q = TM.compare(a, b)
    diff = np.clip(np.abs(a.astype(np.int16) - b.astype(np.int16)) * 8, 0, 255).astype(np.uint8)
    x, y = q['block_at']; x0, y0 = max(0, x - 80), max(0, y - 80)
    ca = Image.fromarray(a[y0:y0 + 192, x0:x0 + 192]).resize((576, 576), Image.NEAREST)
    cb = Image.fromarray(b[y0:y0 + 192, x0:x0 + 192]).resize((576, 576), Image.NEAREST)
    H = 960; s = H / a.shape[0]; W = int(a.shape[1] * s)
    ims = [Image.fromarray(a).resize((W, H)), Image.fromarray(b).resize((W, H)), Image.fromarray(diff).resize((W, H))]
    row = Image.new('RGB', (3 * W + 2 * 576 + 50, H + 40), (24, 24, 24)); dr = ImageDraw.Draw(row)
    for i, im in enumerate(ims):
        row.paste(im, (i * (W + 10), 40))
        dr.rectangle([i * (W + 10) + x * s, 40 + y * s, i * (W + 10) + (x + 32) * s, 40 + (y + 32) * s], outline=(255, 40, 40), width=2)
    row.paste(ca, (3 * (W + 10), 40)); row.paste(cb, (3 * (W + 10) + 586, 40))
    dr.text((8, 8), f'{f}  reference | {cand} | diff x8 | worst block crop 3x: reference, {cand}   ssim {q["ssim"]} block {q["block"]} psnr {q["psnr"]}', fill=(255, 255, 255))
    rows.append(row)
if rows:
    sheet = Image.new('RGB', (rows[0].width, sum(r.height for r in rows)), (0, 0, 0)); yy = 0
    for r in rows: sheet.paste(r, (0, yy)); yy += r.height
    sheet.save(out, quality=88); print(out)
