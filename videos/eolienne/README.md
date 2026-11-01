# « Comment une éolienne fait de l'électricité » — style STUDIO (variante C), en français

C'est la première vidéo en **style STUDIO**, le nom choisi par le client pour la variante C des références. Le guide est `../_engine/style-3d-studio/README.md`.

- **Durée** : ≈ 90 s, voix d'**Adrien Moreau**.
- **Image** : 27 plans en coupes franches, des rendus 3D « produit » en Three.js (`index.html`) sur un fond noir à grille fine.
- **Sous-titres** : en haut. Le mot arrive flou puis devient net. Le mot en cours est en gras blanc, les mots déjà dits en fin et gris, et les mots-clés dans un cadre de sélection bleu.
- **Son** : pas de musique. Une ambiance de vent très basse et des bruitages discrets.
- **Couverture** : faite à part (`cover.png`, voir plus bas).

| Plan | Texte | Image |
|---|---|---|
| Accroche | « Une seule pale d'éolienne est plus longue qu'un terrain de basket. Et pourtant, elle tourne si lentement que tu pourrais compter ses tours. Alors, comment un truc aussi lent peut allumer des milliers de maisons ? » | la pale posée à côté d'un terrain (« 28 M », « 50 À 80 M ») ; l'éolienne entière, compteur de tours ; les maisons qui s'allument, les câbles dorés |
| Imagine | « tu es tout en haut, à cent mètres du sol, et le vent arrive » | un personnage en pâte sur la nacelle, « 100 M », filets de vent |
| La pale | pas une voile ; tordue, profilée comme une aile d'avion | une voile barrée d'une croix rouge ; une pale seule, avec trois sections en profil d'aile surlignées en cyan |
| Portance | l'air va plus vite sur une face, la pression baisse, la pale est aspirée | coupe du profil avec lignes de courant (rapides au-dessus), zones « − » et « + », flèche « ASPIRATION » |
| Rotor | trois pales aspirées → le rotor tourne ; la pointe à près de 300 km/h | trois flèches, le rotor démarre ; la caméra suit le bout rouge de la pale, « 300 KM/H » |
| Arbre lent | une quinzaine de tours par minute ; il en faut plus de mille | nacelle ouverte, arbre à bande rouge ; un cadran de 15 à 1 500 tr/min |
| Nacelle et multiplicateur | grande comme un bus ; d'une grosse roue vers une petite, de 15 tours à 1 500 | nacelle à côté d'un bus et d'un personnage ; coupe avec le multiplicateur encadré ; gros plan de deux engrenages |
| Génératrice | aimants devant des bobines de cuivre ; électrons poussés dans le fil ; Faraday, 1831 | rotor à aimants rouges et bleus, bobines qui s'allument ; fil de cuivre et électrons dorés ; bobine, aimant et galvanomètre sur un tapis de découpe vert, « 1831 » |
| Réseau | descend dans la tour, transformateur, réseau | tour ouverte, câble lumineux, transformateur, pylônes et courant |
| Orientation | girouette, anémomètre, moteurs d'orientation | vue de dessus, le vent tourne et la nacelle suit ; coupelles et girouette ; couronne dentée et moteurs |
| Tempête | les pales se mettent de profil, l'éolienne s'arrête | ciel bleu nuit, vent fort, pales qui pivotent, rotor qui ralentit puis s'arrête, « > 90 KM/H » |
| Retour | « Il ne tourne pas vite, il tourne fort. Le multiplicateur fait le reste. » | l'éolienne et les maisons allumées ; flèche de couple orange « LENT, MAIS FORT » ; les engrenages |
| Fin | « Abonne-toi, et envoie ça à quelqu'un qui passe devant des éoliennes sans savoir comment elles marchent ! » | téléphone avec feuille de partage : un contact choisi, « Envoyer » → « ✓ Envoyé » |

## Faits (vérifiés, formulés avec prudence)

