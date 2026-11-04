# rbx engine API (Roblox story shorts, 1080x1920)

> **In a Creatorize project** (this file is copied into the build skill as `references/api.md`): the scene is
> `scenes/scene.js` and imports from `'../engine.js'` (not `'../../engine/rbx.js'`); words are `captions('audio/clean.json')`
> (already tightened: write the scene in that time, there is no timemap); hand-written SFX cues go in `audio/sfx.json`.
> There is no `tools/render.mjs` / `tools/check.mjs` in a project: use the app's `render_frames` (stills) and
> `check_layout` (the same CLIP / CUT / HIDDEN / CAM clip check) tools. Everything else below is the same.

A video = `videos/<name>/scene.js` + `audio.wav` (+ `words.json`, the Parakeet JSON copied from `refs/<n>/<n>.json`).
Render: `node tools/render.mjs videos/<name> --stills 1,5,9` (PNG stills in `out/`), then `node tools/render.mjs videos/<name>`
(mp4 in `out/<name>.mp4`, ~130 fps). Paths in a scene are relative to the video folder. Everything is declared up front;
the engine evaluates it at time t (seconds). Never use Math.random or clocks (use `rng(seed)`).

```js
import { video, set, avatar, cam, captions, rel, head, shake, flash, prop } from '../../engine/rbx.js';
video({ duration: 32.4 });
set('hallway');
captions('words.json');
const leo = avatar({ shirt: { color: '#1f4fd1', sleeves: 'none' }, hair: 'curly', hairColor: '#ddd', face: 'smug', pos: [0, 0, 0], rotY: 180 });
leo.at(2, { pose: 'walk' }).at(2, { pos: [0, 0, 0] }).at(4, { pos: [0, 0, -6], pose: 'idle', face: 'scared' });
cam(0, 2, { pos: rel(leo, [-1.2, 4, 8.5]), look: head(leo, [0, -.9, 0]), fov: 45, to: { pos: rel(leo, [-1, 4, 7.6]) } });
```

## Units and coordinates
1 unit = 1 stud. y up, floor y = 0. An avatar is ~5.3 tall (legs 0-2, torso 2-4, head top ~5.2). Ceilings are at y = 10.
`rotY` in DEGREES. rotY 0 = avatar faces +z; 180 = faces -z; 90 = faces +x.

## video({ duration })
Length in seconds. If omitted: last caption word end + 0.5 (or 5).

## avatar(opts) -> a
`{ skin:'#f2c99b', shirt:{ color, pattern?, sleeves? }, pants:{ color, shoes? }, hair, hairColor, hatColor?, face:'smile', pos:[x,y,z], rotY, scale?, accessory? }`
- shirt.pattern: `plain stripes hoodie suit tie logo torn`. shirt.sleeves: `short` (default) | `long` | `none` (bare arms).
- pants.shoes: a colour for the feet. shirt / pants may also be a plain colour string.
- hair: `messy spiky bun long bald cap fedora curly` (cap/fedora use `hatColor`). accessory: `glasses`.
- scale: 0.7 = a small kid, 1.5 = a giant.

### a.at(t, key) - keyframes (chainable)
key fields (any subset): `pos:[x,y,z]`, `rotY` (deg), `pose`, `face`, `ease`, `visible`, `blend`.
- pos is interpolated between the keys that set pos (default ease `inOut`; `linear` automatically while walking/running;
  set `ease:'linear'|'in'|'out'|'smooth'|'inOut'` on the LATER key). Hold a position by repeating it at the start of a move:
  `.at(3, {pos:[0,0,0]}).at(4, {pos:[0,0,-5]})`.
- rotY turns over the last 0.35 s before the key that sets it.
- pose / face / visible switch at the key time. Poses blend over 0.22 s (`blend: 0` = snap).
- Shortcuts: `a.face(name, t=0)`, `a.pose(name, t=0)`, `a.hide(t)`, `a.show(t)`.

Poses: `idle talk walk run jump float fall flail sit crouch point armsUp faint lie hug cry wave shove scared shrug facepalm sleep`
- float = slow bob, arms out, legs dangling (combine with pos keys going up). fall = arms up flailing (use while pos goes down).
- faint = tips over backward onto the floor in 0.45 s and stays (then `lie` keeps him there). sit = legs forward, hips 0.5 lower
  (put him on a chair seat: chair seat top is y 1.7, so pos y ≈ 0.7 sitting on a chair, 0 = sitting on the floor looks like on a low stool).
- shove: arms thrust forward in 0.18 s. point: right arm forward. wave: right arm up waving. cry: hands to face, head down, sobbing.
- jump pose = arms straight up (Roblox jump); move pos.y up/down yourself.

