# QA: the gates

1. **check_layout says Clean (or Clean for export)**: every shot builds and no overlap is left (CZ CONTACT through,
   floating, coplanar from 12 px, cutaway, camclip; a sweep finding is a clip between two checked frames: fix it the same
   way). Fix each at its cause or declare it intended (contact.md), never by moving the camera away. The app runs the same
   check before the export and refuses while one overlap or one broken shot is listed.
   Notes, never blockers: a camera, HOLD, FOOTSLIDE, PARTIAL or CHECKFAIL line. Give each ONE fix at its cause
   (camera.md, humans.md), then write it in storyboard.md and move on; never loop on it. PARTIAL = the check ran out of
   time: LOOK at the frames it names; CHECKFAIL = that shot was not checked: look at it by eye; CONTACTINFO lines (hidden
   overlaps, z-fights under 12 px) are information. A camera note on a tour shot (CAMERA (note): TOUR, CZ CAMTOUR)
   belongs to the TOUR in common.py (the director retimes its stops once), never to a private camera.
   Camera target: `CZ CAM` jerk <= 900 %/s3 and 0 jerky frames (the same measure as tools/camstats.py).
   Never run Blender or tools/signoff.py yourself during a build (the blender / signoff / camreplay command lines in other
   docs are for the engine's own tests).
   Export anyway with overlaps ONLY when the user asks for it: project.json `"settings": {"overlapGate": false}`.
2. render_frames start / middle / end of every shot at scale 0.5 (the middle = the shot's X-ray word), and LOOK at each:
   - the clause shown literally (the step being done, on its word)
   - the green X-ray on the named thing on its word, inside the frame
   - real things are library assets (no Python tree, car, rock or tool), models detailed (no plain boxes)
   - nothing clipping, floating or flickering that the check can't see (a clip hidden by motion blur, a gap under a
     moving prop, a hand beside its prop)
   - the detail bar (detail.md, 8 lines): no flat surface over 10 % of the frame, material truth (scans), edges,
     ground edges broken, far things in a little air, rim on the subject, life, still clean (no speckle near the X-ray);
     no `CZ DETAIL WARN` line left (a scan id missing from the cache, a relief face that got no skin)
   - light: a hard low sun with long shadows, a darker shade side, rim on silhouettes, specular on metal and water
   - the frame filled: the subject 50-80 % of the frame height, foreground / midground / background
   - the camera: cuts mode = the start and end frames differ and both edges are still; tour shots = the same set as the
     neighbouring part
3. **Tour seams**: the export's assemble prints `SEAM` per tour join (SEAMFAIL over 2.5 = a part's set differs from its
   neighbour: same set in every part of a tour).
4. **Credits**: every library asset is in `.suite/CREDITS.json` (the engine writes it as shots place assets) with a CC0 /
   CC-BY / public-domain licence and in DESCRIPTION.txt (CC-BY authors named). No `CZ ASSET WARN` lines left in the shot
   logs (every low-poly or NASA model was given a size).
5. The look numbers (the export grades toward them automatically): brightness ~98, saturation ~101, contrast ~58 on
   0-255 frames measured like the owner's reference. Too flat = a lower sun, darker fill (M.setup light_k 1.0-1.3).
6. Speed: a frame under ~1.5 s at full size (render_frames prints the time per frame); the detail pass adds ~0.1-0.25 s.
