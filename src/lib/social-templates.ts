// The wording of the posters the editorial calendar proposes (French, for the shop's Haitian audience): explainers about how KONVWA works, news, promos
// and the greetings / countdowns of the year's events. Everything stated here is something the platform really does; the admin edits every proposal before validating it.
// Pure data: no i18n, no DOM.

/** A headline without its *accent* marks. */
export const plainHeadline = (s: string) => s.replace(/\*/g, '')

export type CalendarKind = 'event' | 'explainer' | 'news' | 'promo'
/** `photo`: a stock photo under a dark gradient; `studio`: a product photo on a light background. */
export type CalendarLayout = 'photo' | 'studio'

export interface PosterText {
  layout: CalendarLayout
  /** The id of the stock photo (src/lib/social-assets.ts). */
  asset: string
  badge: string
  /** The words between *stars* are drawn in orange. */
  headline: string
  subline: string
  bullets: string[]
  /** The post's text (the order band and hashtags are added by the calendar). */
  caption: string
}

/** An evergreen poster: it can come back every few weeks. */
export interface Evergreen extends PosterText { id: string; kind: Exclude<CalendarKind, 'event'>; needsChannel?: boolean }

export const EVERGREEN: Evergreen[] = [
  // ── explainers: how the platform works ─────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'steps', kind: 'explainer', layout: 'photo', asset: 'phone-hand', badge: 'Comment ça marche', headline: 'Importer en Haïti, en *3 étapes*',
    subline: 'Simple, clair, en gourdes.',
    bullets: ['Envoyez le lien du produit', 'Recevez un devis clair en gourdes', 'Payez par MonCash ou NatCash et suivez votre colis'],
    caption: '📦 Importer en Haïti n’a jamais été aussi simple !\n\n1️⃣ Envoyez le lien du produit (Alibaba, Shein, Temu…)\n2️⃣ Recevez un devis clair en gourdes\n3️⃣ Payez par MonCash ou NatCash et suivez votre colis jusqu’en Haïti',
  },
  {
    id: 'links', kind: 'explainer', layout: 'photo', asset: 'woman-phone-1', badge: 'Alibaba · Shein · Temu', headline: 'Un produit vous plaît ? *Envoyez-nous le lien*',
    subline: 'On s’occupe du devis, de l’achat et de l’expédition vers Haïti.',
    bullets: ['Copiez le lien du produit', 'Envoyez-le depuis la page « Soumettre »', 'Recevez votre devis en gourdes'],
    caption: '🔗 Vous avez trouvé le produit parfait sur Alibaba, Shein ou Temu ?\n\nCopiez son lien et envoyez-le depuis la page « Soumettre » de votre compte KONVWA : vous recevez un devis en gourdes, puis on s’occupe de l’achat et de l’expédition vers Haïti.',
  },
  {
    id: 'payment', kind: 'explainer', layout: 'photo', asset: 'pay-taptopay', badge: 'Paiement', headline: 'Payez avec *MonCash* ou *NatCash*',
    subline: 'Le paiement local, sans carte bancaire internationale.',
    bullets: ['Prix affichés en gourdes (HTG)', 'Paiement MonCash ou NatCash', 'Historique de vos paiements dans votre compte'],
    caption: '💳 Pas besoin de carte bancaire internationale !\n\nSur KONVWA, vous payez avec MonCash ou NatCash. Les prix sont affichés en gourdes et vous retrouvez l’historique de vos paiements dans votre compte.',
  },
  {
    id: 'tracking', kind: 'explainer', layout: 'photo', asset: 'ship-1', badge: 'Suivi', headline: 'Suivez votre colis *étape par étape*',
    subline: 'De l’entrepôt jusqu’en Haïti, depuis votre compte.',
    bullets: ['Réception à l’entrepôt', 'Expédition vers Haïti', 'Arrivée en Haïti', 'Retrait ou livraison'],
    caption: '📍 Où est mon colis ? Vous le savez à chaque étape !\n\nDepuis votre compte KONVWA, suivez votre commande : réception à l’entrepôt, expédition, arrivée en Haïti, puis retrait ou livraison.',
  },
  {
    id: 'two-shelves', kind: 'explainer', layout: 'studio', asset: 'box-brown-white', badge: 'Deux façons d’acheter', headline: '*Boutique* ou sourcing en gros ?',
    subline: 'Un seul compte pour les deux.',
    bullets: ['Boutique : produits finis, vendus à l’unité', 'Sourcing en gros : grandes quantités, prix dégressifs', 'Prix en gourdes, livraison estimée affichée'],
    caption: '🛍️ Pour vous ou pour votre commerce, KONVWA a ce qu’il vous faut.\n\n• La boutique : des produits finis, vendus à l’unité.\n• Le sourcing en gros : de grandes quantités avec des prix dégressifs.\n\nUn seul compte, des prix en gourdes et la livraison estimée affichée sur chaque fiche.',
  },
  {
    id: 'clear-prices', kind: 'explainer', layout: 'photo', asset: 'box-white-table', badge: 'Transparence', headline: 'Des prix clairs, *en gourdes*',
    subline: 'Pas de mauvaise surprise : vous voyez tout avant de payer.',
    bullets: ['Prix du produit en HTG', 'Livraison estimée sur chaque fiche', 'Devis détaillé avant paiement'],
    caption: '💰 Chez KONVWA, vous savez ce que vous payez.\n\nPrix en gourdes, livraison estimée sur chaque fiche produit et devis détaillé avant tout paiement.',
  },
  {
    id: 'reseller', kind: 'explainer', layout: 'photo', asset: 'handshake-desk', badge: 'Revendeurs', headline: 'Devenez *revendeur* KONVWA',
    subline: 'Prix revendeur, catalogue en gros et suivi de vos marges.',
    bullets: ['Demandez le statut revendeur dans votre compte', 'Accédez au catalogue en gros', 'Suivez vos marges et vos commandes'],
    caption: '🚀 Et si vous en faisiez votre activité ?\n\nAvec le statut revendeur KONVWA : prix revendeur, catalogue en gros et suivi de vos marges. Demandez-le depuis votre compte.',
  },
  {
    id: 'referral', kind: 'explainer', layout: 'photo', asset: 'friends-phone-1', badge: 'Parrainage', headline: 'Parrainez vos amis, *gagnez ensemble*',
    subline: 'Votre ami et vous recevez chacun un bonus dans votre portefeuille.',
    bullets: ['Trouvez votre code de parrainage dans votre compte', 'Partagez-le avec vos amis', 'Le bonus est crédité dès son premier paiement éligible'],
    caption: '🎁 Parrainez vos amis !\n\nPartagez votre code de parrainage : votre ami et vous recevez chacun un bonus dans votre portefeuille dès son premier paiement éligible.',
  },
  {
    id: 'loyalty', kind: 'explainer', layout: 'photo', asset: 'medals-gold', badge: 'Fidélité', headline: 'Plus vous commandez, *moins vous payez* de frais',
    subline: 'Votre niveau fidélité réduit nos frais de service.',
    bullets: ['Niveaux Bronze, Argent et Or', 'Remise sur nos frais de service', 'Appliquée automatiquement à vos devis'],
    caption: '🏅 La fidélité est récompensée !\n\nAvec les niveaux Bronze, Argent et Or, vous bénéficiez d’une remise sur nos frais de service, appliquée automatiquement à vos devis.',
  },
  {
    id: 'insurance', kind: 'explainer', layout: 'photo', asset: 'boxes-open-brown', badge: 'Sérénité', headline: '*Protégez* votre colis',
    subline: 'Une assurance optionnelle est proposée pour votre expédition.',
    bullets: ['Déclarez la valeur de votre colis', 'La prime est un petit pourcentage de cette valeur', 'Payée avec votre portefeuille KONVWA'],
    caption: '🛡️ Un colis important ? Assurez-le !\n\nL’assurance est optionnelle : vous déclarez la valeur de votre colis et la prime, un petit pourcentage de cette valeur, est payée avec votre portefeuille.',
  },
  {
    id: 'delivery', kind: 'explainer', layout: 'photo', asset: 'courier-scooter', badge: 'Livraison', headline: 'Retrait ou livraison : *vous choisissez*',
    subline: 'Selon les options disponibles dans votre zone.',
    bullets: ['Retrait en point de retrait', 'Livraison à domicile selon la zone', 'Suivi dans votre compte'],
    caption: '🚚 Votre colis est arrivé en Haïti : comment le recevoir ?\n\nChoisissez le retrait en point de retrait ou la livraison à domicile selon les options disponibles dans votre zone.',
  },
  {
    id: 'app', kind: 'explainer', layout: 'photo', asset: 'woman-phone-2', badge: 'Application', headline: 'Installez *KONVWA* sur votre téléphone',
    subline: 'Gratuit, sans passer par une boutique d’applications.',
    bullets: ['Ouvrez konvwa.shop sur votre téléphone', 'Choisissez « Ajouter à l’écran d’accueil »', 'Retrouvez KONVWA comme une application'],
    caption: '📱 KONVWA directement sur votre écran d’accueil !\n\nOuvrez konvwa.shop sur votre téléphone et choisissez « Ajouter à l’écran d’accueil » : c’est gratuit et ça se fait en quelques secondes.',
  },
  {
    id: 'whatsapp', kind: 'explainer', layout: 'photo', asset: 'friends-phone-2', badge: 'WhatsApp', headline: 'Suivez notre chaîne *WhatsApp*',
    subline: 'Promos et nouveaux arrivages en premier.',
    bullets: ['Les promos du moment', 'Les nouveaux arrivages', 'Les conseils pour bien importer'],
    caption: '💬 Ne ratez plus rien : suivez la chaîne WhatsApp de KONVWA !\n\nPromos, nouveaux arrivages et conseils pour bien importer, directement sur votre téléphone.',
    needsChannel: true,
  },
  // ── news ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'news-arrivals', kind: 'news', layout: 'studio', asset: 'studio-headphones-1', badge: 'Nouveautés', headline: 'Nouveaux *arrivages* cette semaine',
    subline: 'Découvrez les derniers produits ajoutés à la boutique.',
    bullets: ['Électronique, beauté, mode et bien plus', 'Prix en gourdes', 'Livraison estimée sur chaque fiche'],
    caption: '✨ Du nouveau sur KONVWA !\n\nDe nouveaux produits viennent d’arriver dans la boutique : électronique, beauté, mode et bien plus. Prix en gourdes et livraison estimée sur chaque fiche.',
  },
  {
    id: 'news-top', kind: 'news', layout: 'studio', asset: 'studio-sneaker-blue', badge: 'Les plus demandés', headline: 'Les produits *préférés* de nos clients',
    subline: 'Jetez un œil aux produits qui plaisent le plus en ce moment.',
    bullets: ['Des produits sélectionnés pour vous', 'Prix en gourdes', 'Paiement MonCash ou NatCash'],
    caption: '🔥 Qu’est-ce qui plaît le plus en ce moment ?\n\nDécouvrez dans la boutique les produits préférés de nos clients, avec des prix en gourdes et un paiement MonCash ou NatCash.',
  },
  {
    id: 'news-categories', kind: 'news', layout: 'studio', asset: 'studio-headphones-2', badge: 'Catalogue', headline: 'Plus de *choix*, chaque semaine',
    subline: 'Téléphones, audio, photo, beauté, maison, sport…',
    bullets: ['Des catégories pour tous les besoins', 'De nouveaux produits régulièrement', 'Une question ? Notre équipe vous répond'],
    caption: '🛒 Le catalogue KONVWA s’agrandit régulièrement !\n\nTéléphones, audio, photo, beauté, maison, sport… parcourez les catégories de la boutique et trouvez votre bonheur.',
  },
  {
    id: 'news-channel', kind: 'news', layout: 'photo', asset: 'friends-phone-3', badge: 'WhatsApp', headline: 'Les nouveautés en premier sur *WhatsApp*',
    subline: 'Rejoignez notre chaîne : promos et arrivages directement sur votre téléphone.',
    bullets: [],
    caption: '📣 Les nouveautés KONVWA arrivent d’abord sur WhatsApp !\n\nRejoignez notre chaîne pour ne rien manquer.',
    needsChannel: true,
  },
  // ── promos ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'promo-week', kind: 'promo', layout: 'photo', asset: 'tote-bags', badge: 'Promos', headline: 'Les *promos* de la semaine',
    subline: 'Repérez les réductions affichées dans la boutique.',
    bullets: ['Remise affichée sur chaque produit concerné', 'Paiement MonCash ou NatCash', 'Livraison estimée affichée'],
    caption: '🏷️ Les promos de la semaine sont en ligne !\n\nRepérez les produits avec une réduction affichée dans la boutique. Paiement MonCash ou NatCash, livraison estimée sur chaque fiche.',
  },
  {
    id: 'promo-deals', kind: 'promo', layout: 'studio', asset: 'studio-sneaker-gray', badge: 'Bons plans', headline: 'Vos *bons plans* du moment',
    subline: 'Des produits à prix réduit, à saisir dans la boutique.',
    bullets: ['Prix barrés et remise affichée', 'Prix en gourdes', 'Commandez en quelques clics'],
    caption: '💥 Envie d’un bon plan ?\n\nLa rangée « Réductions » de la boutique rassemble les produits à prix réduit. Prix en gourdes, commande en quelques clics.',
  },
]

