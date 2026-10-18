# Les 3 premières secondes — le guide des hooks

Sur TikTok, Reels et Shorts, la décision de rester ou de glisser se prend en moins de 3 secondes. Le moteur impose donc **la loi des 3 secondes** et refuse (`check`) ou signale (`qa`) ce qui la viole.

## La loi

| # | Règle | Seuil | Contrôlé par |
|---|---|---|---|
| 1 | Quelque chose bouge dès les premières images | événement visible < 0,15 s ; mouvement mesuré entre 0,05 et 0,5 s | hooks écrits ainsi ; `qa` |
| 2 | Un son dès l'ouverture | premier effet sonore < 0,15 s | `check` (hookReport) ; `qa` (crête sur 0,6 s) |
| 3 | La voix démarre tout de suite | début de voix ≤ 0,35 s (le moteur la place à 0,12 s) | `check` |
| 4 | Le message est lisible vite | ligne principale nette avant 1,6 s | `legible()` de chaque hook ; `check` |
| 5 | Court | ≤ 7 mots, ≤ 48 caractères, phrase dite ≤ 2,5 s | `check` (erreur) |
| 6 | Le hook dure 2,8 à 3,0 s | jamais plus de 3 s | calendrier |
| 7 | Un mot-clé en couleur | `*mot*` dans le texte (statement, question) | `check` (avertissement) |
| 8 | Il accroche plus que la suite | énergie visuelle du hook ≥ 90 % de celle du corps | `qa` |

## Les 10 hooks

| Type | Look | Quand l'utiliser | Champs |
|---|---|---|---|
| `hook.impact` | **Typo cinétique** sur fond blanc : chaque bloc (séparé par `|`) claque plein cadre en arrivant de derrière la caméra, l'écran tremble, le mot-clé `*orange*` éclate (traits d'impact), puis tout se range en titre géant en capitales | **par défaut** : chiffres, alertes, listes (« 4 \| \*arnaques\* \| à éviter \| en Chine ») | `text` (2 à 5 blocs), `sub?` |
| `hook.statement` | Gros mots qui jaillissent, mot-clé en couleur avec marqueur, glyphes qui s'envolent. Avec `"tone": "accent"` : plein orange, texte blanc, mot-clé marine — **le plus percutant** | promesse, affirmation, contraste (« Achetez *partout*. Recevez en Haïti. ») | `text`, `sub?`, `glyphs?`, `tone?`, `bg?` |
| `hook.question` | Question qui se retourne mot par mot | douleur, curiosité (« Vous payez *trop cher* ? ») | `text` |
| `hook.number` | Chiffre géant qui monte | preuve, économie, délai (« 12 500 HTG économisés ») | `value`, `prefix?`, `suffix?`, `text?` |
| `hook.product` | Produit réel qui entre en vol, ruban, cercle pointillé, titre en capitales | lancement d'un produit précis | `image`, `title`, `kicker?`, `image2?`, `kicker2?`, `title2?` |
| `hook.poster` | Affiche éditoriale (photo en noir et blanc, cercle d'accent, micro-typo) | marque premium, produit qui a du style | `image`, `text`, `ghost?`, `micro?` |
| `hook.pulse` | Pulsation → pilule d'interface avec icône | fonctionnalité de l'app, notification | `text`, `icon?`, `sub?` |
| `hook.pixel` | Texte qui se forme en carrés pixel, fond marine, lueur | technologie, nouveauté | `text`, `sub?` |
| `hook.collage` | Grand disque orange qui claque, **vrais objets détourés** (drapeaux, avion, colis, cliente…) qui jaillissent des bords en profondeur, phrase blanche au centre ; tout saute sur le mot-clé. Avec `carry`, un objet traverse vers la scène suivante | import, origine des produits, promesse visuelle — **le plus proche des références** | `text`, `items` (2 à 6 images), `sub?`, `carry?` |
| `hook.logo` | Logo qui claque sur l'orange puis bascule | notoriété de marque, lancement | `text?` (slogan) |

## Écrire un bon hook (en français, vouvoiement)

Formules qui fonctionnent, du plus fort au plus doux :

1. **Contraste / promesse en deux temps** — « Achetez *partout*. Recevez en Haïti. »
2. **Douleur en question** — « Vous payez *trop cher* ? » · « Colis bloqué en douane ? »
3. **Chiffre choc** — « 48 h. » · « −30 % sur Shein. »
4. **Interdit / interpellation** — « Stop. Ne commandez pas avant de voir ça. »
5. **Avant / après** — « Hier : 3 semaines. Aujourd'hui : *10 jours*. »

À éviter : commencer par le nom de la marque (on la montre à la fin), « Bonjour », « Dans cette vidéo… », les phrases de plus de 7 mots, les chiffres sans unité.

## Rythme du reste

- Scènes de 1,8 à 5,2 s en moyenne (aucune au-delà de 7,5 s) ; jamais plus de 2 scènes du même type de suite.
- Une scène = une phrase dite = une idée. Si la phrase dépasse la durée max du type (`motion types`), coupez-la en deux scènes.
- Fin : `scene.end` avec logo, slogan, bouton d'action, adresse (2,6 s minimum).
