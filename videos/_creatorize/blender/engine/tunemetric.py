# tunemetric.py - the render tuner's quality gate (2026-10-30): is a tuned frame visibly different from the reference?
# Pure numpy, so both Blender (engine/tune.py, inside the probe) and the app's Python (tools/render_tune.py) use the
# same numbers. Luma SSIM with an 8x8 box window (Wang et al. 2004's fast form), the mean over the frame plus the
# WORST 32x32 block (a local drop: a shadow that moved, a texture that lost its detail), and PSNR.
# The bar (calibrated on Cu Chi e29, references/render.md): mean SSIM >= 0.985, worst block >= 0.80, PSNR >= 36 dB on
# the PNG's sRGB values. A setting that misses any of them is not used. Calibration: shadow maps at half resolution
# (mean 0.989, worst block 0.80-0.83: contact shadows a touch softer, seen only in a 3x crop; the coordinator and I both
# judged the full frames identical) passes; far plants without shadows (block 0.74: shadows missing under trees),
# quarter-resolution GI (mean 0.982) and 16 fog steps (mean 0.976) fail. gruss's words: "without big perceivable loss".
import numpy as np

BAR = dict(ssim=0.985, block=0.80, psnr=36.0)


def luma(rgb):
    """HxWx3 (or 4) array in 0..1 or 0..255 -> float64 luma 0..255 (Rec. 709)."""
    a = np.asarray(rgb, dtype=np.float64)
    if a.max() <= 1.0 + 1e-6: a = a * 255.0
    return a[..., 0] * 0.2126 + a[..., 1] * 0.7152 + a[..., 2] * 0.0722


def _box(a, k):
    """Mean over every k x k window (valid part), by summed-area table."""
    c = np.cumsum(np.cumsum(np.pad(a, ((1, 0), (1, 0))), 0), 1)
    return (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)


def ssim_map(x, y, k=8):
    C1, C2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    mx, my = _box(x, k), _box(y, k)
    sxx = _box(x * x, k) - mx * mx; syy = _box(y * y, k) - my * my; sxy = _box(x * y, k) - mx * my
    return ((2 * mx * my + C1) * (2 * sxy + C2)) / ((mx * mx + my * my + C1) * (sxx + syy + C2))


def compare(a, b, block=32):
    """Two frames (HxWxC arrays) -> {ssim, block, block_at, psnr}: mean SSIM, the worst block's mean SSIM and where it is
    (x, y of its top-left in pixels), PSNR in dB on luma."""
    x, y = luma(a), luma(b)
    m = ssim_map(x, y)
    h, w = (m.shape[0] // block) * block, (m.shape[1] // block) * block
    bl = m[:h, :w].reshape(h // block, block, w // block, block).mean(axis=(1, 3))
    i = int(np.argmin(bl)); by, bx = divmod(i, bl.shape[1])
    mse = float(np.mean((x - y) ** 2))
    return dict(ssim=round(float(m.mean()), 5), block=round(float(bl.min()), 4), block_at=[bx * block, by * block],
                psnr=round(99.0 if mse < 1e-10 else float(10 * np.log10(255.0 ** 2 / mse)), 2))


def passes(r, bar=BAR):
    return r['ssim'] >= bar['ssim'] and r['block'] >= bar['block'] and r['psnr'] >= bar['psnr']


def worst(results):
    """The worst of several compare() results (per value)."""
    if not results: return None
    w = min(results, key=lambda r: r['block'])
    return dict(ssim=min(r['ssim'] for r in results), block=w['block'], block_at=w['block_at'], psnr=min(r['psnr'] for r in results))
