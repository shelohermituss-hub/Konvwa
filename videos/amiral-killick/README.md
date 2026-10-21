# « Un amiral haïtien a fait sauter son propre navire » — Hammerton Killick

Composition HyperFrames écrite à la main (`index.html`), 9:16, 51 s. **Style de `henriquez-1900`** (référence K, vitesse normale) : plan continu sur fond gris clair, texte = voix mot par mot, cartes photo et pastilles posées avec une ombre douce, flou plein cadre entre les parties. Sans marque. Une première version dans le style de la référence L (images cinématographiques générées) a été refusée par le client ; la référence L reste analysée dans `_engine/references/ref-l-amiral`.

| Partie | Image / objet | Son |
|---|---|---|
| Accroche | photo du Crête-à-Pierrot qui fume (1902) + éclat qui saute | basse, pop |
| Septembre 1902, guerre civile | page de calendrier, « Camp Firmin » (portrait) VS « Camp Nord Alexis » | pops, basse |
| L'amiral et son navire | portrait de Killick, photo du Crête-à-Pierrot à Gonaïves, pastille « Camp Firmin » | pops |
| Le cargo, les armes | caisse de fusils dessinée, pastille « Markomannia · cargo allemand », tampon « SAISIES » | pop, impact |
| Le Panther | photo du SMS Panther, pastille « Canonnière allemande » | coup de canon |
| Gonaïves, l'ultimatum | carte dessinée de la baie, le Panther avance, pastille « 6 sept. », bulle « Reddition ? » | whoosh, pops |
| L'équipage descend | photo du navire à Gonaïves (6 sept. 1902), deux canots qui gagnent la rive | vagues |
| Seul à bord | portrait de Killick, lueur de feu | battements de cœur, montée, **musique coupée** |
| L'explosion / il coule | photo du navire qui sombre dans la fumée, **flash blanc**, tremblement ; puis photo de l'épave | explosion |
| La chute | photo du drapeau haïtien, « la mer » en très grand | vagues, musique qui remonte |
| Question | OUI / NON, bulle « Répondez ici », flèche vers le bouton commentaire de TikTok | pops |

- **Faits** : septembre 1902, guerre civile (camps d'Anténor Firmin et de Nord Alexis) ; Killick, à bord du Crête-à-Pierrot, arrête le cargo allemand Markomannia et saisit les armes destinées au camp adverse ; l'Allemagne envoie la canonnière Panther ; le 6 septembre 1902, aux Gonaïves, le Panther exige la reddition ; Killick fait évacuer l'équipage, met le feu aux munitions et coule avec le navire. Le drapeau autour des épaules relève du récit (« dit-on » dans la voix).
- **Images (réelles)** :
  - `killick.jpg` — portrait de l'amiral, fourni par le client (agrandi, contraste) ;
  - `crete-fumee.jpg` — *Haitian ship Crête-à-Pierrot.jpg* (Wikimedia Commons) ;
  - `crete-gonaives.jpg` — *Haitianisches Kanonenboot "Crête-à-Pierrot" am 6. September 1902 im Hafen von La Gonaives…* (Wikimedia Commons, photo prise depuis le Panther) ;
  - `crete-coule.jpg` — *Das haitianische Kanonenboot Crete-à-Pierrot sinkt nach Beschuß durch SMS Panther…* (Wikimedia Commons) ;
  - `crete-epave.jpg` — *Wrack des haitianischen Kanonenboots Crete-à-Pierrot im Hafen von Gonaives…* (Wikimedia Commons) ;
  - `panther-1901.jpg` — *SMS Panther (1901).jpg* (Wikimedia Commons) ;
  - `firmin.jpg` — *Antenor Firmin.jpg* (Wikimedia Commons) ;
  - `drapeau.jpg` — Unsplash, Ayush Design (PZ0UUDUPUnE).
  - Pas de photo d'archive des armes ni de Nord Alexis (téléchargement Wikimedia refusé) : caisse dessinée, pastille sans portrait.
- **Voix** : FLORA / Gemini TTS « Charon » (fr-FR), vitesse normale, pauses de 0,4 s (0,6 s avant « Puis », 0,9 s après « explose », 0,7 s avant la chute, 0,55 s avant la question) → `assets/vo/vo.wav` (48,7 s).
- **Musique** : ElevenLabs Music via FLORA (sans cuivres), bouclée, coupée juste avant l'explosion puis remontée sur la chute → `assets/music/bed.mp3`.
- **Sons sur mesure** (ElevenLabs Sound Effects via FLORA) : `explosion.mp3`, `canon.mp3`, `vagues.mp3` ; `heartbeat.wav` synthétisé ; les autres viennent de `_engine/sfx`.
- **Rendu** : `npx --yes hyperframes@0.8.168 render --quality looks --output renders/amiral-killick.mp4` (MP4 non commité).
