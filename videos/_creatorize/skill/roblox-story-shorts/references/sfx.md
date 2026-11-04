# Sound effects (Roblox story shorts)

The refs are voice + meme SFX, no music. The star is the **vine boom** on every punchline. The app does the rest:
the dead air is already cut (the voice you build on is tightened), and the Sound step levels every sound against the
voice, mixes and masters to -14 LUFS / -1 dBTP. You only place cues.

## Placing a cue
Two ways, both in project time (the voice's time, the same seconds as `audio/clean.json` / `audio/script_timed.txt`):

1. In the scene, next to what makes the sound (preferred: it moves with the shot):
   ```js
   import { sfx } from '../engine.js';
   sfx(11.97, 'vine_boom');                       // punchline lands
   sfx(3.30, 'pop/pop');                          // teleport poof
   sfx(37.90, 'riser/riser', { align: 'end' });   // the riser ENDS at the twist
   sfx(3.40, 'fx/glitch', { gain: -6 });          // a quieter layer (dB)
   ```
2. Or a list in `audio/sfx.json` (handy for many booms at once):
   ```json
   [ {"t": 11.97, "name": "vine_boom", "note": "Teachers wear helmets."},
     {"t": 3.30, "name": "pop/pop"} ]
   ```
Both are merged (the same t + name counts once). Fields: `t` seconds, `name` (below; the bare file name also works when
it is unique: `pop2`, `thud`), `gain` dB on top of the automatic level (-30..+12), `align`: `start` (default, the sound
starts at t) or `end` (it ends at t: risers, `woosh/reverse`). An unknown name is skipped and reported, never an error.

## Where they go (the refs' grammar)
- **vine_boom**: t = the END of the punchline's last word + 0.05 s (`end` in clean.json). 5-10 per short, never two
  within ~3 s. Every short ends on one (the last line). A boom plays 9 dB OVER the voice and is never ducked: the joke.
- **pop/pop, pop2, pop3** (alternate them): something teleports, appears, vanishes. On the frame it happens.
- **woosh/***: camera whips and body moves (a dive = `woosh/deep`, an arm swing = `woosh/cloth1`), a few per short.
- **impact/***: a body hits the floor, a punch, a crash. On the contact frame.
- **riser/*** with `align: 'end'` into a twist; **meme/*** for reactions (`meme/huh` confused, `meme/bonk` dumb moment).
- Layers (everything but booms) sit about 7 dB under the voice. Fewer, better: 15-30 sounds in a 60 s short.

## Names (the catalog: `references/sfx_catalog.json`, its `use` line says when)
| kind | names |
|---|---|
| boom (over the voice) | `vine_boom` (THE star), `bass_drop` (one big reveal, max once) |
| meme | `meme/bonk` `meme/huh` `meme/ding` `meme/wrong` `meme/right` `meme/correct` `meme/money` `meme/bell` |
| pop | `pop/pop` `pop/pop2` `pop/pop3` `pop/ping` (UI ping, text card) |
| woosh | `woosh/swoosh` (whip cut) `woosh/short` `woosh/deep` `woosh/simple` `woosh/reverse` (align end) `woosh/cloth1` `woosh/cloth2` `woosh/smooth` `woosh/power` |
| impact | `impact/thud` `impact/punch` `impact/hit` `impact/heavy` `impact/big_boom` `impact/crash` `impact/glass` |
| riser (align end) | `riser/riser` `riser/short` `riser/easy` `riser/rising` |
| fx | `fx/glitch` `fx/shine` `fx/camera` `fx/explosion` `fx/spin` `fx/slurp` |

## No cues at all
If the scenes and `audio/sfx.json` place nothing, the Sound step places a safe default set by itself: vine booms on
the last line and on short lines that follow a longer setup, pops on "teleported / vanished / poof" words and on shots
named so, a short woosh on hard cuts. It is a fallback: placing the booms yourself on the real punchlines is always better.

## Scripts (the app runs them; you never need to)
`scripts/tighten.py <project>` (dead air, run right after transcription), `scripts/sound_design.py <project>` (cues ->
audio/sfx_bed.wav, levelled), `scripts/mix.py <project>` (voice + cues -> audio/final_mix.wav, -14 LUFS, <= -1 dBTP).
