# storyboard.md template (copy it into the project as storyboard.md and fill it in)

The header lines come first: every agent of a crew reads them before its rows.

```
# <title> - storyboard

Camera: cuts | cutless | mixed (tours: e05-e09, e20-e24)
Why: <one line: one world travelled through -> cutless; jumps of place, scale or time, or a list of things -> cuts>
Master framing: <a cutaway film: the one framing most shots return to; else "none">
Assets: tree -> ph:tree_small_02 (height 6, lod 0.25 far) | car -> kenney:car-kit/sedan (width 4.4 = its length: width= is the longest footprint side) | ground -> ph:forrest_ground_01 | sky -> ph:<hdri>
People: <none> | worker (male, Walk_Carry_Loop, cardboard box|carry) in e12-e14; engineer (female, Idle_Talking_Loop, can|wrap) e20
Section: <a cutaway: contact.section((0, -3.5, 0), (0, -1, 0), 'section', box=(...)) in common.world(); else "none">

## The idea, step by step
<the chain of steps the narration walks through>

## The set
<one design all film long: scale (1 unit = 1 m), the hero models, the light (sun_rot / elev), what is library and what
is modelled in Python>

## Shots (30 fps, frame = round(s*30)+1, F0-F1 contiguous from 1 to the end)
| # | F0-F1 | clause | picture (what moves / is built on which word) | green X-ray (thing, word, frame) | camera |
|---|---|---|---|---|---|
| 01 | 1-48 | ... | ... | the hole on "hole" f19 | push in + down (cuts: one eased move, rest to rest) |
| 05 | 166-221 | ... | ... | ... | tour: hold on the pump (stop 2) |
| 06 | 222-281 | ... | ... | ... | tour: travel to the drain (stop 3), hold |
```

## The camera mode (camera.md)
- **cutless** when the story stays in ONE world the viewer can travel through (one machine, one building, one
  cross-section, one process in one place) and the clauses name parts of it: a stop every 2-3 clauses (hold on the
  word that names it), travel between stops; tour shots 4-6 s, 3-8 stops per tour, legs >= 1.5 s, holds 0.4-0.8 s, and
  each leg turns at most ~12 deg per second of leg (the 20 deg/s cap: far-apart stops at nearly the same yaw, further
  away; a reverse angle goes on a cut). The TOUR is written in common.py before any shot of the group; its
  `CZ CAMTOUR` / `CZ CAMCAP .. tour` lines are the director's to retime, once.
- **cuts** when the story jumps place, scale or time (outside -> inside, a map -> a detail, then -> now), or the clauses
  are a list of separate things. Each shot one eased move, the cut on rest; `dips` (a cut through black) only where
  time passes.
- **mixed**: a tour per continuous stretch, cuts between them.

assemble.json follows the header: `{"dir": "shots", "shots": [...], "camera": "cuts" | "cutless" | "mixed",
"tours": [["e05", "e06", "e07", "e08", "e09"]], "dips": [["e14", "e15", 6]], "dissolves": []}`.
