# Antivirus steps: restore from quarantine and add an exclusion
keywords: norton, norton 360, avast, avg, bitdefender, kaspersky, mcafee, windows security, defender, microsoft defender, quarantine, restore, restore from quarantine, no restore button, exclusion, exclusions, exception, exceptions, allow, allowed apps, whitelist, protection history, virus chest, ransomware protection, ransomware shield, data protector, controlled folder access, launcher removed
platforms: both

What to click to restore the Creatorize Launcher (or a Creatorize file) from quarantine and add the Creatorize folders (listed in "Your antivirus blocks or removes Creatorize") as an exclusion. Labels differ a little between versions. Never turn the antivirus off: the exclusion is enough.

## Windows Security (Microsoft Defender)
- Restore: **Virus & threat protection > Protection history**, pick the entry, **Restore**. If it shows up again as a threat: **Allow on device**.
- Exclude: **Virus & threat protection > Manage settings > Add or remove exclusions > Add an exclusion > Folder**.

## Norton
- Restore (Windows): **Security > History**, show **Quarantine**, pick the entry, **Create exception & restore** (or **Restore**). No restore button? Add the exclusion, then click **Install it again** in Creatorize.
- Exclude (Windows): **Security > Scans > Exclusions > Add Exclusion**. On Mac: Norton's "Exclude files and folders from scans".
- Ransomware (Windows): **Security > Advanced Security > Computer > Ransomware Protection > App permissions**: set Creatorize Suite to **Allowed**.

## Avast and AVG
- Restore: open the **Quarantine** (Avast: **Protection > Quarantine**), tick the file, click **…**, then **Restore and add exception** (On Mac: **Restore**).
- Exclude: On Windows: **Menu > Settings > General > Exceptions > Add exception**. On Mac (Avast): **Menu > Preferences > Scans**, then **Add exceptions**.
- Ransomware Shield: **Allow an app**, and pick Creatorize Suite.

## Bitdefender
- Restore (Windows): **Protection > Antivirus > Open > Settings > Manage quarantine**, **Restore**.
- Exclude (Windows): **Protection > Antivirus > Open > Settings > Manage Exceptions > + Add an Exception**, with **Antivirus** (and **Advanced Threat Defense**, if it shows) on, then **Save**. On Mac: **Manage exceptions**.
- Ransomware (Windows): **Protection > Ransomware Remediation > Manage > Exceptions > + Add an Exception**, and pick Creatorize Suite.

## Kaspersky
- Restore: On Windows: **Security > Quarantine**, **Restore**. On Mac: menu bar **Protection > Detected Objects**, **Restore File**.
- Exclude (Windows): **Settings > Security settings > Exclusions and actions on object detection > Manage exclusions > Add**.

## McAfee
Restore the Creatorize Launcher from McAfee's quarantined items, then add Creatorize Launcher and Creatorize Suite to the excluded files of Real-Time Scanning. McAfee forgets an exclusion when a program updates: add them again after an update.

## Another antivirus
Find its quarantine (or threat history) and restore the file, then add the folders to its exclusions (also called exceptions or the allowed list).
