# « La jarre de Zhang Heng » (an 132) — style ANIMÉ, nouveau rendu, en français, AVEC sous-titres

Première vidéo dans le **nouveau rendu calé sur les références** (validé sur `LookTest`) :
- 3D « dessin animé » : couleurs franches, peinture mate, tout cerné d'encre, lumière claire et égale, texte lisible dans le décor ;
- **caméra continue** dans chaque lieu, et des **passages filés** (flou de vitesse) d'un lieu à l'autre au lieu de coupes franches ;
- sous-titres discrets : 1 à 3 mots, en minuscules, blanc gras (Inter 800), contour sombre.

- **Format** : 1080 × 1920, **60 i/s**, **66,5 s**.
- **Faits, sources, texte** : `SCRIPT.md`.

## Rendu (PC Windows, PowerShell)

```
cd $HOME\Konvwa
git pull
.\videos\_engine\rendre-anime.cmd JarreShort jarre-zhang-heng
```

La vidéo finale : `videos\jarre-zhang-heng\renders\jarre-zhang-heng.mp4` (son à −14 LUFS par `finish.py`).

## Fichiers

| Quoi | Où |
|---|---|
| Voix, mots minutés | `voice/voice.wav`, `voice/take2.mp3` (prise brute), `voice/texte.txt`, `voice/words.json` (texte exact calé sur Whisper), `voice/words-whisper.json` |
| Image (code) | `../_remotion/src/videos/jarre/` : `story.ts` (temps forts, caméra, passages filés), `jar.ts` (la jarre en 3D), `world.ts` (décors), `cast.ts` (personnages et effets), `Jarre.tsx` |
| Son | `audio/build_mix.py`, `audio/mix.flac` (mix final, commité), `audio/musique.mp3`, `audio/sfx/` (clong, galop, séisme, rires, pop) |
| Couverture | `cover.png`, `cover-grille.png` ; source dans `cover/` |

## Les lieux et le déroulé

1. **La salle du trône** (Luoyang) : gros plan sur un dragon et sa bille, recul : Zhang Heng, la jarre, l'empereur sur son trône ; ondes au sol.
2. **La cour sous l'orage** : le nuage en colère gronde l'empereur, éclair, secousse.
3. **La carte de l'empire Han** : un petit cavalier part de Longxi vers Luoyang… lentement ; l'empereur dépité.
4. **La jarre** : Zhang Heng fier, orbite autour des huit dragons, les crapauds, la secousse, « Clong ! », la flèche « SÉISME ».
5. **« Comment ? »** : point d'interrogation, puis **le bus** qui freine : le passager part vers l'avant.
6. **La jarre en transparence** : la colonne penche et pousse une bille.
7. **Un jour** : la bille de l'ouest tombe, la tasse de thé ne bouge pas, la cour se moque.
8. **Le messager** au galop dans la cour, puis **Longxi** : maisons fissurées et effondrées, poussière.
9. **Le musée** : la réplique moderne sous vitrine, puis retour à la vraie jarre et Zhang Heng, fier.

## Signature « Godzy » (3 apparitions, le nom seul)

- la bannière verticale de la cour ;
- la publicité dans le bus ;
- l'affiche du musée.
