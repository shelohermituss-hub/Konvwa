# « Le docteur Guillotin a inventé la guillotine ? Faux. » — style ANIMÉ, en français

Vidéo en **style ANIMÉ** écrite sur le gabarit de `../_engine/style-anime/README.md`. Elle dure **≈ 71,4 s**, avec la voix de **Gabriel Dubois**. **L'animation est sobre**, comme demandé : la machine est montrée en dessin, en plan ou en silhouette, jamais en usage ; il n'y a ni victime ni violence. Tout est dessiné en SVG et CSS dans `index.html`. Chaque scène a son décor illustré, les personnages en perruque poudrée apparaissent en médaillons, et chaque dessin a son bruitage. Le son est mixé sous la voix par `../_engine/style-anime/mix_anime.py`.

| Étape du gabarit | Texte | Image |
|---|---|---|
| Accroche (mythe en deux affirmations) | « Le docteur Guillotin a inventé la guillotine. Il lui a même donné son nom. » | Guillotin en buste, la silhouette de la machine derrière lui, « INVENTEUR » ; plaque de laiton « GUILLOTIN » + « E » |
| Démenti | « Ça, c'est ce qu'on veut te faire croire… » | manuel « HISTOIRE DE FRANCE », tampon « FAUX » |
| Question d'ouverture | « Il l'a inventée ? » | « 1ER DÉCEMBRE 1789 », l'hémicycle de l'Assemblée, drapés tricolores |
| Origine réelle | député et médecin ; « la même peine pour tous » ; noble à l'épée, pauvre pendu ou roué | médaillon, sac de médecin ; projet de loi écrit à la plume, balance qui s'équilibre ; noble et pauvre côte à côte (épée, corde, roue) ; les marches du rang s'abaissent au même niveau |
| Accusation retournée | « Il parle d'une machine, mais il n'en dessine aucune. Il proposait une loi, pas une lame. » | feuille blanche, « AUCUN PLAN » ; « LOI » contre une lame barrée |
| Qui l'a conçue | Antoine Louis, 1792 : deux montants, une lame en biais, une corde ; Tobias Schmidt construit le prototype ; « la Louison » | Académie de chirurgie ; **plan technique tracé trait par trait** ; clavecin, marteau, la machine se monte ; plaque « LOUISON » et flèche vers Louis |
| Et pendant ce temps-là | la chanson royaliste, le surnom | journal « Les Actes des Apôtres », notes de musique ; l'étiquette « GUILLOTINE » se colle sur « LOUISON » |
| Preuves en rafale | Halifax (XVIᵉ s.), « la Vierge » en Écosse (1564), la mannaia en Italie | trois cartes de pays ; frise 1564 → 1792, « + 2 SIÈCLES » |
| Grand retournement | « Il a fini guillotiné ? Non. » Il meurt dans son lit en 1814 ; « la tache involontaire de sa vie » ; la famille change de nom | tampon « NON », chambre, chandelle ; tache d'encre sur le parchemin ; pétition « REFUSÉ », **plaque « FAMILLE GUILLOTIN » barrée, « NOUVEAU NOM »** |
| **Phrase miroir** | « Il n'a pas inventé la machine. La machine a pris son nom. » | la machine dans la lumière dorée, sa plaque prend le nom : « GUILLOTIN » puis « E » |

## Faits (vérifiés, formulés avec prudence)

- **1ᵉʳ décembre 1789** : Joseph-Ignace Guillotin, médecin et député, présente à l'Assemblée un projet de réforme pénale :
  - les mêmes délits sont punis des mêmes peines, « quels que soient le rang et l'état du coupable » ;
  - la décapitation devient le seul supplice ;
  - elle se fait par un « simple mécanisme ».

  Il ne dessine pas de machine. [Wikipédia](https://fr.wikipedia.org/wiki/Joseph-Ignace_Guillotin)
- **Avant** : la décapitation (à l'épée ou à la hache) était réservée aux nobles ; les autres condamnés étaient pendus, et certains crimes punis de la roue.
- **1792** : Antoine Louis, chirurgien et secrétaire perpétuel de l'Académie de chirurgie, rédige l'avis technique (lame oblique) et met l'appareil au point. Tobias Schmidt, facteur de clavecins allemand, construit le prototype. Premier usage le 25 avril 1792. La machine est d'abord surnommée « la Louison » ou « la Louisette ». Le nom « guillotine » vient d'une chanson moqueuse du journal royaliste *Les Actes des Apôtres*. [Wikipédia (en)](https://en.wikipedia.org/wiki/Guillotine)
- **Machines antérieures** :
  - le gibet de Halifax, en Angleterre, attesté au XVIᵉ siècle et utilisé jusqu'en 1650 ;
  - la « Maiden » (« la Vierge ») en Écosse, construite en 1564 ;
  - la mannaia en Italie.
- **Guillotin** :
  - il meurt de causes naturelles le 26 mars 1814 à Paris ;
  - la légende qui le fait guillotiné vient d'une confusion avec un homonyme lyonnais ;
  - il parlait de la machine comme de « la tache involontaire de [sa] vie ».
- **La famille** : selon plusieurs sources, ses descendants ont demandé qu'on rebaptise la machine ; devant le refus, ils ont changé de nom. Le nouveau nom n'est pas connu, d'où le « dit-on » dans la voix et la plaque « NOUVEAU NOM » à l'écran. [Wikipédia (en)](https://en.wikipedia.org/wiki/Joseph-Ignace_Guillotin)

## Production

- **Voix** : Magnific / ElevenLabs « Gabriel Dubois » (`voiceId` 480, `eleven_v4`, stabilité 0,4, 336 crédits), consigne `[energetic, punchy, fast delivery]`.
  - Une seule prise.
  - Temps des mots avec Whisper ; pauses à 0,16 s, respirations avant les questions et la phrase miroir.
  - Tempo ×1,1 → 70,3 s, 270 mots, soit 230 mots/min.
- **Sons** :
  - banque `../_engine/style-anime/sfx/`, avec 4 sons ajoutés (40 crédits) : `marteau`, `lame`, `plaque`, `clavecin` ;
  - 100 bruitages ;
  - mixage `mix_anime.py` : voix 19,6 dB au-dessus du fond pendant la parole (médiane).
- **Rendu** :
  1. `npx --yes hyperframes@0.8.168 render --fps 120 --quality looks --output renders/raw120.mp4`
  2. `python3 -I ../_engine/style-histoire/finish.py renders/raw120.mp4 renders/guillotin.mp4`

  MP4 non commités.

## Publication (proposition)

- **Description** : « Guillotin n'a jamais inventé la guillotine… et il a passé sa vie à le regretter. Tu le savais ? 👇 #histoire #révolutionfrançaise #guillotine #lesaviezvous »
