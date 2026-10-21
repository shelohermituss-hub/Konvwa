# Drapeaux jumeaux · ép. 2 — « Le Tchad et la Roumanie »

Composition HyperFrames écrite à la main (`index.html`), 9:16, 39,9 s. Même format que l'épisode 1 (`../drapeau-haiti-liechtenstein`, la vidéo devenue virale) : fond gris clair, texte = voix mot par mot, **douze parties de 2 à 3 s** enchaînées par un flou plein cadre, même musique, mêmes familles de sons. **Sans marque** : la couleur vient des drapeaux. Pastille « DRAPEAUX JUMEAUX · ÉP. 2 » en haut pendant toute la vidéo.

| Partie | Image / objet | Son |
|---|---|---|
| Accroche « même drapeau » | les deux drapeaux arrivent des côtés et se superposent | whooshs, basse |
| Bleu, jaune, rouge | le drapeau se construit bande par bande | pops |
| La nuance de bleu | pastilles `#002664` (Tchad) et `#002B7F` (Roumanie), loupe sur le Tchad | pop |
| 1848 | photo de Bucarest, puce « Bucarest, Roumanie » | pop |
| 1989 | drapeau à l'emblème communiste, l'emblème est découpé (trou) | déchirure |
| 1959 | photo du drapeau tchadien, puce « Indépendance · 1960 » | pop |
| 2004 | lettre « ONU » qui se remplit ligne à ligne | touches |
| Réponse de la Roumanie | tampon « HORS DE QUESTION », secousse | **scratch et coupure de la musique**, basse |
| Résultat | les deux drapeaux montent aux mâts, « = » | **retour de la musique**, basse |
| Andorre et Moldavie | grille de 4 drapeaux, cercles sur les blasons | pops, scintillement |
| Prochain épisode | Indonésie et Monaco (rouge sur blanc), pastille « ÉP. 3 », « ? » | whooshs |
| Question | défilé de drapeaux, bulle « Répondez ici », flèche vers le bouton commentaires | pop, clic |

- **Astuce commentaires** : question ouverte « Et vous, quels drapeaux jumeaux connaissez-vous ? Dites-le en commentaire. » + bulle et flèche vers le bouton de TikTok ; le teaser de l'épisode 3 donne une raison de s'abonner. Aucun faux commentaire affiché.
- **Faits** : tricolore roumain apparu lors de la révolution de 1848 ; en décembre 1989 les manifestants découpent l'emblème de la République socialiste, le drapeau troué devient le symbole de la révolution ; le Tchad adopte son drapeau le 6 novembre 1959 (indépendance le 11 août 1960) ; en 2004 le Tchad demande à l'ONU d'examiner la question, la Roumanie refuse de changer (le président Iliescu). Seule différence : le bleu, plus foncé au Tchad. Andorre et Moldavie : mêmes couleurs, avec un blason.
- **Voix** : FLORA / Gemini TTS « Charon » (fr-FR), dates écrites en lettres dans le texte envoyé ; pauses raccourcies, silence allongé avant « Réponse de la Roumanie » (scratch), `atempo=1.1` → `assets/vo/vo.wav` (38,2 s). Temps des mots : transcription alignée sur le texte, débuts de phrase recalés sur les silences. Coût voix ≈ 0,026 $ (2 prises).
- **Musique** : celle de l'épisode 1 (ElevenLabs Music via FLORA), bouclée ; coupure au scratch, retour sur « Résultat », baissée sous le teaser et la question → `assets/music/bed.mp3`.
- **Sons** : repris de l'épisode 1 (`scratch`, `dechirure`, `roulement` sur mesure ; les autres viennent de `_engine/sfx`), volumes ≤ 0,45 sous la voix.
- **Images** :
  - drapeaux tricolores et rouge-blanc dessinés en HTML (couleurs officielles) ;
  - `tchad.jpg` — Unsplash MUQOrcV6xiQ (drapeau du Tchad) ;
  - `bucarest.jpg` — Unsplash WziMWpMfGEY (vieille ville de Bucarest) ;
  - `andorre.png`, `moldavie.png`, `roumanie-1965.png` — *Flag of Andorra*, *Flag of Moldova*, *Flag of Romania (1965–1989)*, Wikimedia Commons (domaine public).
- **Rendu** : `npx --yes hyperframes@0.8.168 render --quality looks --output renders/drapeaux-jumeaux-tchad-roumanie.mp4` (MP4 non commité).
