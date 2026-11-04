# Claude edit errors and usage limits
keywords: usage limit, limit reached, out of usage, resets at, rate limit, rate-limiting, 429, overloaded, 529, claude is already working, claude is working, press stop, busy, git is not installed, can't revert, cannot be reverted, re-apply, no shots to upgrade, ultraedit, unexpected format, build crashed, build stopped, continue the build, resume build, crash, processing for hours, stuck, no sign of progress, ran out of memory, stopped unexpectedly, exit code, quiet for
platforms: both

## The build stopped before it finished (Continue the build)
> The build stopped at: ...
> Claude Code stopped unexpectedly (exit code 1). What it did so far is kept: a build can be continued from where it stopped.
> Claude Code ran out of memory in this long run and stopped. ...
> Claude showed no sign of progress for 20 minutes, so the app stopped this run. What it did so far is kept.
> The app was closed while Claude was building. / The app ended unexpectedly ...

What it means: a long build ended early (Claude Code crashed, the app closed or crashed, you pressed Stop, a limit or an error). Everything it built so far is kept in the project.

Fix:
1. Open the project. The Claude panel shows a card saying where the build stopped, also after a restart of the app.
2. Press **Continue the build** (or type "continue" in the chat). Claude reads what is already built (the scenes, the build's progress notes and its plan) and builds only what is left. After a crash it continues in a fresh conversation, so the conversation that crashed is not loaded again.
3. Don't press Build video again unless you want to start over. **Dismiss** hides the card.

A run that stays silent for a few minutes shows "quiet for N min" on the working line; a long step (a render, a big check) can be quiet. After 20 minutes with no sign of progress the app stops it, and a build can then be continued.

## Usage limit reached
> Your Claude usage limit is reached. It resets at ...
> Your Claude usage limit is reached for now. Try again later, or pick a lighter model in Settings.

What it means: your own Claude plan's limit is used up for now. It is your Claude account's limit, not a Creatorize one.

Fix:
1. Wait until the time shown, then try again. Edits made before the limit stay listed and can be reverted.
2. Meanwhile pick a lighter model in **Settings > AI engines > Model**.

## Overloaded or rate-limited
> Claude is overloaded right now. Try again in a minute.
> Claude is rate-limiting requests right now. Try again in a minute.

Fix: wait a minute and try again.

## Claude is already working
> Claude is already working on this project. Wait for it to finish or press Stop.
> Claude is working on this video. Change ...
> ... when it has finished (or press Stop in the Claude panel).

What it means: one Claude job at a time per project.

Fix: wait until it finishes, or press **Stop** in the Claude panel, then try again.

## Git is not installed
> Git is not installed, so edits cannot be reverted.

Fix:
1. On Windows, in PowerShell: `winget install --id Git.Git -e`. On Mac, in Terminal: `xcode-select --install`
2. Restart the app and check **Settings > System > System check** (Git row green).

## An edit can't be re-applied or undone
> Later edits changed the same lines, so this edit cannot be re-applied automatically. Ask Claude to redo it instead.
> This edit is already undone (reverted or restored past). Use Re-apply to bring it back.
> This edit changed no files.

Fix: follow the message: ask Claude to make the change again, or use **Re-apply**. An edit that changed no files has nothing to undo.

## No shots to upgrade
> There are no shots to upgrade yet: build the video first.

Fix: build the video first, then run Ultraedit.