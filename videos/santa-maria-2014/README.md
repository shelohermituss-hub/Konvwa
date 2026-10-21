# « On a cru retrouver l'épave de la Santa María en Haïti »

Composition HyperFrames écrite à la main (`index.html`), 9:16, 34,3 s. Style « histoire express » avec le mouvement de la v2 de « L'or d'Haïti » (`../or-haiti-1914-v2`) : chaque scène naît de la précédente, iris photo, zooms de caméra, ressorts, rendu 60 i/s avec flou de mouvement, son à −14 LUFS. Pastille « HISTOIRE D'HAÏTI · 1492 ».

| Partie | Image / objet | Transition vers la suivante | Son |
|---|---|---|---|
| Accroche | tableau de la Santa María, un cercle de recherche se verrouille sur le navire, « RETROUVÉE ? » | inondation bleu nuit depuis le cercle | whooshs, clic |
| Noël 1492 | pastille « 25 DÉC. 1492 », portrait de Colomb | page poussée à gauche | pops |
| Le récif | **croquis de la côte nord dessiné par Colomb (1493)**, croix rouge sur « Nativida », zoom | page poussée vers le haut | choc, déchirure |
| La Navidad | trois planches tombent et deviennent le fort (dessiné), « 1er fort espagnol » | iris | chocs sourds, scintillement |
| 2014 | côte nord (Labadee, près du Cap-Haïtien), « MAI 2014 » | inondation noire depuis « MAI 2014 » | pops |
| Le monde s'emballe | trois unes de journaux (génériques, sans titre réel) | iris | pops, touches |
| UNESCO | épave sous-marine, « Mission d'experts · UNESCO, 2014 » | page poussée vers le haut | pop |
| Verdict | clou en cuivre, rapport (clous : cuivre, époque XVIIᵉ–XVIIIᵉ s.), frise 1492 → ≈ 1700, « +2 siècles », tampon « PAS ELLE » | **inondation noire tenue pendant le scratch** (« Bilan : » en blanc) | montée, basse, scratch |
| Bilan | le croquis de Colomb en gros plan, ondes de sonar et « ? » sur la côte, « Côte nord d'Haïti » | page poussée vers le haut | **retour de la musique** sur « l'épave », carillon, scintillement |
| Question | OUI / NON, « Répondez ici », flèche vers les commentaires | — | pops, clic |

- **Faits** : la Santa María s'échoue sur un récif dans la nuit du 24 au 25 décembre 1492 au large de la côte nord d'Haïti ; avec son bois, Colomb fait construire le fort de La Navidad, premier établissement espagnol des Amériques. En mai 2014, l'explorateur sous-marin américain Barry Clifford annonce avoir probablement retrouvé l'épave au large du Cap-Haïtien. À la demande d'Haïti, l'UNESCO envoie une mission d'experts ; son rapport d'octobre 2014 conclut que l'épave est plus récente (fixations en cuivre ou en bronze, technique de la fin du XVIIᵉ ou du XVIIIᵉ siècle) et ne peut pas être la Santa María. L'épave n'a jamais été retrouvée.
- **Voix** : FLORA / Gemini TTS « Charon » (fr-FR), dates écrites en lettres ; 2ᵉ prise gardée (la 1ʳᵉ n'a pas servi). Temps des mots de la fin recalés sur les silences, pauses raccourcies, silence allongé avant « Bilan » et avant « Répondez », `atempo=1.1` → `assets/vo/vo.wav` (32,6 s). Coût ≈ 0,026 $ (2 prises).
- **Musique** : `../_engine/style-histoire/musique-bed.mp3`, bouclée ; coupure au scratch, retour sur « l'épave », baissée sous la question.
- **Images** :
  - `santa-maria.jpg` — Michael Zeno Diemer, *The Santa Maria at sea* (Wikimedia Commons, domaine public) ;
  - `colomb.jpg` — Sebastiano del Piombo, *Portrait of a Man, Said to be Christopher Columbus* (1519, Metropolitan Museum, Wikimedia Commons, domaine public) ;
  - `carte-1493.jpg`, `carte-zoom.jpg` — *La Española 1493.jpg*, croquis de la côte nord-ouest d'Hispaniola attribué à Colomb (Wikimedia Commons, domaine public), recadré et agrandi ;
  - `labadee.jpg` — Unsplash, Kenrick Baksh (ycBxZyw8EVU), côte de Labadee ;
  - `epave.jpg` — Unsplash, NOAA (e0eHtnr7eeU) — épave d'illustration (pas celle du Cap-Haïtien) ;
  - fort, planches, clou, rapport, unes de journaux : dessinés en HTML/SVG.
- **Rendu** :
  1. `npx --yes hyperframes@0.8.168 render --fps 120 --quality looks --output renders/raw120.mp4`
  2. `python3 -I ../_engine/style-histoire/finish.py renders/raw120.mp4 renders/santa-maria-2014.mp4`
  MP4 non commités.
