# Test du style « cartoon documentaire » (15 s)

Test de validation du nouveau style demandé par le client, reproduit d'après sa vidéo de référence (« Les africains sentent mauvais », dessin vectoriel animé).

**Le style** :
- dessin vectoriel plat, entièrement dessiné en SVG et CSS dans `index.html`, sans aucune image ;
- fonds sombres avec halo ou rayons dorés ;
- personnages en buste (paysan au chapeau de paille, maître d'école, Haïtien fier) qui clignent des yeux ;
- chiffres dorés lumineux qui comptent, chandelle, carte où Haïti s'allume en or, pluie de pièces, sacs de sucre et de café ;
- coupes sèches toutes les 1 à 4 s avec une légère poussée de caméra ;
- sous-titres Bebas Neue en majuscules, 2 à 4 mots, mot prononcé dans une case rouge ;
- barre de progression dorée en haut ;
- musique continue sous la voix.

**Le texte**, début d'une vidéo « mythe contre réalité » :
- « Haïti a toujours été pauvre ? Faux. »
- Saint-Domingue est la colonie la plus riche du monde en 1789, avec environ 40 % du sucre et 60 % du café consommés en Europe (ordres de grandeur couramment cités par les historiens).

**Production** :
- **Voix** : FLORA / Gemini TTS « Charon » (fr-FR), ton « démonteur de mythe », débit rapide. Une prise (≈ 0,013 $), pauses réduites à 0,14 s, tempo ×1,1 (≈ 225 mots/min, comme la référence).
- **Temps des mots** : Whisper mot à mot sur la prise entière, car la voix ne fait presque pas de pauses.
- **Carte** : Natural Earth 1:10m (domaine public), projetée en SVG.
- **Polices** : Bebas Neue et Anton (SIL OFL).
- **Rendu** :
  1. `npx --yes hyperframes@0.8.168 render --fps 120 --quality looks --output renders/raw120.mp4`
  2. `python3 -I ../_engine/style-histoire/finish.py renders/raw120.mp4 renders/test-cartoon.mp4`