Faces (PNG decals in engine/faces/): `smile happy grin smug worried scared shocked cry sob angry furious sad sleepy neutral surprised evil monster`
(+ any other `faces/<name>.png`; a missing file gets a drawn placeholder).

## Camera
`cam(t0, t1, { pos, look, fov=50, to:{ pos, look, fov }, ease='inOut' })` - one shot; a shot runs until the next shot's t0 (hard cut).
`to` = slow push/pan towards those values over t0..t1.
**Every shot moves by default** (owner: the camera is never stationary). A shot without `to` gets an automatic dolly along
its view line: auto shots alternate push-in (authored pos -> closer) and pull-out (closer -> authored pos), so the camera
never goes behind the authored pos. Travel = 12 %/s of the camera-to-look distance x shot length, clamped 10-18 %, ease
in-out; shots < 1 s get a 10 % ease-out punch-in. Plus a tiny drift (1.2 % of the distance sideways/up). Shot length =
until the next shot's t0. `still: true` turns it off for one shot; tune globally with `CAMDEF` (`rate min max punch
punchAmt outEvery drift`, `outEvery: 0` = push-ins only). Ref measurement (tools/camref.py, 114 ref shots): median
|zoom| 17.5 %/s, 81 % push-ins, 3 % static, so authored `to` moves can be bolder than the default.
pos / look accept:
- `[x,y,z]` world point; an avatar (look = its head);
- `rel(a, [dx,dy,dz])` = point in a's own frame that follows a (dx>0 = his left, dz>0 = in front of him, dy = height from his feet);
- `head(a, [dx,dy,dz])` = offset from the centre of a's head (follows him, also when he floats).
Recipes: close-up `pos: rel(a,[0,4.6,3.2]), look: head(a)`, fov 40; over-the-shoulder from behind A at B:
`pos: rel(A,[-3,6,-5.5]), look: head(B,[0,-.8,0])`; low angle up at a floater `pos: rel(A,[-3.4,2.8,-4.5]), look:[x, 7, z]`, fov 62.
Effects: `shake(t, amt=.3, dur=.45)`, `flash(t, dur=.25, color='#fff')`, `fade(t0, t1, color='#000', from=0, to=1)`, `lines(t0, t1)` (white speed lines).

## Sets and props
`set(name)` builds one location at the origin with its lighting:
- `hallway` / `school_night_hallway`: 12 wide (x -6..6), runs along z from +20 to -70, lockers on both walls, doors at z -51, -25, 1
  (CLASS 8B sign at z 1 on the -x wall), ceiling lights. Stand people at x -3..3.
- `classroom`: 26x26 centred on 0, whiteboard on the -z wall, teacher desk (-7,-8), 3x3 student desks at x -6/0/6, z -2/3/8 (chairs just +z of them), windows on +x wall.
- `bedroom`: 18x18, carpet, bunk bed at (-5, -4.6) (lower mattress top y 2.4, upper y 7.2), window -z wall, wardrobe, lamp, rug.
- `house_kitchen`: 20x18, counter + fridge on -z wall, table at (0,2) with chairs at x ±3.2.
- `livingroom`: 22x18, wood floor, couch at (0,4) facing -z, TV on -z wall, rug, lamp, plant.
- `outside_school`: grass, path along z, brick school facade at z -20 (door at x 0), trees, sky. Daylight.
- `park`: grass, path along z, trees, benches at (-5,-4) and (5,6), flower bed near (-4, 10). Daylight.
Several locations in one video: `const B = place('bedroom', [300,0,0])` builds a second set 300 units away; then
`useLight(t, B)` switches lighting to it at t. `set()` returns its own lighting too: `const A = set(...)`, then `useLight(9, A)` switches back.
`light('day'|'indoor'|'night', overrides)` re-lights by hand.

`prop(name, { pos, rotY, scale, color, ...})` -> THREE.Group. Names:
`locker lockers(n,colors) desk chair door bed bunkbed table cookie phone flower tree lamp ceiling_light bench couch tv fridge counter(w) whiteboard(w) window(w,h,night) plant wardrobe rug(w,d) trashcan sign(text,bg)`.
Props are static; move them with `onFrame(t => { g.position.y = ... })` (deterministic functions of t only).
A cookie in a hand: `onFrame(t => { g.position.copy(rel(a, [-1.5, 2, .6])()) })`.

## Captions
`captions('words.json', { offset=0, until, max=7 })`: phrase chunks of 2-7 words, breaking at punctuation and pauses > 0.45 s;
white Nunito Black, dark outline + shadow, centred at 22 % height, 1-2 balanced lines. `offset` shifts (word time - offset).
`caption(t0, t1, text)` adds a manual one. Tweak globally: `CAP.size` (66), `CAP.y` (.22), `CAP.upper` (all caps).

## Clip check
`node tools/check.mjs videos/<name> [--samples 8] [--frames] [--md]` samples every shot and prints
`CLIP` (avatar part inside a set/prop/other avatar, OBB depth; `minor` < 0.4), `CUT` (the shot's subject head cut by the
frame edge), `HIDDEN` (a near avatar fully behind a set/prop surface), `CAM` (camera inside a solid box or an avatar part).
Ignored as normal contacts: resting on top of something (feet on floor), sit/lie/sleep/faint/crouch poses against
furniture, hug/shove poses between avatars, props smaller than 0.8, people whose head is < 24 px tall. `--frames` saves a
jpg per finding in `out/check/`, `--md` writes `CLIPS.md`. Names = the scene variable that made the avatar (`x#k` in loops).
rbx.js hooks it uses: `window.__rbx = { state, poseAt(t), collidables(), THREE, CAMDEF }`, `prop()` groups carry
`userData.prop`, room planes `userData.kind` (floor / wall / ceiling).

