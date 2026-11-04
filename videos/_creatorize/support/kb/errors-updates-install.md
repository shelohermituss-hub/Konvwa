# Update and install errors
keywords: update failed, update error, can't update, could not reach the update server, offline, automatic updates are off, not an installed copy, restart now, update installs when you close, reinstall, missing its own file, node.js not found, git not found, system check, install command, antivirus, virus, ransomware, defender, controlled folder access, quarantined, blocked, app closes by itself
platforms: both

## Could not reach the update server
> Could not reach the update server (offline?).

Fix: check the internet connection (and that a VPN, firewall or antivirus isn't blocking the app), then press **Check now** in **Settings > General > Updates**.

## Automatic updates are off
> Automatic updates are off: not an installed copy.

What it means: this copy was started from a folder or download, not from the installed app, so it can't update itself.

Fix: On Windows: run the Creatorize Suite installer and open the app from the Start menu. On Mac: drag Creatorize Suite into Applications and open it from there.

## macOS says the app can't be opened or was blocked
> Creatorize Suite can't be opened ...
> "Creatorize Suite" was blocked ...

Fix: click **Done** (not Move to Trash), open **System Settings > Privacy & Security**, scroll down to Security, click **Open Anyway** next to "Creatorize Suite was blocked", enter your Mac password and click **Open Anyway** again. On macOS 12 or older it's **System Preferences > Security & Privacy > General**. You only do this once per update; projects and settings are kept. With the Creatorize Launcher installed, updates install without this step.

## Something is still running
> Claude is still working. The update installs when you close the app, or restart once it is done.
> An export is still running. ...
> A routine is still running. ...

Fix: let it finish, then click **Restart now** in **Settings > General > Updates** (or just close the app: the update installs then). On Mac, click **Download**, open the file and drag the app into Applications (replace the old one).

## The app is missing its own file
> ... Creatorize Suite is missing its own file ...

Fix: On Windows: run the installer again (projects and settings are kept); if it happens again, allow the Creatorize Suite folder in your antivirus. On Mac: download Creatorize Suite again and drag it into Applications.

## Antivirus calls Creatorize a virus or ransomware
> Ransomware / Threat detected / app closes while it is working / engine files are missing

Creatorize writes many files into your Documents folder while it builds and exports a video, and it isn't signed by a big publisher, so some antivirus programs mistake it for ransomware and stop it. It doesn't collect or send your files.

Fix on Windows (Windows Security; other antivirus programs have the same two settings under similar names):
1. **Virus & threat protection > Manage settings > Exclusions > Add or remove exclusions > Add an exclusion > Folder**: add `%LOCALAPPDATA%\Programs\creatorize-suite` (the app) and `Documents\Creatorize Suite` (your projects).
2. **Virus & threat protection > Ransomware protection > Allow an app through Controlled folder access > Add an allowed app**: pick `Creatorize Suite.exe` from `%LOCALAPPDATA%\Programs\creatorize-suite`.
3. If files were already quarantined (for example "engine files are missing"), run the installer again: projects and settings are kept.

Fix on Mac: if a security app (not macOS itself) blocks it, add Creatorize Suite in Applications and the `Documents/Creatorize Suite` folder to that app's allowed list. The macOS "cannot be opened" message the first time is different: **System Settings > Privacy & Security > Open Anyway** (see Updates and versions, On Mac).

Keep the antivirus on: the exclusion is enough. The Creatorize Launcher keeps disappearing, or you use Norton, Avast, AVG, Bitdefender, Kaspersky or McAfee: see "Your antivirus blocks or removes Creatorize".

## A tool is missing in System check
> Not found: edits cannot be reverted
> Not found: Claude cannot render edited intros
> Not found: audio pipeline disabled

What it means: Git, Node.js or Python is not installed (rows in **Settings > System > System check**).

Fix:
1. Click the button next to the row to copy its install command.
2. On Windows, run it in PowerShell: Git `winget install --id Git.Git -e`, Node.js `winget install --id OpenJS.NodeJS.LTS -e`, Python `winget install --id Python.Python.3.12 -e`. On Mac, in Terminal: Git `xcode-select --install`, Node.js `brew install node`, Python `brew install python` (Homebrew from brew.sh first).
3. Restart the app and press **Run checks**.
