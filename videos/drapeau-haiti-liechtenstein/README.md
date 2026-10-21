# « Haïti et le Liechtenstein avaient le même drapeau » — montage façon référence K

Composition HyperFrames écrite à la main (`index.html`), 9:16, 30 s. Grammaire de la référence K (`_engine/references/ref-k-histoire`) : plan continu sur fond gris clair, texte = voix mot par mot, changement de partie par flou plein cadre. **Sans marque** (pas de logo ni de couleurs KONVWA) : la couleur vient des drapeaux. Le rythme est porté par le son.

| Partie | Image / objet | Son |
|---|---|---|
| Accroche « même drapeau » | deux drapeaux arrivent des deux côtés et se superposent | whooshs, coup de basse |
| Bleu en haut, rouge en bas | le drapeau se construit bande par bande | deux pops |
| Caraïbes / Alpes | photos Île-à-Vache (Haïti) et château de Vaduz (Liechtenstein) | whooshs, déclic photo |
| « Personne ne le remarque… » | les photos passent en gris | musique baissée (suspense) |
| JO de 1936 | carte « Berlin » avec flamme | roulement de tambour jusqu'à « 1936 », coup de basse, foule |
| « Surprise » | les deux drapeaux montent aux mâts, « = », tampon « IDENTIQUES » | **scratch, la musique s'arrête**, impact du tampon |
| 1937 | la couronne tombe sur le drapeau du Liechtenstein | scintillement, carillon |
| « Et Haïti ? » | point d'interrogation puis ✓ | **silence musical**, tic-tac |
| « Pas nous. » | le drapeau haïtien grossit, mot géant | **musique qui revient d'un coup**, basse, foule |
| Abonnez-vous | bouton « S'abonner » tapé → « Abonné ✓ » | clic |

- **Texte** : à partir du texte du client. Précision : la ressemblance a été constatée aux JO de Berlin en 1936 (Haïti n'y participait pas), d'où « Personne ne le remarque… jusqu'aux Jeux olympiques de 1936. Surprise : les deux drapeaux sont identiques ». Le Liechtenstein ajoute la couronne en 1937.
- **Voix** : FLORA / Gemini TTS « Charon » (fr-FR), longues pauses raccourcies (pauses dramatiques gardées) → `assets/vo/vo.wav` (28 s). Temps des mots (`RAW`) : `npx hyperframes transcribe` reporté à travers les coupes, débuts de phrase recalés sur les silences mesurés.
- **Musique** : ElevenLabs Music via FLORA ; coupures et retours mixés dans `assets/music/bed.mp3` (enveloppe calée sur les mots).
- **Sons sur mesure** (ElevenLabs Sound Effects via FLORA) : `scratch.mp3`, `foule.mp3`, `roulement.mp3`. Les autres viennent de `_engine/sfx`.
- **Images** :
  - drapeaux dessinés en HTML (bleu `#00209F`, rouge `#D21034`) ;
  - `couronne.png` — découpée dans *Flag of Liechtenstein.svg* (Wikimedia Commons, domaine public) ;
  - `haiti.jpg` — Unsplash, Claudia Altamimi (Île-à-Vache, 26UUGdTfzgQ) ;
  - `vaduz.jpg` — Pixabay 7581523, Leonhard_Niederwimmer ;
  - `torche.jpg` — Unsplash, Igor Lepilin (fjmPfKvayzA).
- **Rendu** : `npx --yes hyperframes@0.8.168 render --quality looks --output renders/drapeau-haiti-liechtenstein.mp4` (MP4 non commité).
