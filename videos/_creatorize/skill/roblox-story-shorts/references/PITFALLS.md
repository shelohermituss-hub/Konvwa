# PITFALLS (everything the lab learned; each line cost a re-render)

## Placement + clipping
- **People are 4 wide with arms** (torso 2 + arm 1 each side). Two people side by side need >= 4.4 between centres; 5+
  for shrug / dance / tPose / cheer / scared. Use `lineUp()` / `crowd()` instead of hand-placing extras.
- Props and furniture: keep a standing person >= 1.3 from any prop edge; idle arms swing ~0.8. `crowd()` only avoids props
  that exist when it is called: create sets and props FIRST, then the crowd. It checks spawn spots, not paths: a run or
  a drive across the crowd still collides (check_layout catches it).
- A person sitting at a desk / table: use the set's chairs (classroom chairs at z = desk z + 1.4, sit pos y 0.7). Standing
  between desk rows clips the desk. Seated but gesturing: `{ pose: 'talk', sit: true }` keeps the legs seated
  (also `sitTalk sitGesture sitShrug sitCry sitDrive`). `sit: 'floor'` for the floor.
- Ceilings are at y 10. Floaters are pushed down automatically so their top clears the ceiling; for a float that must go
  higher use `set(name, { h: 16 })`, `breakCeiling(t, {x, z})`, or an outdoor set. Tipped-flat floaters reach ~3 above pos.y.
- Giants (`scale: 1.5+`) in a room: raise the ceiling (`{ h: 16 }`) or the head goes through it.
- A person "parked" off stage behind a wall gets dragged through it when his pos interpolates to the entrance: add a pos
  key 0.01 s before the entrance at the entrance point, or keep him hidden until then.
- One avatar per person PER LOCATION, shown only in its time window. Never move an avatar between locations with pos keys.
- `car_interior`: front seats x -2.2 (driver, steering wheel) / 2.2, back bench z 3.6; sit pos y 0.7, rotY 180, driver
  pose `sitDrive`. The car walls are at x ±3.6 and the pillars at z -2.4 / 4.9: close-ups inside the car keep the
  camera between x -3 and 3 (`rel(a, [1.4, 4.2, 3.4])` for the passenger, mirror dx for the driver).
- Held things: `hold(a, 'umbrella')` puts the grip in the fist; a big held prop still collides with neighbours.
- Animals and vehicles are props: `thing()` moves them, but nothing stops them going through walls or people.

## Camera
- 9:16 is narrow: a close-up from 2.5-3 away is too tight (head cut); 4-4.6 at fov 40-45 = face + shoulders.
- The auto push walks the camera forward along its view line by 10-30 %: anything 1-2 units in front of the camera (a
  dashboard, a head in an OTS, a doorframe) becomes a CAM finding. Pull the pos back, or use a fov-only `to: { fov }`.
- `rel()` cameras follow the avatar's facing: if he faces away from where you think, the camera ends up behind him or
  inside a wall. Over-the-shoulder shots: use a world point on the A-B line instead when rotY is unclear.
- Never put a prop, a crowd or a parked car between the camera and the subject (stills show it; check_layout says HIDDEN).
- Outdoor sets: the camera at y < 0.3 goes under the ground. Low angles at y 1-2.8.
- Cameras looking up in a room see the ceiling lights; fine. Looking up OUTDOORS: the sky is a backdrop, keep fov <= 62.
- **Tiny people (scale 0.1-0.3) need a camera at THEIR size**: 0.6-1.2 away, at their head height, fov 40-50. A room-sized
  wide with a 3-inch hero shows a dot (app build 2026-10-30, "I fit through doors now": the payoff line was a 3 s wide of an
  empty doorway with a speck in it). The doorway gag = a low camera behind the tiny hero walking under the huge frame.
- **The last shot is the payoff**: the hero's face (close or medium, readable) or the gag itself, big; never a wide or an
  empty set, and never one shot held over the last 2.5+ s (cut again on the last clause or push in visibly with `to:`).

## Looks
- Material colours are shared: `mat('#6a5a8c').color.set(...)` recolours EVERY prop using that colour. Give a recoloured
  prop its own `color` option instead.
- Tints: `grade()` and `light()` overrides change the whole frame from that moment; scope `grade(t0, t1, ...)` to the
  shots that need it, and `useLight()` back at the next location cut.
- Faces: use names from faces.md; a missing name draws a placeholder face (looks wrong, check_preview warns).
- **Text never in the caption band** (the top ~22 % of the frame, where the captions sit): a `label()` over a head in a
  close-up lands on the caption (app build 2026-10-30: "-1 INCH" printed over "you shrink one inch"). Put labels beside or
  below the head (`off: [1.6, -0.5, 0]`), or use `title(t0, t1, text, { y: .72 })` (lower third); stills must show both read.
- Shrinking / growing: avatars have a `scale` option but no `scale` key yet; to animate it set `a.root.scale` from an
  `onFrame(t => a.root.scale.setScalar(s(t)))` hook (s(t) eased between your own [t, scale] keys; deterministic), or cut
  between two avatars (big, then small) on the word with a `puff()`. Keep the feet on the floor: scale shrinks towards
  the root (feet), so pos needs no change.
- Signs: `sign(text)` sizes itself; long text on `prop('sign')` shrinks. Put signs on walls at y 6-8 (above heads).
- `box(w,h,d,color,[x,y,z])`: y is the BOTTOM; it adds itself to the scene. `ball()` positions are centres.
- Transparent things (glass, water) never hide people in check_layout; a person standing in `prop('pool')` water is fine.

## Timing
- Cut on word starts (`audio/clean.json` start times); the audio is tightened already, there are no pauses to fill.
- `a.at(t, { pos })` interpolates from the PREVIOUS pos key: hold a position by repeating it at the start of a move.
- Poses blend 0.22 s; `blend: 0` snaps (use on cuts). Faces switch instantly.
- Vine boom: end of the punchline word + 0.05 s, 5-10 per short, never two within ~3 s.

## Before saying done
Stills at the middle of EVERY shot (look at each), `check_layout` clean (no CLIP >= 0.4, CUT, HIDDEN, CAM), no console
errors. The lab's 3 stress tests went from 35 findings to 19 in one pass of fixing what the check reported; the rest were framing
choices that only the stills showed (a mailbox in front of the hero, a camera under an umbrella).
