# « Le plus jeune président du monde était haïtien » — Jean-Claude Duvalier, 1971

Composition HyperFrames écrite à la main (`index.html`), 9:16, 30,1 s, style « histoire express » v2 (`../_engine/style-histoire/README.md`). Pastille « HISTOIRE D'HAÏTI · 1971 ».

| Partie | Image / objet | Transition vers la suivante | Son |
|---|---|---|---|
| Accroche | podium dessiné, drapeau noir et rouge des Duvalier sur la marche n°1, médaille « N°1 le plus jeune » | iris | whooshs, pop, scintillement |
| Avril 1971 | photo de François Duvalier (1968), « AVRIL 1971 », la photo s'assombrit et un bandeau de deuil la barre sur « meurt » | inondation noire depuis le bandeau | pops, basse |
| Le fils | photo de François Duvalier debout derrière son fils assis, tampon « PRÉSIDENT À VIE », zoom sur le fils sur « 19 ans » | page poussée vers le haut | basse, clic |
| La Constitution | document « CONSTITUTION », ligne « Âge minimum du président » barrée, « modifiée » écrit à la main, bulletin de référendum coché OUI | page poussée à gauche | déchirure, touches, clic |
| Le résultat | barres OUI / NON, compteur jusqu'à 2 391 916, « 0 » qui tremble | inondation rouge depuis la barre OUI | montée, scintillement |
| « Baby Doc » | portrait de Jean-Claude Duvalier adulte, tampon « BABY DOC » | page poussée vers le haut | basse, clic |
| 15 ans, puis la fuite | frise 1971 → 1986, « 15 ans », avion Haïti → France, « 7 FÉV. 1986 » | **inondation noire tenue pendant le scratch** | montée, souffle |
| Bilan | « 19 ANS » géant, tampon « À VIE », « avant 20 ans » | page poussée vers le haut | **retour de la musique** sur « président » |
| Question | OUI / NON, « Répondez ici », flèche vers les commentaires | — | pops, clic |

- **Faits** : François Duvalier meurt le 21 avril 1971 ; son fils Jean-Claude (né le 3 juillet 1951) lui succède comme président à vie le lendemain, à 19 ans, ce qui fait de lui le plus jeune président du monde. La Constitution avait été modifiée en janvier 1971 pour abaisser l'âge minimum du président, et le référendum du 31 janvier 1971 l'avait désigné successeur : 2 391 916 « oui », aucun « non » (résultat officiel). Surnommé « Baby Doc », il gouverne jusqu'au 7 février 1986, date à laquelle il quitte Haïti pour la France.
- **Choix éditorial** : la demande disait « chef d'État » ; la voix dit « président », plus exact (des monarques plus jeunes existaient). Les photos libres de Jean-Claude Duvalier sur Wikimedia datent de 2011 (il avait 59 ans) et ne sont pas utilisées ; les deux photos d'époque ont été fournies par le client.
- **Voix** : FLORA / Gemini TTS « Charon » (fr-FR), dates et nombres écrits en lettres (le nombre de « oui » est dit arrondi : « deux millions trois cent quatre-vingt-onze mille »). 1ʳᵉ prise gardée. Temps des mots de la fin recalés sur les silences, pauses raccourcies, silence allongé avant « Bilan » et avant « Répondez », `atempo=1.1` → `assets/vo/vo.wav` (28,4 s). Coût ≈ 0,026 $ (2 prises).
- **Musique** : `../_engine/style-histoire/musique-bed.mp3`, bouclée ; coupure au scratch, retour sur « président », baissée sous la question.
- **Images** :
  - `papa-doc.jpg` — *François Duvalier (cropped).jpg*, 1968, Wikimedia Commons, domaine public ;
  - `pere-fils.jpg` (François debout derrière Jean-Claude) et `baby-doc.jpg` (portrait de Jean-Claude adulte) — fournies par le client, agrandies ×2 ; droits à vérifier par le client avant publication ;
  - podium, médaille, Constitution, bulletin, barres de vote, drapeau 1964–1986 (accroche), frise, avion : dessinés en HTML/SVG ;
  - police manuscrite `assets/fonts/caveat-700.woff2` (Caveat, Google Fonts, licence SIL OFL).
- **Rendu** :
  1. `npx --yes hyperframes@0.8.168 render --fps 120 --quality looks --output renders/raw120.mp4`
  2. `python3 -I ../_engine/style-histoire/finish.py renders/raw120.mp4 renders/duvalier-1971.mp4`
  MP4 non commités.
