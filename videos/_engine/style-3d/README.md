# Style 3D — guide (« construis-le »)

Référence du client : « Comment un drone tient vraiment en l'air » (83 s, 720×1280, 30 i/s). Ce document décrit ce que fait la vidéo et comment la reproduire. **Nom choisi par le client : « style 3D ».**

## 1. Image

- **Vraie 3D temps réel** (type Three.js / WebGL), pas du dessin plat :
  - objets simples modélisés (planche en bois, moteurs, hélices en disques flous, circuit imprimé, puce, châssis carbone, batterie, télécommande, caméra, nacelle) ;
  - ombres, éclairage doux, légère profondeur de champ.
- **Un seul monde, aucune coupe franche** (détection de plans : 0 coupe). Tout passe par des **mouvements de caméra** :
  - orbite autour de l'objet ;
  - vue de dessus ;
  - plongée **dans** la puce (macro sur le gyroscope MEMS à côté d'un cheveu) puis retour ;
  - travelling vers la télécommande.
- **Décor** : fond bleu pétrole sombre (`#16323a` → `#0c1c22`), halo au centre, pluie fine et traits de vent, un hélipad « H » au sol en cercles cyan. La grille technique sert pour la vue « labo ».
- **L'objet se construit pièce par pièce** : la planche devient un vrai drone (bras carbone, batterie, radio, GPS, baromètre, nacelle, pieds). Chaque nouvelle pièce apparaît au moment où la voix la nomme.
- **Habillage « interface »** :
  - étiquettes en police mono, petites capsules sombres reliées à la pièce par un trait (« MOTEURS ARRIÈRE + », « POUSSÉE », « PIÈCE QUI VIBRE », « CHEVEU HUMAIN · 70 µm », « TÉLÉCOMMANDE ») ;
  - flèches de force cyan ;
  - flèches de rotation autour des hélices ;
  - compteurs (« SANS CORRECTION 0,39 s → 0,75 s ELLE TOMBE », « CORRECTIONS 757 → 4 757 », « 18 % → 9 % » de batterie) ;
  - incrustation « IMAGE FILMÉE · ÇA TREMBLE → STABLE » ;
  - cibles GPS et ondes radio.
- **Titre de chaque pièce** : grand mot en mono majuscules, souligné d'un trait cyan (« GYROSCOPE », « CONTRÔLEUR DE VOL », « VARIATEUR », « BATTERIE AU LITHIUM », « RADIO », « GPS », « BAROMÈTRE », « NACELLE »).
- **Sous-titres** :
  - police ronde très grasse (type Montserrat ExtraBold), blanche, 1 ou 2 lignes, vers 60 % de la hauteur ;
  - **le mot-clé coloré en cyan** (« drone », « toupie », « gyroscope », « décollé ») au lieu de la case rouge du style ANIMÉ ;
  - les mots apparaissent par groupes de 2 à 5.
- Pas de barre de progression, pas de logo.

## 2. Récit : « tu le construis toi-même »

Le spectateur est le constructeur, à la 2ᵉ personne. Chaque étape suit la même mécanique, **problème → solution → nom de la pièce** :

1. **Accroche** par une construction absurdement simple : « Si tu fixes une hélice et son moteur aux quatre coins d'une planche, bravo : tu as construit un drone. »
2. **« Mais… »**, le problème : la planche tourne comme une toupie.
3. **« Alors… »**, la solution : deux hélices dans un sens, deux dans l'autre.
4. **« Le vrai problème : »**, la grosse difficulté avec un chiffre-choc (« pas même une seconde »).
5. Solution en image, puis **« Ça, c'est un gyroscope »**, avec le titre à l'écran.
6. On enchaîne : contrôleur de vol → variateur → batterie → radio → GPS → baromètre → caméra → nacelle → retour automatique.
7. **Fin en boucle** sur la première phrase : « Regarde-toi : tu viens de construire un drone. »

Les mots-outils qui rythment le texte : « Mais », « Alors », « Ça, c'est un… », « Pour… », « Grâce à… ». Des phrases courtes, aucun jargon sans image. Il n'y a ni question finale ni appel à commenter dans la vidéo.

## 3. Son (mesuré : voix et fond séparés avec Demucs)

- **Voix** :
  - homme, grave et posé : hauteur médiane **107 Hz**, plus grave que Charon (128 Hz) et bien plus que Gabriel Dubois ;
  - débit **208 mots/min**, plus calme que le style ANIMÉ (239) ;
  - 283 mots pour 83 s ;
  - probablement une voix de synthèse.
  - **Voix retenue : Adrien Moreau** (Magnific / ElevenLabs, `voiceId` 230, consigne `[calm, clear, confident documentary narration]`). C'est la plus proche de la référence au comparatif de timbre (MFCC 14,8), devant Cédric Bouchard (22,5), Thibault Vasseur (24,4), Corentin Beaulieu (26,3), Gabriel Dubois (27,1) et Charon (32,3).
- **Musique** : électro « tech » douce (nappes, arpèges, basse, beat léger), positive, continue.
- **Bruitages** : environ 34 en 83 s (un toutes les 2,4 s), plus rares que dans le style ANIMÉ. Ce sont des sons fonctionnels :
  - bourdonnement des hélices, whoosh de rotation et d'accélération ;
  - « chute » quand la planche tombe ;
  - clics numériques, bips de calcul, vibration aiguë du gyroscope ;
  - clipsage des pièces, ondes radio, rafales de vent, pings du GPS ;
  - obturateur et moteurs de la nacelle, alerte de batterie faible, toucher au sol.
- **Mixage** : la voix passe nettement devant. Pendant la parole, le fond est environ 15,5 dB sous elle. Sur l'ensemble : voix −14,4 LUFS, fond −29,2 LUFS. Notre `../style-anime/mix_anime.py` convient tel quel.

## 4. Comment le reproduire

- HyperFrames sait piloter **Three.js** de façon déterministe (adaptateur Three.js du skill `/hyperframes-animation`). On peut donc faire une vraie 3D :
  - géométrie procédurale (boîtes, cylindres, disques), matériaux simples, une lumière douce, du brouillard ;
  - particules pour la pluie ;
  - une caméra animée par images-clés, calée sur les mots de la voix ;
  - pas besoin de modèles externes.
- Habillage en HTML par-dessus la 3D : étiquettes mono, titres soulignés, compteurs, sous-titres avec mot-clé cyan.
- Chaîne inchangée pour le reste : voix (Magnific/ElevenLabs), temps des mots avec Whisper, `align_voice.py`, bruitages générés, `mix_anime.py`, rendu à 120 i/s puis `finish.py`.
- Sujets qui se prêtent au format « tu le construis » : comment marche une moto, un panneau solaire et sa batterie, un téléphone qui appelle, un avion, un frigo, l'électricité qui arrive à la maison, un paiement MonCash.
