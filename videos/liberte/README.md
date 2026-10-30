# « La Statue de la Liberté a été construite pour les immigrants ? Faux. » — style ANIMÉ, en français

Vidéo en **style ANIMÉ** écrite sur le gabarit de `../_engine/style-anime/README.md`. Elle dure **≈ 73,7 s**, avec la voix de **Gabriel Dubois**. Tout est dessiné en SVG et CSS dans `index.html`, y compris la statue. Les animations demandées sont là : **la statue se construit** (squelette de fer, plaques de cuivre rangée par rangée, statue finie), puis **la caméra descend** de la torche aux **chaînes cachées à ses pieds**. Le son est mixé sous la voix par `../_engine/style-anime/mix_anime.py`.

| Étape du gabarit | Texte | Image |
|---|---|---|
| Accroche (mythe en deux affirmations) | « La Statue de la Liberté a été construite pour accueillir les immigrants. C'est pour eux qu'elle lève sa torche. » | le port la nuit, la statue sur son socle, un bateau d'immigrants qui arrive ; gros plan sur la torche qui s'allume |
| Démenti | « Ça, c'est ce qu'on veut te faire croire… » | carte postale « GREETINGS FROM NEW YORK · BIENVENUE AUX IMMIGRANTS », tampon « FAUX » |
| Question d'ouverture | « Construite pour les immigrants ? Remontons en 1865. » | calendrier « 1865 » |
| Origine réelle | fin de la guerre de Sécession, esclavage aboli ; Laboulaye, juriste, cofondateur et président de la Société française contre l'esclavage ; l'idée (« raconte-t-on ») | drapeau, canon, une chaîne qui se brise ; Laboulaye en médaillon, toast « VICTOIRE DU NORD » ; acte de la société, tampon « PRÉSIDENT » ; dîner aux chandelles, ampoule |
| Accusation retournée | « Un cadeau pour la fin de l'esclavage. Pas une porte d'entrée. » | paquet cadeau orné d'une chaîne brisée / porte barrée |
| Bartholdi et les chaînes | maquettes ; une maquette avec des chaînes brisées dans la main gauche, remplacées par la tablette du 4 juillet 1776 | atelier, maquettes ; esquisse sépia où la chaîne rougit ; tablette « JULY IV MDCCLXXVI » |
| **La statue se construit** | Eiffel, le squelette de fer ; les plaques de cuivre | le treillis de fer monte dans la silhouette, puis 12 rangées de cuivre, puis la statue cuivrée |
| **Les chaînes cachées** | « Bartholdi les a cachées à ses pieds » ; fer ouvert, chaîne brisée, pied droit qui avance ; invisibles depuis le sol | **la caméra descend la statue jusqu'aux pieds**, les chaînes deviennent dorées ; gros plan des pieds, le talon se lève ; vue du sol (socle immense), hélicoptère « VUE D'EN HAUT » |
| Le poème | Emma Lazarus, 1883, pour le socle ; oublié ; inauguration en 1886 sans lui ; Ellis Island en 1892 ; plaque en 1903, 17 ans après | médaillon, « THE NEW COLOSSUS », pièces pour le socle ; le poème glisse dans un tiroir, « OUBLIÉ » ; feux d'artifice, « SANS LE POÈME » ; bâtiment d'Ellis Island ; plaque de bronze et frise 1886 → 1892 → 1903 |
| Grand retournement | « Son vrai nom ? La Liberté éclairant le monde. » | la statue, la torche qui brille |
| **Phrase miroir** | « Elle n'a pas été construite pour accueillir les immigrants. Elle a été construite pour célébrer des chaînes brisées. » | la statue dans la lumière dorée, la caméra plonge vers les chaînes brisées dorées |

## Faits (vérifiés, formulés avec prudence)

- **Laboulaye** : partisan de Lincoln, abolitionniste. Il est cofondateur et président de la Société française contre l'esclavage (French Anti-Slavery Society), fondée en 1865, l'année de la victoire de l'Union et de l'abolition de l'esclavage aux États-Unis. [NPS — Abolition](https://www.nps.gov/stli/learn/historyculture/abolition.htm)
- **L'idée en 1865** : elle vient du récit de Bartholdi, que des historiens discutent ; d'où le « raconte-t-on » dans la voix. [MCNY — mythes sur l'origine](https://blog.mcny.org/2014/01/28/myths-surrounding-the-origin-of-the-statue-of-liberty/)
- **Les chaînes dans la main** :
  - une maquette de Bartholdi vers 1870 (Museum of the City of New York) semble tenir une chaîne ou un fer brisé dans la main gauche ;
  - le musée dit n'avoir aucun document sur la symbolique ;
  - d'où le « selon plusieurs historiens ».
- **Les chaînes aux pieds** : la version finale porte la tablette « JULY IV MDCCLXXVI ». Un fer brisé et une chaîne reposent au pied droit ; la chaîne passe sous la draperie et ressort devant le pied gauche, avec son dernier maillon brisé. [NPS — Abolition](https://www.nps.gov/stli/learn/historyculture/abolition.htm) On les voit mal depuis le sol.
- **Construction** : Gustave Eiffel conçoit la structure intérieure en fer ; la peau est faite de plaques de cuivre martelées, montées à Paris avant le voyage.
- **Le poème** :
  - « The New Colossus » est écrit par Emma Lazarus en 1883 pour une vente aux enchères au profit du socle ;
  - Emma Lazarus meurt en 1887 ;
  - son amie Georgina Schuyler redécouvre le poème en 1901 et fait poser la plaque de bronze dans le socle en 1903.

  [Wikipédia](https://en.wikipedia.org/wiki/The_New_Colossus), [NPS — Emma Lazarus](https://www.nps.gov/stli/learn/historyculture/emma-lazarus.htm)
- **Dates** :
  - inauguration le 28 octobre 1886 ;
  - Ellis Island ouvre comme centre d'immigration le 1ᵉʳ janvier 1892.

  Nom officiel : « La Liberté éclairant le monde ».

## Production

- **Voix** : Magnific / ElevenLabs « Gabriel Dubois » (`voiceId` 480, `eleven_v4`, stabilité 0,4, 386 crédits), consigne `[energetic, punchy, fast delivery]`.
  - Une seule prise.
  - Temps des mots avec Whisper ; pauses à 0,16 s, respirations avant les questions et la phrase miroir.
  - Tempo ×1,1 → 72,6 s, 290 mots, soit 240 mots/min.
- **Sons** :
  - banque `../_engine/style-anime/sfx/`, avec 3 sons ajoutés (40 crédits) : `corne-bateau`, `feux-artifice`, `helico` ;
  - 91 bruitages ;
  - mixage `mix_anime.py` : voix 19,2 dB au-dessus du fond pendant la parole (médiane).
- **Rendu** :
  1. `npx --yes hyperframes@0.8.168 render --fps 120 --quality looks --output renders/raw120.mp4`
  2. `python3 -I ../_engine/style-histoire/finish.py renders/raw120.mp4 renders/liberte.mp4`

  MP4 non commités.

## Publication (proposition)

- **Description** : « On t'a dit qu'elle accueillait les immigrants… Regarde ses pieds. Tu avais déjà vu ces chaînes ? 👇 #histoire #statuedelaliberte #esclavage #lesaviezvous »
