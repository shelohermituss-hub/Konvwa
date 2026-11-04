# render.md - the render tuner: the fastest settings that look the same, on every machine (2026-10-30)

gruss: "render settings should be always adjusted before the render starts. Meaning claude would automatically pick the
best render settings for the given machine to minimize render time without big perceivable quality loss." And: "it's
known very well that one render task at a time and proper resource management". Code decides, not a prompt: you never
pick render settings by hand for an export, and you never start several Blenders yourself.

## What runs, when
Every export (`src/main/blender/export.ts`, the phase "Tuning the render for this computer") runs
`tools/render_tune.py <film>` before the first frame, then `tools/render_queue.py ... --plan <film>/render_plan.json
--jobs <plan.jobs>`. `render_queue.py --tune` does the same from a terminal.
1. **Machine profile** (cached per machine in `~/.cache/creatorize/render_tuner/machine.json`, `CZ_TUNER_CACHE`): GPU,
   VRAM or unified memory, cores, OS; the free memory is read again every run.
2. **Probe**: the film's longest shot and the shot with the most scene code, each built ONCE in Blender (`run.py
   --tuneprobe`, engine/tune.py). 3 frames (20 / 50 / 80 % of the shot) at the shot's own settings = the reference, then
   every candidate on top of the ones already kept. A candidate is kept only when ALL probe frames pass the quality bar
   against the reference AND it is >= 3 % faster. The second shot re-checks the first shot's set (whole, else knob by knob).
3. **Blenders at once: ONE.** Two only when the parallel test (the probe shot rendered as the export renders it, by 1
   Blender and then by 2 at once) measured >= 15 % more frames a minute with no memory pressure (no swap / compressor
   growth on a Mac, VRAM < 92 %, RAM > 10 % free) and memory allows it (each Blender's measured peak, own + GPU, x2 <
   80 % of free memory).
4. **render_plan.json** in the film: `shot_candidates` (what the first probe shot kept, in order), `settings` (what
   every probed shot passed), jobs and why, every decision with its numbers (time, SSIM, worst block, PSNR), the probe's
   reference vs tuned s/frame, peak memory. Reused while the machine, the kit and the probed scene files are unchanged.
5. **Per shot, in the render's own Blender** (`run.py --plan` -> `tune.shot_plan`, no second build): 2 of the frames it
   renders at the shot's own settings and with the whole candidate set; kept when it passes the bar and is >= 3 %
   faster, else knob by knob (~4 extra renders a shot; prints `CZ TUNE shot kept {...}: a -> b s/frame`). Why: shots
   differ. Cu Chi on the PC: half-res shadows + plant shadow LODs were invisible on e29 (2.28 -> 0.87 s on the probe
   frames) but changed e07's contact shadows (worst block 0.72). Fewer than 8 frames (a re-render of a few) or
   `CZ_TUNE_PER_SHOT=0`: the film's safe `settings`.
Every plan value is a CAP (engine/tune.py `apply`): a shot is never rendered more expensively than it was built.

## The quality bar (engine/tunemetric.py)
Luma SSIM (8x8 window) on the PNG's sRGB values: mean >= 0.985, the worst 32x32 block >= 0.80 (a local drop: a shadow
that went missing, a texture that lost detail), PSNR >= 36 dB, on every probe frame. Calibrated on Cu Chi e29: shadow
maps at half resolution score mean 0.989 / worst block 0.80-0.83 (contact shadows a touch softer in a 3x crop, the full
frames identical by eye) and pass; far plants without shadows (block 0.74), quarter-resolution GI (mean 0.982) and 16 fog
steps (mean 0.976) fail. (The probe once read Blender's LINEAR pixels, which hide differences in the darks: fixed, the
PNG is read as Non-Color = the bytes a viewer sees.) Look at what a candidate changed: `python tools/tune_sheet.py
<film>/.suite/tune/<shot> <candidate>` (reference | tuned | difference x8 | 3x crop of the worst block).

## The knobs (engine/tune.py KNOBS), in the order tried
Measured on Cu Chi e29 (PC, RTX 5080; reference 2.22 s/frame; time vs the reference / vs the set kept so far; quality
vs the reference on the PNG's sRGB values):
| knob | what | Cu Chi e29 |
|---|---|---|
| `scene_gn` 1 | the SCENE PASS (engine/scenepass.py, docs/SCENE_OPTIMIZER.md): static library placements -> one Geometry Nodes instancer per asset (exact matrices, verified) | 174 placements -> 9 instancers, 321 -> 154 objects, 1.00x, SSIM 0.99998 (kept: invisible, not slower; e07 / Basement the same) |
| `scene_lod` 1 / 4 | LOD by screen size from the shot's camera path: 50 / 25 / 10 % tiers where a placement keeps >= k tris per pixel | nothing to cut (the trees fill the frame); forced k 0.05: 0.44x but SSIM 0.926 (rejected) |
| `scene_join` 1 | static meshes in one 8 m cell joined (object-space textures: only parts sharing one matrix) | 44 -> 7, not faster; Basement: 221 of 245 static meshes read object space |
| `shadow_scale` 0.5 / 0.75 | shadow map resolution (D.light sets 1.0) | 0.5: 0.56x, mean 0.989, worst block 0.80 (kept; e07: block 0.71, not kept there) |
| `area_shadows` 0 | the fill / bounce AREA lights cast no shadow | 0.54x with the above, SSIM 0.989 (kept); e07 alone 0.94x, SSIM 0.9997 |
| `shadow_proxy` 0.25 / 0.1 | the instanced library models cast their shadows from a decimated, camera-invisible twin of their mesh | 0.25: 0.39x with the above, block 0.806 (kept); 0.1: block 0.69 (rejected); e07: block 0.63 |
| `point_shadows` 0 | the POINT lamps cast no shadow | block 0.64 (rejected: lamp light through tunnel walls) |
| `far_casters` 30 / 15 | library models (collection instances) that far from every camera position cast no shadow | 30: 0.34x with the above (kept); 15: block 0.74 (rejected) |
| `light_res` 0.004 | fill / bounce / rim lights' shadow texel (m) | no gain |
| `light_threshold` 0.03 / 0.1 | where a local light's reach ends (fewer casters per shadow map) | no gain on top of the shadow set; Basement 0.1: PSNR 35.95 (rejected) |
| `samples` 3 / 2 | EEVEE TAA samples (motion blur, DOF and AA come from them) | alone: 3 = 0.80x (SSIM 0.995), 2 = 0.62x (SSIM 0.986, block 0.906; only the canopy leaves' edges differ). On top of the shadow set: SSIM 0.982 / 0.973 (rejected) |
| `vol_tile` 16, `vol_samples` 16 | the fog's froxel size and steps | no gain / SSIM 0.976 (rejected) |
| `gi_res` / `rt_res` 4, `gi_steps` 4 | screen-space GI / ray tracing resolution and steps | block 0.82 / SSIM 0.984 (rejected) |
| `shadow_steps` 3 | soft shadow ray steps | SSIM 0.982 (rejected) |
| `tex_limit` 2048 | GPU texture size limit (memory only; the library is 2k, 1024 measured no faster) | no change |
Rule of thumb from it: the cost is the plants in the shadow maps, so the gains are shadow-side (resolution, which lights
cast, what casts and at what detail); GI, fog and soft-shadow steps change what the viewer sees and buy little.
(The greedy order matters: once the shadow set is kept, samples 2 no longer passes; alone it would. Not explored yet.)

## What a frame costs (one feature off at a time: `render_tune.py --ablate`, diagnostic only)
Cu Chi e29 on the PC (RTX 5080, 1080x1920, 4 samples, reference 2.23 s/frame, CPU 2.4 cores busy = draw-call
submission): library models 87 %, shadows 77 % (the local lights' 49 %, the sun's 21 %), samples 4 -> 1 59 %, fog volume
15 %, volume shadows 0, scatter 1, ray tracing / GI 1, DOF 1, motion blur 1, people 1. The same frame rendered again
costs the same (2.17 s; the frame change is ~1 ms). e07 (1.56 s/frame): library models 82 %, shadows 68 %.
**The jungle's cost is hundreds of library plants drawn into the shadow maps of 11 shadow-casting lights (D.corners
'both' gives every fill / bounce light a shadow), every TAA sample.** On the Mac mini the same work is GPU time (the M6 GPU 97 % busy, the CPU
idle). Build lessons (PITFALLS): far plants at `lod=` and few shadow-casting fill lights.

## Results (before = the shots' own settings; after = the tuned plan)
PC (RTX 5080, Blender 5.2.3, 1080x1920, cores 4-19), the export's own path (render_queue.py --anim), bench copies of the
mini's projects with 2 shots each (`Documents\Creatorize Nightly\tuner-bench`); quality = every rendered frame after vs before.
| film | before | after | quality over every frame | tuner cost |
|---|---|---|---|---|
| Cu Chi e29 (jungle finale, 112 fr) | 1.90 s/frame | **0.41 s/frame** (shadow 0.5, fill no shadow, plant shadow LOD 0.25, far casters 30) | | 16 s shot check |
| Cu Chi e07 (99 fr) | 1.05 | 1.06 (only far casters passed its frames; built with the cz.light fix, its fill already shadowless) | | 37 s shot check |
| Cu Chi, the 2 shots | 5.4 min | **3.6 min** incl. the shot checks (1 Blender: 2 at once measured +6 %) | mean SSIM 0.9936, min 0.9873, worst block 0.803, PSNR >= 41.8: 0 frames fail | probe 6.1 min (once per film and machine) |
| Basement e12 + e36 (117 fr) | 0.307 / 0.280 s/frame, 43 s | 0.278 / 0.258, 40 s (shadow 0.5; 2 at once measured -45 %) | mean 0.9949, worst block 0.821, PSNR >= 44.2: 0 fail | probe 2.9 min |
| Mac mini M6 | Cu Chi e29 alone 8.1-10.3 s/frame (coordinator, export paused) | pending (the redo job owns the mini) | | |
Earlier plan (before the per-shot step): samples 2 + 2 Blenders for the whole film: Cu Chi 5.4 -> 2.7 min, worst block
0.898. Look at the frames: `tuner-bench\compare-jungle-e29\sheet_tuned.jpg`, `compare-basement-e36\sheet_tuned.jpg`.

## Overrides
- `CZ_RENDER_TUNE=0` (env) or `project.json` `settings.renderTune = false`: the shots' own settings, one Blender.
- `settings.renderTune = {"samples": 8, "jobs": 2}`: those values forced over the tuned ones (not tested).
- A probe that fails (a shot that does not build, a timeout `CZ_TUNE_TIMEOUT`, default 1200 s) = the same safe fallback,
  with the reason in render_plan.json and the export log.
- `CZ_RENDER_AFFINITY=0xFFFF0` (Windows): Blender off cores 0-3 (the owner's PC rule), probes and queue alike.
