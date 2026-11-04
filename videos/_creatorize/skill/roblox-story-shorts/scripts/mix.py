#!/usr/bin/env python3
"""Roblox story shorts mix + master: voice + the sound design's cues -> audio/final_mix.wav (48 kHz stereo 16-bit).

  python mix.py <project> [--lufs -14] [--tp -1] [--bed-gain 0] [--trim 0] [--no-bed] [--stems] [--sfx DIR]
                          [--music FILE [--music-gain -10]]      (unknown arguments are ignored, never an error)
  python mix.py <project> --master-only [--lufs -14] [--tp -1]     master an existing audio/final_mix.wav in place

Inputs: audio/clean.wav (the voice; tightened by tighten.py) and audio/sfx_cues.json (sound_design.py writes it; when it
is missing sound_design.py runs first). Levels as in the lab (tools/mix.py, 2026-10-30): booms +9 dB over the speech, NOT
ducked, and the voice dips 3 dB for 0.4 s under each boom so the joke punches through; every other sound -4 dB then ducked
up to 3 dB under the voice (~-7 dB). --bed-gain / --trim (dB) move every sound effect (the app's Effects level).
Master: the whole mix to --lufs integrated (default -14 LUFS), then a 4x-oversampled true-peak limiter with a 3 ms
look-ahead (ceiling --tp minus 0.2 dB, default -1 dBTP: measured <= -1.0). The mix lasts the voice, or up to 1.5 s after
the last cue when that is later (the closing boom rings out).
--master-only: for a mix the app's shared mix.py made (user music, audio layers): gain to --lufs, then the same limiter.
Writes audio/final_mix.wav + audio/mix_report.json {integrated_lufs, true_peak_dbfs, voice_to_bed_db_while_speaking,
limiter_db, cues, bed_gain_db}; --stems also audio/stems/voice.wav + sfx.wav + music.wav (silent) at the final gain
(before the limiter, so they add up to the mix within the limiter's ~1 dB on boom peaks).
Prints: mix: N cues, ... LUFS, true peak ... dBTP. Only python + numpy + scipy + ffmpeg on PATH."""
import json, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rbxaudio import SR, Catalog, load, save, opt, ebur128, lufs_of, follower, limit, render_cues


def master(x, A, lufs, tp):
    I = lufs_of(x, A)
    x = x * 10 ** ((lufs - I) / 20)
    x, gr = limit(x, tp - 0.2)
    # the limiter takes a little loudness off the booms: one more small make-up pass, limited again
    I2 = lufs_of(x, A)
    if abs(lufs - I2) > .15: x, gr2 = limit(x * 10 ** ((lufs - I2) / 20), tp - 0.2); gr = min(gr, gr2)
    return x, gr


