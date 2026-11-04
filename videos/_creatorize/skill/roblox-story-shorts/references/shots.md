# Shots: how the reference shorts cut (measured on 5 refs, 187 shots)

## Numbers
- Average shot **1.15 s**; 80 % are 0.3-2.0 s. Longer than 2.5 s only for one continuous action (a float, a slow push).
- A cut lands within ~0.05 s of a **word start** in nearly every case. A new noun or verb = a new shot.
- Framing mix: close / ECU faces ~30 %, medium ~35 %, wide ~25 %, over-the-shoulder ~10 %.
- **Low angle** (camera at knee / waist height looking up) in ~40 % of shots; high / top-down ~10 %.
- Faces change about every 1.5-2 s on the hero; side characters usually hold one face per scene.
- Captions change with the speech, independent of cuts (the engine does this).

## Rules
1. **Literal visualisation.** Every clause gets its own picture: "onions" -> a cop guarding a bowl of onions; "the TV went
   off" -> the dark TV; "the whole world" -> the Earth (`prop('planet')`). Never illustrate abstractly.
2. **Rule -> 3-5 escalating examples -> story -> twist.** Each example is two beats: setup shot, then the consequence /
   reaction shot.
3. **Empty-frame vanish.** Teleports and disappearances = cut to the same framing with the person gone (hide him on the cut,
   `puff(t, a)` + `sfx(t, 'pop/pop')`), or fade him (`a.fadeTo(t0, t1, 0)`).
4. **Punch-in triplets.** Same pose, 2-3 hard cuts closer (wide -> medium -> close) on one sentence to stress it.
5. **Deadpan hero + reaction faces.** The hero keeps a smug / neutral face while everyone else gets shocked / screaming
   faces; ECU faces from a low angle sell the emotion.
6. **Shot / reverse shot** for dialogue: one shot per line, alternating, often over the shoulder.
7. **Camera always moving** (the engine's auto push-in / pull-out does it); bigger authored moves (`to:`) on emotional
   and ending shots; low angle for anything that floats or looms; `shake()` on impacts, `roll` for a dutch tilt on chaos.
8. **Physical gags:** stiff faint (`faint` then `lie`), shoved into lockers (`shove`), floating arms out (`float`), lying
   stiff on a counter or bed, dragged away (`drag` + `pull`), crawling (`crawl`).
9. **HUD devices** when the rule is a number: `counter()` by the head, `title()` for "ONE WEEK LATER", `label()` for names.

## Camera recipes (9:16 portrait: frames are narrow, people are wide)
| shot | pos | look | fov |
|---|---|---|---|
| close-up (face + shoulders) | `rel(a, [0, 4.6, 4.4])` | `head(a)` | 40-46 |
| ECU (face fills) | `rel(a, [0, 4.6, 3.2])` | `head(a)` | 38-42 |
| medium (waist up) | `rel(a, [-1, 4.4, 7.5])` | `head(a, [0, -.9, 0])` | 45-50 |
| full body | `rel(a, [-1.2, 4, 10])` | `head(a, [0, -1.8, 0])` | 50 |
| low angle hero | `rel(a, [-1.2, 1.6, 3.6])` | `head(a)` | 55-62 |
| low angle at a floater | `rel(a, [-3.4, 2.8, -4.5])` | `[x, 7, z]` | 62 |
| over the shoulder A -> B | world point behind A on the line A-B, ~3 to the side, y 5.5-6 | `head(B, [0, -.8, 0])` | 45-50 |
| wide establishing | 12-18 back, y 6-8 | the middle of the action at y 3 | 55-60 |
| top-down on someone lying | `[x, 12, z + .5]` | `[x, 0, z]` | 50 |
`rel(a, [dx, dy, dz])`: dx > 0 = his left, dz > 0 = in front of him. A close-up from in front only works if he faces the
camera side: decide where each person faces before placing cameras.

## Per-beat checklist
- Cut on the first word of the beat. Hero face changes on this beat? Pose changes? Reaction shot after a gag?
- Is the subject's head fully in frame (9:16 is narrow: two people side by side need a wide or an OTS)?
- Anything between the camera and the subject (a prop, a crowd, a wall, a door)? Move the camera, not the subject.
- Punchline beat: vine boom at the end of the last word (+0.05 s), often with a punch-in or `shake()`.
