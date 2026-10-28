# Style ANIMÉ — gabarit

Dessin vectoriel animé, reproduit d'après la vidéo de référence du client (« Les africains sentent mauvais… », 98 s). Modèles : `videos/test-cartoon/` (test de 15 s) et `videos/cowboys/` (première vidéo complète, en anglais).

La règle « images réelles uniquement » du style RÉEL **ne s'applique pas** ici : tout est dessiné en SVG et CSS dans `index.html`. Les cartes viennent de Natural Earth (domaine public).

## 1. Gabarit de script (à suivre pour chaque vidéo)

Le format est « mythe contre réalité ». Le script doit permettre une image par phrase. Viser **60 à 100 s**, soit environ 230 à 380 mots à un débit d'environ 220 mots/min.

| # | Temps | Rôle | Règle | Exemple de la référence |
|---|---|---|---|---|
| 1 | 0–3 s | **Accroche = le mythe énoncé comme vrai** | Formulé comme le pense quelqu'un qui y croit, choquant, ≤ 7 mots à l'écran. Idéalement **deux affirmations**, qui deviendront les deux parties. | « Les africains sentent mauvais, et sans les blancs, ils ne seraient rien. » |
| 2 | 3–6 s | **Démenti et promesse** | Toujours la même formule. | « Ça, c'est ce que l'histoire veut nous faire croire. Sauf que c'est faux, et je vais te le prouver. » |
| 3 | — | **Question d'ouverture de la partie 1** | Elle répète le mythe sous forme de question, pour que le spectateur sache où il en est. | « D'où vient cette histoire d'odeur ? » |
| 4 | — | **Origine du mythe, puis accusation retournée** | La cause réelle, puis une chute en antithèse **« X, pas Y »**. | « Cette odeur, c'était celle de la cruauté des négriers, pas celle des africains. » |
| 5 | — | **Qui a inventé le mythe, et pourquoi** | Un nom, une date et une citation, puis 2 ou 3 phrases coupées. | « En 1785, Thomas Jefferson… Aucune preuve. Juste un prétexte pour déshumaniser. » |
| 6 | — | **L'accusateur faisait pire** | « Et pendant ce temps-là, … » | Versailles, où l'on se lavait à peine |
| 7 | — | **Le contre-exemple au même moment** | « Au même moment, … », avec 2 ou 3 **détails concrets et sensoriels**, puis une chute qui retourne la morale. | savon noir, karité, bâtonnet ; « La leçon d'hygiène ne venait pas du côté qu'on croit. » |
| 8 | — | **Question d'ouverture de la partie 2** | Elle reprend la 2ᵉ moitié de l'accroche. | « Et sans les blancs, l'Afrique ne serait rien ? » |
| 9 | — | **Preuves en rafale** | 3 à 5 preuves, chacune avec **un chiffre ou un nom propre**, et des listes de trois. | Égypte −4 500 ans, Nok, Mansa Moussa, Tombouctou ; « Astronomie, médecine, droit. » |
| 10 | — | **Grand retournement** | Une question courte, puis l'accusateur dépendait en fait de l'accusé. | « Et l'Europe, alors ? » Nantes, Bordeaux, 12 millions, révolution industrielle… |
| 11 | dernières s | **Phrase miroir de l'accroche** | La fin **répond mot pour mot à la première phrase**, retournée (chiasme). Elle fait boucler la vidéo. | « Ce n'est pas l'Afrique qui ne serait rien sans l'Europe. C'est l'Europe qui ne serait pas ce qu'elle est aujourd'hui sans l'Afrique. » |

**Règles d'écriture :**

