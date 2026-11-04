# Contact: nothing clips, floats or flickers (the overlap gate)

gruss, 2026-10-30: "some elements are clipping out because of overlaps, it looks unprofessional". Every shot is checked
automatically: `check_layout` (in the app) and `tools/signoff.py` (the gate) build each shot with
`engine/run.py --check`, and `engine/contact.py` prints one line per problem:

    CZ CONTACT <type> <shot> f=<frame> <a> x <b> depth=<m> px=<n> fix: <how>

It looks at sampled frames (every 0.25 s, every X-ray peak, the frame after something appears), judges ON SCREEN (only
solids the camera sees, 8 px or bigger; only defects 3-6 px or bigger, z-fights 12 px or bigger), uses the evaluated
geometry (modifiers, displacement, geometry-node instances) and costs 10-600 ms a frame (0.1-4 s a shot; a big set gets
up to 10 s, plus the time to read heavy meshes, 15 s at most). When time runs out it never says clean: it prints
`CZ CONTACT partial <shot> f=<first unchecked> checked x <k>/<n> ... unchecked: f=...` (a note, not a failure): LOOK at
those frames yourself.

## The rules (build it right first)
1. **Things rest ON what holds them.** Put an object's lowest point at the support's top z (`bound_box` min, or a ray
   down), never "about there". A prop resting on a prop: same.
2. **Solids never pass into other solids** of another model. A real opening (a pipe through its wall, a root in the
   soil, a post in its footing, stones half sunk in gravel) is declared: give both the same group.
3. **One surface per surface.** Never lay a plane or a part exactly on another face of a different material (a decal on
   a box top, a panel flush with a wall): lift it at least 1 cm (more for far shots), or paint the detail into the
   material. Same material in one plane is fine (it cannot flicker).
4. **A cutaway is cut clean.** Everything that reaches the section plane is cut AT the plane (`half_cut` / bisect) and
   ends 1 cm behind the face if it is buried (ending exactly IN the cut face z-fights with it). Declare the plane once in
   the kit: `contact.section(point, normal_toward_camera, name, box=(x0, x1, y0, y1, z0, z1))` (box = the cut part of
   space: the soil block, not the house standing on it).
5. **The camera never enters a solid** and keeps clip start (0.05) away from every surface it sees.
6. **Moving things meet at surfaces**, never pass through anything between two checked frames.

## What counts (round 2, 2026-10-30)
- **Only what the camera can see fails.** A `through` whose meeting line is hidden (behind a wall, under the soil, on the
  far side of the object) and a `floating` gap that is off screen or covered print `CZ CONTACTINFO hidden-<type> ...`:
  info for the builder, never a failure. If a later camera move shows it, it becomes a finding at that frame.
- **Thin things (poles, pipes, rods: longest side >= 4x the next) count at any sunk share:** their centre line inside
  another solid is a `through`. A pipe that really goes through its wall is declared: `contact.allow(pipe, wall, group=...)`.
- **A prop is held by its underside, not just its lowest point:** its down-facing surface touching any solid (a platform
  on its bogies, tracks on the ground while the bucket hangs lower) means it rests.
- **Only what the film draws hides or holds (fix round 2026-10-30).** A wall that is `hide_render` (or hidden by a key:
  `M.visible`, a prop that appears later, a hidden collection) never hides a clip behind it and never holds a prop up.
- **Library models (package A):** a mesh over 150 k triangles (a Poly Haven tree) is judged by exact samples of its
  surface and its true lowest points; it can poke into things (`through`) but is never the closed "inside". Copies of one
  library asset (`A.scatter` rocks, a row of the same tree) are one family: never checked against each other, each still
  checked against everything else.
- **Detail pass (references/detail.md):** `D.fog`, `D.motes`, `D.scatter` pieces and `D.roots` are never checked (sunk
  or floating by design). `D.relief` skins may overlap their own cut block and stand in front of the section, and are
  still checked against everything else: a prop the lumps swallow IS a finding (pass it as `clear=`).
- **Small z-fights are info:** a coplanar patch under 12 px prints `CZ CONTACTINFO coplanar-small ... (too small to
  flicker)`; from 12 px it is a finding.
- **People (package C):** `run.py --check` also runs `hands.hold_issues()` (CZ HOLD lines; `CZ HOLD OK` = fine) and the
  foot-slide check (CZ FOOTSLIDE) when the shot has figures; check_layout lists each problem once. A prop in a person's
  hand is never `floating` and never `through` that person.