## Misc
`rng(seed)` -> deterministic random(). `THREE`, `scene`, `camera`, `mat(color)`, `box(w,h,d,color,[x,y,z])` (y = bottom) for custom builds.

## Any topic (2026-10-31): sets, kits, props, animals, vehicles, people helpers
Everything below is additive; all calls above still work. Catalog stills: `node tools/render.mjs videos/_kit --stills 0.5,1.5,...`.

### More sets: `set(name, opts)` / `place(name, at, opts)`
`house_hallway` (8 wide, z -18..18, doors both walls, runner rug), `bathroom` (14x12: toilet (-4.5,-4.9), sink + mirror on -z,
bathtub (4.8,-1.5)), `office` (28x24: 4 cubicles at x -7/1, z -5/4, windows +x), `hospital` (24x20: beds at x -7 / 5, z -4.6,
mattress top y 2.6), `pizzeria` = `restaurant` (checker floor, counter + oven on -z, booths on +x, tables at (-6,1) (0,6) with chairs),
`store` = `supermarket` (32x28, h 12: shelf aisles at x -6.75 / 0 / 6.75 between rows, registers at (-6,7) (2,7)), `mall` (34x60,
h 16, shop fronts on both walls, `opts.shops: ['GAMES',...]`), `car_interior` (car facing -z at the origin, road scrolling past:
front seats x -2.2 (driver, pose `sitDrive`) / 2.2, back bench z 3.6 (x ±2.2); sit pos y 0.7, rotY 180; front view `pos [0,4.6,-6.5]`; walls x ±3.6, keep cameras inside x -3..3; `opts.color`),
`house_exterior` = `neighborhood` (house facing +z at z -4.5, front door z 1, path, driveway + car at x 8.5, sidewalk z 13 (top y .25),
road z 15..25), `city_street` = `street` (road along z x -7..7, sidewalks x ±7..12 (top y .3), buildings, crosswalk z 8, `opts.light`),
`beach` (sand, sea at z < -10), `forest` (dirt path x -2.5..2.5 along z), `desert`, `snow` (falling snow, `opts.snowfall:false`),
`space` = `moon` (moon ground, Earth in the sky, `opts.ground:false` = empty space), `pool_room` = `pool` (pool 20x12 at z -3:
water y 2.2, people inside stand at y 0 = waist deep).
`opts`: `night: true` (most sets), `h` (ceiling height of room sets, e.g. 16 for giants), `ceiling: false` (no ceiling at all).

### Your own location: `room(o)` / `outdoor(o)`
- `room({ w:20, d:18, h:10, floor:'wood'|'tile'|'carpet'|'checker'|'concrete'|colour, floorColor, floorColor2, wall:'#e8e2d6', wallLow, ceiling:true,
  windows:[{ wall:'back'|'front'|'left'|'right', at:0, y:3, w:5, h:4 }], doors:[{ wall, at, color }], night, at:[x,y,z] })`.
  back = -z wall, front = +z, left = -x, right = +x; `at` = offset along that wall. Without `at` it is the main set (like
  `set()`), with `at` it is another location (like `place()`). Returns the light for `useLight()`.
- `outdoor({ ground:'grass'|'sand'|'snow'|'concrete'|'asphalt'|'dirt'|'moon'|colour, sky:'day'|'sunset'|'night'|'overcast'|'hot'|'space'|'underwater',
  path:{ w, len, kind, alongX }, props:[['tree',{pos:[...]}], ...], fog:true, at })`.

