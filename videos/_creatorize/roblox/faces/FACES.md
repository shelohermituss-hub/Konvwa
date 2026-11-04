# Face decals (2026-10-30: lifted from the reference shorts)

512x512 transparent PNGs, cut from the sharpest frontal close-up of each face in `refs/<n>/<n>.mp4`, skin keyed out
(inpainted skin estimate + Lab distance, head hull mask), Lanczos upscale + light sharpen, centred at ~53 % height.
Build: `python -I tools/faces2_extract.py` (frames + crops -> work/faces2/raw, boxes in tools/faces2_cands.json), then
`python -I tools/faces2_build.py` (face box + options per face in tools/faces2_map.json), then
`python -I tools/faces2_final.py` (old names -> copies, `aliases.json`, `sheet.png`). Check on a head:
`node tools/render.mjs videos/_faces --stills ...` + `python -I tools/faces2_test.py` -> work/faces2/render_test.jpg.
The older drawn set is in `drawn/` (reference only).

**Round 3 (2026-10-30): every face is a clean vector decal.** `python -I tools/faces3_vector.py` traces the ref crops:
colour layers (black lines / white fills / up to 2 colour clusters) against a skin estimate, non-face parts dropped
(per-face `roi` / `drop` / `nolayer` / `inroi` in `tools/faces3.json`), contours -> Chaikin-smoothed paths ->
`work/faces3/svg/<name>.svg` + 4x supersampled PNG. Faces with no usable frame (turned, cut off, blurred, hair over
them) are hand-traced from the ref crops as SVG primitives in `tools/faces3_hand.py`: mom_rage, sweat, teary, o_eyes,
derp_o, glasses_frown, bug_eyes, mom_teeth, leo_smug, plus the new ones below. Then `python -I tools/faces2_final.py`
(aliases + sheet). Run order: faces3_vector -> faces3_hand -> faces2_final. Pre-round-3 PNGs: `work/faces3/bak/`.

**Round 4 (2026-10-30, owner: "weird artifacts"): every traced face is now hand-drawn too** (faces3_hand.py):
blonde_smug, classic_smile, dad_moustache, dion_smirk, glasses_worry, goofy_tongue, happy_derp, kid_cry, meme_man,
moustache_sad, noob_angry, noob_unamused, noob_yell, squint_frown, squint_mad; bug_eyes lost the cheek lines (got a small
frown), glasses_frown lenses pale instead of the grey bar, mom_teeth brows redrawn. Consistent weights (brows 11-14, rims
9-13, mouths 10-14), no grey/half-transparent leftovers. PNGs are downsampled premultiplied with edge colour bled (no
fringe in mips). Engine (rbx.js): max anisotropy, trilinear mipmaps, premultiplied alpha, polygonOffset units -2.
Run now: faces3_hand -> faces2_final (do NOT rerun faces3_vector, it would bring the traced versions back).
Check: work/faces2/render_test.jpg.

| new name | ref | when to use |
|---|---|---|
| mom_red_eyes | momyelling | red spiral eyes, mom losing it |
| girl_o | flower | flower girl surprised: star pupils, o mouth |
| sis_scared | momyelling | big sister scared, huge eyes, frightened mouth |
| mannequin_scream | statue | black eyes, screaming open mouth |
| dad_shock | momyelling | bald dad shocked, moustache over o mouth |
| nerd | testpaper | glasses + buck teeth grin |

| name | old name(s) | ref @ time (s) | when to use |
|---|---|---|---|
| mom_rage | furious | momyelling 1.5 | screaming parent, wrinkles + huge teeth |
| meme_man | | momyelling 14.5 | realistic meme face: stunned dread, awkward silence |
| noob_unamused | sleepy | testpaper 0.0 | half-lidded, unimpressed, bored |
| noob_yell | scream | testpaper 3.5 | V brows, yelling open mouth |
| noob_angry | angry | testpaper 6.5 | outraged wide eyes + angry brows |
| leo_smug | smug | levitate 0.0 | smug sideways half-lidded look, scheming, lying |
| teary | sad | levitate 13.0 | big watery pleading eyes, lonely |
| sweat | scared | monster 5.5 | nervous side-glance with sweat drops |
| moustache_sad | cry | cantcry 2.0 | grumpy moustache frown with one tear |
| goofy_tongue | grin | cantcry 11.5 | goofy happy, tongue out |
| dion_smirk | | cantcry 14.5 | droopy eyes + small v smirk, pretending to be fine |
| blonde_smug | | love 3.0 | side-eye smug smile, flirty |
| dad_moustache | moustache | love 13.0 | curly-moustache dad |
| derp_o | shocked | whistle 1.0 | derpy huge round eyes, tiny mouth |
| squint_frown | | whistle 0.5 | > < squint frown, straining |
| squint_mad | | whistle 3.5 | squinting grumpy frown, annoyed |
| glasses_frown | neutral | whistle 8.0 | glasses, flat unhappy stare, deadpan |
| bug_eyes | nervous | whistle 13.5 | stressed bug eyes with bags |
| mom_teeth | | whistle 14.0 | furious mom, gritted zigzag teeth |
| o_eyes | surprised | flower 2.0 | surprised round eyes, o mouth |
| classic_smile | smile | statue 12.5 | calm classic smile, default |
| kid_cry | sob | shirtcolor 10.0 | bawling, tears, clenched teeth |
| glasses_worry | worried | shirtcolor 12.0 | glasses, worried stare |
| happy_derp | happy | jumpscared 0.0 | big happy open grin, excited |
| evil, monster, love | | (drawn, no clean ref close-up) | villain grin / creature / love-struck |