def main():
    a = sys.argv[1:]
    proj = os.path.abspath(a[0] if a and not a[0].startswith('--') else '.'); A = os.path.join(proj, 'audio')
    lufs, tp = opt(a, 'lufs', -14.0, float), opt(a, 'tp', -1.0, float)
    out = os.path.join(A, 'final_mix.wav'); rep_f = os.path.join(A, 'mix_report.json')
    if '--master-only' in a:
        x = load(out); x, gr = master(x, A, lufs, tp); save(out, x)
        I, TP = ebur128(out)
        try: rep = json.load(open(rep_f, encoding='utf-8'))
        except Exception: rep = {}
        rep.update({'integrated_lufs': I, 'true_peak_dbfs': TP, 'mastered': True, 'limiter_db': round(gr, 2)})
        json.dump(rep, open(rep_f, 'w', encoding='utf-8'), indent=1)
        print(f'master: {I:.1f} LUFS, true peak {TP:.1f} dBTP, limiter {gr:.1f} dB'); return
    cf = os.path.join(A, 'sfx_cues.json')
    if not os.path.exists(cf) and '--no-bed' not in a:
        import sound_design; sound_design.design(proj, a)
    voice = load(os.path.join(A, 'clean.wav')); vlen = len(voice)
    bed_gain = opt(a, 'bed-gain', 0.0, float) + opt(a, 'trim', 0.0, float)
    try: cj = json.load(open(cf, encoding='utf-8'))
    except Exception: cj = {'cues': []}
    cues = [] if '--no-bed' in a or bed_gain <= -60 else [dict(c, gain=float(c.get('gain', 0) or 0) + bed_gain) for c in cj.get('cues', [])]
    sfxdir = opt(a, 'sfx') or cj.get('sfx_dir')
    from rbxaudio import find_sfx
    if not sfxdir or not os.path.exists(os.path.join(sfxdir, 'catalog.json')): sfxdir = find_sfx(proj, a)
    from rbxaudio import speech_level
    speech = speech_level(voice)
    last = max([c['t'] for c in cues] + [0])
    n = max(vlen, int((last + 1.5) * SR)) if cues else vlen
    voice = np.vstack([voice, np.zeros((n - vlen, 2))])
    missing = []
    if cues and sfxdir:
        cat = Catalog(sfxdir); missing = sorted({c['name'] for c in cues if not cat.get(c['name'])})
        boom, lay, mask, placed = render_cues(cat, cues, speech, n, voice)
    else:
        if cues: print('mix: the Roblox SFX library was not found (--sfx DIR): the voice alone')
        boom, lay, mask, placed = np.zeros((n, 2)), np.zeros((n, 2)), np.zeros(n), []
    vdip = 10 ** (-3 * follower(mask, .005, .15) / 20)
    v = voice * vdip[:, None]; fx = boom + lay
    # the user's own music (Project settings > Music): looped / cut to the mix, faded, 18 LU under the voice at the default
    # --music-gain -10 (each dB more = 1 dB louder), ducked 6 dB more while the voice talks
    mus = np.zeros((n, 2)); mf = opt(a, 'music')
    if mf and os.path.exists(mf):
        m = load(mf)
        if len(m):
            m = np.tile(m, (n // len(m) + 1, 1))[:n]
            vI = lufs_of(voice[:vlen], A); mI = lufs_of(m[:min(n, 60 * SR)], A)
            m *= 10 ** ((vI - 18 + opt(a, 'music-gain', -10.0, float) + 10 - mI) / 20)
            fi, fo = int(1.2 * SR), int(min(2.5, n / SR / 4) * SR)
            m[:fi] *= np.linspace(0, 1, fi)[:, None]; m[-fo:] *= np.linspace(1, 0, fo)[:, None]
            env = 20 * np.log10(follower(np.abs(voice).max(1), .08, .9) + 1e-9)
            m *= (10 ** (-6 * np.clip((env - (speech - 24)) / 20, 0, 1) / 20))[:, None]
            mus = m; print(f'your music: {os.path.basename(mf)}, 18 LU under the voice ({opt(a, "music-gain", -10.0, float)} dB setting), ducked under it')
    mix = v + fx + mus
    I0 = lufs_of(mix, A); g = 10 ** ((lufs - I0) / 20)
    final, gr = master(mix, A, lufs, tp)
    save(out, final)
    I, TP = ebur128(out)
    # voice vs effects while the voice talks (the app's check; booms land in the gaps, so this stays high)
    talk = np.abs(voice).max(1) > 10 ** ((speech - 20) / 20)
    rms = lambda z: 20 * np.log10(np.sqrt(np.mean(z ** 2)) + 1e-12)
    ratio = round(float(rms(v[talk]) - rms(fx[talk])), 1) if fx.any() and talk.any() else None
    if '--stems' in a:
        S = os.path.join(A, 'stems'); os.makedirs(S, exist_ok=True)
        save(os.path.join(S, 'voice.wav'), v * g); save(os.path.join(S, 'sfx.wav'), fx * g); save(os.path.join(S, 'music.wav'), mus * g)
    rep = {'integrated_lufs': I, 'true_peak_dbfs': TP, 'lufs': I, 'true_peak': TP, 'voice_to_bed_db_while_speaking': ratio,
           'limiter_db': round(gr, 2), 'cues': len(placed), 'missing': missing, 'bed_gain_db': bed_gain, 'speech_db': round(speech, 2),
           'duration': round(n / SR, 3), 'style': 'roblox', 'auto': bool(cj.get('auto')) and bool(cues), **({'music': os.path.basename(mf)} if mus.any() else {})}
    json.dump(rep, open(rep_f, 'w', encoding='utf-8'), indent=1)
    print(f'mix: {len(placed)} cues, {I:.1f} LUFS, true peak {TP:.1f} dBTP, limiter {gr:.1f} dB, voice over effects while talking {ratio} dB')
    print(out)


if __name__ == '__main__':
    main()
