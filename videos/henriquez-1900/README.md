# « Le premier champion olympique noir était haïtien » — Constantin Henriquez

Composition HyperFrames écrite à la main (`index.html`), 9:16, 33 s. Grammaire de la référence K en version rapide (comme `drapeau-haiti-liechtenstein`) : plan continu sur fond gris clair, texte = voix mot par mot, onze parties courtes, flou plein cadre bref entre elles. Sans marque.

| Partie | Image / objet | Son |
|---|---|---|
| Accroche | médaille d'or « Paris 1900 » qui tombe et tourne | whoosh, basse, scintillement |
| Son nom | portrait de Constantin Henriquez | déclic |
| Port-au-Prince 1880 → Paris 1900 | deux épingles, trajet en pointillés parcouru par un bateau, tampon « JEUX OLYMPIQUES » | pops, basse |
| Le rugby, pour la première fois | ballon qui arrive en tournant, tampon « 1RE FOIS » | **sifflet d'arbitre** |
| Il joue avec l'équipe de France | photo de l'équipe de 1900, zoom et cercle doré sur lui | whoosh, déclic |
| France–Allemagne, France–Grande-Bretagne, l'or | tableaux de score 27–17 et 27–8, médaille d'or rugby | clics, basse, carillon |
| Premier athlète noir champion olympique | portrait + médaille + pastille « 1er » | pops |
| 36 ans plus tard, Jesse Owens | frise 1900 → 1936 (« +36 ans »), carte Jesse Owens et ses 4 médailles d'or | montée, pops |
| Mais le premier, c'était un Haïtien | portrait, drapeau haïtien | **scratch : la musique s'arrête** |
| 36 ans avant Jesse Owens | « 36 ans » géant, frise Henriquez 1900 / Owens 1936 | **retour de la musique**, basse |
| Question finale | boutons OUI / NON qui pulsent, bulle « Répondez ici » et flèche vers le bouton commentaire de TikTok (côté droit) | pops, notification |

- **Astuce commentaires** : question fermée en fin de vidéo (« Vous le connaissiez ? Répondez OUI ou NON en commentaire »). Répondre demande un seul mot, ce qui fait monter le nombre de commentaires. Aucun faux commentaire n'est affiché.
- **Faits** : Constantin Henriquez, né à Port-au-Prince en 1880, champion olympique de rugby avec la France aux Jeux de Paris 1900 (victoires 27–17 contre l'Allemagne et 27–8 contre la Grande-Bretagne ; première apparition du rugby aux Jeux), considéré comme le premier athlète noir champion olympique. Jesse Owens : 4 médailles d'or à Berlin en 1936, soit 36 ans plus tard.
- **Voix** : FLORA / Gemini TTS « Charon » (fr-FR), dates écrites en lettres dans le texte envoyé ; pauses raccourcies (gardées avant « Mais le premier » et avant la question), `atempo=1.06` → `assets/vo/vo.wav` (30,5 s). Alignement : `align_voice` (transcription alignée sur le texte, débuts de phrase recalés sur les silences).
- **Musique** : ElevenLabs Music via FLORA (sans cuivres), coupures et retours mixés dans `assets/music/bed.mp3`.
- **Sons sur mesure** (ElevenLabs Sound Effects via FLORA) : `sifflet.mp3`, `scratch.mp3`. Les autres viennent de `_engine/sfx`.
- **Images** (Wikimedia Commons, photos de 1899-1900, domaine public) :
  - `henriquez.jpg` — *Constantin Henriquez.jpg*, passée en noir et blanc et agrandie ;
  - `equipe-1900.jpg` — *L'équipe de France de rugby aux JO de 1900 (médaille d'or).jpg*.
  - Médailles, ballon, drapeaux, bateau et frise : dessinés en HTML/SVG. Pas de photo de Jesse Owens (fichier introuvable sur Commons au moment du montage).
- **Rendu** : `npx --yes hyperframes@0.8.168 render --quality looks --output renders/henriquez-1900.mp4` (MP4 non commité).
