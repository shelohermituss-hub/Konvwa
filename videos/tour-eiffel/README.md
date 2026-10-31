# « La tour Eiffel a été construite pour durer ? Faux. » — style ANIMÉ, en français (public France)

Vidéo en **style ANIMÉ** écrite sur le gabarit de `../_engine/style-anime/README.md`. Elle dure **≈ 74,3 s** (v2), avec la voix de **Gabriel Dubois**. Tout est dessiné en SVG et CSS dans `index.html`. La tour est dessinée en quatre parties (pieds et 1ᵉʳ étage, 2ᵉ étage, flèche, antenne), avec un treillis découpé dans la silhouette : elle peut **se construire pièce par pièce**, puis devenir dorée pour la phrase miroir. Le son est mixé sous la voix par `../_engine/style-anime/mix_anime.py`.

| Étape du gabarit | Texte | Image |
|---|---|---|
| Accroche (v2, demandée par le client) | « En 1910, la tour Eiffel devait être détruite. Pourquoi voulait-on démolir le symbole de Paris ? Et qu'est-ce qui l'a sauvée au dernier moment ? » | « 1910 » doré, une grue de démolition dont le boulet frappe la tour, tampon « À DÉTRUIRE » ; « POURQUOI ? », la tour découpée en pointillés rouges, « LE SYMBOLE DE PARIS » ; « QUI L'A SAUVÉE ? », une bouée, une horloge à quelques minutes de midi |
| Ouverture | « Remontons en 1887. » | calendrier 1887 |
| La construction | Exposition universelle, 100 ans de la Révolution, 300 m ; 18 000 pièces, 2,5 millions de rivets, 2 ans de chantier | affiche « PARIS 1889 », Eiffel en médaillon, règle « 300 M » ; **la tour se construit étage par étage** entre deux grues, compteur jusqu'à 18 038 pièces, étincelles de rivets, puis le drapeau |
| L'accusation retournée | 20 ans seulement, puis la Ville de Paris peut la démonter ; « construite pour une fête » | la convention du 8 janvier 1887 (article 11), « 20 ANS » surligné, tampon « DÉMONTABLE » ; feux d'artifice, fanions, « 1889 → 1909 » |
| Question d'ouverture n° 2 | « Les Parisiens l'ont aimée ? Même pas. » | un cœur qui se brise, « MÊME PAS » |
| Preuves | la protestation dans *Le Temps* (février 1887) ; Garnier, Maupassant, Gounod ; « inutile et monstrueuse » ; Maupassant au restaurant (« dit-on ») | le journal et les signatures ; trois médaillons et l'Opéra ; tampons « INUTILE » et « MONSTRUEUSE » ; le restaurant, la fenêtre sur Paris sans la tour |
| Comment elle a survécu | météo, vent ; l'antenne ; 1898, premier message jusqu'au Panthéon ; l'armée ; 1910 : +70 ans ; la guerre de 14 (la Marne, Mata Hari) | anémomètre qui tourne ; ondes radio ; carte de Paris, liaison de 4 km, morse ; soldats ; contrat 1910, tampon « +70 ANS » ; poste d'écoute, bande morse ; carte de la Marne, taxis ; Mata Hari « ARRÊTÉE » |
| Grand retournement | « La tour qu'on voulait démonter est devenue une arme. » | la tour émet, « À DÉMONTER » s'efface, « UNE ARME » |
| **Phrase miroir** | « Ce n'est pas sa beauté qui l'a sauvée. C'est une antenne. » | la tour dorée sur des rayons, puis zoom sur l'antenne qui émet |

## Versions

- **v1** : l'accroche « mythe contre réalité » du gabarit (« La tour Eiffel a été construite pour durer. Et les Parisiens l'ont aimée tout de suite… c'est faux »).
- **v2** (retour client : accroche trop faible) : on ouvre sur la question « pourquoi voulait-on la détruire ? », et la phrase miroir y répond. Seule l'accroche a été régénérée (50 crédits) puis raccordée à la voix d'origine à partir de « Paris prépare l'Exposition… ».

