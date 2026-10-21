# « Haïti et le Liechtenstein avaient le même drapeau » — montage façon référence K, version rapide

Composition HyperFrames écrite à la main (`index.html`), 9:16, 36 s. Grammaire de la référence K (`_engine/references/ref-k-histoire`) en version dynamique : plan continu sur fond gris clair, texte = voix mot par mot, **douze parties de 2 à 3 s** enchaînées par un flou plein cadre court, entrées vives. **Sans marque** : la couleur vient des drapeaux.

| Partie | Image / objet | Son |
|---|---|---|
| Accroche « même drapeau » | deux drapeaux arrivent des côtés et se superposent | whooshs, basse |
| Bleu en haut, rouge en bas | le drapeau se construit bande par bande | pops |
| 1803, Dessalines | drapeau français : le blanc est arraché, bleu et rouge se rejoignent | déchirure |
| 1921, maison princière | photo du château de Vaduz, pastille « 1921 » | pop |
| 160 km² contre ≈ 28 000 | carrés à l'échelle : Haïti grandit à partir du point du Liechtenstein | whoosh, basse |
| Les années passent | compteur 1921 → 1935 | tic-tac, musique baissée |
| Berlin 1936 | carte avec flamme, « 1936 » géant | roulement de tambour → basse, **scratch et coupure de la musique** |
| Identiques | les deux drapeaux montent aux mâts, « = », tampon « IDENTIQUES » | la musique revient sur le tampon |
| 1937, la couronne | la couronne tombe sur le drapeau, pastille « Prince + Peuple » | scintillement |
| Et Haïti ? | drapeau haïtien actuel (armoiries), « ? » puis ✓ | **silence musical**, tic-tac |
| Pas nous. | le drapeau grossit, mot géant | **retour de la musique**, basse |
| Abonnez-vous | bouton tapé → « Abonné ✓ » | clic |

- **Retour client pris en compte** : la foule avec trompettes (`foule.mp3`) est retirée (elle couvrait la voix) ; sons placés plus bas sous la voix ; débit et animations plus rapides ; plus de scènes et d'informations.
- **Faits ajoutés** : naissance du bleu et rouge haïtien en 1803 (Dessalines arrache le blanc du drapeau français, selon le récit national) ; couleurs de la maison princière du Liechtenstein, officialisées en 1921 ; superficies (Liechtenstein ≈ 160 km², Haïti ≈ 27 750 km²) ; la couronne (1937) symbolise l'union du prince et du peuple. La ressemblance est constatée aux JO de Berlin (Haïti n'y participait pas).
- **Voix** : FLORA / Gemini TTS « Charon » (fr-FR), dates écrites en lettres dans le texte envoyé (une première prise avait dit « 1921 » au lieu de « 1936 ») ; pauses raccourcies, silence ajouté après « 1936 » (scratch) et après « Pas nous », `atempo=1.1` → `assets/vo/vo.wav` (34,6 s). Temps des mots : transcription alignée sur le texte, débuts de phrase recalés sur les silences.
- **Musique** : ElevenLabs Music via FLORA, bouclée, coupures et retours mixés dans `assets/music/bed.mp3`.
- **Sons sur mesure** (ElevenLabs Sound Effects via FLORA) : `scratch.mp3`, `roulement.mp3`, `dechirure.mp3`. Les autres viennent de `_engine/sfx`.
- **Images** :
  - drapeaux dessinés en HTML (bleu `#00209F`, rouge `#D21034`), drapeau français dessiné ;
  - `drapeau-haiti.png` — drapeau d'Haïti avec armoiries (Wikimedia Commons, domaine public, repris de `haiti-1804`) ;
  - `couronne.png` — découpée dans *Flag of Liechtenstein.svg* (Wikimedia Commons, domaine public) ;
  - `haiti.jpg` — Unsplash, Claudia Altamimi (Île-à-Vache, 26UUGdTfzgQ) ;
  - `vaduz.jpg` — Pixabay 7581523, Leonhard_Niederwimmer ;
  - `torche.jpg` — Unsplash, Igor Lepilin (fjmPfKvayzA).
- **Rendu** : `npx --yes hyperframes@0.8.168 render --quality looks --output renders/drapeau-haiti-liechtenstein.mp4` (MP4 non commité).