- **Pales** : un terrain de basket FIBA mesure 28 m. Les pales des éoliennes terrestres récentes font environ 50 à 80 m, et plus de 100 m en mer.
- **Vitesse de rotation** : les grands rotors tournent à environ 10 à 15 tr/min, soit un tour toutes les 4 à 6 s. La vitesse en bout de pale est limitée autour de 80 m/s, d'où « près de 300 km/h ».
- **Portance** : la pale a un profil d'aile. La différence de pression entre ses deux faces l'aspire sur le côté (portance), et c'est ce qui fait tourner le rotor.
- **Multiplicateur** : le plus souvent un rapport d'environ 1:100, qui porte l'arbre lent à environ 1 500 tr/min pour la génératrice. Certaines éoliennes, surtout en mer, s'en passent avec une génératrice à entraînement direct. La voix simplifie (« il y a un multiplicateur ») en décrivant le cas le plus courant.
- **Induction** : Michael Faraday découvre l'induction électromagnétique en 1831.
- **Orientation** : une girouette et un anémomètre sur la nacelle ; des moteurs d'orientation font tourner la nacelle sur une couronne dentée.
- **Arrêt en tempête** : au-delà d'environ 25 m/s (≈ 90 km/h), les pales se mettent en drapeau (de profil) et l'éolienne s'arrête.

## Production

- **Voix** : Magnific / ElevenLabs « Adrien Moreau » (`voiceId` 230, `eleven_v4`, stabilité 0,4, 362 crédits), consigne `[conversational, clear, confident, lively explainer]`.
  - Une seule prise de 91,2 s, environ 200 mots/min.
  - Alignement : pauses à 0,18 s, tempo ×1,0, 88,7 s.
  - Mots recalés à la main après Whisper (nombres, « Alors, »).
- **Sons** :
  - 6 bruitages ajoutés à `../_engine/style-3d/sfx/` : `pale-swoosh`, `vent`, `engrenages`, `courant`, `tempete`, `envoi-tel` ;
  - l'ambiance `ambiance-vent` (en boucle), 185 crédits en tout ;
  - 43 bruitages ;
  - mixage `mix_anime.py` sans musique : ambiance coupée sous 280 Hz, 20 dB sous la voix ; voix 19,6 dB au-dessus du fond (médiane) ; **0 trou**.
- **Sources** dans `src/` : `eol-module.js` (la 3D), `eol-shell.html` (sous-titres, téléphone), `build_eol.py` (mixage et assemblage de `index.html`), `script.txt`, `disp.json`, `timing.json`.
  - La voix `vo.wav` n'est pas commitée : seul le mixage `assets/audio/mix.mp3` l'est.
- **Rendu** : directement en **60 i/s**, à la demande du client. En 120 i/s, le rendu prenait environ 3 h sur le processeur du serveur, sans carte graphique.
  1. `npx --yes hyperframes@0.8.168 render --fps 60 --quality looks --output renders/raw60.mp4`
  2. `python3 -I ../_engine/style-histoire/finish.py renders/raw60.mp4 renders/eolienne.mp4`

  Sur une entrée à 60 i/s, `finish.py` ne mélange pas les images : il règle seulement le son à −14 LUFS et réencode. Les ombres sont en 1024 PCF. MP4 non commités.

## Couverture (faite à part)

`cover.png` (1080×1920) et `cover-grille.png` (aperçu 3:4 du profil). La source est dans `cover/` : `cover.html`, `fond.jpg` et `render-cover.mjs` (`node videos/eolienne/cover/render-cover.mjs`).

- **Fond** : une photo-illustration générée avec Magnific (vue de drone au coucher du soleil, une pale géante posée à côté d'un terrain de basket, deux personnes minuscules). C'est une illustration, pas une photo réelle. Une version en rendu 3D studio a été essayée, mais **le client préfère garder celle-ci**.
- **Titre** : « 1 PALE » en très gros, puis « PLUS LONGUE QU'UN TERRAIN DE BASKET », avec une pastille « COMMENT ÇA MARCHE ? ».
- **Annotations** : un cercle « TOI » autour des personnes, des pointillés rouges sur la longueur de la pale, et le contour bleu du terrain (« 28 M »).

## Publication (proposition)

- **Description** : « Une seule pale est plus longue qu'un terrain de basket… et elle tourne au ralenti. Alors comment ça allume des milliers de maisons ? 👇 #science #éolienne #commentcamarche #énergie »