// ── events ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface YMD { y: number; m: number; d: number }

export interface EventPost extends PosterText {
  /** Days before the event (0 = the day itself). */
  before: number
  /** Hour of the post, Haiti time. */
  hour: number
  kind: 'event' | 'promo'
}
export interface EventDef { id: string; when: (year: number) => YMD; posts: (year: number) => EventPost[] }

const greet = (asset: string, badge: string, headline: string, subline: string, caption: string, hour = 9): EventPost => ({ before: 0, hour, kind: 'event', layout: 'photo', asset, badge, headline, subline, bullets: [], caption })
const SHIPPING_NOTE = '⏱️ Les délais de livraison varient selon le produit : vérifiez l’estimation sur chaque fiche.'

/** Fixed-date and moving events (Haiti). `when` gives the day, `posts` what is posted around it. */
export const EVENTS: EventDef[] = [
  { id: 'new-year', when: (y) => ({ y, m: 1, d: 1 }), posts: (y) => [
    greet('fireworks-1', 'Bonne année', `Bonne année *${y}* !`, 'Toute l’équipe KONVWA vous souhaite une année pleine de santé et de réussite.', `🎉 Bonne année ${y} !\n\nToute l’équipe KONVWA vous souhaite une année pleine de santé, de bonheur et de belles réussites. Merci de votre confiance !`, 8),
    greet('haiti-hills', 'Fête de l’Indépendance', 'Bonne fête de l’*Indépendance*, Haïti !', 'Fiers de notre histoire, tournés vers l’avenir.', '🇭🇹 Bonne fête de l’Indépendance, Haïti !\n\nFiers de notre histoire, tournés vers l’avenir. L’équipe KONVWA vous souhaite une belle journée.', 12),
  ] },
  { id: 'ancestors', when: (y) => ({ y, m: 1, d: 2 }), posts: () => [greet('haiti-cathedral', 'Jour des Aïeux', 'Bon *Jour des Aïeux*', 'Une pensée pour celles et ceux qui ont fait Haïti.', '🕊️ Jour des Aïeux : une pensée pour celles et ceux qui ont fait Haïti.\n\nL’équipe KONVWA vous souhaite une belle journée.')] },
  { id: 'valentine', when: (y) => ({ y, m: 2, d: 14 }), posts: () => [
    { before: 6, hour: 12, kind: 'event', layout: 'photo', asset: 'valentine-3', badge: 'Saint-Valentin', headline: 'Une idée cadeau pour la *Saint-Valentin* ?', subline: 'Parfums, bijoux, montres… trouvez le cadeau parfait.', bullets: [], caption: `💝 La Saint-Valentin approche !\n\nParfums, bijoux, montres… trouvez une idée cadeau dans la boutique KONVWA.\n\n${SHIPPING_NOTE}` },
    greet('valentine-1', 'Saint-Valentin', 'Joyeuse *Saint-Valentin* !', 'Offrez de l’amour à ceux qui comptent.', '💘 Joyeuse Saint-Valentin de la part de toute l’équipe KONVWA !'),
  ] },
  { id: 'womens-day', when: (y) => ({ y, m: 3, d: 8 }), posts: () => [greet('womens-1', 'Journée des femmes', 'Bonne Journée internationale des *droits des femmes*', 'Merci à toutes celles qui font avancer Haïti.', '💜 Bonne Journée internationale des droits des femmes !\n\nMerci à toutes celles qui font avancer Haïti, chaque jour.')] },
  { id: 'carnival', when: (y) => easterMinus(y, 49), posts: () => [greet('carnival-3', 'Carnaval', 'Bon *Carnaval* !', 'Que la fête commence : musique, couleurs et bonne humeur.', '🎭 Bon Carnaval à toutes et à tous !\n\nMusique, couleurs et bonne humeur : profitez bien de la fête avec KONVWA.', 10)] },
  { id: 'easter', when: (y) => easterMinus(y, 0), posts: () => [greet('gift-pink', 'Pâques', 'Joyeuses *Pâques* !', 'Une belle journée en famille à toutes et à tous.', '🐣 Joyeuses Pâques de la part de toute l’équipe KONVWA !')] },
  { id: 'labour', when: (y) => ({ y, m: 5, d: 1 }), posts: () => [greet('haiti-city', 'Fête du Travail', 'Bonne Fête du *Travail* et de l’Agriculture', 'Hommage à celles et ceux qui travaillent chaque jour.', '👷 Bonne Fête du Travail et de l’Agriculture !\n\nHommage à celles et ceux qui travaillent chaque jour pour Haïti.')] },
  { id: 'flag', when: (y) => ({ y, m: 5, d: 18 }), posts: () => [greet('flag-haiti', 'Fête du Drapeau', 'Bonne fête du *Drapeau* et de l’Université !', 'Fiers de nos couleurs.', '🇭🇹 Bonne fête du Drapeau et de l’Université !\n\nFiers de nos couleurs, l’équipe KONVWA vous souhaite une belle journée.')] },
  { id: 'mothers', when: (y) => lastWeekday(y, 5, 0), posts: () => [
    { before: 7, hour: 12, kind: 'event', layout: 'photo', asset: 'mother-2', badge: 'Fête des mères', headline: 'La fête des mères approche : et si vous la *gâtiez* ?', subline: 'Parfums, bijoux, beauté, maison… des idées pour toutes les mamans.', bullets: [], caption: `💐 La fête des mères, c’est dans une semaine !\n\nParfums, bijoux, beauté, maison… découvrez des idées cadeaux pour toutes les mamans dans la boutique KONVWA.\n\n${SHIPPING_NOTE}` },
    greet('mother-3', 'Fête des mères', 'Bonne fête à toutes les *mamans* !', 'Merci pour votre amour et votre courage.', '💐 Bonne fête à toutes les mamans !\n\nMerci pour votre amour et votre courage. Toute l’équipe KONVWA vous souhaite une belle journée.'),
  ] },
  { id: 'fathers', when: (y) => nthWeekday(y, 6, 0, 3), posts: () => [
    { before: 7, hour: 12, kind: 'event', layout: 'photo', asset: 'father-2', badge: 'Fête des pères', headline: 'Une idée cadeau pour la *fête des pères* ?', subline: 'Montres, outils, audio, photo… de quoi faire plaisir à papa.', bullets: [], caption: `👔 La fête des pères approche !\n\nMontres, outils, audio, photo… trouvez de quoi faire plaisir à papa dans la boutique KONVWA.\n\n${SHIPPING_NOTE}` },
    greet('father-4', 'Fête des pères', 'Bonne fête à tous les *papas* !', 'Merci pour votre force et votre exemple.', '👨‍👧‍👦 Bonne fête à tous les papas !\n\nToute l’équipe KONVWA vous souhaite une belle journée.'),
  ] },
  { id: 'back-to-school', when: (y) => ({ y, m: 8, d: 25 }), posts: () => [
    { before: 0, hour: 12, kind: 'event', layout: 'photo', asset: 'school-backpack', badge: 'Rentrée des classes', headline: 'La *rentrée* approche : préparez-vous', subline: 'Ordinateurs, tablettes, sacs à dos… pour bien démarrer l’année.', bullets: [], caption: `🎒 La rentrée des classes approche !\n\nOrdinateurs, tablettes, sacs à dos… découvrez de quoi bien démarrer l’année scolaire dans la boutique KONVWA.\n\n${SHIPPING_NOTE}` },
  ] },
  { id: 'dessalines', when: (y) => ({ y, m: 10, d: 17 }), posts: () => [greet('haiti-hills', 'Jour de Dessalines', 'Honneur à *Jean-Jacques Dessalines*', 'Anniversaire de sa disparition : souvenons-nous.', '🇭🇹 Honneur à Jean-Jacques Dessalines, père de la patrie.\n\nL’équipe KONVWA s’associe à cette journée de mémoire.')] },
  { id: 'vertieres', when: (y) => ({ y, m: 11, d: 18 }), posts: () => [greet('haiti-city', 'Vertières', 'Anniversaire de la bataille de *Vertières*', 'Honneur à celles et ceux qui ont lutté pour la liberté.', '🇭🇹 18 novembre : anniversaire de la bataille de Vertières.\n\nHonneur à celles et ceux qui ont lutté pour la liberté d’Haïti.')] },
  { id: 'black-friday', when: (y) => nthWeekday(y, 11, 5, 4), posts: () => [
    { before: 4, hour: 12, kind: 'promo', layout: 'photo', asset: 'sale-tags-red', badge: 'Black Friday', headline: 'Le *Black Friday* approche chez KONVWA', subline: 'Gardez un œil sur la boutique : les offres arrivent.', bullets: [], caption: '🖤 Le Black Friday approche !\n\nGardez un œil sur la boutique KONVWA : retrouvez les offres du moment sur konvwa.shop.' },
    { before: 0, hour: 9, kind: 'promo', layout: 'photo', asset: 'bf-phone-shop', badge: 'Black Friday', headline: 'C’est le *Black Friday* sur KONVWA', subline: 'Retrouvez les offres du moment dans la boutique.', bullets: [], caption: '🖤 C’est le Black Friday !\n\nRetrouvez les offres du moment dans la boutique KONVWA.' },
  ] },
  { id: 'christmas', when: (y) => ({ y, m: 12, d: 25 }), posts: () => [
    { before: 12, hour: 12, kind: 'event', layout: 'studio', asset: 'xmas-4', badge: 'Noël', headline: '*Noël* approche : trouvez vos cadeaux', subline: 'Pensez à commander tôt : les délais varient selon le produit.', bullets: [], caption: `🎄 Noël approche !\n\nTrouvez vos idées cadeaux dans la boutique KONVWA.\n\n${SHIPPING_NOTE} Pensez à commander tôt.` },
    greet('xmas-1', 'Noël', 'Joyeux *Noël* !', 'Toute l’équipe KONVWA vous souhaite de belles fêtes.', '🎅 Joyeux Noël à toutes et à tous !\n\nToute l’équipe KONVWA vous souhaite de belles fêtes en famille.', 8),
  ] },
  { id: 'new-year-eve', when: (y) => ({ y, m: 12, d: 31 }), posts: (y) => [greet('fireworks-3', 'Fin d’année', `Merci pour cette année *${y}*`, 'À très bientôt pour de nouvelles aventures avec KONVWA.', `✨ Merci pour cette année ${y} !\n\nÀ vous, clients fidèles, un immense merci. Toute l’équipe KONVWA vous souhaite une très belle fin d’année et vous donne rendez-vous l’an prochain.`, 12)] },
]

