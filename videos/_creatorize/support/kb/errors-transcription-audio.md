# Transcription and audio step errors
keywords: transcription, transcriber, time words, clean audio, clean and time, python not found, ffmpeg, audio step, mix failed, no words could be timed, parakeet, setup failed, did not pass the test, winerror 4551, smart app control, application control policy, blocked by windows
platforms: both

## Python or ffmpeg was not found
> Python was not found. Install it, or set its path in Settings > System > Tool paths...
> ... could not run ffmpeg. Install it or set its path in Settings > System > Tool paths.

What it means: the audio steps need Python and ffmpeg on this computer.

Fix:
1. Open **Settings > System > System check**.
2. Install what is missing. On Windows, in PowerShell: `winget install --id Python.Python.3.12 -e` and `winget install --id Gyan.FFmpeg -e`. On Mac, in Terminal: `brew install python` and `brew install ffmpeg` (no Homebrew yet? Get it from brew.sh first).
3. Restart the app and press **Run checks**. Still not found? Set the path in **Settings > System > Tool paths**.

## Another audio step is running
> Another audio step is still running for this project.

Fix: wait for it to finish (or cancel it), then try again.

## Transcription setup failed
> Transcription setup did not pass the test after three tries.
> The transcriber's own Python environment is missing " ...

Fix:
1. Make sure Claude is signed in (**Settings > AI engines**).
2. In **Settings > System > System check**, on the Transcription row click **Set up with Claude** (or **Redo with Claude**).
3. Still failing? Click **Help > Report a problem** so it gets fixed.

## No words could be timed
> No words could be timed. Check that the voiceover is speech and that script.txt matches it.

Fix:
1. Check that the voiceover file really has the narration in it.
2. Make sure the script matches what is said, then press **Time words** again.

## Nothing to mix
> There is no voiceover to mix yet. Add the voiceover (first step), then run this step again.

Fix: add the voiceover first, then run the step again.

## The mix failed
> The mix failed: ...

Fix: run the step again. If it fails again, click **Help > Report a problem** so it gets fixed.

## Windows blocked it: Smart App Control (WinError 4551)
> Windows blocked part of it: Smart App Control (or an App Control policy) stops Python's packages from loading (WinError 4551).
> ... blocked by application control policy ...

Windows only (a Mac has nothing like it). What it means: Windows 11's Smart App Control only lets signed programs run. The Python packages transcription and the audio steps use are not signed, so Windows refuses to load them. The installer and **Settings > System > System check** (the **Smart App Control** row) tell you when it is On.

Fix:
1. Open **Windows Security > App & browser control > Smart App Control settings** and pick **Off**.
2. Restart Creatorize Suite and run the step (or the transcription setup) again.

Be aware before you turn it off: Smart App Control has no exceptions for single apps, and on a Windows that is not up to date, Windows can only turn it back on by resetting or reinstalling Windows (up-to-date Windows 11 lets you turn it on again in the same place). Your antivirus (Microsoft Defender) keeps protecting the PC either way.

If Smart App Control is already Off and it still says this, your organization's App Control policy blocks it: ask whoever manages this PC.
