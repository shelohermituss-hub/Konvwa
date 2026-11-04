#!/usr/bin/env python3
"""Roblox story shorts sound design: the meme SFX pack on the story's moments, LEVEL-MATCHED to the voice.
No music (the refs have none; the user's own track still works: Project settings > Music, mixed by mix.py).

  python sound_design.py <project> [--sfx DIR] [--no-auto] [--cues-in-old-time] [--sfx-lib DIR ...]   (--sfx-lib: ignored)

Cues (all merged, the same t + name only once):
  audio/events.json "sfx"   the scene's sfx(t, name, {gain, align}) calls, collected by the app's event pass
  sfx.json / audio/sfx.json  [{t, name, gain?, align?, note?}] written by Claude (references/sfx.md)
  name = a catalog name ('vine_boom', 'pop/pop', 'woosh/deep', or the bare file name when unique: 'pop2', 'thud').
  No cues at all (and no --no-auto): a safe default set from the words + shots (rbxaudio.auto_cues): vine booms on the
  punchlines + the last line, pops on teleport/vanish words and shots, a short woosh on hard cuts.
  --cues-in-old-time: the cues were placed BEFORE tighten.py ran (scene time = the untightened voice): mapped through
  audio/timemap.json. By default cue times are the tightened voice's times (the scenes are built after tighten).
Levels (2026-10-30, measured on the refs with tools/loudstats.py): every sound's loudest 100 ms is set relative to the
voice's speech level (audio/clean.wav): booms (vine_boom, bass_drop) +9 dB OVER the speech and never ducked (the joke),
everything else -4 dB, then ducked up to 3 dB while the voice talks (~-7 dB under it). A cue's gain (dB) on top.
Outputs (what the app's Sound step expects):
  audio/sfx_bed.wav        stereo 48 kHz 16-bit, starts at 0, already levelled + ducked: mix it with NO more ducking
                           (the app's mix.py: --bed-duck 1; or this folder's mix.py, which also masters)
  audio/sound_sfx.wav      the same (the effects half), audio/sound_music.wav silence (the music half: none)
  audio/sfx_placed.txt     one line per sound placed; audio/sfx_used.json {mode, user_clips, user_placed, auto}
  audio/sfx_cues.json      the final cue list in voice time (what mix.py uses)
Only python + numpy + scipy + ffmpeg on PATH."""
import json, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rbxaudio import SR, Catalog, find_sfx, load, save, speech_level, scene_cues, auto_cues, timemap_o2n, render_cues, sfx_dirs


def design(proj, argv):
    A = os.path.join(proj, 'audio'); os.makedirs(A, exist_ok=True)
    d = find_sfx(proj, argv)
    if not d: sys.exit('sound design: the Roblox SFX library was not found (catalog.json). Looked in: ' + '; '.join(sfx_dirs(proj, argv)))
    cat = Catalog(d)
    clean = os.path.join(A, 'clean.wav')
    voice = load(clean) if os.path.exists(clean) else None
    # (no clean.wav: the speech level of a typical clean voiceover; the mix still levels the whole thing)
    speech = speech_level(voice) if voice is not None else -20.0
    vdur = len(voice) / SR if voice is not None else 0.0
    cues = scene_cues(proj); auto = False
    if '--cues-in-old-time' in argv:
        o2n = timemap_o2n(proj)
        if o2n: cues = [dict(c, t=round(o2n(c['t']), 3)) for c in cues]
    if not cues and '--no-auto' not in argv and voice is not None:
        cues = auto_cues(proj, vdur); auto = True
        print(f'no sound effects placed by the scenes or sfx.json: placed {len(cues)} by default (booms on punchlines, pops on teleports)')
    last = max([c['t'] for c in cues] + [0])
    n = int(max(vdur, last + 1.6) * SR) + SR // 2
    boom, lay, mask, placed = render_cues(cat, cues, speech, n, voice)
    bed = boom + lay
    pk = 20 * np.log10(np.abs(bed).max() + 1e-9)
    # 32-bit float: the exact level against clean.wav even when a boom peaks over 0 dBFS (the mix's limiter takes care of it)
    save(os.path.join(A, 'sfx_bed.wav'), bed, float32=True)
    save(os.path.join(A, 'sound_sfx.wav'), bed, float32=True)
    save(os.path.join(A, 'sound_music.wav'), np.zeros((n, 2)), float32=True)
    # what mix.py needs to rebuild the same buses (and dip the voice 3 dB under each boom)
    json.dump({'speech_db': round(speech, 2), 'auto': auto, 'sfx_dir': d,
               'cues': [{k: c[k] for k in ('t', 'name', 'gain', 'align', 'note') if k in c} for c in cues]},
              open(os.path.join(A, 'sfx_cues.json'), 'w', encoding='utf-8'), indent=1)
    open(os.path.join(A, 'sfx_placed.txt'), 'w', encoding='utf-8').write('\n'.join(placed) + ('\n' if placed else ''))
    json.dump({'mode': 'auto', 'user_clips': 0, 'user_placed': 0, 'auto': auto, 'placed': len(placed)},
              open(os.path.join(A, 'sfx_used.json'), 'w', encoding='utf-8'))
    nb = sum(1 for c in cues if (cat.get(c['name']) or {}).get('category') == 'boom')
    print(f'sfx: {len(placed)} sounds ({nb} booms) from {d}, speech level {speech:.1f} dBFS, bed peak {pk:.1f} dBFS')
    print('wrote audio/sfx_bed.wav')
    return cues


if __name__ == '__main__':
    a = sys.argv[1:]
    design(os.path.abspath(a[0] if a and not a[0].startswith('--') else '.'), a)
