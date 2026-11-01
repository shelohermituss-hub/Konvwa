# « La tour qui faisait fondre les voitures » (Londres, 2013) — style ANIMÉ, en français

Première vidéo du nouveau **style ANIMÉ** : le skill `cartoon-3d-short`, adapté au français (`.claude/skills/cartoon-3d-short/KONVWA.md`).

- **Rendu** : personnages 2D plats dans une ville en 3D peinte, rendue avec three.js dans Remotion.
- **Format** : 1080 × 1920, **60 i/s**, **66,5 s**.
- **Sans sous-titres**, à la demande du client.
- **Voix** : Gabriel Dubois.
- **Faits et sources** : `SCRIPT.md`.

## Fichiers

| Quoi | Où |
|---|---|
| Voix, mots minutés | `voice/voice.wav`, `voice/words.json` |
| Image (code) | `../_remotion/src/videos/talkie/` : `story.ts` (26 plans, caméras, flou), `world.ts` (Londres, la tour, la Jaguar, le parc, Las Vegas), `cast.ts` (personnages, fumée, chaleur), `Talkie.tsx` |
| Son | `audio/build_mix.py` (musique + ambiances + bruitages), `audio/mix.flac` (mix final, commité), `audio/musique.mp3`, `audio/sfx/` |
| Couverture | `cover.png`, `cover-grille.png` ; source dans `cover/` |

## Les 26 plans

1. **Accroche** : la Jaguar fond au soleil couchant, la tour derrière, une passante horrifiée. Puis un flash blanc.
2. **La ville** : la City vue du ciel, la tour au milieu des tours de bureaux et du « cornichon ».
3. **Contre-plongée** : la tour plus large en haut qu'en bas.
4. **Profil** : la courbe de la façade, vue de côté.
5. **Le surnom** : un enfant lève son talkie-walkie jouet devant la tour.
6. La rue au soleil bas, avec des passants et le bus à impériale.
7. La tache de lumière apparaît.
8. La selle de vélo cloque.
9. Le paillasson fume.
10. L'homme d'affaires arrive vers sa Jaguar.
11. Le rétroviseur fond.
12. Le logo coule.
13. La carrosserie gondole.
14. Les journalistes accourent : caméra, micro, carnet.
15. La poêle et l'œuf qui cuit.
16. **Londres grise** : parapluies, ciel couvert.
17. **Le soleil revient.**
18. **La loupe** au parc : l'enfant concentre le soleil sur une feuille.
19. **Le point brûlant** : la lumière se serre, la feuille fume.
20. **La tour fait pareil** : des dizaines de rayons partent de la façade et convergent.
21. **Vue aérienne** : les rayons arrivent sur le même coin de rue.
22. **La Jaguar réparée** : l'homme d'affaires avec son chèque, le mécanicien.
23. **Les pare-soleil** poussent sur la façade, lame après lame.
24. **« Et le plus fort ? »** : l'enfant parle dans son talkie-walkie.
25. **Las Vegas** : l'hôtel courbe, la piscine, les palmiers.
26. **Le client sur son transat** : ses cheveux fument.

## Signature « Godzy » (3 apparitions, le nom seul)

- l'enseigne de la boutique devant laquelle le paillasson fume ;
- la publicité sur le flanc du bus à impériale ;
- le grand panneau d'affichage de Las Vegas.

## Son

- **Musique** : fond de dessin animé enjoué (cordes en pizzicato, basson, glockenspiel), généré avec Magnific / ElevenLabs.
  - Ses « stops » sont remontés pour qu'il n'y ait jamais de silence.
- **Ambiances par lieu** :
  - rue de Londres ;
  - pluie (plan 16) ;
  - parc ;
  - piscine.
- **Bruitages calés sur les mots** :
  - métal qui fond ;
  - cloques ;
  - feu ;
  - rafale d'appareils photo ;
  - œuf qui grésille ;
  - la loupe ;
  - les pare-soleil ;
  - les cheveux qui roussissent ;
  - le bus ;
  - le talkie-walkie.
- **Mixage** : `../_engine/style-anime/mix_anime.py`.
  - La voix passe devant : en médiane, 15,6 dB au-dessus du fond.
  - **0 trou** dans le son.
- **Refaire le son** : `python3 -I videos/talkie-walkie/audio/build_mix.py`. La commande écrit `audio/mix.flac`.

## Rendu (sur le PC Windows du client)

```
git pull
videos\_engine\rendre-anime.cmd TalkieShort talkie-walkie
```

La commande enchaîne trois étapes :

1. le rendu Remotion avec la carte NVIDIA ;
2. l'ajout de `audio\mix.flac` ;
3. `finish.py`, qui règle le son à −14 LUFS.

La vidéo arrive dans `videos\talkie-walkie\renders\talkie-walkie.mp4`. Le MP4 n'est pas commité.

## Publication (proposition)

> À Londres, un immeuble a fait fondre une voiture… sans la toucher 😳🔥 #lesaviezvous #londres #architecture #histoire #science