## Faits (vérifiés, formulés avec prudence)

- **Chantier** :
  - du 28 janvier 1887 au 31 mars 1889, soit 2 ans, 2 mois et 5 jours ;
  - 18 038 pièces de fer et 2 500 000 rivets ;
  - 300 m sans le drapeau (312 m avec).

  [Wikipédia](https://fr.wikipedia.org/wiki/Tour_Eiffel)
- **Concession de 20 ans** :
  - l'article 11 de la convention du 8 janvier 1887 donne à Eiffel la jouissance de la tour pour 20 ans, jusqu'au 31 décembre 1909 ;
  - elle revient ensuite à la Ville de Paris ;
  - le contrat prévoyait qu'on puisse la démonter : sa destruction était envisagée pour 1910.

  [Wikipédia](https://fr.wikipedia.org/wiki/Tour_Eiffel), [toureiffel.paris](https://www.toureiffel.paris/en/news/130-years/how-did-radio-save-tower)
- **La protestation des artistes** :
  - « Protestation contre la tour de M. Eiffel », publiée dans *Le Temps* le 14 février 1887 ;
  - signée notamment par Charles Garnier, Guy de Maupassant, Charles Gounod, Alexandre Dumas fils, Leconte de Lisle ;
  - elle parle de « l'inutile et monstrueuse tour Eiffel ».
- **Maupassant au restaurant** : c'est une anecdote célèbre, mais rapportée sans source sûre. D'où le « dit-on ».
- **TSF** :
  - le 5 novembre 1898, Eugène Ducretet établit la première liaison radio en morse entre la tour et le Panthéon (environ 4 km) ;
  - Eiffel finance la météo, l'aérodynamique et les expériences du capitaine Ferrié à partir de 1903 ;
  - la station militaire devient permanente en 1909, et la concession est prolongée de 70 ans à partir du 1ᵉʳ janvier 1910.

  [toureiffel.paris](https://www.toureiffel.paris/en/news/130-years/how-did-radio-save-tower)
- **1914-1918** :
  - la station capte des messages allemands ; ceux sur l'arrêt de l'avancée de von der Marwitz aident la contre-offensive de la Marne ;
  - en 1917, un message intercepté sur l'agent « H-21 » contribue à l'arrestation de Mata Hari.

  [toureiffel.paris](https://www.toureiffel.paris/en/news/130-years/how-did-radio-save-tower)

## Production

- **Voix** : Magnific / ElevenLabs « Gabriel Dubois » (`voiceId` 480, `eleven_v4`, stabilité 0,4, 384 crédits), consigne `[energetic, punchy, fast delivery]`.
  - Une seule prise.
  - Temps des mots avec Whisper ; pauses à 0,16 s, respirations avant les questions et la phrase miroir.
  - Tempo ×1,1 → 73,2 s (v2), 288 mots, soit 236 mots/min.
- **Sons** :
  - banque `../_engine/style-anime/sfx/`, plus `onde-radio` du style 3D, et 1 son ajouté (10 crédits) : `morse` ;
  - 89 bruitages (v2) ;
  - mixage `mix_anime.py` : voix 19,6 dB au-dessus du fond pendant la parole (médiane).
- **Rendu** :
  1. `npx --yes hyperframes@0.8.168 render --fps 120 --quality looks --output renders/raw120-v2.mp4`
  2. `python3 -I ../_engine/style-histoire/finish.py renders/raw120-v2.mp4 renders/tour-eiffel-v2.mp4`

  MP4 non commités.

## Publication (proposition)

- **Description** : « Elle devait être démontée en 1909… Tu savais ce qui l'a sauvée ? 👇 #paris #toureiffel #histoire #lesaviezvous »
- **Heure** : soirée, heure de Paris (19 h–21 h).
