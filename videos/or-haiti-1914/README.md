# « Des Marines américains ont emporté l'or d'Haïti » — décembre 1914

Composition HyperFrames écrite à la main (`index.html`), 9:16, 31,6 s, dans le **style « histoire express » validé** (`../_engine/style-histoire/README.md`, modèle `../drapeaux-jumeaux-tchad-roumanie`). Pastille « HISTOIRE D'HAÏTI · 1914 » en haut tout du long.

| Partie | Image / objet | Son |
|---|---|---|
| Accroche « l'or d'Haïti » | drapeau d'Haïti, la carte « lingots » s'envole sur « emporté », il reste un cadre vide | whooshs, basse |
| 17 décembre 1914 | page de calendrier, puis la Banque nationale (dessinée) et la puce « Port-au-Prince » | pops |
| Les caisses | trois caisses « OR » tombent, compteur 0 → 500 000 $ | chocs sourds, touches, scintillement |
| Le Machias, New York | photo de l'USS Machias, pastille « ➜ New York » | pop, whoosh |
| National City Bank | photo du 55 Wall Street, pastille « = Citibank » | pops |
| Haïti proteste | lettre « À : Washington · violation de notre souveraineté » | touches |
| L'or ne revient pas | lingots en noir et blanc, tampon « JAMAIS RENDU » | basse, clic |
| 7 mois plus tard | photo des Marines en 1915, frise 1915 → 1934 qui se remplit, « 19 ans » | montée, pop |
| Bilan | **scratch et coupure de la musique**, photo des Marines au Cap-Haïtien, tampon « BRAQUAGE » | **retour de la musique** sur « braquage », basse |
| Question | boutons OUI / NON, bulle « Répondez ici », flèche vers le bouton commentaires | pops, clic |

- **Faits** : le 17 décembre 1914, des Marines débarqués de la canonnière USS Machias retirent environ 500 000 $ en or de la Banque nationale de la République d'Haïti à Port-au-Prince ; l'or part pour New York, dans les coffres de la National City Bank (ancêtre de Citibank). Le gouvernement haïtien proteste contre une atteinte à sa souveraineté. En juillet 1915, les États-Unis occupent Haïti, jusqu'en 1934 (19 ans).
- **Voix** : FLORA / Gemini TTS « Charon » (fr-FR), nombres et dates écrits en lettres dans le texte envoyé ; la 2ᵉ prise sautait la moitié du texte, la 1ʳᵉ est gardée. Temps des mots de la fin recalés sur les silences (la transcription dérivait), pauses raccourcies, silence allongé avant « Bilan », `atempo=1.1` → `assets/vo/vo.wav` (29,9 s). Coût ≈ 0,026 $ (2 prises).
- **Musique** : `../_engine/style-histoire/musique-bed.mp3`, bouclée, enveloppe mixée dans `assets/music/bed.mp3`.
- **Images** :
  - `drapeau-haiti.png` — drapeau d'Haïti (Wikimedia Commons, domaine public, repris de `haiti-1804`) ;
  - `or.jpg` (et `or-gris.jpg`, sa version noir et blanc) — Unsplash, Jingming Pan (iYsrkq5qq0Q) ;
  - `machias.jpg` — *Machias.jpg*, USS Machias, Boston Navy Yard, 1901 (Wikimedia Commons, domaine public) ;
  - `ncb.jpg` — *55-wall-street.jpg*, ancien siège de la National City Bank (Wikimedia Commons) ;
  - `marines-pap.jpg` — *US Marines and sailors from the USS Washington ashore for the capture of Port-au-Prince, Haiti, 1915* (Wikimedia Commons, domaine public) ;
  - `marines-cap.jpg` — *American Marines In 1915 defending the entrance gate in Cap-Haitian* (Wikimedia Commons, domaine public) ;
  - banque, calendrier, caisses, lettre, frise : dessinés en HTML/SVG.
- **Rendu** : `npx --yes hyperframes@0.8.168 render --quality looks --output renders/or-haiti-1914.mp4` (MP4 non commité).
