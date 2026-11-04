# People in a 3D Informational film (engine/human.py + engine/hands.py)

The 3D reconstruction style's figure system, ported to Blender: the same two jointed mannequins, the same 131 CC0 motion
clips with the same QA verdicts, the same VERIFIED hand holds. Never build a person from primitives again (the old
`props_d.py` person_parts / crowd / walker rigs are retired for anything closer than a far crowd).

## When a film needs people
- Scale: a person next to a machine, a dam, a tunnel bore tells the viewer how big it is. One figure is enough.
- A process done by hands: a worker carrying a box into the warehouse, an engineer holding a tool at the pipe.
- A body explained: X-ray figure (finish 'xray' or `xray=True` + `f.xray(keys)`) to show the lungs, the spine, a load.
- A crowd for density (a stadium, a queue, a city): `H.crowd(...)`, far from the camera, idle / talk clips.
Keep them as supporting actors: the subject is the mechanism. No faces (the mannequins are faceless on purpose).

## API (`import human as H`)
| call | what |
|---|---|
| `f = H.figure(who, finish=, color=, at=(x,y,z), face=, height=, name=, xray=False)` | who = a role (`main` glossy orange, `worker`, `engineer`, `scientist`, `police`, `extra`, ... see `H.ROLES`) or `male` (1.80 m) / `female` (1.68 m). finish `matte` / `glossy` / `glow` / `xray`. face = yaw degrees (0 looks toward -Y, toward a camera at -Y) or a point / object to face. |
| `f.play(clip, t0, t1=None, speed=1, loop=None, blend=None, offset=0)` | seconds. Calls in time order. Every change crossfades (sit<->stand 0.5 s, gestures 0.25, walk 0.35, else 0.3). One-shots hold their last pose to t1. Act names work too (`'point'`, `'phone'`, `'sit'`... = `H.ACTS`). |
| `f.walk([(x,y), ...], t0, t1=None, clip_name='Walk_Loop', end_clip='Idle_Loop')` | walks the path and stands still at its last point (< 1 cm). t1 = when it stands still (None: the clip's own stride speed). The clip time follows the distance (planted feet at any speed), the speed ramps up / down with the crossfades, the stance foot drives the body (corners turn about the planted foot), the walk ends on a passing pose that matches the end clip's feet. Keep the rate 0.6-1.6x (it warns). `f.walk_info` = speed, rate, t1, end error. |
| `H.plant()` | **call once after every play / walk / hold of the shot.** Each foot that rests on the floor is held where it touched down (leg IK, eased): catches idle clips that shuffle, crossfades, turns. |
| `f.turn(t, face, dur=0.4)` / `f.place(at, face)` | turn in place / move (a turn on the spot is held by `H.plant()`; over ~45 deg let the walk arrive facing that way). |
| `f.sit(seat_obj_or_height, t0, t1)` | sits on the object's top (the sit clips sit on 0.45 m x height/1.8; the figure is lifted / lowered to match). |
| `f.look_at(obj_or_point, t0, t1)` | head + neck turn (eased). |
| `f.xray([(t, 0..1), ...])` | solid -> mega's X-ray green (needs `xray=True` or finish `xray`). |
| `H.crowd(n, (x0,y0,x1,y1), clips_=(...), t0, t1, seed, spacing=0.75)` | extras with shared mesh data, random clip phases / speeds. |
| `H.clips('wave')`, `H.clips(tag='sit', body='female', verified=True)` | the catalog (builtin.json + the user's own clips); broken clips are never listed. |
| `H.import_mixamo(path, name=None)` | the user's own clip (Mixamo FBX they downloaded, any humanoid FBX / GLB / BVH), retargeted onto both bodies, cached. |
| `H.figure('custom:<path or A.model key>', at=, face=)` | ANY rigged humanoid as a person (an uploaded GLB / FBX, a Mixamo character, `templates/lowpoly/library/characters/base_m_grey.glb`): bones auto-mapped (`H.ue_name`), it plays every clip, walk, sit, plant. Holds stay mannequin-only. |
| `H.report()` | timings (first import vs cached). |

Clip names: `Idle_Loop`, `Idle_Talking_Loop`, `Walk_Loop`, `Walk_Formal_Loop`, `Walk_Carry_Loop`, `Jog_Fwd_Loop`, `Sprint_Loop`,
`Sitting_Idle_Loop`, `KK_Sit_Chair_Idle_Loop`, `G_Point_Forward`, `G_Shrug`, `G_Typing_Seated_Loop`, `Idle_TalkingPhone_Loop`,
`KK_Hold_A_Loop`, `KK_PickUp`, `Push_Loop`, `Crouch_Idle_Loop`, ... (`H.clips()` lists all 131 with what they suit).
A clip marked broken on a body (quality.json, e.g. `Crouch_Fwd_Loop` on the female) raises with the reason: pick another.

## Hands (`import hands as HD`)
Every object a person holds goes through `HD.hold` (never parent a prop to a bone yourself, never place a prop "near" a hand).
| call | what |
|---|---|
| `p = HD.kit(kind, at=, yaw=)` | recon's own kit prop (its exact geometry, the grips were verified on it): 30 kinds (laptop: closed), `HD.kit_kinds()`. |
| `HD.hold(f, prop, grip, side='R', t0=None, t1=None, use=None, kind=None)` | held all along, or picked up at t0 from where it rests (the hand reaches for it 0.5 s before) and put back at t1. Any model works: pass `kind=` (its grips are fitted to the model's bounding box) or set `prop['cz_grips']`. |
| `HD.handover(a, b, prop, grip, t=, side_a='R', side_b='L')` | a holds it until t, b from t; the exchange pose is searched between them so both can reach it. Facing each other: give it from a's right hand to b's LEFT (both hands on the same side of the line between them). Stand them about 0.8-0.9 m apart. |
| `HD.rest(f, desk, t0, t1)` | hands come down onto a surface (typing, writing). |
| `HD.hold_issues()` | the HOLD check (see below). |

Only VERIFIED kind x grip x body x hand x clip combos are allowed (the 3D reconstruction's handtest table: 36 kind|grip rows,
555 combos, `engine/data/hands.json`). Anything else raises with a verified alternative, e.g. `smartphone|ear` is verified
with `Idle_Loop`, `Walk_Loop`, `Idle_Talking_Loop`, `Sitting_Idle_Loop`, `KK_Sit_Chair_Idle_Loop` and `Idle_TalkingPhone_Loop`.
Uses: `clip` / `hang` (the hand stays where the clip puts it, the prop rides it), chest uses `hold` (a can upright),
`carry` (a box in front of the belly, both hands), `look`, `read`, `show`, `aim`, `film`, `tray`, `pole`, `sign`, `mic`,
`umbrella` (the prop sits in front of the chest and the hands IK to it), `ear` (head anchor).

## How the hands work (recon's solve, ported)
`hold()` runs recon's solveHand once per hold: the palm pushed out of / onto the object (8 rounds), each finger closed
joint after joint until its visible vertices touch (the thumb swings in from outside, other spreads tried when it does not
touch), every skin-blended finger vertex verified, and what no finger can fix moved off the palm along its normal. Handle
grips use recon's baked BAR_BEST places; `use: 'hang'` turns the hand every frame so the prop hangs straight
(hangStraight, baked per frame); chest / head uses build recon's use frame (setupUse, earFrame for phones at the ear,
the mouth for mics and drinks) and push the prop off the body (clearBody); `rest()` lowers each hand onto the surface
under it every frame (baked). Kit props are recon's own geometry (`HD.kit(kind)`, 30 kinds (laptop: closed): `HD.kit_kinds()`).
`tests/humans/sweep_holds.py` renders every VERIFIED kind|grip on both bodies into a contact sheet with the HOLD check.

## Feet that stay put (walk + plant) and the foot slide check
How the walk works (recon's sequence walk + figures.js pTable, Round 3): the walk strip's time is keyed frame by frame
(clip time = distance / stride speed, so the planted foot never slides whatever the speed); the root speed ramps up after
the clip has half faded in and down to rest as the end clip fades in; every frame the root moves so the planted ball
joints stay where they are (weighted by how planted each foot is), so a corner turns the body about the planted foot; the
clip phase is chosen so the walk ends on a passing pose whose planted foot already stands where the end clip puts it; the
path is corrected until the walk ends on its last point. `H.plant()` then holds every resting foot in the world (leg IK
to where it touched down, eased over 3 frames outside the contact): idle shuffles, crossfades and turns.
`run.py --check` calls `H.foot_issues()`: one line per planted foot that slides more than 2 cm, nothing when clean:
`CZ FOOTSLIDE <figure> f=<frame> slide=<cm> fix: <foot, times; how>`. `H.foot_slide()` prints the per-figure summary
(`CZ FOOTSLIDE OK <figure> (max <cm> cm, <n> steps)`). Measured (tests/humans/t_walk.py, t_custom.py, t_humans.py):
straight walk, 90 deg corner, 135 deg corner with t1, a start facing away + Walk_Carry_Loop, walk -> turn -> sit,
3 custom figures: max 0.0-1.2 cm (before Round 3: 12.6 / 19 cm at start / stop, 35 cm after a corner).

## The HOLD check
`HD.hold_issues()` measures the drawn hands at 4 held frames per hold and prints, per problem:
`CZ HOLD <frame> <figure>: <kind>|<grip> <R|L>: <problem>` (hand inside the prop N mm (bone), floats N mm off the palm,
<finger> finger N mm off (air), hand N mm off its IK target (out of reach), not VERIFIED with clip <c>), or
`CZ HOLD OK <figure>: <kind>|<grip> <side> (<n> frames)`. A handover out of reach prints
`CZ HOLD handover <a> -> <b>: the exchange point is N cm out of reach: stand them closer`.
Fix before a render: more than 5 mm inside / off is visible in a close-up. INSIDE is hands.js's own test (ray parity
against each closed part, open parts like screens never "inside"; two rays + a third on disagreement), measured around
the prop's origin; the solve uses the same geometry in the hand's rest frame. Sweep (`tests/humans/sweep_holds.py`, every
VERIFIED kind|grip on both bodies, the steering wheel 40 cm in front of the chest as recon's handtest): 71 / 71 rows clean.

## Custom figures (`custom:`)
`H.figure('custom:C:/path/hero.glb')` (GLB / GLTF / FBX) or `'custom:<A.model key or query>'`: the model's skeleton is
auto-mapped (Mixamo `mixamorig:*`, UE `pelvis / thigh_l`, Rigify `DEF-*`, `Bip01 *`, `LeftForeArm`, `forearm.L` ... via
`H.ue_name`; it needs hips, thighs, calves, feet, upper / lower arms and head). A hidden mannequin of the same build plays
the clips; every mapped bone of the model copies its mannequin bone's world turn since rest onto its own rest after the two
bone directions are lined up (an A-pose model follows the T-pose clips), the hips copy the place; the model is scaled so its
hip height is the mannequin's. Everything the Figure does works (play, walk, sit, look_at, plant); `f.custom` = {arm, meshes,
mapped, scale}. Holds (`HD.hold`) stay on mannequins (the finger solve needs the mannequin's hand data). Cost 0.2-0.3 s
per model (imported once per run, linked copies after). Tested: the library's CC0 Quaternius base male and a
Mixamo-named FBX (65 of 65 bones mapped each), pointing + walking next to a mannequin.

## The user's own clips (Mixamo)
Mixamo clips may not ship with the app. The user downloads them with their own Adobe account (FBX, "Without Skin" is
enough) and the film imports them: `H.import_mixamo('~/Downloads/Waving.fbx')`. The clip is retargeted onto both bodies
(bone map mixamorig:Hips -> pelvis, LeftForeArm -> lowerarm_l, LeftHandIndex1 -> index_01_l ..., each bone's armature-space
rotation change since its rest applied to the mannequin's rest after the two rests are lined up, hips scaled by leg
length, travel removed and kept as the stride speed) and cached in `<Creatorize Assets>/3d/humans/v1/clips/<body>/` with
its entry in `humans/user/catalog.json`; afterwards `f.play('Waving', ...)` like any clip. It is not in the VERIFIED table:
hands holding props use the built-in clips.

## Pitfalls
- Feet: every clip carries its ground lift (the lowest sole on z = 0), so never move a figure's z to "fix" a sinking foot
  on flat ground: put the figure on the surface (at=(x, y, floor_z)).
- A walk needs room: 1.0 m/s on Walk_Loop; a 3 m path takes 3 s. Do not squeeze it into 1 s (rate > 1.6 looks like a run).
- Forgetting `H.plant()` leaves idle shuffles and crossfade slides of 5-25 cm: `run.py --check` reports them as
  `CZ FOOTSLIDE ... fix:` lines.
- Handover: the exchange is searched for both reaches (hands.js fitExchange); about 0.7 m apart for one-hand props.
- Sitting: the seat must be a real object at 0.40-0.50 m (scaled with height); give the sit its own t0 after the walk.
- Holds over a clip change are re-checked per clip: a hold verified with `Idle_Loop` may not be verified with `G_Shrug`.
