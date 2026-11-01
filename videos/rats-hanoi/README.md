# « Les rats d'Hanoï » (1902) — style ANIMÉ, en français, AVEC sous-titres

Troisième vidéo du style ANIMÉ (skill `cartoon-3d-short`, adapté au français : `.claude/skills/cartoon-3d-short/KONVWA.md`), et la première avec des sous-titres.

- **Format** : 1080 × 1920, **60 i/s**, **64,8 s**.
- **Voix** : Gabriel Dubois.
- **Faits et sources** : `SCRIPT.md`.

## Sous-titres (intégrés à l'image, dans `Rats.tsx`)

- 3 ou 4 mots à la fois, en majuscules, police Inter 800 (`videos/_remotion/public/fonts/inter-800.woff2`).
- Texte blanc cerné d'encre ; le mot prononcé passe en jaune `#ffd23f` et grossit légèrement.
- Placés à 62 % de la hauteur, loin du texte et des boutons de TikTok.
- Le texte vient du script exact. Les temps viennent de Whisper (`voice/words.json`). Les erreurs de Whisper comme « sceaux » ou « l'Ephéra » ne passent donc pas à l'écran.
- Pour une version sans sous-titres, ajoute l'option `--props='{"captions":false}'` au rendu.

## Fichiers

| Quoi | Où |
|---|---|
| Voix, mots minutés | `voice/voice.wav`, `voice/words.json` (texte du script), `voice/words-whisper.json`, prise brute `voice/take1.mp3`, `serrer_pauses.py` |
| Image (code) | `../_remotion/src/videos/rats/` : `story.ts` (20 plans), `world.ts` (décors), `cast.ts` (personnages et effets), `Rats.tsx` (avec les sous-titres) |
| Son | `audio/build_mix.py`, `audio/mix.flac` (mix final, commité), `audio/musique.mp3`, `audio/sfx/` |
| Couverture | `cover.png`, `cover-grille.png` ; source dans `cover/` |

Décors de `world.ts` :
- le boulevard du quartier français, avec sa plaque d'égout ouverte ;
- les égouts en brique ;
- le bureau des primes ;
- la ferme à rats dans les rizières ;
- la salle de bains ;
- le jardin d'aujourd'hui ;
- la salle d'archives.

## Les 20 plans

1. **Accroche** : au guichet, un chasseur tend une queue de rat, l'employé paie.
2. La ferme à rats, l'éleveur ravi. Flash blanc.
3. Le quartier français tout neuf.
4. La chasse d'eau.
5. Sous les rues, la ville des rats.
6. La carte : la peste en Asie.
7. Les chasseurs au chapeau conique, avec lanternes et seaux, autour de la plaque d'égout.
8. La chasse dans les égouts.
9. Le tableau : 20 112 rats le 21 juin 1902.
10. Les rats se multiplient.
11. Plan B : la pièce d'un centime.
12. La pile de rats sur le comptoir, puis… la queue.
13. L'image du quotidien : l'enfant payé pour arracher la mauvaise herbe sème des graines en douce.
14. Des rats sans queue dans la rue.
15. Couper la queue, relâcher le rat.
16. L'inspecteur au casque colonial découvre la ferme.
17. « PRIME — ANNULÉE ».
18. Plus de rats qu'avant.
19. L'effet cobra : un cobra sort du panier.
20. L'historien et son livre « L'EFFET RAT ».

## Signature « Godzy » (3 apparitions, le nom seul)

- l'enseigne d'un café du boulevard ;
- l'étiquette des cages de la ferme ;
- le dos d'un livre de la salle d'archives.

## Son

- **Musique** : cartoon espiègle (pizzicati, cithare pincée, basson), générée avec Magnific / ElevenLabs. Ses vrais silences sont remontés, et le fond ne descend jamais à plus de 8 dB sous son niveau médian.
- **Ambiances** : boulevard, rizières, égouts, bureau, jardin.
- **Bruitages** : pièce, couinements, rats dans les égouts, chasse d'eau, compteur, pile de rats, mauvaise herbe, ciseaux, tampon, cobra.
- **Mixage** : `../_engine/style-anime/mix_anime.py`. La voix passe devant (médiane 15,7 dB au-dessus du fond), **0 trou**.

## Rendu (sur le PC Windows du client, en PowerShell)

```powershell
cd $HOME\Konvwa
git pull
.\videos\_engine\rendre-anime.cmd RatsShort rats-hanoi
```

La vidéo arrive dans `videos\rats-hanoi\renders\rats-hanoi.mp4`. Le MP4 n'est pas commité.

## Publication (proposition)

> En 1902, la France payait chaque queue de rat… alors les habitants ont élevé des rats 🐀 #histoire #lesaviezvous #effetcobra #anecdote
