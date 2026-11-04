# Film duc-marmelade (moteur Blender de Creatorize, via l'outil konvwa)

- `<engine>` = `videos/_creatorize/blender` (ne jamais le modifier).
- `<blender>` / `<python>` : trouvés par `python videos/_konvwa/konvwa.py verifier` (PC : Blender 5.2 installé ; serveur cloud : module bpy).
- Test : `python videos/_konvwa/konvwa.py test duc-marmelade s01 --frames 10,40` -> `renders/test/s01_rN/` + `planche.jpg`.
- Rendu final (PC) : `python videos/_konvwa/konvwa.py rendu duc-marmelade` -> `renders/duc-marmelade.mp4`.
- Les mots : `audio/timeline.json` (lu par `cz.words()`), `audio/words.json` (sous-titres). Voix : `audio/voice.*`.