- **Pas de « Bilan » ni de « Bottom line »**, pas de question finale, pas de « abonne-toi » ni de « écris en commentaire » : la vidéo se termine sur la phrase miroir. Le texte de la description TikTok porte l'appel aux commentaires.
- **Phrases courtes**, spectateur tutoyé (« je vais te le prouver »), presque une **date, un chiffre ou un nom propre par phrase**. Ce sont eux qui donnent l'autorité.
- **Courbe d'émotion** : indignation, puis preuve, puis ironie (l'accusateur faisait pire), puis fierté, puis retournement.
- **Une phrase = une image** : si on ne voit pas quoi dessiner pour une phrase, la réécrire.
- **Une vidéo courte (≈ 60 s) n'a qu'une partie** : on saute les étapes 8 et 9. L'accroche n'a alors qu'une affirmation, mais on garde les questions d'ouverture, l'accusation retournée et la phrase miroir.
- **Faits** : vérifier chaque chiffre et chaque citation. Ce qui est incertain se dit avec prudence dans la voix (« selon ses mémoires », « on dit que », « certains historiens pensent »). Les nombres sont écrits en lettres dans le texte de la voix et affichés en chiffres à l'écran.

**Squelette à remplir** (français ; en anglais : « That's what they want you to believe. But it's false, and I'm going to prove it. »)

```
[MYTHE A], et [MYTHE B].
Ça, c'est ce qu'on veut te faire croire. Sauf que c'est faux, et je vais te le prouver.
[Question qui reprend A] ?
[Cause réelle, concrète]. [Antithèse : « C'était X, pas Y. »]
[Date], [personne] [écrit / décide] [citation ou fait]. [Fragment court.] [Fragment court.]
Et pendant ce temps-là, [l'accusateur faisait pire].
Au même moment, [contre-exemple + 2-3 détails]. [Chute qui retourne la morale.]
[Question qui reprend B] ?
[Preuve 1 + chiffre]. [Preuve 2 + nom]. [Preuve 3 + date]. [Liste de trois.]
Et [l'accusateur], alors ? [Ce qu'il doit à l'accusé, en rafale.]
[Phrase miroir : l'accroche retournée.]
```

## 2. Image (ce que le moteur dessine)

- **Fonds** : sombres, avec un halo radial et un vignettage. Rayons qui tournent lentement pour les moments forts (doré pour la fierté, rouge, bleu). Rayures de papier peint ou bois pour les intérieurs, coucher de soleil, nuit.
- **Beaucoup d'illustrations, pas seulement des personnages** (demande du client) :
  - chaque scène a un **décor illustré** qui raconte la phrase (plantation, bâtiment officiel, carrefour avec voitures, tunnel, ville qui s'allume, labo, salon, pas de tir…) ;
  - plusieurs **objets animés** par scène ;
  - le personnage passe **en médaillon** rond (300 px) avec sa plaque de nom ;
  - le grand buste est réservé aux moments forts (accroche, phrase miroir) ;
  - modèle : `videos/inventeurs/`.
- **Personnages en buste**, dessinés en SVG :
  - peau, coiffure (cheveux courts, tresses, gris), chapeau (cowboy, sombrero, paille), moustache, bandana, lunettes ;
  - humeur : triste, neutre, sûr de lui, en colère ;
  - ils clignent des yeux.
- **Objets** : chandelle, cartes de papier, tampons rouges (« FAUX », « FALSE »), balance, pièces qui tombent, affiches WANTED, étoile, bobines, clap, sacs, lasso, longhorn.
- **Cartes** : Natural Earth projetée en SVG ; le pays ou l'État s'allume en or avec une lueur, puis une pastille de nom, une piste et un troupeau.
- **Chiffres** : Anton doré lumineux (« 1789 », « 1 IN 4 », « 3,000+ ») qui comptent jusqu'à leur valeur.
- **Montage** :
  - une coupe sèche par phrase ou demi-phrase (toutes les 1 à 6 s) ;
  - à chaque coupe, la caméra remonte légèrement puis pousse lentement de 6 % ;
  - les objets arrivent en ressort sur leur mot.
- **Sous-titres** : Bebas Neue en majuscules, 84 px, blanc avec contour noir, 2 à 4 mots, **le mot prononcé dans une case rouge `#d7263d`**, à hauteur d'environ 1 400 px.
- **Barre de progression** dorée `#f2b705` en haut, 9 px.

## 3. Production

- **Voix** :
  - Analyse de la référence : voix d'homme jeune (20–30 ans), accent de France, synthétique (type ElevenLabs), énergique, débit d'environ 240 mots/min. Hauteur médiane d'environ 200 Hz, donc nettement plus aiguë et vive que « Charon » (128 Hz).
  - Voix la plus proche mesurée (timbre MFCC) : **Thomas Perrin** (catalogue ElevenLabs de Magnific, `audio_tts`, modèle `eleven_v4`), avant Gabriel Dubois, Maxime Giraud et Théo Laurent. Charon est la plus éloignée.
  - Consigne en tête du texte : `[energetic, punchy, fast delivery]`, MAJUSCULES sur le mot à frapper (« c'est FAUX »).
  - Coût : 58 crédits Magnific pour un extrait de 13 s, soit environ 270 crédits pour une minute de voix.
  - Ne pas cloner la voix du créateur de la référence : on prend une voix du catalogue qui s'en approche.
  - Charon (FLORA) reste possible pour un ton plus grave de documentaire.
- **Temps des mots** :
  - Whisper mot à mot sur la prise entière (`npx hyperframes transcribe … --json`), car la voix ne fait presque pas de pauses ;
  - corriger les noms mal entendus en comparant avec l'autre prise ;
  - puis `align_voice.py` : pauses à 0,14–0,16 s, tempo ×1,1 à ×1,18 pour arriver vers 210–230 mots/min.
- **Musique** : `../style-histoire/musique-bed.mp3` en **continu** (pas de scratch). Dans la référence, la musique est un fond de suspense (nappe, pulsation grave), constant, environ 9 dB sous la voix (voix −21 LUFS, musique + sons −29,6 LUFS avant mastering).
- **Sons : trois couches** (mesurées sur la référence en séparant voix et fond avec Demucs : 80 sons en 98 s, soit **un son toutes les 1,2 s**) :
  1. **Bruitage illustratif sur chaque dessin.** C'est la couche qui manquait. Chaque objet qui apparaît a son vrai son :
     - mouches, parfum, tampon, horloge, tonnerre, chaînes, goutte d'eau ;
     - scintillement, balance, compteur, papier, plume, feu, ping sur la carte ;
     - frottement, éclaboussure, forge, pièces, usine, canon, pluie.
  2. **Boom grave de cinéma** (sous-basse 55–67 Hz, environ 1,2 s, +25 dB au-dessus de la musique), environ 16 par vidéo, uniquement sur les phrases fortes : les deux affirmations de l'accroche, « FAUX », « Aucune preuve », les questions d'ouverture, les grands chiffres, la phrase miroir.
  3. **Liaisons** : souffle (whoosh) court sur les coupes, montée (riser) avant un retournement.
- **Banque de sons** : `sfx/` contient 25 sons générés avec Magnific (ElevenLabs SFX, environ 225 crédits), normalisés à −1 dB crête. Le fichier porte le nom du son : `boom-cine`, `riser`, `whoosh`, `tampon`, `ding`, `scintille`, `compteur`, `ping-carte`, `papier`, `plume`, `balance`, `horloge`, `goutte`, `eclaboussure`, `spray`, `frottement`, `mouches`, `chaines`, `pieces`, `forge`, `usine`, `feu`, `tonnerre`, `canon`, `pluie`.
  - Un son manque pour un nouveau dessin ? Le générer avec `audio_sfx_generate` (1–3 s, 5 crédits par seconde) et l'ajouter ici.
  - Volumes conseillés : bruitages 0,25–0,4, boom 0,35–0,45, whoosh 0,2.
- **Rendu** :
  1. `npx --yes hyperframes@0.8.168 render --fps 120 --quality looks --output renders/raw120.mp4`
  2. `python3 -I ../_engine/style-histoire/finish.py …` (60 i/s, −14 LUFS)
- **Description TikTok** : l'accroche, les mots-clés et 3 à 5 hashtags. C'est **ici** qu'on invite à commenter, pas dans la vidéo.
