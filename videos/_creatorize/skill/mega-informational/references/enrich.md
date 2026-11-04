# The enrich loop (Ultraedit only, on a clock)

The app runs the Ultraedit on a clock: every render_frames / enrich_frame / check_layout result says the minutes used of
its budget, and at the limit they answer "finish now". Spend each call where the picture will change.

1. enrich_frame(t, note) on the ONE key moment of a shot (its widest framing): the app renders YOUR frame (the previs)
   and sends only that frame to the image service (Google Flow); it returns the SAME render, richer: hard-surface
   detail, debris, decals, lamps, atmosphere, better light. targets/<shot>_<frame>_enriched.png. ONE enrich_frame per
   message (each takes 30-90 s; calls sent together only wait in a queue). One per shot: a second one is refused.
   Order: the shots that carry the video first (the opening, the reveals, the climax), then the others while the clock lasts.
2. LOOK at the target: it must show YOUR shot (same camera, same objects). The app throws away a target of another
   scene; then dress that shot from your own judgement and go on.
3. Build its biggest extras for real in your files: panel lines and bolts as geometry, decals for flat things (labels,
   stripes, signs), debris scattered with M.scatter, lamps as emissive parts, haze / clouds as cloud cards.
4. ONE render_frames at that moment and compare with the target: density, light, contrast.
   STOP RULE: at most 2 build-and-compare rounds per shot, then the next shot. A render that comes back NOTHING CHANGED
   (byte-identical to the previous one) ends that shot: your edit did not reach the frame (the wrong object, file or
   frame range). Never render a moment again just to check it; a moment that comes back identical twice is closed.
Standard and Verified: no enrich loop (never call enrich_frame).
