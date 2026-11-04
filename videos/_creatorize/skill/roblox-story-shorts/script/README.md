# roblox-story-script: how it plugs into Creatorize (later)

Status 2026-10-30: lab skill in `experiments/roblox-style/skill/`, not wired into the app yet. Trained on the
owner's 9 narrated Roblox story shorts + 3 meme shorts.

## Files
- `SKILL.md`: the rules, workflow, output format with shot hints, checklist, 3 original examples, meme mode.
- `references/formula.md`: measured numbers (258 wpm, lengths, sentence stats), beat shares, twist types, devices.
- `references/examples.md`: the 9 reference scripts annotated beat by beat.

## In New project (when the Roblox story style ships)
- On the Roblox story style, the Script step gets a choice:
  - "I have a voiceover" (upload audio, as today)
  - "I have a script" (paste text)
  - **"Script: write it for me in the Roblox story style"**: an idea field ("a world where yawning puts people to
    sleep", optional), Length (Short 35-52 s / Long 105-115 s), Mode (Narrated story / Meme, no narration), and a
    "Give me 5 ideas" button that returns 5 titles in the `You Can't YAWN...` format to pick from.
- The member's own Claude runs this skill (copied into the project's `.claude/skills/` like the other style skills),
  writes `script.md` in the output format, the app shows it for edits, then voice (their TTS pick) and the build.
- The build's scene builder reads the `> SHOT:` lines (set, who, action, face, camera, text) as its storyboard.
- Wiring later: skill folder -> `templates/skill/roblox-story-script/`, the option in the New project dialog for the
  style, its prompt in `sessions.ts`, a `drive.mjs` scenario that checks the option shows and a fake-Claude script lands.
- Both Windows and Mac: nothing here is platform-specific.
