# Hyperframes Composition Brief: KONVWA

## Objective
Create a 20-second launch-style brag video for KONVWA, a Haitian mobile-first import app.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920×1080
- Duration: 20 seconds

## Source Material
- Project root: `/home/user/Konvwa`
- Primary files read: `src/index.css`, `src/pages/dashboard.tsx`, `src/pages/wallet.tsx`, `src/pages/submit.tsx`
- Product name: KONVWA
- Tagline / strongest claim: "L'import, enfin simple."
- Key UI or visual moment to recreate: KONVWA PAY dark navy card with orange glow; submit form with URL input and HTG price reveal
- Copy that must appear verbatim:
  - "KONVWA PAY"
  - "Votre wallet, en HTG."
  - "Paiement confirmé"
  - "L'import, enfin simple."

## Creative Direction
- Tone preset: app-store
- Creative direction: fintech app for Haiti that doesn't look like it's for Haiti
- Interpretation: Clean, confident, mobile-first. Each scene holds just long enough to feel settled. Restraint IS the statement — no hustle energy.
- Angle: The gap between how premium KONVWA looks and what it does (replace the visa-card nightmare with a phone tap) is where the video lives.
- Hook: Alibaba · Shein · Temu logos arrive, then KONVWA wordmark fades over them.
- Outro / punchline: KONVWA logomark drops center, "L'import, enfin simple." fades in under it.
- Avoid:
  - Generic SaaS language ("streamline your workflow")
  - Abstract filler visuals (gradient washes, particles)
  - Unrelated visual redesign

## Visual Identity
- Background: `#0A1628` (dark navy)
- Text: white / rgba(255,255,255,0.6) for secondary
- Accent: `#F05A28` (orange)
- Card gradient: `linear-gradient(135deg, #0A1628 0%, #162340 55%, #1C2F50 100%)`
- Display font: Poppins (pre-bundled in Hyperframes; KONVWA's brand font — justified use despite monoculture note)
- Body font: Poppins
- Visual references: KONVWA PAY card from dashboard, submit form URL field, wallet MonCash button, dark navy + orange accent throughout

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. Hook: The Three Giants — 3s — Alibaba/Shein/Temu logos, KONVWA wordmark overlay
2. KONVWA PAY Card — 4s — dark gradient card, "Votre wallet, en HTG."
3. Submit a Product URL — 5s — phone frame, URL types in, HTG price counts up
4. MonCash Confirmation — 4s — MonCash button, tap ripple, green "Paiement confirmé" toast
5. Outro — 4s — KONVWA brand name, "L'import, enfin simple."

## Audio
- Audio role: warm corporate bed with clean momentum
- Audio arc: fades in at 0s, carries steady energy through product reveals, fades out under outro hold
- Music: `assets/music/happy-beats-business-moves-vol-1-by-ende-dot-app.mp3`
- Music treatment: volume 0.6, fade in 0s over 0.5s, fade out starts at 18s over 2s
- Music cue guidance: bundled preset; tempo 120.19 BPM (beat ≈ 0.499s); strong cues at 3.02s (card reveal), 4.02s (glow pulse), 16.02s (logo drop), 17.02s (tagline reveal); beat-grid at ≈14.0s for MonCash toast (beat 28 = 13.97s)
- Audio-reactive treatment: subtle — use RMS to make the KONVWA PAY card glow breathe slightly. No waveform bars.
- Audio-coupled moments:
  - Scene 3 — keyboard tick SFX on each URL character typed
  - Scene 3 — subtle counter tick sounds as HTG price counts up
  - Scene 4 — soft UI tap feedback on MonCash button press
  - Scene 4 — short confirmation chime on toast arrival (beat-locked ~14.0s)
- SFX selection guidance: sparse and polished. Card sound for the PAY card reveal, soft keyboard clicks for URL typing, muted tap for MonCash button, clean chime for confirmation toast.
- SFX analysis guidance: use sfx-analysis.md in brag skill assets if present; prefer low high-frequency-risk files for repeated typing sounds
- Exact SFX choice: Hyperframes chooses filenames, timestamps, density, and volume based on implemented animation.
- Audio files: music already copied to `brag-output/composition/assets/music/`
