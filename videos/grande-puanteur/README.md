# « La Grande Puanteur » (Londres, 1858) — style ANIMÉ, en français

Deuxième vidéo du style ANIMÉ (skill `cartoon-3d-short`, adapté au français : `.claude/skills/cartoon-3d-short/KONVWA.md`).

- **Rendu** : personnages 2D plats dans une ville en 3D peinte, avec three.js dans Remotion.
- **Format** : 1080 × 1920, **60 i/s**, **68,7 s**.
- **Sans sous-titres.**
- **Voix** : Gabriel Dubois.
- **Faits et sources** : `SCRIPT.md`.

## Fichiers

| Quoi | Où |
|---|---|
| Voix, mots minutés | `voice/voice.wav`, `voice/words.json` ; la prise brute est `voice/take1.mp3`, ses pauses sont resserrées par `serrer_pauses.py` |
| Image (code) | `../_remotion/src/videos/puanteur/` : `story.ts` (26 plans), `world.ts` (décors), `cast.ts` (personnages et effets), `Puanteur.tsx` |
| Son | `audio/build_mix.py`, `audio/mix.flac` (mix final, commité), `audio/musique.mp3`, `audio/sfx/` |
| Couverture | `cover.png`, `cover-grille.png` ; source dans `cover/` |

Décors de `world.ts` :
- la Tamise brune, le Parlement néogothique, la tour de l'horloge, le pont ;
- les bouches d'égout et les usines ;
- la rue victorienne et sa tranchée ;
- la salle des débats ;
- le tunnel de brique ;
- la rue d'aujourd'hui.

## Les 26 plans

1. **Accroche** : un député se bouche le nez devant le Parlement, des odeurs vertes montent.
2. Les députés fuient par la terrasse. Flash blanc.
3. La Tamise vue du ciel.
4. Les bouches d'égout crachent dans le fleuve.
5. La canicule dans la rue : éventails, mouchoirs.
6. Le thermomètre monte.
7. Le fleuve brun bouillonne.
8. **Aujourd'hui** : une poubelle au soleil, avec des mouches.
9. Le couvercle s'ouvre, l'enfant se pince le nez.
10. « Une poubelle aussi longue qu'un fleuve » : des odeurs sur toute la Tamise.
11. Le Parlement tout neuf au bord de l'eau.
12. Une servante trempe les rideaux dans une bassine de chlorure de chaux.
13. Les députés se bouchent le nez sur leurs bancs.
14. Ils sortent en courant.
15. On pense à déménager : les bancs partent en charrette.
16. Le crieur de journaux brandit « GODZY — GREAT STINK! ».
17. Les députés votent à main levée.
18. Le calendrier défile jusqu'à 18.
19. Bazalgette, son plan à la main, devant la tranchée et les terrassiers.
20. Dans le tunnel de brique, à la lumière des lanternes.
21. Vue du ciel : les égouts brillent sous la ville et partent vers l'est.
22. « Et le plus fort ? » : gros plan sur Bazalgette.
23. Le « mauvais air » : un nuage vert grimaçant poursuit les passants.
24. « C'était faux » : le nuage se dégonfle.
25. Le fleuve redevenu propre, les promeneurs sourient.
26. **Aujourd'hui** : la plaque d'égout dans la rue, la tour de l'horloge au loin.

## Signature « Godzy » (3 apparitions, le nom seul)

- le titre du journal du crieur ;
- l'enseigne d'une boutique de la rue victorienne ;
- l'autocollant sur la poubelle d'aujourd'hui.

## Son

- **Musique** : air de music-hall victorien enjoué (tuba, basson, pizzicati, accordéon), généré avec Magnific / ElevenLabs. Ses creux sont remontés.
- **Ambiances par lieu** : quai de la Tamise, rue de 1858 (sabots, charrettes), rue d'aujourd'hui, salle des débats, tunnel.
- **Bruitages calés sur les mots** :
  - fleuve qui bouillonne, bouches d'égout ;
  - jingle de la puanteur, mouches ;
  - couvercle de la poubelle, rideau trempé ;
  - députés qui fuient, cloche de la tour ;
  - charrette, journal, vote, calendrier, tampon ;
  - pelles, briques ;
  - nuage, nuage qui se dégonfle ;
  - eau des égouts.
- **Mixage** : `../_engine/style-anime/mix_anime.py`. La voix passe devant (médiane 15,3 dB au-dessus du fond), **0 trou**.
- **Refaire le son** : `python3 -I videos/grande-puanteur/audio/build_mix.py`.

## Rendu (sur le PC Windows du client)

```
git pull
videos\_engine\rendre-anime.cmd PuanteurShort grande-puanteur
```

La vidéo arrive dans `videos\grande-puanteur\renders\grande-puanteur.mp4`. Le MP4 n'est pas commité.

## Publication (proposition)

> En 1858, Londres puait tellement que les députés ont fui leur propre Parlement 🤢 #histoire #lesaviezvous #londres #anecdote
