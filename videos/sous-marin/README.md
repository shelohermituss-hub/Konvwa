# « Comment un sous-marin plonge et remonte » — style 3D, en français

Troisième vidéo en **style 3D** (guide `../_engine/style-3d/README.md`). Elle dure **≈ 89,8 s**, avec la voix d'**Adrien Moreau**. Tout est en vraie 3D Three.js dans `index.html`, en un seul plan :
- la mer : surface, rayons de lumière, fond rocheux, bulles ;
- une bouteille ;
- le sous-marin **en écorché**. La moitié avant de la coque légère est découpée (plan de coupe Three.js), ce qui laisse voir la coque épaisse, les ballasts et l'eau qui les remplit puis en est chassée (niveau d'eau par plan de coupe), les bouteilles d'air et les régleurs.

**C'est la première vidéo mixée avec le correctif du son** (retour client « le son se coupe plusieurs fois », voir plus bas). Le mixage annonce **0 trou**.

| Étape | Texte | Image |
|---|---|---|
| Accroche | « Un sous-marin pèse plusieurs milliers de tonnes. Il peut couler exprès, rester entre deux eaux, puis remonter quand il veut. Comment ? » | le sous-marin en surface, « PLUSIEURS MILLIERS DE TONNES », il plonge, reste entre deux eaux, remonte → **COMMENT ?** |
| « Tu le construis toi-même » | la bouteille qui flotte, qui coule | une bouteille vide flotte ; elle se remplit d'eau (niveau qui monte) et coule |
| Archimède | « l'eau pousse vers le haut tout objet plongé, avec une force égale au poids de l'eau qu'il déplace » | « SYRACUSE · IL Y A 2 000 ANS · ARCHIMÈDE », flèche « POUSSÉE » contre flèche « POIDS » ; plus lourd, la bouteille coule ; plus légère, elle remonte → **POUSSÉE D'ARCHIMÈDE** |
| Ballasts | « une coque, et autour, des réservoirs ouverts par le bas » | « IMPOSSIBLE À VIDER » ; la coque épaisse, puis la coque légère en écorché, les réservoirs et leurs ouvertures → **BALLASTS** |
| Plonger | purges ouvertes, l'air s'échappe, l'eau entre | les purges s'ouvrent, bulles, l'eau monte dans les ballasts, le sous-marin descend |
| Pression | +1 bar tous les 10 m ; à 300 m, environ 30 kg par cm² | compteur « PROFONDEUR 0 → 300 m · PRESSION 1 → 31 BAR », flèches de pression rouges, « ≈ 30 KG » → **COQUE ÉPAISSE** |
| Entre deux eaux | régleurs, barres de plongée | les régleurs s'allument, les barres de plongée pivotent → **BARRES DE PLONGÉE** |
| Remonter | l'air comprimé chasse l'eau par le bas | les bouteilles d'air → **AIR COMPRIMÉ** ; l'air part dans les ballasts, l'eau est chassée (bulles), le sous-marin remonte et perce la surface |
| Fin en boucle | « Regarde-toi : tu viens de construire un sous-marin. Avec une bouteille, de l'air, et une idée vieille de 2 000 ans. » | le sous-marin entier en surface, la bouteille à côté, « UNE BOUTEILLE », « DE L'AIR », « ARCHIMÈDE » → **UN SOUS-MARIN** |

## Faits (vérifiés, formulés avec prudence)

- **Poussée d'Archimède** : tout corps plongé dans un fluide subit une poussée verticale vers le haut, égale au poids du fluide déplacé. Archimède a vécu à Syracuse au IIIᵉ siècle av. J.-C., d'où « il y a plus de 2 000 ans ».
- **Ballasts** : réservoirs situés entre la coque épaisse et la coque légère, ouverts en bas, avec des purges en haut.
  - Pour plonger, on ouvre les purges : l'air sort et l'eau entre par le bas.
  - Pour remonter, on referme les purges et on « chasse » à l'air comprimé, stocké à haute pression dans des bouteilles.
- **Pression** : environ +1 bar tous les 10 m. À 300 m, environ 31 bar, soit à peu près 30 kg par centimètre carré. La « coque épaisse » (coque résistante) est un cylindre d'acier qui tient la pression.
- **Entre deux eaux** : les régleurs ajustent finement le poids, et les barres de plongée pilotent la profondeur en mouvement.
- **Ordre de grandeur** : « plusieurs milliers de tonnes » couvre aussi bien les sous-marins d'attaque que les sous-marins lanceurs d'engins.

## Le son ne se coupe plus (correctif du moteur, valable pour toutes les vidéos)

L'ascenseur avait des « coupures » à l'écoute au téléphone. Deux causes, toutes deux corrigées dans le moteur :
- **La musique** : entre les phrases, elle tombait à environ 23 dB sous la voix dans la bande d'un haut-parleur de téléphone. `../_engine/style-anime/mix_anime.py` :
  - la règle à 15 dB sous la voix, mesurés au-dessus de 300 Hz ;
  - adoucit ses basses ;
  - ne la baisse plus que de 3 dB, lentement ;
  - signale les trous restants (« À CORRIGER »).
- **La voix** : elle contenait des silences numériques purs. `../_engine/style-histoire/align_voice.py` comble les pauses avec le bruit de fond de la prise et coupe plus tard après chaque mot.

Mesure sur cette vidéo :
- pauses à environ 19 dB sous la voix au téléphone (23 avant) ;
- voix 15,3 dB au-dessus du fond pendant la parole (médiane) ;
- **0 trou**, contre 5 détectés sur l'ancien mixage de l'ascenseur avec le même détecteur.

## Production

- **Voix** : Magnific / ElevenLabs « Adrien Moreau » (`voiceId` 230, `eleven_v4`, stabilité 0,4, 346 crédits), consigne `[calm, clear, confident documentary narration]`.
  - Une seule prise.
  - Alignement corrigé, pauses à 0,22 s ; tempo ×1,0 → 88,7 s, 280 mots.
- **Sons** :
  - banque `../_engine/style-3d/sfx/`, avec 5 sons ajoutés (65 crédits) : `bulles`, `sonar`, `purge-air`, `chasse-air`, `coque-craque` ;
  - plus `whoosh`, `scintille`, `ding`, `riser`, `goutte`, `eclaboussure` du style ANIMÉ ;
  - 45 bruitages ;
  - musique `musique-tech`.
- **Rendu** :
  1. `npx --yes hyperframes@0.8.168 render --fps 120 --quality looks --output renders/raw120.mp4`
  2. `python3 -I ../_engine/style-histoire/finish.py renders/raw120.mp4 renders/sous-marin.mp4`

  MP4 non commités.

## Publication (proposition)

- **Description** : « Un sous-marin de plusieurs milliers de tonnes coule… exprès. Et il remonte avec une idée d'il y a 2 000 ans. Tu savais comment ? 👇 #science #sousmarin #archimède #commentcamarche »
