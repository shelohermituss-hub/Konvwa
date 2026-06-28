export interface SupplierProduct {
  id: string
  name: string
  price: number
  currency: string
  category: string
}

export interface Supplier {
  id: string
  name: string
  specialty: string
  location: string
  address: string
  phone: string
  whatsapp: string
  email: string
  initials: string
  avatarColor: string
  coverGradient: string
  description: string
  rating: number
  reviewCount: number
  productCount: number
  yearsActive: number
  tags: string[]
  products: SupplierProduct[]
}

export const SUPPLIERS: Supplier[] = [
  {
    id: '1',
    name: 'Dragon Electronics',
    specialty: 'Électronique & Informatique',
    location: 'Shenzhen, Chine',
    address: 'Zone industrielle Longhua, Shenzhen 518109, Guangdong',
    phone: '+86 755 8888 1234',
    whatsapp: '+86 155 8888 1234',
    email: 'contact@dragonelectronics.cn',
    initials: 'DE',
    avatarColor: '#1d4ed8',
    coverGradient: 'linear-gradient(135deg, #1e40af 0%, #0ea5e9 100%)',
    description:
      "Fournisseur premium d'électronique grand public et de composants informatiques. Partenaire officiel de Konvwa depuis 2022, avec 15 ans d'expérience dans l'export vers les Caraïbes. Certifié ISO 9001 et partenaire agréé de grandes marques asiatiques.",
    rating: 4.8,
    reviewCount: 312,
    productCount: 248,
    yearsActive: 15,
    tags: ['Téléphones', 'Ordinateurs', 'Accessoires', 'Composants'],
    products: [
      { id: 'p1', name: 'Smartphone Android 5G', price: 180, currency: 'USD', category: 'Téléphones' },
      { id: 'p2', name: 'Laptop 15" Intel i5', price: 320, currency: 'USD', category: 'Ordinateurs' },
      { id: 'p3', name: 'Écouteurs Bluetooth TWS', price: 25, currency: 'USD', category: 'Accessoires' },
      { id: 'p4', name: 'Chargeur USB-C 65W GaN', price: 12, currency: 'USD', category: 'Accessoires' },
    ],
  },
  {
    id: '2',
    name: 'Guangzhou Fashion Hub',
    specialty: 'Mode & Vêtements',
    location: 'Guangzhou, Chine',
    address: 'Zhongda Textile Market, Guangzhou 510220, Guangdong',
    phone: '+86 20 8888 5678',
    whatsapp: '+86 138 8888 5678',
    email: 'sales@gzfashionhub.cn',
    initials: 'GF',
    avatarColor: '#db2777',
    coverGradient: 'linear-gradient(135deg, #be185d 0%, #f43f5e 100%)',
    description:
      "Grossiste en vêtements tendance, streetwear et accessoires de mode. MOQ bas à partir de 10 pièces et livraison rapide sous 7 jours. Idéal pour les revendeurs haïtiens souhaitant proposer des collections actuelles à prix compétitifs.",
    rating: 4.6,
    reviewCount: 189,
    productCount: 1250,
    yearsActive: 8,
    tags: ['Femme', 'Homme', 'Streetwear', 'Chaussures', 'Accessoires'],
    products: [
      { id: 'p5', name: 'Robe d\'été (lot 12 pcs)', price: 96, currency: 'USD', category: 'Femme' },
      { id: 'p6', name: 'T-shirts unisexe (lot 20)', price: 60, currency: 'USD', category: 'Casual' },
      { id: 'p7', name: 'Sneakers (lot 6 paires)', price: 72, currency: 'USD', category: 'Chaussures' },
      { id: 'p8', name: 'Sacs à main (lot 10)', price: 80, currency: 'USD', category: 'Accessoires' },
    ],
  },
  {
    id: '3',
    name: 'AliHome Furniture',
    specialty: 'Maison & Mobilier',
    location: 'Foshan, Chine',
    address: 'Shunde District Furniture City, Foshan 528300, Guangdong',
    phone: '+86 757 8888 9012',
    whatsapp: '+86 137 8888 9012',
    email: 'info@alihomefurniture.cn',
    initials: 'AH',
    avatarColor: '#d97706',
    coverGradient: 'linear-gradient(135deg, #b45309 0%, #f59e0b 100%)',
    description:
      "Mobilier moderne et articles de décoration intérieure haute qualité. Conçu pour l'export, nos produits résistent aux conditions climatiques caribéennes. 10 ans de partenariat avec des importateurs dans les Caraïbes et l'Amérique latine.",
    rating: 4.7,
    reviewCount: 94,
    productCount: 520,
    yearsActive: 10,
    tags: ['Meubles', 'Décoration', 'Cuisine', 'Jardin', 'Literie'],
    products: [
      { id: 'p9', name: 'Table + 4 chaises (salon)', price: 220, currency: 'USD', category: 'Salon' },
      { id: 'p10', name: 'Armoire 3 portes miroir', price: 180, currency: 'USD', category: 'Chambre' },
      { id: 'p11', name: 'Kit déco cuisine complet', price: 45, currency: 'USD', category: 'Cuisine' },
      { id: 'p12', name: 'Canapé d\'angle 5 places', price: 350, currency: 'USD', category: 'Salon' },
    ],
  },
  {
    id: '4',
    name: 'ProBeauty Supply',
    specialty: 'Beauté & Cosmétiques',
    location: 'Yiwu, Chine',
    address: 'Yiwu International Trade City, District 5, Hall B',
    phone: '+86 579 8888 3456',
    whatsapp: '+86 136 8888 3456',
    email: 'orders@probeautysupply.cn',
    initials: 'PB',
    avatarColor: '#7c3aed',
    coverGradient: 'linear-gradient(135deg, #6d28d9 0%, #a855f7 100%)',
    description:
      "Grossiste spécialisé en produits cosmétiques, soins capillaires et maquillage. Large gamme adaptée aux peaux et cheveux afro-caribéens. Certification FDA et CE sur tous nos produits. Minimum de commande très bas, idéal pour les petits commerces.",
    rating: 4.9,
    reviewCount: 267,
    productCount: 380,
    yearsActive: 6,
    tags: ['Cosmétiques', 'Cheveux', 'Soins', 'Maquillage', 'Parfums'],
    products: [
      { id: 'p13', name: 'Kit soins capillaires (24u)', price: 48, currency: 'USD', category: 'Cheveux' },
      { id: 'p14', name: 'Fond de teint (lot 12)', price: 36, currency: 'USD', category: 'Maquillage' },
      { id: 'p15', name: 'Crème hydratante (lot 50)', price: 60, currency: 'USD', category: 'Soins' },
      { id: 'p16', name: 'Perruques naturelles HD (5u)', price: 250, currency: 'USD', category: 'Cheveux' },
    ],
  },
]
