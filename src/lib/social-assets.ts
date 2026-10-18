// The stock photos (Unsplash, free to use) of the information posters: public/social-assets/<id>.jpg, small versions in t/<id>.jpg.
// Generated once from the originals; supabase/functions/facebook-post/assets.ts is a verbatim copy (a test checks it).

export type AssetLayout = 'photo' | 'studio'
export interface SocialAsset {
  id: string
  label: string
  /** The poster layouts the photo suits: `photo` is full-bleed under a dark gradient, `studio` is a product on a white background. */
  layouts: AssetLayout[]
  /** Where the subject is (0-1), so that the crop keeps it. */
  focus: { x: number; y: number }
  tag: string
  width: number
  height: number
  /** Studio photos: the colour of their background, which the poster continues around the photo. */
  bg: string | null
}

export const SOCIAL_ASSETS: SocialAsset[] = [
  { id: 'flag-haiti', label: 'Drapeau haïtien', layouts: ['photo'], focus: { x: 0.5, y: 0.5 }, tag: 'haiti', width: 1400, height: 1050, bg: null },
  { id: 'haiti-city', label: 'Ville haïtienne', layouts: ['photo'], focus: { x: 0.5, y: 0.5 }, tag: 'haiti', width: 1400, height: 933, bg: null },
  { id: 'haiti-hills', label: 'Collines d’Haïti', layouts: ['photo'], focus: { x: 0.5, y: 0.5 }, tag: 'haiti', width: 1400, height: 933, bg: null },
  { id: 'haiti-cathedral', label: 'Cathédrale', layouts: ['photo'], focus: { x: 0.5, y: 0.5 }, tag: 'haiti', width: 1400, height: 1050, bg: null },
  { id: 'ship-1', label: 'Cargo en mer', layouts: ['photo'], focus: { x: 0.5, y: 0.5 }, tag: 'livraison', width: 1400, height: 934, bg: null },
  { id: 'ship-2', label: 'Porte-conteneurs', layouts: ['photo'], focus: { x: 0.5, y: 0.5 }, tag: 'livraison', width: 1400, height: 933, bg: null },
  { id: 'plane-cargo', label: 'Avion cargo', layouts: ['photo'], focus: { x: 0.5, y: 0.5 }, tag: 'livraison', width: 1400, height: 933, bg: null },
  { id: 'courier-scooter', label: 'Livreur à scooter', layouts: ['photo'], focus: { x: 0.5, y: 0.5 }, tag: 'livraison', width: 1400, height: 997, bg: null },
  { id: 'boxes-open-brown', label: 'Cartons ouverts', layouts: ['photo'], focus: { x: 0.5, y: 0.5 }, tag: 'livraison', width: 1400, height: 933, bg: null },
  { id: 'box-white-minimal', label: 'Colis blanc', layouts: ['studio'], focus: { x: 0.5, y: 0.5 }, tag: 'livraison', width: 1400, height: 933, bg: '#eef3f6' },
  { id: 'box-white-table', label: 'Colis sur table', layouts: ['photo', 'studio'], focus: { x: 0.5, y: 0.5 }, tag: 'livraison', width: 1400, height: 933, bg: '#c6caca' },
  { id: 'pay-taptopay', label: 'Paiement mobile', layouts: ['photo'], focus: { x: 0.5, y: 0.35 }, tag: 'paiement', width: 1100, height: 1650, bg: null },
  { id: 'phone-hand', label: 'Téléphone en main', layouts: ['photo'], focus: { x: 0.5, y: 0.35 }, tag: 'paiement', width: 1100, height: 1501, bg: null },
  { id: 'woman-phone-1', label: 'Cliente au téléphone 1', layouts: ['photo'], focus: { x: 0.5, y: 0.2 }, tag: 'paiement', width: 1100, height: 1650, bg: null },
  { id: 'woman-phone-2', label: 'Cliente au téléphone 2', layouts: ['photo'], focus: { x: 0.5, y: 0.2 }, tag: 'paiement', width: 1100, height: 1650, bg: null },
  { id: 'gift-pink', label: 'Cadeau rose', layouts: ['photo'], focus: { x: 0.5, y: 0.35 }, tag: 'cadeau', width: 1100, height: 1650, bg: null },
  { id: 'gift-red-bows', label: 'Cadeaux rubans rouges', layouts: ['photo'], focus: { x: 0.5, y: 0.35 }, tag: 'cadeau', width: 1100, height: 1653, bg: null },
  { id: 'mother-3', label: 'Fête des mères 1', layouts: ['photo'], focus: { x: 0.5, y: 0.25 }, tag: 'fete', width: 1100, height: 1650, bg: null },
  { id: 'mother-2', label: 'Fête des mères 2', layouts: ['photo'], focus: { x: 0.5, y: 0.25 }, tag: 'fete', width: 1100, height: 1650, bg: null },
  { id: 'father-4', label: 'Fête des pères 1', layouts: ['photo'], focus: { x: 0.5, y: 0.25 }, tag: 'fete', width: 1100, height: 1650, bg: null },
  { id: 'father-2', label: 'Fête des pères 2', layouts: ['photo'], focus: { x: 0.5, y: 0.25 }, tag: 'fete', width: 1100, height: 1650, bg: null },
  { id: 'carnival-1', label: 'Carnaval 1', layouts: ['photo'], focus: { x: 0.5, y: 0.5 }, tag: 'fete', width: 1400, height: 984, bg: null },
  { id: 'carnival-3', label: 'Carnaval 2', layouts: ['photo'], focus: { x: 0.5, y: 0.3 }, tag: 'fete', width: 1100, height: 1160, bg: null },
  { id: 'fireworks-1', label: 'Feux d’artifice 1', layouts: ['photo'], focus: { x: 0.5, y: 0.3 }, tag: 'fete', width: 1100, height: 1375, bg: null },
  { id: 'fireworks-3', label: 'Feux d’artifice 2', layouts: ['photo'], focus: { x: 0.5, y: 0.3 }, tag: 'fete', width: 1100, height: 1650, bg: null },
  { id: 'xmas-1', label: 'Noël 1', layouts: ['photo'], focus: { x: 0.5, y: 0.3 }, tag: 'fete', width: 1100, height: 1650, bg: null },
  { id: 'xmas-2', label: 'Noël 2', layouts: ['photo'], focus: { x: 0.5, y: 0.3 }, tag: 'fete', width: 1100, height: 1718, bg: null },
  { id: 'xmas-4', label: 'Noël (studio)', layouts: ['studio'], focus: { x: 0.5, y: 0.3 }, tag: 'fete', width: 1200, height: 1600, bg: '#dad8d6' },
  { id: 'school-backpack', label: 'Rentrée des classes', layouts: ['photo'], focus: { x: 0.5, y: 0.7 }, tag: 'fete', width: 1100, height: 1650, bg: null },
  { id: 'sale-tags-red', label: 'Étiquettes de soldes', layouts: ['photo'], focus: { x: 0.5, y: 0.5 }, tag: 'promo', width: 1100, height: 1467, bg: null },
  { id: 'bf-phone-shop', label: 'Achat sur téléphone', layouts: ['photo'], focus: { x: 0.5, y: 1 }, tag: 'promo', width: 1100, height: 1647, bg: null },
  { id: 'tote-bags', label: 'Sacs colorés', layouts: ['photo'], focus: { x: 0.5, y: 0.4 }, tag: 'promo', width: 1100, height: 1650, bg: null },
  { id: 'box-brown-white', label: 'Carton ouvert (studio)', layouts: ['studio'], focus: { x: 0.5, y: 0.5 }, tag: 'livraison', width: 1400, height: 933, bg: '#f8f9fb' },
  { id: 'valentine-1', label: 'Roses 1', layouts: ['photo'], focus: { x: 0.5, y: 0.35 }, tag: 'fete', width: 1100, height: 1650, bg: null },
  { id: 'valentine-2', label: 'Roses 2', layouts: ['photo'], focus: { x: 0.5, y: 0.3 }, tag: 'fete', width: 1100, height: 1467, bg: null },
  { id: 'valentine-3', label: 'Roses 3', layouts: ['photo'], focus: { x: 0.5, y: 0.3 }, tag: 'fete', width: 1100, height: 1603, bg: null },
  { id: 'womens-1', label: 'Journée des femmes 1', layouts: ['photo'], focus: { x: 0.5, y: 0.2 }, tag: 'fete', width: 1100, height: 1465, bg: null },
  { id: 'womens-2', label: 'Journée des femmes 2', layouts: ['photo'], focus: { x: 0.5, y: 0.2 }, tag: 'fete', width: 1100, height: 1650, bg: null },
  { id: 'womens-3', label: 'Journée des femmes 3', layouts: ['photo'], focus: { x: 0.5, y: 0.25 }, tag: 'fete', width: 1100, height: 1648, bg: null },
  { id: 'friends-phone-1', label: 'Amies sur téléphone 1', layouts: ['photo'], focus: { x: 0.5, y: 0.25 }, tag: 'amis', width: 1100, height: 1656, bg: null },
  { id: 'friends-phone-2', label: 'Amies sur téléphone 2', layouts: ['photo'], focus: { x: 0.5, y: 0.25 }, tag: 'amis', width: 1100, height: 1650, bg: null },
  { id: 'friends-phone-3', label: 'Amis sur téléphone', layouts: ['photo'], focus: { x: 0.5, y: 0.25 }, tag: 'amis', width: 1100, height: 1467, bg: null },
  { id: 'handshake-desk', label: 'Poignée de main (bureau)', layouts: ['photo'], focus: { x: 0.5, y: 0.4 }, tag: 'business', width: 1100, height: 1375, bg: null },
  { id: 'handshake-yellow', label: 'Poignée de main (or)', layouts: ['photo'], focus: { x: 0.5, y: 0.4 }, tag: 'business', width: 1100, height: 1650, bg: null },
  { id: 'medals-gold', label: 'Médailles d’or', layouts: ['photo'], focus: { x: 0.5, y: 0.3 }, tag: 'business', width: 1100, height: 1650, bg: null },
  { id: 'studio-headphones-1', label: 'Casque 1', layouts: ['studio'], focus: { x: 0.5, y: 0.5 }, tag: 'produit', width: 1200, height: 1200, bg: '#ffffff' },
  { id: 'studio-headphones-2', label: 'Casque 2', layouts: ['studio'], focus: { x: 0.5, y: 0.5 }, tag: 'produit', width: 1200, height: 1200, bg: '#fefefe' },
  { id: 'studio-sneaker-blue', label: 'Baskets bleues', layouts: ['studio'], focus: { x: 0.5, y: 0.5 }, tag: 'produit', width: 1200, height: 1200, bg: '#f8f8f8' },
  { id: 'studio-sneaker-gray', label: 'Basket grise', layouts: ['studio'], focus: { x: 0.5, y: 0.5 }, tag: 'produit', width: 1200, height: 1200, bg: '#f9f9f9' },
]

const BY_ID = new Map(SOCIAL_ASSETS.map((a) => [a.id, a]))
export const assetById = (id: string | null | undefined): SocialAsset | null => (id ? BY_ID.get(id) ?? null : null)
/** Where the full-size photo is served from (the site's own origin: the browser preview and the server both load it from there). */
export const assetPath = (id: string) => `/social-assets/${id}.jpg`
export const assetThumbPath = (id: string) => `/social-assets/t/${id}.jpg`
