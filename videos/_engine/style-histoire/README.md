# Style « histoire express » v3 — le style validé par le client

**Règle : toute nouvelle vidéo de faits / histoire (Haïti, drapeaux, anecdotes…) reprend exactement ce style v3**, sauf demande contraire explicite. Le client a validé la v2 (« Garde le style v2 pour toutes les prochaines vidéos »), puis les ajouts « affiche » de la vidéo de la reine à Pise (« C'est parfait, mets à jour le style pour garder les modifications actuelles »).

- **Modèle à copier** : `videos/reine-pise/` (v3 complète : viseur, disques orange, mots fantômes, micro-typo ; pour les images, suivre plutôt `videos/croyances/` : uniquement des photos et détourages réels, sans disque). Pour la mécanique de base, `videos/santa-maria-2014/` et `videos/or-haiti-1914-v2/`. On copie l'`index.html` (CSS, `ctl(t)`, helpers) et on ne réécrit que les scènes, les blocs de texte et les transitions.
- Historique : v1 = `videos/drapeaux-jumeaux-tchad-roumanie/` et `videos/or-haiti-1914/` (flou plein cadre entre les parties). v2 = même chose avec le mouvement enrichi (inondation, iris, page qui pousse). v3 = v2 + accroche « viseur » et scènes « affiche » (section ci-dessous).

## Image

- 9:16 (1080×1920), **1 min ou plus (≥ 60 s)** depuis `videos/punitions-ecole/` et `videos/croyances/` (demandes du client : « vidéo une minute maintenant », puis « 1 minute ou plus » ; avant : 30 à 40 s). Pour tenir la minute : ≈ 210 à 230 mots de texte, une scène toutes les 4 s environ, voix non accélérée (×1,0) ou ×1,05 au plus ; vérifier la durée de la voix alignée avant de construire les scènes et ajouter du contenu si elle fait moins de 58 s. Fond gris clair `#E7E7E7`, grille de points discrète au centre. **Typographie : Poppins** (embarquée dans `assets/fonts/`, 500 à 900, ne pas en changer — le client a refusé un essai en serif italique), emphase en italique gras ; **le texte ne doit pas paraître plat** : ombres de relief sur les styles `m`, `b`, `bi`, `mi` (arête nette de 2 à 6 px + ombre portée douce), ombre légère sur `s`.
- **Sans marque KONVWA** (ni logo ni nom) : la couleur vient du sujet ; **plus de rouge sur tous les mots-clés** (demande du client) : chaque scène a sa couleur d'accent prise dans ses photos (brun bois, bleu craie, vert, ambre, violet, bleu marine…), le rouge haïtien `#D21034` reste rare (croix d'interdiction, alerte du compteur) ; **l'orange n'est plus obligatoire** : choisir pour chaque scène la couleur qui sert le mieux le sujet (doré au coucher du soleil, bleu nuit, vert pour l'argent, violet…). Si un disque est utilisé derrière un détourage, jamais de rouge rosé ; mais depuis `videos/croyances/` on préfère **pas de disque du tout** : le détourage seul, ou une vraie photo derrière (demande du client).
- Pastille noire en capitales en haut (`top: 96px`) tout du long : série (« DRAPEAUX JUMEAUX · ÉP. 2 ») ou thème (« HISTOIRE D'HAÏTI · 1492 »).
- **Texte = voix mot par mot**, en blocs de lignes centrées en haut (`y` ≈ 200–260 px), chaque ligne est un masque (`overflow: hidden`) :
  - mots ordinaires : arrivent flous et gris clair (`#B9B9B9`, 0,16 s) puis se posent en noir ;
  - **mots-clés** (styles `b`, `bi`, `mi`, `x`) : **montent de leur ligne avec un rebond** (`back.out(1.7)`, 0,42 s), directement dans leur couleur ;
  - sortie : tous les mots repartent vers le haut dans leur ligne (0,18 s).
  - Largeur : une ligne `m` (68 px) tient ≈ 26 caractères, `b`/`bi` (116/108 px) ≈ 14, `s` (50 px) ≈ 36 : couper les lignes plus longues.
- **Chaque scène naît de la précédente** (plus de flou plein cadre). Une vidéo alterne les trois transitions :
  - **inondation de couleur** : un disque sort d'un objet de la scène (badge, cercle, tampon), couvre l'écran en 0,3 s, puis se rétracte en 0,32 s dans l'objet de la scène suivante ;
  - **iris d'appareil photo à 6 lames** qui se ferme puis s'ouvre **sur une photo d'époque plein écran**, qui se replie ensuite en carte (`unfold`, échelle 3,4 → 1) ;
  - **page qui pousse** (vers le haut ou la gauche, 0,4 s), lancée juste après la sortie du texte pour ne pas le traverser.
  - Inondations et iris sont calculés à partir du temps dans `ctl(t)` (aucun état entre deux images).
- **Zooms de caméra** (`cam`) sur le détail qui compte (une date, un badge, une croix sur une carte), lents zooms sur les photos (`kb`). Vérifier que le zoom ne pousse pas une puce hors de l'écran (échelle ≤ 1,2 près des bords).
- **Apparitions en ressort** depuis zéro (`spring`, `back.out(1.8)`, 0,5 s), tampons rouges inclinés avec secousse sur la réplique forte, ondes de sonar, frises qui se remplissent, compteurs.
- **« Bilan »** : l'inondation noire part de l'objet de la scène précédente au moment du scratch, **reste noire pendant le silence** (« Bilan : » écrit en blanc), puis se rétracte sur le mot suivant, quand la musique revient.
- **Source des assets : Magnific uniquement** (abonnement du client, MCP `magnific`, depuis `videos/jeux-enfance/`) : images, illustrations, vecteurs, 3D, vidéos, sons se cherchent dans le catalogue Freepik/Magnific (`stock_search`, toujours avec `ai_generated: excluded` pour les photos de lieux, de gens et d'objets réels), puis `stock_download`. Unsplash, Pixabay et Wikimedia ne servent plus que si Magnific n'a vraiment rien (le noter dans le README de la vidéo).
- **Images réelles uniquement** : tableaux, cartes et photos d'époque (Wikimedia Commons avec `wmsearch.sh` / `wmget.sh`, lents exprès), Unsplash via MCP, Pixabay via `motion.mjs assets`. Jamais d'images générées par IA. **Ne jamais fabriquer d'image** (demande du client sur `videos/croyances/`) : maison, lettre, main, alliances, ciel étoilé, lune, pièces, cadenas, ampoule, note… se **cherchent** (photo ou illustration réelle, détourée avec `rembg -m birefnet-general` si besoin), jamais de dessin plat en HTML/SVG. Seuls restent en HTML le texte, les pastilles, tampons, bulles, croix rouges, flèche et l'interface du viseur. Un détourage dont un bord est coupé net (photo recadrée) entre par le bord de l'écran pour cacher la coupe. **Animations 3D permises, avec parcimonie** (accord du client) : au plus un ou deux plans courts par vidéo, et seulement quand la 3D apporte quelque chose qu'une photo ne donne pas (objet qui tourne pour montrer ses deux faces, chute d'un objet, gros plan qui pivote). En Three.js dans la composition (adaptateur `hyperframes-animation`), de préférence texturé avec une vraie photo (ex. pièce, médaille, drapeau) ; jamais à la place des vraies photos de personnes ou de lieux. Une image ne sert qu'une fois par composition (sinon en faire une variante recadrée ou en noir et blanc).

## Accroche et scènes « affiche » (v3)

Tirées des deux références du client (compte à rebours « frames to impact » dans un viseur ; affiches à disques et détourages) :

- **Accroche (≤ 3 s) = image forte + phrase forte** : une **vraie image forte** (de préférence une personne, ex. la photo du vieil homme fournie par le client pour `videos/croyances/`) est visible **dès la première image** et monte dans le cadre, dans un **viseur de caméra** (`.hud` : 4 coins, point REC rouge + timecode calculé à chaque image, légende Courier à droite, ex. « PISE · 1851 »). Un objet tombe ou frappe (couronne en `bounce.out`) et un **compteur** (`.counter2`, chiffres tabulaires) monte vers le chiffre choc, passe au rouge puis pulse. Le suspense vient du compteur, pas d'un texte en plus.
- **Au moins une image ou un objet par scène**, jamais du texte seul. Recettes :
  - **détourage sur disque** : personnage ou monument détouré (`.cut`) posé seul ou sur une vraie photo (plus de disque orange obligatoire) ; variante grise (`grayscale`) pour la mort, sépia pour la vieillesse (le disque peut alors passer au gris foncé) ;
  - **mot fantôme** géant derrière (`.ghost`, gris à 7 %, 230 à 520 px) qui dérive lentement de gauche à droite (sens alterné) : le mot ou la date de la scène (REINE, 1820, PISE, TOSCANE) ;
  - **micro-typographie** Courier en capitales (`.micro`) : coordonnées, dates, lieux, « PATRIMOINE MONDIAL »… dans un coin libre ;
  - **cartes photo** inclinées en ressort avec puce de légende, cartes « mémo » blanches (`.memo`), route en pointillés avec drapeaux miniatures et bateau qui la suit, frise qui se remplit, objets réels détourés (alliances, lettre, fer, balai…).
  - Un objet qui « revient » de scène en scène (ici la couronne : sur la reine, tombant sur le roi, posée sur la tour au Bilan) relie le récit.
- **Détourages** : `rembg i -m isnet-general-use in.jpg out.png` (marche sur les tableaux et les monuments ; le modèle humain de `hyperframes remove-background` rate les objets), puis effacer les restes à la main avec PIL (rectangles ou polygones sur l'alpha) et vérifier en gros plan.
- Placement : laisser la zone du texte (haut, jusqu'à ≈ 450 px) et la zone basse TikTok libres ; vérifier sur les captures qu'aucune carte n'en cache une autre ni une puce.

## Voix

- FLORA, modèle `t2a-gemini-3-1-flash-tts`, `voice_name: Charon`, `language_code: fr-FR`, 2 prises (≈ 0,013 $ chacune). Vouvoiement.
- Consigne : « Dis comme un conteur TikTok très dynamique : débit rapide et énergique, phrases enchaînées presque sans pause, ton captivant et <ton du sujet>, une courte pause avant « Bilan », et la question finale posée directement au spectateur. Lis les dates et les nombres exactement comme ils sont écrits : <texte> ». **Dates et nombres écrits en lettres**.
- Écouter / transcrire les deux prises : une prise peut sauter la moitié du texte.
- **Mots créoles dans la voix** : la voix fr-FR prononce mal le créole écrit (« bannann peze » sonnait « bannes en pésé »). Pour un plat ou un objet qui a un nom français courant en Haïti, écrire le texte de la voix **en français** (« banane pesée », « banane bouillie », « hareng » au lieu de « aransò ») — demande du client. Le texte à l'écran suit la voix (karaoké) ; le créole reste possible dans les pastilles, mots fantômes et tampons.
- Traitement : silences de début et de fin coupés, `npx hyperframes transcribe -m medium -l fr --json`, **recaler sur les silences (`silencedetect`) les temps de la fin de la prise** (la transcription dérive souvent après 20 s), puis `align_voice.py` (pauses raccourcies, silence ajouté avant « Bilan » et avant « Répondez », `atempo=1.1`) → `assets/vo/vo.wav` + temps de chaque mot (`T = 0,2 + RAW`).

## Son

- Musique : `musique-bed.mp3` (ElevenLabs Music via FLORA), bouclée (`acrossfade d=2`), volume 0,18. Enveloppe mixée dans `assets/music/bed.mp3` : **scratch + coupure** juste avant « Bilan », **retour fort** sur le mot qui suit, baissée sous la question finale, fondu de 1,6 s.
- Sons (repris de `videos/santa-maria-2014/assets/sfx`) : souffle + souffle court sur chaque inondation, souffle court + clic d'obturateur sur chaque iris, souffle sur chaque poussée, pop sur chaque ressort, basse sur l'accroche et le tampon, touches de clavier, montée, scintillement. Volumes 0,15 à 0,45 : **rien ne couvre la voix**.
- `build_exemple.py` (version Santa María) montre tout le câblage : enveloppe, sons des transitions, pistes sans chevauchement, remplacement de `__END__`, `__VO__`, `__SCRATCH__`, `RAW`, `WORDS`.

## Chaque seconde compte : accroche, attention, partage

Recommandations de Meta pour les Reels transmises par le client (les 6 dernières vidéos de la série sont devenues virales) : la plateforme diffuse plus largement ce que les gens **regardent jusqu'au bout, aiment, commentent et partagent**. À vérifier sur chaque nouveau texte, avant la voix :

- **Accroche (0–3 s) amusante, pertinente ou inattendue.** La première phrase dite est déjà le fait surprenant ou la situation que tout le monde reconnaît (« Pas de téléphone. Pas de jouets. »), jamais une mise en contexte (« Aujourd'hui on va parler de… », « Saviez-vous que… »). ≤ 7 mots à l'écran, image forte et mouvement dès la première image (voir l'accroche v3).
- **Garder l'attention jusqu'à la fin** :
  - une **promesse ouverte** dans les 5 premières secondes, payée plus loin (« le dernier, presque personne ne s'en souvient », numérotation N° 1 → N° 9, compteur) ;
  - **un événement visuel nouveau toutes les 2 s environ** (image, objet, tampon, compteur, transition) : aucun plan fixe sans changement plus de 3 s ;
  - pas de temps mort dans la voix (pauses raccourcies), relance avant chaque partie (« Et ce jeu est très vieux : ») ;
  - le « Bilan » arrive comme une chute, puis la question finale, sans générique ni logo pour faire durer.
- **Du contenu « c'est tout moi », qu'on a envie d'envoyer à quelqu'un** : parler au spectateur (« vous », « ton », « on »), des détails haïtiens précis et vécus (mots créoles, lakou, phrases des parents, souvenirs d'école), des situations où chacun se reconnaît et pense à un proche. Un fait doit pouvoir se raconter à quelqu'un d'autre après la vidéo.
- **De l'humour quand le sujet s'y prête** : une réplique créole de parent, un tampon décalé, une chute ; jamais moqueur envers une personne ou une croyance, et pas sur les sujets graves (morts, dictature, catastrophes).
- **Interactions** : une seule question finale qui invite à partager un savoir (section suivante) ; quand ça colle au sujet, elle peut aussi pousser à identifier quelqu'un (« Identifie celui qui gagnait toujours aux oslè »), ce qui fait à la fois commenter et partager.

### Format « 3 faits » (demande du client, modèle `videos/3-faits/`)

Pour tenir une minute sans ennuyer avec des faits courts :

- **Trois faits par vidéo**, reliés par un thème (« 3 faits que ton cerveau va refuser », « 3 choses plus vieilles que tu ne le crois ») : ça remplit la minute naturellement et ça garde le rythme.
- **Annoncer le meilleur pour la fin** dès l'accroche : « Et le troisième est le plus fou. » La carte ou la pastille N° 3 reste un « ? » jusqu'à son tour (suivi 1 · 2 · ? en bas de l'écran).
- **Chaque fait est une petite histoire en trois temps** : l'accroche (le fait dit tout de suite), deux ou trois détails surprenants (chiffres comptés à l'écran, comparaison à l'échelle), puis le retournement (« et elle ne couvre même pas tout le pays »).
- **Vérifier chaque fait avant la voix** ; si une formule courante est fausse ou dépassée, la reformuler honnêtement (« presque aussi grand ») et le dire au client.
- Nombres : **dits en toutes lettres dans le texte de la voix, affichés en chiffres à l'écran** (les mots en trop du nombre sont vides dans `WORDS`, `.w:empty { display: none }`).
- Viser **≈ 65 s**.

## TikTok : recommandation, recherche et monétisation

Conseils officiels de TikTok transmis par le client (« Comprendre le système de recommandation », « Créer des vidéos de haute qualité », tableau « Récompenses par vidéo »), et ce qu'on en tire pour chaque vidéo :

- **Le vrai frein à la monétisation, c'est la région des spectateurs, pas la qualité.**
  - Seules les vues venant des États-Unis, du Mexique, du Brésil, du Japon, de la Corée du Sud, d'Allemagne, du Royaume-Uni et de France comptent pour le Programme de récompenses (depuis le 04/12/2025).
  - Sur une vidéo du client (1,9 K vues), 89 % des vues venaient de régions non éligibles. Il n'y avait que 71 vues admissibles ; 6 % des vues venaient hors du fil Pour toi ou de la recherche, et 0,5 % étaient écartées pour temps de visionnage insuffisant.
  - Or TikTok **tient compte de la localisation et de la région de publication** et pousse les créateurs de la région : sans changement, la vidéo reste surtout montrée en Haïti.
- **Public visé : la France et la diaspora haïtienne des États-Unis et de France**, sans perdre l'identité haïtienne (le « contenu spécialisé » est ce que TikTok valorise).
  - **Sujets haïtiens** : les raconter pour quelqu'un qui a grandi en Haïti et vit ailleurs (« Si tu as grandi en Haïti… », souvenirs, nostalgie, « envoie ça à ta famille à Miami »). Un Français qui ne connaît pas Haïti doit aussi comprendre : on explique en une phrase ce qu'est le lakou ou le griot.
  - **Faits généraux** (format « 3 faits », science, histoire du monde) : ils intéressent tout public francophone. Ajouter quand c'est possible un lien avec Haïti ou la France.
  - Français standard dans la voix et le texte (règle déjà en place), créole seulement en touche.
- **Les vues venant de la recherche comptent** au même titre que le fil Pour toi.
  - Les mots qu'on taperait dans la recherche doivent être **dits dans la voix, écrits à l'écran et repris dans la description** (« faits incroyables », « le saviez-vous », « histoire d'Haïti », « Lune », « requins »…).
  - Chaque vidéo livrée est accompagnée d'une **proposition de description** (une phrase d'accroche avec ces mots-clés + 3 à 5 hashtags précis, pas de #fyp seul).
- **Durée de visionnage** : TikTok la cite en premier. Les règles « chaque seconde compte » s'appliquent : aucun moment creux, des coupes fluides, la promesse annoncée dès l'accroche et tenue jusqu'au bout. Les vidéos restent **au-dessus d'une minute**, ce que demande le programme de récompenses.
- **Variété** : le système écarte le contenu trop répétitif dans un même fil. On alterne donc les formats (faits, débat, souvenirs, histoire) et les couleurs, sans publier deux fois de suite le même gabarit.
- **Tendances** : on peut ajouter un son tendance à faible volume au moment de publier dans l'application, si ça colle au sujet, sans remplacer la voix ni la musique de la série.
- **À ne jamais faire** :
  - changer de région du compte ou utiliser un VPN pour « paraître » en France ou aux États-Unis : c'est contraire aux règles et ça met le compte en danger ;
  - acheter des vues.
  - L'audience éligible se gagne par le sujet, la langue, les mots-clés et l'heure de publication.
- **Heure de publication** : Haïti est à l'heure de New York ; Paris a 6 h d'avance (5 h pendant quelques semaines au printemps et à l'automne). Tester par exemple 12 h–13 h en Haïti (midi à New York, soir en France) contre la soirée en Haïti, et comparer la part de « vues admissibles » dans le tableau Récompenses.

## Fin : faire commenter

- Question ouverte ou OUI / NON, boutons OUI / NON en ressort, bulle blanche « Répondez ici » + flèche rouge animée vers le bouton commentaires de TikTok (`left: 860px; top: 1180px`).
- **Préférer, quand le sujet s'y prête, une question qui invite à partager un savoir** : un nom, un exemple, un souvenir que le spectateur connaît (« Quel prénom-prière connaissez-vous ? Écrivez-le en commentaire »). C'est la fin de `videos/prenoms-prieres/` puis de `videos/ti-non/` (« C'est quoi ton ti non ? »), les deux vidéos qui ont le mieux marché : chacun qui connaît un exemple a une raison de commenter, et les réponses relancent la discussion. Le visuel suit l'idée : un objet vide à remplir (badge « JE M'APPELLE » vide avec curseur qui clignote) plutôt que deux boutons. Garder OUI / NON quand il n'y a rien à partager (« Connaissiez-vous… ? »).
- Jamais de faux commentaires affichés.

## Contrôle et rendu

1. `npx --yes hyperframes@0.8.168 check` (les alertes de contraste sur les mots en cours d'apparition ou sous une inondation sont normales).
2. Captures `snapshot --at …` au milieu de chaque scène **et pendant chaque transition**.
3. `npx --yes hyperframes@0.8.168 render --fps 120 --quality looks --output renders/raw120.mp4` (≈ 7 min pour 35 s).
4. `python3 -I videos/_engine/style-histoire/finish.py renders/raw120.mp4 renders/<nom>.mp4` : 2 sous-images fusionnées → **60 i/s avec flou de mouvement**, son à **−14 LUFS** (deux passes) avec un limiteur à −2 dB (crêtes ≈ −1 dBFS après encodage), recherche des images isolées qui « sautent » (doit afficher `pops none`).
5. Vérifier le MP4 final : `ebur128` (≈ −14 LUFS, crête < −1 dBFS) et quelques images extraites avec `ffmpeg -ss`.
6. README dans le dossier de la vidéo (déroulé, transitions, faits, sources des images, coût). MP4 jamais commité.