## Types and how to fix each
| type | means | fix |
|---|---|---|
| through | `a` is 15 %+ of its surface inside closed solid `b`, deeper than 6 px | move / resize so they touch; if it is meant to go in, `contact.allow(a, b, group='name')` |
| floating | a grounded prop's lowest points are `depth` above what is under it, it is not moving, nothing holds it at its side | lower it onto the support; `contact.airborne(ob)` only if it really flies, falls or is thrown |
| coplanar | two surfaces of different materials, facing the same way, in one plane (also two layers inside one joined mesh: `<a>_self_`) | lift one >= 1 cm, shrink one so they do not overlap, or one surface with the detail painted in |
| cutaway | `a` pokes `depth` out of the section plane (or out of a `contact.shell()` see-through shell it sits in) | bisect it at the plane / move it behind; `ob['cz_section_ok'] = True` only if it stands in front of the cut on purpose |
| camclip | the camera is inside `a`, or its near plane cuts `a` open | move that Flight key back; `M.Flight(..., clip=(0.01, ...))` if it must be that close |
| sweep | `a` passes through `b` while moving, between the checked frames | change one path or its timing |

## Opt-outs (on the object or any parent)
- `ob['cz_airborne'] = True` flying, falling, thrown (never "floating"). Moving 2 %+ of its size in 3 frames up or down
  already counts as in motion (lowered into place, falling).
- `ob['cz_group'] = 'roots,soil'` objects sharing a group may overlap (`contact.allow(*objs, group=...)`).
- `ob['cz_nocontact'] = True` never checked (helpers, guides). Effects are skipped by themselves: see-through (BLENDED:
  X-ray, glass, water, gas) and emission-only materials (glows, labels, the sun disc), text objects.
- Parts of one model are never checked against each other: children of one parent (that is still prop-sized, < 25 m),
  one name prefix before `_` (`pump_body`, `pump_rod`), copies of one object (`debris.017`, `debris.240`). So name the
  parts of one model with its prefix.

## Running it
- In a build: `check_layout` only (each finding once, with its fix); the app runs the same check before the export and
  refuses while an overlap is listed. Never run Blender or the tools below yourself during a build.
- What blocks the export: through, floating, coplanar (12 px+), cutaway, camclip, sweep, a shot that does not build.
  Notes (fix once at the cause, then note it in storyboard.md and move on): `partial`, a crashed check, camera lines,
  HOLD / FOOTSLIDE, every CONTACTINFO line.
- For engine developers (outside a build): `python tools/signoff.py <project dir>` (Windows: `python`, not the Store
  `python3`; it finds the app's own Blender) -> `SIGNOFF <project>: PASS` or `FAIL` + every issue and note;
  `--only e03,e04` some shots, `--gate all` fails on notes too. One shot: `<blender> -b --factory-startup -P
  templates/blender/engine/run.py -- e07.py --check`.
- Calibration (a gate is only trusted once seen to fail): `tools/signoff.py templates/blender/tests/contact` must say
  `t01: 9 issues` (one of each type, a thin pole through a crate, two clips behind walls the render hides) with
  `hidB x hidA` as info only, and `t02: clean` (the same info line). Never edit those two to make them pass.
- Knobs (env): `CZ_CONTACT=0` off, `CZ_CONTACT_STEP=0.25` seconds between samples, `CZ_CONTACT_BUDGET` seconds of
  checking (default 4, +1 per 50 solids up to 10), `CZ_CONTACT_CAP=15` hard cap, `CZ_CONTACT_COPLANAR_PX=12`,
  `CZ_CONTACT_HEAVY=150000` triangles.

## Limits (say so, don't trust blindly)
- Visibility is judged by rays to up to 48 meeting points (through) / each foot's gap (floating) at the checked frames;
  a defect visible only between two checked frames can be missed (the sweep covers moving things).
- Thin-object sampling follows the straight centre line: a bent cable is judged by its surface samples only.
- Open meshes (heightfields, half-cut parts, planes) can't hold things "inside": they are never the `b` of `through`.
- The z-fight tolerance is geometric (depth precision at that distance), not a render probe.
- A heavy library mesh is never the "inside" of a through and is not z-fight checked (its proxy is too coarse).
- A collection instance hidden by hide_render while another visible instancer shows the same collection still blocks
  rays (rare: say it if a clip behind such a prop is missed).