// ── dates ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d))
const fromUtc = (t: Date): YMD => ({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() })

export const addDays = (a: YMD, n: number): YMD => fromUtc(new Date(utc(a.y, a.m, a.d).getTime() + n * 86400000))
export const weekdayOf = (a: YMD): number => utc(a.y, a.m, a.d).getUTCDay()
export const sameDay = (a: YMD, b: YMD) => a.y === b.y && a.m === b.m && a.d === b.d
export const dayNumber = (a: YMD) => Math.floor(utc(a.y, a.m, a.d).getTime() / 86400000)

/** The n-th (1-based) given weekday (0 = Sunday) of a month. */
export function nthWeekday(y: number, m: number, weekday: number, n: number): YMD {
  const first = weekdayOf({ y, m, d: 1 })
  return { y, m, d: 1 + ((weekday - first + 7) % 7) + (n - 1) * 7 }
}

/** The last given weekday (0 = Sunday) of a month. */
export function lastWeekday(y: number, m: number, weekday: number): YMD {
  const last = fromUtc(new Date(Date.UTC(y, m, 0)))
  return addDays(last, -((weekdayOf(last) - weekday + 7) % 7))
}

/** Easter Sunday (Gregorian calendar, Meeus / Jones / Butcher). */
export function easter(y: number): YMD {
  const a = y % 19; const b = Math.floor(y / 100); const c = y % 100
  const d = Math.floor(b / 4); const e = b % 4; const f = Math.floor((b + 8) / 25); const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30; const i = Math.floor(c / 4); const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7; const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31); const day = ((h + l - 7 * m + 114) % 31) + 1
  return { y, m: month, d: day }
}
function easterMinus(y: number, days: number): YMD { return addDays(easter(y), -days) }
