# Film essai-pack-stickstory (style stickstory du pack Creatorize, via l'outil konvwa)

- Moteur : `videos/_creatorize/stickstory` (servi tel quel par `videos/_konvwa/web.mjs` ; ne jamais le modifier, ne pas le recopier).
  Les aides propres au film vont dans `models.js` (copie de départ du moteur) ; les scènes dans `scenes/*.js`.
- Skill du style : `videos/_creatorize/skill/stickstory-videos/SKILL.md` + `references/` ; règles KONVWA : `.claude/skills/konvwa-styles/SKILL.md`.
- Images de contrôle : `python videos/_konvwa/konvwa.py test essai-pack-stickstory --temps 1,4.5,9` -> `renders/test/rN/` + `planche.jpg`.
- Contrôle (scènes qui plantent, mise en page) : `python videos/_konvwa/konvwa.py test essai-pack-stickstory --controle`.
- Son : `python videos/_konvwa/konvwa.py son essai-pack-stickstory` ; vidéo finale : `python videos/_konvwa/konvwa.py rendu essai-pack-stickstory`.
- Aperçu dans le navigateur : `node videos/_konvwa/web.mjs serve essai-pack-stickstory`.
- Les mots : `audio/timeline.json` (phrases et mots, lus par `say` / `cue` / `S.at`), voix `audio/voice.*`.
