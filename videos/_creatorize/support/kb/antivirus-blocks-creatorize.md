# Your antivirus blocks or removes Creatorize
keywords: antivirus, anti virus, virus, ransomware, threat detected, threat found, quarantine, quarantined, removed, deleted, blocked, false positive, norton, avast, avg, bitdefender, kaspersky, mcafee, defender, windows security, controlled folder access, exclusion, exception, allow, whitelist, launcher missing, launcher removed, launcher disappeared, keeps removing, removed by your antivirus, install it again, app closes by itself, killed, smart app control
platforms: both

Creatorize writes many files in your projects folder while it builds and exports a video, and it is not signed by a big publisher, so some antivirus programs don't know it yet. They put it (or the Creatorize Launcher) in quarantine, or stop it as "ransomware". Creatorize doesn't encrypt, collect or send your files. Keep your antivirus on: an exclusion is all it needs.

## The Creatorize Launcher keeps disappearing
> Your antivirus keeps removing the Creatorize Launcher

Creatorize puts the launcher back once. When it is gone again, Creatorize stops putting it back (so your antivirus stops warning you) and tells you once, with the steps for your antivirus. **Settings > System > System check** then says **Removed by your antivirus**: click **How to get it back** there.

1. Restore it from your antivirus' quarantine.
2. Add these folders as an exclusion. On Windows: `%LOCALAPPDATA%\Programs\creatorize-launcher`, `%LOCALAPPDATA%\Programs\creatorize-suite` (the app) and `Documents\Creatorize Suite` (your projects). On Mac: Creatorize Launcher and Creatorize Suite in Applications, and `Documents/Creatorize Suite`.
3. Click **Install it again**.

What to click in Windows Security, Norton, Avast, AVG, Bitdefender, Kaspersky and McAfee: see "Antivirus steps: restore from quarantine and add an exclusion".

## Creatorize stops while it works ("ransomware")
Add the same folders as an exclusion, then allow Creatorize Suite in your antivirus' ransomware protection. Windows Security: **Virus & threat protection > Manage ransomware protection > Allow an app through Controlled folder access > Add an allowed app**, and pick Creatorize Suite.

If app files were already removed ("files for the ... style are missing"): On Windows, run the installer again. On Mac, open the Creatorize Launcher and click **Repair**. Projects and settings are kept.

## Windows: Smart App Control
Smart App Control (Windows 11) is not a quarantine: it lets only signed programs run, has no exceptions for single apps, and blocks the Python packages transcription and the audio steps use (WinError 4551). **System check** has a **Smart App Control** row. What to do: see "Transcription and audio step errors". A Mac has nothing like it.

Still blocked? Click **Help > Report a problem** (with **Add my app version and system** ticked it says what was blocked).
