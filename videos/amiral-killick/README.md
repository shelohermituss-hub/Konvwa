# « Un amiral haïtien a fait sauter son propre navire » — Hammerton Killick, style référence L

Composition HyperFrames écrite à la main (`index.html`), 9:16, 51 s. Grammaire de la **référence L** (`_engine/references/ref-l-amiral`, vidéo client « Semmelweis ») : images cinématographiques photoréalistes que la caméra parcourt, alternées avec des plans « collage sur table », texte en capitales épaisses avec relief, étiquettes en papier déchiré, texte machine à écrire, mots isolés en italique serif, grain de film et vignette. Sans marque.

| Partie | Plan | Mouvement / transition | Son |
|---|---|---|---|
| Accroche | ciel d'orage → navire haïtien | descente inclinée (comme le ciel → l'hôpital de la réf.) | vagues, whoosh |
| Septembre 1902, guerre civile | papier quadrillé, « 1902 » machine à écrire, tampon « GUERRE CIVILE » | poussée | touches, impact |
| L'amiral et son navire | porte-documents sur tissu rouge, texte tapé, photo polaroid du navire déposée | glissé | touches |
| Les armes saisies | cale d'un navire, caisses de fusils, tampon « SAISIES » | poussée lente | impact |
| Le Panther | canonnière allemande dans la brume, étiquette « Canonnière allemande », « LE PANTHER » en relief | révélation par un cercle | coup de canon |
| Gonaïves, l'ultimatum | tableau noir : côte tracée à la craie, le Panther vient vers le Crête-à-Pierrot | glissé | touches, pops |
| L'équipage descend | canots qui s'éloignent | panoramique | vagues |
| Seul à bord | l'amiral de dos, drapeau sur les épaules, torche ; étiquette « Amiral Hammerton Killick » ; lueur de feu qui vacille | poussée vers la torche | battements de cœur, montée, **musique coupée** |
| L'explosion | navire qui explose | **flash blanc**, tremblement | explosion |
| La chute | drapeau sur la mer à l'aube, « la mer » en grand italique | dérive lente | vagues, musique qui remonte |
| Question | OUI / NON, bulle « Répondez ici », flèche vers le bouton commentaire de TikTok | glissé | pops |

- **Faits** : septembre 1902, guerre civile (partisans d'Anténor Firmin contre ceux de Nord Alexis) ; l'amiral Hammerton Killick, à bord du Crête-à-Pierrot, arrête le cargo allemand Markomannia et saisit les armes destinées au camp adverse ; l'Allemagne envoie la canonnière Panther ; le 6 septembre 1902, aux Gonaïves, le Panther exige la reddition ; Killick fait évacuer l'équipage, met le feu à la sainte-barbe et coule avec le navire. Le drapeau autour des épaules relève du récit (« dit-on » dans la voix).
- **Images** : générées avec Nano Banana 2.1 via FLORA (9:16, 2K) : `navire`, `panther`, `armes`, `equipage`, `amiral`, `explosion`, `aube`. **Illustrations, pas des photos d'archive** ; l'amiral est toujours de dos (aucun visage inventé pour une personne réelle). `grain.png` : bruit généré.
- **Voix** : FLORA / Gemini TTS « Charon » (fr-FR), vitesse normale, pauses de 0,4 s (0,6 s avant « Puis », 0,9 s après « explose », 0,7 s avant la chute, 0,55 s avant la question) → `assets/vo/vo.wav` (48,7 s).
- **Musique** : ElevenLabs Music via FLORA (sans cuivres), bouclée, coupée juste avant l'explosion puis remontée sur la chute → `assets/music/bed.mp3`.
- **Sons sur mesure** (ElevenLabs Sound Effects via FLORA) : `explosion.mp3`, `canon.mp3`, `vagues.mp3` ; `heartbeat.wav` (synthétisé, repris de `pieuvre-3-coeurs`) ; les autres viennent de `_engine/sfx`.
- **Polices** : Anton, Special Elite, Playfair Display (Google Fonts).
- **Rendu** : `npx --yes hyperframes@0.8.168 render --quality looks --output renders/amiral-killick.mp4` (≈ 190 Mo à cause du grain), puis `ffmpeg -i renders/amiral-killick.mp4 -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart renders/amiral-killick-tiktok.mp4` (≈ 40 Mo). MP4 non commités.