### Props: `prop(name, opts)` (front = +z, y 0 = floor; `color` where it makes sense)
Animals: `dog cat bird penguin fish shark dinosaur (trex) cow`. Vehicles: `car bus (text) bike boat rocket (flame) ufo (beam)`.
Indoor: `shelf (w, seed) register office_desk (top y 2.6) computer laptop office_chair (seat y 1.7) cubicle water_cooler
hospital_bed iv_stand heart_monitor curtain (w) toilet (seat y 1.7) sink mirror bathtub (water:false) pizza_oven booth (seat y 1.6)
pizza cake burger cup book bookshelf painting (seed) clock crate ball (r) gift money trophy portal (r, color) tombstone (text) stairs (n, w)`.
Outdoor: `palm pine (snow) rock (size) cactus snowman igloo umbrella towel street_lamp (on) traffic_light (state) building (w,h,d,lit)
house (color, roof) fence (w) mailbox log bush cloud planet (r, kind: earth|mars|moon|sun, ring) pyramid dune ice water (w,d,y) pool (w,d)`.
Surface heights to put things ON: table 2.9, desk 2.6, office_desk 2.6, counter 3.25, kitchen counter 3.25, bed mattress 2.4.
- `sign(text, { pos, rotY, bg, color, h:1.2, w (auto from the text), post:true })` a sign sized to its text ('\n' = new line).
- `build(parts, { pos, rotY, scale })` anything the catalog lacks, from primitives:
  `{ box:[w,h,d] | cyl:[rTop,rBot,h] | ball:r | cone:[r,h] | torus:[r,tube] | text:'HI', size:[w,h], bg, fg, at:[x,y,z], color, rot:[x,y,z] deg, r (round), glow, opacity, scale:[x,y,z] }`
  (`at` = bottom centre for box/cyl/cone/text, centre for ball/torus). E.g. a lamp post `build([{cyl:[.15,.2,8],color:'#333'},{ball:.6,at:[0,8.3,0],glow:true,color:'#fff3c8'}])`.

### Moving things: `thing(name|group, opts)` = `animal()` = `vehicle()`
`const dog = animal('dog', { pos:[2,0,0], rotY: 90 }); dog.at(1, { pos:[2,0,0], anim:'walk' }).at(3, { pos:[10,0,0] }).at(3, { anim:'idle' })`
Keys like avatars: `pos rotY scale visible ease anim`; `.hide(t) .show(t)`; `.g` = the group. anim: `walk run` (legs swing), `fly`
(wings flap), `swim bob hop spin`, `drive` (wheels spin; they also spin while pos moves), `chomp roar` (dinosaur jaw), `launch` (rocket flame).

### People helpers
- `avatar({ ..., shirt:{ color, text:'I LIED', textColor }, hair, accessory:['beard', {kind:'cape', color:'#c00'}], opacity })`.
  hair (+ hats): `bald messy spiky bun long curly cap fedora pigtails ponytail quiff afro mohawk buzz tophat cowboy beanie hood helmet chef party crown long_straight`
  (`hatColor` colours hats / hood / helmet). accessory: `glasses sunglasses beard moustache mask headphones crown halo horns backpack cape scarf bowtie necklace tail wings`.
- New poses: `lookUp lookDown hugKnees sitFloor sitTalk sitGesture sitShrug sitCry crawl drag (being dragged, on his back) pull (the dragger)
  kneel cheer think swim punch kick dance carry holdUp phone eat clap salute bow handsHips crossArms tPose zombie reach hide sneak climb stretch freeze`.
  `sitFloor` / `hugKnees` = on the floor at pos y 0; `sit*` = on a chair (pos y 0.7). `swim` lies face down (put pos y at the water line - 1).
- Keys `headPitch` (deg, + = looks up) and `headYaw` (deg, + = turns to his left): `a.at(4, { headPitch: 30 })`.
- Key `sit: true` keeps the legs seated under ANY pose (`{ pose: 'phone', sit: true }`), `sit: 'floor'` on the floor, `sit: false` stands. Seated poses: `sit sitTalk sitGesture sitShrug sitCry sitDrive`.
- Opacity: `a.at(t, { opacity: .4 })` or `a.fadeTo(t0, t1, 0)` (ghosts, vanishing, invisible people). `avatar({ opacity: .5 })`.
- `lineUp(people | n, { at:[x,y,z], dir:'x'|'z'|deg, gap:4.4, rotY })` -> avatars in a row (people = avatar options or avatars).
- `crowd(n, { center, w, d, gap:4.4, face:[x,z] | rotY, seed, looks, pose, faceName })` -> n people spread over w x d, never
  inside props, never closer than `gap`, all facing `face` (default: towards +z = the usual camera side).
