# The camera (the owner's top priority)

The owner, 2026-10-30, after the night's three shorts: "camera movement is jaggy, it's not intentional the cuts are
rough, the ramp is not smooth. it should be a smooth ease, slow start ease in/out slow out. super nice. And there should
be two options, cuts or cutless". Earlier: "jittery, jaggy", "not this frantic", "calm and viewable".

What was wrong (measured on the night's 110 shots with tools/camreplay.py + camstats.py): every shot started and ended
moving at ~50 % of its peak speed (v4's speed profile + creep), so 0 of 220 cut edges were at rest: every cut slammed
one moving camera into another. Inside shots, v4's sampled arc-length retime left jerk kinks (600-2000 %/s^3). No euler
flips, no lens jumps: those were not it.

## Pick the mode per film (storyboard, before any shot is written)
- **cuts** (default): a film of separate views - different places, scales, cutaways, an inside and an outside. Each shot
  = ONE eased move that starts at rest and ends at rest, so every cut lands on a still frame on both sides (clean).
- **cutless**: ONE world explored continuously - a single machine, a building, a cross-section the story walks along,
  a process that happens in one place. No cuts: the camera holds on a focal point, travels to the next, holds. Write it
  in assemble.json as `"camera": "cutless"` and the group(s) as `"tours"`.
- A film can mix: tours for its continuous stretches, plain cuts (or a `"dips"` cut through black) between them.

## cuts: M.Flight (v5)
```python
t = lambda f: (f - 1) / 30
M.Flight([(t(F0), (0, -34, 14), (0, 0, 14), 24),          # (time, eye, target, lens[, roll[, hold]])
          (t(F1), (-6, -30, 20), (0, 0, 15), 26)]).bake(F0, F1)
```
- The keys draw a C2 path (eye, target, lens, roll). The shot travels it as ONE eased move: slow start, ease in, cruise,
  ease out, slow end. The look target is eased with it; orientation is a quaternion (no flips); lens and DOF focus ride
  the same curve. A slow creep toward the subject is folded into the same curve (ends stay at rest; one-move shots
  only: with a hold the camera rests still between its moves).
- `ease='smooth'` (default: the speed ramps up/down with smootherstep over `ease_in`/`ease_out` = 0.4 of the move;
  position, speed, acceleration and jerk are all continuous), `'sine'`, `'smootherstep'`, `'linear'`, or bezier handles
  `ease=(0.45, 0, 0.55, 1)`.
- A hold: a 6th key item `True`, or the same pose twice - the camera arrives at rest, waits, leaves at rest.
- Move-matched cut: `exit='carry'` on the outgoing shot and `enter='carry'` on the incoming one (no ease at that end;
  both moving the same way on screen at the same speed). Otherwise never: a cut lands on rest.
- `dof=(None, 2.8)` focuses on the eased target (or a point / object / function of t: pulls are smoothed; an animated
  object is followed frame by frame).
- `legacy=True` (or env CZ_FLIGHT=4) = the old v4 camera, only for re-rendering an old film unchanged (v5-only
  keywords are dropped for it). `strict_ease` is a v4 option: v5 ignores it and says so.

## cutless: M.Tour (one camera across several shot files)
```python
# common.py - the SAME tour for every shot of the group (written by the director BEFORE the shots are split)
TOUR = [dict(t=(T(1), T(19)),    look=(-6, 4, 3),    dist=16, yaw=-8, pitch=16, lens=26, name='tower'),  # hold 0.6 s
        dict(t=(T(75), T(93)),   look=(5, 6, 1.6),   dist=16, yaw=4,  pitch=16, lens=28, name='tank'),   # leg 1.9 s, hold
        dict(t=(T(150), T(168)), look=(6.5, -3, .45), dist=15, yaw=10, pitch=18, lens=28, name='pipe'),
        dict(t=(T(222), T(240)), look=(-4, -4, 1.4),  dist=15, yaw=-4, pitch=16, lens=26, name='hut')]
# each shot of the group:   M.Tour(C.TOUR).bake(F0, F1)
```
(This is `tests/camera/set_common.py`'s tour: 4 stops in 8 s, every leg under the turn cap, gate-clean.)
- A stop: `t=(arrive, leave)` (hold) or `t=time`, `look=` point (or object), `eye=` point or `dist` + `yaw` + `pitch`
  (degrees, yaw 0 = looking +y from -y), `lens`, `roll`, `name` (said in the schedule lines), `drift` (the hold's slow
  push, share of the distance, default 0.02: never frozen), `via=[eye points]` (the leg leaving this stop steers through
  them, around solids), `arc=True` (the eye swings around the moving focus keeping its distance; default False =
  straight: an orbit swing indoors goes through walls), `pass_=True` with one time = pass through without stopping.
- **The turn budget (plan the stops with it):** the view turns at most 20 deg/s, and an eased leg peaks at ~1.7x its
  average, so a leg of T seconds turns at most ~12 x T degrees (1.5 s: 18 deg, 2 s: 24 deg, 3 s: 36 deg). Keep stops
  that are far apart at nearly the same yaw and further away (the camera trucks along the set: little turn, calm), and
  put a big change of view (a reverse angle, inside -> outside) on a cut instead.
- **The schedule:** a stop every 2-3 clauses; tour shots 4-6 s; legs >= 1.5 s, holds 0.4-0.8 s. The engine gives each
  leg the time its turn needs; the extra comes first out of the next hold (arrive later), then out of this one (leave
  earlier), each kept >= 0.4 s; what still does not fit pushes the later stops, and a tour that would run past its last
  stop is squeezed back into it (faster than the cap). Every stop is reached and held. Changed times print as
  `CZ CAMTOUR cam tank: planned 2.47-3.07 s, camera 2.80-3.07 s` and a squeezed tour as `CZ CAMCAP cam tour: the legs
  need 3.7, 2.9, 7.8 s ..., the stops leave 1.4, 1.4, 1.8 s`: the director retimes the stops (or turns less), once.
  A tour line is the director's: a crew builder reports it and never changes the TOUR or the camera mode in its shot.
- Lead the travel over something worth seeing (via=), not empty ground.
- Every shot of the group builds the same set (same objects, light, materials at the shared moment): the parts are
  consecutive frames of one camera. assemble.py proves it: each part renders one frame past its end and must match the
  next part's first frame (`SEAM a -> b 0.3`; `SEAMFAIL` over 2.5 = a prop / light / material differs: fix the shot).

## Keys that look right
- 2-3 keys per 2-second shot, ONE kind of move: a push toward the thing named, an orbit, a rise to reveal scale, a
  pull back. The camera moves 5-20 % of its distance to the subject per 2 s, turns at most ~24 degrees (the 20 deg/s
  cap: a shot of T seconds turns at most ~12 x T degrees).
- Keep the target on the subject; move the eye. The eye stays outside solids along the whole path.
- No whips at the shot edges (keys a few frames apart at F0 / F1): the engine drops them; ease does the edges.
- A held camera: one key, or the same pose twice (it creeps slowly over the whole shot, never pops).
- Lens 14-50 mm on the 24 mm vertical sensor; a key outside is clamped and reported (`CZ CAMLENS`).

## The report (every bake) and what to do with it
`CZ CAM peak .. %/s, accel .. %/s2, jerk .. %/s3, turn .. deg/s, edges a/b %/s, lens .., N jerky frames` (screen motion
in % of the frame height, measured in float64 = the same numbers as tools/camstats.py). `CZ CAMJERK <frames>`: jerk
> 900 %/s^3 (a kink, or a move too big for its time: fewer / closer keys, a smaller move, or more frames).
`CZ CAMEDGE`: a cut not on rest. `CZ CAMCAP`: a turn over 20 deg/s. `CZ CAMTOUR` / `CZ CAMCAP .. tour`: see the tour.
Measured on the shipped tests (2 s moves, peak 30-75 %/s): jerk 300-860, accel 80-200, edges 0.0, 0 jerky frames; a
held camera reads jerk ~30; a linear-ease start / stop reads 86 000, a 1.2 s version of a 2 s push 3 600.
**Camera lines are notes, never export blockers** (only overlaps and shots that do not build block the export):
check_layout lists them as `CAMERA (note)`; fix each ONCE at its cause, and if it is still listed write it in
storyboard.md and move on. Never loop on a camera line.

## Tools (development and QA only: never during a build; the export runs the gate itself)
Kit tools of the app (`templates/blender/tools/`, not in the project folder), run with the app's Python and Blender:
- `<blender> -b --factory-startup -P tools/camreplay.py -- <film dir> <out.json> [--legacy]`: every shot's camera only
  (seconds; reads common.py / kit.py and the module the shots import as C / K), then
  `<python> tools/camstats.py <out.json> --shots` (exact speed / accel / jerk, rest at cuts) and
  `<python> tools/camseam.py <out.json> t01,t02,..` (a tour's parts: identical shared frames, one-camera stats).
- `<python> tools/camjerk.py <film.mp4 | frames dir> [--shots <film>] --list`: the same from the picture (what the
  viewer sees; also writes measure-style json for camsmooth / cammotion / camcurve).
