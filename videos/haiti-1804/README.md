# « Haïti a vaincu une des armées les plus puissantes du monde » — montage façon référence K

Composition HyperFrames écrite à la main (`index.html`), 9:16, 43 s. Grammaire de la référence K (`_engine/references/ref-k-histoire`) : un plan continu sur fond gris clair, texte = voix mot par mot (gris flou → noir), lignes de tailles mêlées, objets noir et blanc à ombre douce (portraits tramés, cartes, anneau, barre de progression, listes ✦ / ✕), couleur seulement sur le drapeau, changement de partie par flou plein cadre, appel à commenter puis logo.

- **Voix** : FLORA / Gemini TTS « Charon » (fr-FR), silences coupés puis `atempo=1.06` → `assets/vo/vo.wav` (41 s). Temps des mots (`RAW` dans `index.html`) : `npx hyperframes transcribe` (medium, fr) sur la voix avant accélération ; `T = 0,2 + RAW / 1,06`.
- **Musique** : ElevenLabs Music via FLORA → `assets/music/bed.mp3`.
- **Images** (Wikimedia Commons, domaine public) : *Toussaint Louverture* (Girardin), *Jean Jacques Dessalines*, *Napoléon* (J.-L. David), *Battle for Palm Tree Hill* (J. Suchodolski, 1845 — illustration, pas Vertières elle-même, d'où la mention à l'écran), *Flag of Haiti*. Portraits tramés : `rembg` + PIL `convert('1')`.
- **Illustrations de l'anneau** (sucre, café, indigo, coton) : fournies par le client, détourées avec `rembg` (`assets/img/{sucre,cafe,indigo,coton}.png`). L'image d'indigo vient d'Alamy (bandeau recadré) : vérifier la licence avant diffusion commerciale.
- **Couleur** : les mots gras, italiques et géants se posent en orange KONVWA (`#E2501D`, version plus sombre pour le contraste sur le gris) ; logo et nom KONVWA fixés en haut de l'écran.
- **Faits** : soulèvement de 1791 à Saint-Domingue, expédition envoyée par Napoléon en 1802, capture de Toussaint Louverture (1802), bataille de Vertières (18 novembre 1803), indépendance proclamée par Dessalines le 1er janvier 1804.
- **Rendu** : `npx --yes hyperframes@0.8.168 render --quality looks --output renders/haiti-1804.mp4` (MP4 non commité).
