# « Ces prénoms n'existent qu'en Haïti » — les prénoms-prières

Composition HyperFrames écrite à la main (`index.html`), 9:16, 32,9 s, style « histoire express » v3 (`../_engine/style-histoire/README.md`). Pastille « CULTURE D'HAÏTI · PRÉNOMS ».

| Partie | Image / objet | Transition vers la suivante |
|---|---|---|
| Accroche | viseur REC, acte de naissance sur disque orange, le prénom « Dieuseul » s'écrit lettre par lettre, tampon rond « HAÏTI · ÉTAT CIVIL » sur « Haïti » | inondation orange depuis le tampon |
| Les prénoms | quatre badges « JE M'APPELLE » : Dieuseul, Mercidieu, Dieujuste, Jésula | page poussée à gauche |
| État civil | « Surnom ? » barré, registre des naissances qui se remplit, tampon « OFFICIEL » | iris |
| Une prière | photo de la cathédrale du Cap-Haïtien | page poussée vers le haut |
| Les traductions | carte sur disque orange : chaque prénom se coupe en prière (Merci · Dieu, Dieu · seul, Dieu *est* juste, Jésus *est* là), deux bougies | iris |
| Dieusibon | photo de la cathédrale Sainte-Anne d'Anse-à-Veau, badge « Dieusibon » | page poussée à gauche |
| La naissance | photo d'un enfant endormi sur l'épaule de sa mère, bougie | **inondation noire depuis la flamme, tenue pendant le scratch** (« Bilan : » en blanc) |
| Bilan | l'acte de naissance revient (« Jésula »), tampon « PRIÈRE », halos dorés | page poussée vers le haut |
| Question | badge « JE M'APPELLE » vide avec curseur, « Répondez ici », flèche vers les commentaires | — |

- **Faits** : en Haïti, surtout en milieu rural, beaucoup de prénoms sont des phrases religieuses en créole ou en français. Sens donnés par l'inventaire des prénoms créoles d'issendai.com (https://issendai.com/wp/haitian-names/haitian-kreyol-names/) : Mesidieu / Mercidieu « merci à Dieu », Dieusel / Dieuseul « Dieu seul », Dieujuste « Dieu est juste », Jésula « Jésus est là » (un des prénoms féminins les plus courants), Dieusibon « Dieu est si bon ». Ces étymologies sont peu documentées par ailleurs ; « n'existent qu'en Haïti » reprend la formule du client (on les retrouve aussi dans la diaspora haïtienne). L'acte de naissance, le registre (numéros fictifs) et les badges sont des illustrations dessinées, pas de vrais documents.
- **Voix** : FLORA / Gemini TTS « Charon » (fr-FR) ; 3ᵉ prise gardée (la 1ʳᵉ sautait le début et répétait des phrases, la 2ᵉ prononçait « Dieuzeul »). Temps des mots recalés à la main sur les silences (la transcription coupe les prénoms composés en deux mots), pauses raccourcies, silence allongé avant « Bilan » et avant « Écrivez-le », `atempo=1.1` → `assets/vo/vo.wav` (31,2 s). Coût ≈ 0,039 $ (3 prises).
- **Musique** : `../_engine/style-histoire/musique-bed.mp3`, bouclée ; coupure au scratch, retour sur « en Haïti », baissée sous la question.
- **Sons** : 70 effets (touches de clavier pendant que le prénom s'écrit, tampons, pops, whooshs, basses, carillon, scintillements, scratch avant « Bilan »), toujours sous la voix.
- **Images** (Unsplash, licence Unsplash) :
  - `cathedrale-cap.jpg` : cathédrale du Cap-Haïtien vue de la rue 17, Patrice S Dorsainville (photo `HlseIzr_6fI`) ;
  - `anse-a-veau.jpg` : cathédrale Sainte-Anne d'Anse-à-Veau, Alex Polinis (photo `3Ac7zj0A2PM`) ;
  - `mere-enfant.jpg` : enfant endormi sur l'épaule de sa mère, Haïti, TopSphere Media (photo `leUFTSlCEXk`) ;
  - acte de naissance, badges, registre, tampons, bougies, viseur : dessinés en HTML/SVG ; écriture manuscrite `assets/fonts/caveat-700.woff2` (Caveat, SIL OFL).
- **Rendu** :
  1. `npx --yes hyperframes@0.8.168 render --fps 120 --quality looks --output renders/raw120.mp4`
  2. `python3 -I ../_engine/style-histoire/finish.py renders/raw120.mp4 renders/prenoms-prieres.mp4`
  MP4 non commités.
