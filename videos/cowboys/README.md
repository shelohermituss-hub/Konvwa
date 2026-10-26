# « Cowboys were all white? False. » — style ANIMÉ, en anglais

Première vidéo complète en **style ANIMÉ** (dessin vectoriel animé, d'après la vidéo de référence du client), en anglais pour le public américain. Durée : **≈ 67,5 s**.

- Tout est dessiné en SVG et CSS dans `index.html`, sans aucune image : bustes, chapeaux, longhorns, lasso, fer à marquer, fer à cheval, étoile de marshal, affiches WANTED, masque, bobines, clap, panneau HOLLYWOOD, désert.
- Carte des États-Unis : Natural Earth 1:50m (domaine public).
- Comme dans la référence :
  - fonds sombres avec halo ou rayons ;
  - coupes sèches toutes les 1 à 6 s avec poussée de caméra ;
  - sous-titres Bebas Neue en majuscules, 2 à 4 mots, mot prononcé dans une case rouge ;
  - barre de progression dorée ;
  - musique continue.

| Plan | Ce qu'on voit |
|---|---|
| Accroche | cowboy blanc « à la Hollywood » en sépia, pellicule rayée, désert |
| Hollywood | panneau HOLLYWOOD la nuit, projecteurs, compteur « 100 YEARS » |
| False | tampon « FALSE » sur le cowboy d'Hollywood, puis un cowboy noir sur rayons dorés |
| 1865 | carte des États-Unis, le Texas s'allume, « MILLIONS OF CATTLE », piste du Texas à Abilene (Kansas), troupeau de longhorns |
| Le métier | un ancien esclave, icônes lasso, fer à cheval et fer à marquer (ROPE · RIDE · BRAND), un chapeau tombe sur sa tête |
| 1 sur 4 | quatre cowboys, un seul reste éclairé, « 1 IN 4 » |
| Vaqueros | vaquero au sombrero, rayons rouges ; quatre cartes LASSO, RODEO, CHAPS, BUCKAROO avec leur mot espagnol |
| Nat Love | buste, plaque, compteur « 15 years old » ; ses mémoires, lasso qui tourne, « 1876 », « DEADWOOD DICK » |
| Bill Pickett | buste, longhorn, « BULLDOGGING », poussière, tampon « CHOMP! », « STILL IN RODEOS TODAY » |
| Bass Reeves | buste, étoile de marshal, « DEPUTY U.S. MARSHAL » ; pluie d'affiches WANTED, « 3,000+ OUTLAWS ARRESTED », masque « THE LONE RANGER? » |
| Hollywood | bobines qui tournent, clap qui claque, « REWRITTEN » |
| Bottom line | coucher de soleil, quatre cowboys (noir, blanc, mexicain, amérindien), « THE REAL WILD WEST » |
| Question | grand « ? », « TELL ME BELOW », flèche vers les commentaires |

## Faits (vérifiés, formulés avec prudence)

- **Après la guerre de Sécession**, le Texas compte des millions de bovins (environ 5 millions de longhorns selon les estimations courantes). Ils sont conduits vers le nord, vers les gares du Kansas (piste Chisholm vers Abilene).
- **« As many as one in four cowboys was Black »** : c'est l'estimation haute couramment citée par les historiens (« jusqu'à un sur quatre »).
- **Vaqueros** : *lasso* vient de *lazo*, *rodeo* de l'espagnol *rodeo*, *chaps* de *chaparreras*, *buckaroo* de *vaquero*.
- **Nat Love** :
  - né esclave dans le Tennessee en 1854, il part dans l'Ouest vers 15 ans ;
  - le concours de lasso de Deadwood (4 juillet 1876) et le surnom « Deadwood Dick » viennent **de ses propres mémoires** (1907), ce que dit la voix.
- **Bill Pickett** : on lui attribue l'invention du *bulldogging* (lutte avec un bouvillon), qu'il pratiquait en mordant la lèvre de l'animal. C'est toujours une épreuve de rodéo.
- **Bass Reeves** :
  - né esclave, il devient en 1875 l'un des premiers marshals adjoints noirs à l'ouest du Mississippi ;
  - on dit (« he's said to ») qu'il a arrêté plus de 3 000 hors-la-loi ;
  - l'idée qu'il aurait inspiré le Lone Ranger est une hypothèse débattue (« some historians believe »).
- **Détail visuel** : la récompense « $500 REWARD » des affiches est décorative.

## Production

- **Voix** :
  - FLORA / Gemini TTS « Charon » (en-US), ton « narrateur TikTok qui démonte un mythe ». 2 prises (≈ 0,026 $), la 1ʳᵉ est gardée.
  - Temps des mots : Whisper mot à mot sur la prise entière (« Matt » corrigé en « Nat », vérifié sur l'autre prise).
  - Pauses réduites à 0,16 s, courtes respirations avant « Take Nat Love », « And then there's Bass Reeves » et « Bottom line », tempo ×1,18 (≈ 210 mots/min) → `assets/vo/vo.wav` (66,5 s).
- **Nombres** : dits en toutes lettres, affichés en chiffres (« 15 », « 1876 », « 3,000 »).
- **Musique et sons** : `../_engine/style-histoire/musique-bed.mp3` en continu (pas de coupure), effets de la série calés sur les mots.
- **Polices** : Bebas Neue et Anton (SIL OFL).
- **Rendu** :
  1. `npx --yes hyperframes@0.8.168 render --fps 120 --quality looks --output renders/raw120.mp4`
  2. `python3 -I ../_engine/style-histoire/finish.py renders/raw120.mp4 renders/cowboys.mp4`
  MP4 non commités.

## Publication (proposition)

- **Description** : « Cowboys were all white? Hollywood lied. As many as 1 in 4 cowboys was Black — meet Nat Love, Bill Pickett and Bass Reeves. #blackhistory #cowboy #wildwest #history #bassreeves »
- **Heure** : soirée à New York (19 h–21 h).
