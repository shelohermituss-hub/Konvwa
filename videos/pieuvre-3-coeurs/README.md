# « Les pieuvres ont trois cœurs » — montage façon référence K

Composition HyperFrames écrite à la main (`index.html`), 9:16, 30 s. Même grammaire que `haiti-1804` (référence K, `_engine/references/ref-k-histoire`) : un plan continu sur fond gris clair, texte = voix mot par mot (gris flou → encre, mots forts en orange KONVWA `#E2501D`, « bleu » en bleu), changement de partie par flou plein cadre, appel à commenter puis logo ; logo et nom KONVWA fixés en haut. Version « plus vivante » : chaque partie a son image en couleur et un objet animé.

| Partie | Image / objet |
|---|---|
| Accroche « trois cœurs » | pieuvre illustrée qui monte + trois cœurs numérotés qui battent |
| Deux cœurs → branchies, le troisième → le corps | panneau : cœurs qui battent, flux de sang dans les tuyaux |
| Sang bleu, cuivre et pas fer | gros plan photo, goutte bleue, cases Cu ✦ / Fe ✕ |
| En nageant, le cœur principal s'arrête | pieuvre détourée qui nage + électrocardiogramme qui devient plat (bip continu) |
| 2/3 des neurones dans les 8 bras | anneau qui se remplit à 2/3, bras comptés de 1 à 8 |
| Toucher, goûter, réagir | photo des ventouses + liste ✦ |
| « 3 » en commentaire, suivez KONVWA | la pieuvre et ses trois cœurs reviennent, puis le logo |

- **Texte** : à partir des deux phrases du client (trois cœurs ; deux vers les branchies, un vers le corps), complété par des faits connus : sang bleu (hémocyanine, à base de cuivre), arrêt du cœur systémique pendant la nage, environ deux tiers des neurones dans les bras, ventouses qui touchent et goûtent.
- **Voix** : FLORA / Gemini TTS « Charon » (fr-FR) → `assets/vo/vo.wav` (28,1 s). Pour tenir en 30 s : phrase « Voilà pourquoi elle préfère ramper : nager l'épuise. » retirée (coupe dans les silences), pause de 0,4 s ajoutée après « s'arrête de battre » (le temps de l'électrocardiogramme plat), longues pauses raccourcies, puis `atempo=1.09`. Temps des mots (`RAW` dans `index.html`) : `npx hyperframes transcribe` (medium, fr) reporté à travers les coupes, débuts de phrase recalés sur les silences mesurés (`silencedetect`) ; `T = 0,2 + RAW`.
- **Musique** : ElevenLabs Music via FLORA, coupée à 30 s avec fondu → `assets/music/bed.mp3`. Sons : `_engine/sfx` ; `heartbeat.wav` et `flatline.wav` synthétisés avec ffmpeg.
- **Images** (détourage `rembg`) :
  - `hero.png` — illustration Pixabay 2373177 (thisisprabha), fond retiré.
  - `nage-cut.png` — photo Pixabay 3232758 (ErikTanghe), détourée.
  - `ventouses.jpg` — photo Pixabay 1025738 (jusch).
  - `nage.jpg` — photo Unsplash « close-up photo of brown octopus », Qijin Xu (pSmXVhWr9kE).
  - Licences Pixabay et Unsplash : usage commercial gratuit, crédit non obligatoire.
- **Rendu** : `npx --yes hyperframes@0.8.168 render --quality looks --output renders/pieuvre-3-coeurs.mp4` (MP4 non commité).
