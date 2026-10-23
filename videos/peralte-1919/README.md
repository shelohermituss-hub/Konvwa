# « La photo qui devait humilier Péralte en a fait un martyr » — Charlemagne Péralte, 1919

Composition HyperFrames écrite à la main (`index.html`), 9:16, 29,3 s, style « histoire express » v3 (`../_engine/style-histoire/README.md`). Pastille « HISTOIRE D'HAÏTI · 1919 ».

| Partie | Image / objet | Transition vers la suivante |
|---|---|---|
| Accroche | viseur REC, la photo de 1919 en tirage sur disque orange, qui **se développe** (du noir flou à nette) pendant que le compteur « DÉVELOPPEMENT » monte de 0 à 100 % et passe au rouge | inondation orange depuis la photo |
| L'occupation | photo des Marines à Cap-Haïtien (1915), badge « 1915 — 1934 » | page poussée à gauche |
| Péralte | portrait détouré sur disque orange, photo des chefs cacos (1915), « Chef des Cacos » | inondation noire (la nuit tombe) |
| La nuit | ciel étoilé avec lune, médaillon de Péralte qui s'assombrit, « Trahi pour 2 000 $ », « 1ᵉʳ NOV. 1919 » | iris (l'obturateur) |
| La photo | la photo des Marines, puis trois copies qui s'éparpillent, « Des milliers d'exemplaires » | page poussée vers le haut |
| Le martyr | la photo sur disque orange, une croix dorée se trace derrière sur « Christ », halos sur « crucifié », « Martyr national » | **inondation noire tenue pendant le scratch** (« Bilan : » en blanc) |
| Bilan | pièce dorée à son effigie, qui tourne sur « symbole » ; reste à l'écran pendant « connaissiez-vous Charlemagne Péralte ? » | page poussée vers le haut |
| Question | OUI / NON, « Répondez ici », flèche vers les commentaires | — |

- **Faits** : Haïti est occupée par les États-Unis de 1915 à 1934. Charlemagne Péralte (né à Hinche en 1885) mène l'insurrection des Cacos. Trahi par Jean-Baptiste Conzé, payé 2 000 $, il est tué dans la nuit du 31 octobre au 1ᵉʳ novembre 1919 par le sergent des Marines Herman Hanneken, déguisé en caco. Son corps est attaché à une porte et photographié ; la photo est reproduite à des milliers d'exemplaires et diffusée dans tout le pays pour décourager la résistance. La ressemblance avec une crucifixion en fait au contraire un martyr et un héros national ; son visage figure sur des timbres et des pièces haïtiennes, et des générations d'artistes (dont Philomé Obin, *Crucifixion de Charlemagne Péralte pour la liberté*, 1970) l'ont représenté en Christ. Sources : Wikipédia (FR et EN), [Bucknell — The death of Charlemagne Péralte](https://occupationundead.scholar.bucknell.edu/2019/10/28/the-death-of-charlemagne-peralte/), [Haitian Art Society](https://haitianartsociety.org/blog/charlemagne-peralte-and-the-cacos). Les sources divergent sur la date (31 octobre ou 1ᵉʳ novembre) et sur le lieu (près de Grande-Rivière-du-Nord ou de Sainte-Suzanne) : la vidéo affiche « 1ᵉʳ NOV. 1919 » sans lieu.
- **Image sensible** : la photo du corps est un document historique très connu en Haïti, montrée sans gros plan et sans effet choquant. TikTok peut tout de même la signaler ou en limiter la diffusion.
- **Voix** : FLORA / Gemini TTS « Charon » (fr-FR), dates écrites en lettres ; 1ʳᵉ prise gardée (la 2ᵉ sautait « Péralte devient un martyr »). Temps des mots de la fin recalés à la main sur les silences, pauses raccourcies, silence allongé avant « Bilan » et avant « Répondez », `atempo=1.1` → `assets/vo/vo.wav` (27,6 s). Coût ≈ 0,026 $ (2 prises).
- **Musique** : `../_engine/style-histoire/musique-bed.mp3`, bouclée ; coupure au scratch, retour sur « ils voulaient », baissée sous la question.
- **Sons** : 62 effets (montée et touches pendant le développement, obturateur sur l'iris, basses, pops, whooshs, carillon, scintillements, scratch avant « Bilan »), toujours sous la voix.
- **Images** :
  - `photo-1919.jpg` : le corps de Charlemagne Péralte, photo des Marines américains, 1919, domaine public (document du gouvernement américain ; *Corps de Charlemagne Péralte.jpg* sur Wikimedia Commons), copie haute définition récupérée sur haitianartsociety.org ;
  - `peralte.jpg`, `peralte-cut.png` : portrait de Charlemagne Péralte, début du XXᵉ siècle, Wikimedia Commons, domaine public ;
  - `cacos-1915.jpg` : *USMC Colonel Littleton Waller with Haitian Cacos leaders, October 1915*, Wikimedia Commons, domaine public ;
  - `marines-cap.jpg` : *American Marines in 1915 defending the entrance gate in Cap-Haitian*, Wikimedia Commons, domaine public (déjà utilisé dans `videos/or-haiti-1914`) ;
  - pièce, ciel de nuit, croix, viseur : dessinés en HTML/SVG. La pièce est une évocation, pas la reproduction d'une vraie pièce.
- **Rendu** :
  1. `npx --yes hyperframes@0.8.168 render --fps 120 --quality looks --output renders/raw120.mp4`
  2. `python3 -I ../_engine/style-histoire/finish.py renders/raw120.mp4 renders/peralte-1919.mp4`
  MP4 non commités.
