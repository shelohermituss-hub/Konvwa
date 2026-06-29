import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

export type Lang = 'fr' | 'en'

type Dict = Record<string, string>

const FR: Dict = {
  'nav.home': 'Accueil',
  'nav.orders': 'Commandes',
  'nav.shipments': 'Expéditions',
  'nav.notifs': 'Notifs',
  'nav.profile': 'Profil',
  'nav.suppliers': 'Fournisseurs',

  'common.new': 'Nouveau',
  'common.submit': 'Soumettre',
  'common.save': 'Enregistrer',
  'common.cancel': 'Annuler',
  'common.search': 'Rechercher...',
  'common.see_all': 'Voir tout',
  'common.load_more': 'Charger plus',
  'common.no_result': 'Aucun résultat',
  'common.contact': 'Contacter',
  'common.delivery': 'Livr.',

  'dash.greeting': 'Bonjour',
  'dash.balance': 'Solde disponible',
  'dash.topup': 'Recharger',
  'dash.history': 'Historique',
  'dash.import': 'Importer un produit',
  'dash.quote_time': 'Devis reçu en moins de 24h',
  'dash.recent': 'Commandes récentes',
  'dash.no_orders': 'Aucune commande',
  'dash.submit_first': 'Soumettez votre premier produit',
  'dash.q_submit': 'Soumettre',
  'dash.q_orders': 'Commandes',
  'dash.q_shipping': 'Expédition',
  'dash.q_support': 'Support',

  'orders.title': 'Commandes',
  'orders.search': 'Rechercher...',
  'orders.pending_section': 'En attente de traitement',
  'orders.orders_section': 'Commandes',
  'orders.no_orders': 'Aucune commande',
  'orders.try_other': "Essayez d'autres termes",
  'orders.submit_first': 'Soumettez votre premier produit',
  'orders.draft_label': 'Brouillon · Devis en cours',
  'orders.f.all': 'Tout',
  'orders.f.drafts': 'Brouillons',
  'orders.f.awaiting_payment': 'Paiement',
  'orders.f.processing': 'Traitement',
  'orders.f.in_transit': 'Transit',
  'orders.f.arrived_haiti': 'Arrivé',
  'orders.f.delivered': 'Livré',
  'orders.f.cancelled': 'Annulé',

  'activity.title': "Journal d'activité",
  'activity.subtitle': 'Votre activité récente',
  'activity.empty': 'Aucune activité',
  'activity.empty_sub': 'Votre activité apparaîtra ici',

  'billing.title': 'Facturation',
  'billing.subtitle': 'Historique des commandes payées',
  'billing.reference': 'Référence',
  'billing.product': 'Produit',
  'billing.status': 'Statut',
  'billing.date': 'Date',
  'billing.amount': 'Montant',
  'billing.empty': 'Aucune commande payée',
  'billing.empty_sub': 'Vos commandes payées apparaîtront ici',

  'suppliers.title': 'Fournisseurs',
  'suppliers.subtitle': 'Fournisseurs recommandés',
  'suppliers.view_all': 'Voir tous',
  'suppliers.contact': 'Contacter',
  'suppliers.profile.about': 'À propos',
  'suppliers.profile.products': 'Produits disponibles',
  'suppliers.profile.specialty': 'Spécialité',
  'suppliers.profile.location': 'Localisation',
  'suppliers.profile.no_products': 'Aucun produit disponible',

  'lang.fr': 'Français',
  'lang.en': 'Anglais',
}

const EN: Dict = {
  'nav.home': 'Home',
  'nav.orders': 'Orders',
  'nav.shipments': 'Shipments',
  'nav.notifs': 'Notifs',
  'nav.profile': 'Profile',
  'nav.suppliers': 'Suppliers',

  'common.new': 'New',
  'common.submit': 'Submit',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.search': 'Search...',
  'common.see_all': 'See all',
  'common.load_more': 'Load More',
  'common.no_result': 'No results',
  'common.contact': 'Contact',
  'common.delivery': 'Del.',

  'dash.greeting': 'Hello',
  'dash.balance': 'Available balance',
  'dash.topup': 'Top Up',
  'dash.history': 'History',
  'dash.import': 'Import a product',
  'dash.quote_time': 'Quote received in less than 24h',
  'dash.recent': 'Recent Orders',
  'dash.no_orders': 'No orders',
  'dash.submit_first': 'Submit your first product',
  'dash.q_submit': 'Submit',
  'dash.q_orders': 'Orders',
  'dash.q_shipping': 'Shipping',
  'dash.q_support': 'Support',

  'orders.title': 'Orders',
  'orders.search': 'Search...',
  'orders.pending_section': 'Awaiting processing',
  'orders.orders_section': 'Orders',
  'orders.no_orders': 'No orders',
  'orders.try_other': 'Try different terms',
  'orders.submit_first': 'Submit your first product',
  'orders.draft_label': 'Draft · Quote pending',
  'orders.f.all': 'All',
  'orders.f.drafts': 'Drafts',
  'orders.f.awaiting_payment': 'Payment',
  'orders.f.processing': 'Processing',
  'orders.f.in_transit': 'Transit',
  'orders.f.arrived_haiti': 'Arrived',
  'orders.f.delivered': 'Delivered',
  'orders.f.cancelled': 'Cancelled',

  'activity.title': 'Activity Log',
  'activity.subtitle': 'Your recent account activity',
  'activity.empty': 'No activity yet',
  'activity.empty_sub': 'Your account activity will appear here',

  'billing.title': 'Billing',
  'billing.subtitle': 'Paid orders history',
  'billing.reference': 'Reference',
  'billing.product': 'Product',
  'billing.status': 'Status',
  'billing.date': 'Date',
  'billing.amount': 'Amount',
  'billing.empty': 'No paid orders',
  'billing.empty_sub': 'Your paid orders will appear here',

  'suppliers.title': 'Suppliers',
  'suppliers.subtitle': 'Recommended suppliers',
  'suppliers.view_all': 'View all',
  'suppliers.contact': 'Contact',
  'suppliers.profile.about': 'About',
  'suppliers.profile.products': 'Available products',
  'suppliers.profile.specialty': 'Specialty',
  'suppliers.profile.location': 'Location',
  'suppliers.profile.no_products': 'No products available',

  'lang.fr': 'French',
  'lang.en': 'English',
}

const DICTS: Record<Lang, Dict> = { fr: FR, en: EN }

interface I18nCtx {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string
}

const I18nContext = createContext<I18nCtx>({
  lang: 'fr',
  setLang: () => {},
  t: (k) => k,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    return (localStorage.getItem('konvwa-lang') as Lang) || 'fr'
  })

  function setLang(l: Lang) {
    setLangState(l)
    localStorage.setItem('konvwa-lang', l)
  }

  function t(key: string): string {
    return DICTS[lang][key] ?? DICTS.fr[key] ?? key
  }

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}
