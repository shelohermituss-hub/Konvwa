# Film essai-pack-toon (style toon du pack Creatorize, via l'outil konvwa)

- Moteur : `videos/_creatorize/toon` (servi tel quel par `videos/_konvwa/web.mjs` ; ne jamais le modifier, ne pas le recopier).
  Les aides propres au film vont dans `models.js` (copie de départ du moteur) ; les scènes dans `scenes/*.js`.
- Skill du style : `videos/_creatorize/skill/toon-shorts/SKILL.md` + `references/` ; règles KONVWA : `.claude/skills/konvwa-styles/SKILL.md`.
- Images de contrôle : `python videos/_konvwa/konvwa.py test essai-pack-toon --temps 1,4.5,9` -> `renders/test/rN/` + `planche.jpg`.
- Contrôle (scènes qui plantent, mise en page) : `python videos/_konvwa/konvwa.py test essai-pack-toon --controle`.
- Son : `python videos/_konvwa/konvwa.py son essai-pack-toon` ; vidéo finale : `python videos/_konvwa/konvwa.py rendu essai-pack-toon`.
- Aperçu dans le navigateur : `node videos/_konvwa/web.mjs serve essai-pack-toon`.
- Les mots : `audio/timeline.json` (phrases et mots, lus par `say` / `cue` / `S.at`), voix `audio/voice.*`.