- `randomLook(seed)` -> avatar options for an extra (skin, clothes, hair, face).
- `hold(a, g | 'propName', { hand:'right'|'left'|'both', t0, t1, opts, grip:[x,y,z] })`: the prop floats in front of his hand, upright, follows every pose (`grip` = the prop's own point that goes in the fist; the umbrella has one).
- `attach(a, g, { to:'head'|'body'|'back'|'rhand'|'lhand', off, rot, t0, t1 })`: glue a build() to a body part (hat, mask, jetpack).
- Avatars never poke through a ceiling: a floater (pos y > 0.25) is pushed down until his top clears it (`avatar({ ceiling:false })`
  turns that off). `ceilingAt(x, z)` = the ceiling height there.
- `breakCeiling(t, { x, z, w:4, d:4, above:'sky'|'night'|'space'|colour })`: at t the ceiling over (x,z) bursts open (jagged hole,
  falling chunks, sky above); floaters may then pass through it there.

### Camera + effects
- `cam(..., { roll: 12, to: { roll: -8 } })` dutch angle in degrees.
- `puff(t, where, size=1)` smoke burst (teleport / appear / vanish; where = [x,y,z], an avatar or a function).
- `particles(t0, t1, { kind:'confetti'|'rain'|'snow'|'sparkle'|'smoke'|'fire'|'bubbles'|'hearts'|'money', at: [x,y,z] | avatar, area:[w,h,d], n, color, size })`.
- `title(t0, t1, 'THE NEXT DAY', { y:.42, size:96, color, bg })` big screen text that pops in; `label(target, 'BRAD', { t0, t1, off, color, size })`
  text floating over an avatar / thing / point.

## SFX (2026-10-30)
Owner's rule: the **vine boom is the star**: 5-10 per short, on the dead joke / punchline beat (t = end of the punchline
word + ~0.05 s). Everything else is a quiet layer under the voice: woosh on fast moves / dives / cuts, pop on teleports
and things appearing, impact on falls, a riser into the twist, a meme sting (huh, bonk) rarely.
- Library: `engine/sfx/<category>/<name>.wav` + `engine/sfx/catalog.json` (name, file, category, duration, default gain
  dB, use-when). Rebuild: `python tools/sfxlib.py` (reads the pack on E:, read-only). Names: `vine_boom`, `bass_drop`,
  `meme/{bonk,huh,ding,wrong,right,correct,money,bell}`, `pop/{pop,pop2,pop3,ping}`,
  `woosh/{swoosh,short,deep,simple,reverse,cloth1,cloth2,smooth,power}`, `impact/{thud,punch,hit,heavy,big_boom,crash,glass}`,
  `riser/{riser,short,easy,rising}`, `fx/{glitch,shine,camera,explosion,spin,slurp}`. A bare name works when unique (`pop` is not: use `pop/pop`).
- Cues, either way (both are merged): `videos/<name>/sfx.json` = `[{t, name, gain?, align?, note?}]`, or in scene.js
  `sfx(t, name, { gain, align })` (recorded into `window.__sfx`, no sound in the page). `gain` = dB on top of the
  catalog default; `align: 'end'` makes the sound END at t (risers, `woosh/reverse`).
- Mix: `python tools/mix.py videos/<name>` -> `mix.wav`: voice to -14 LUFS, layers ducked up to 9 dB under speech, booms
  not ducked (voice dips 3 dB under them), true-peak limiter at -1.2 dBTP. `render.mjs` runs it by itself when cues exist and
  muxes `mix.wav`; videos without cues render exactly as before.
- Word times for placing cues: `python tools/words.py videos/<name> [filter]`.
- Dead air (2026-10-30): `python tools/tighten.py videos/<name>` cuts every pause > 0.08 s (word gaps + silent runs) to 0.05 s, 10 ms crossfades; keeps audio.orig.wav/.json, writes timemap.json. scene.js and sfx cues stay in OLD time: index.html renders old(t), captions and mix.py map by themselves. Use `audio.orig.json` word times (words.py) when writing a scene. Undo: `--undo`.
- Levels: mix.py level-matches every sound to the voice (booms +9 dB over speech like the refs, layers -4 dB ducked 3), mix at -14 LUFS; compare with `python tools/loudstats.py <mix> refs/<n>/<n>.wav`.
