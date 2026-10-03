import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { tr } from '@/lib/i18n'
const UPDATED = tr('2 octobre 2026')
const CONTACT_EMAIL = 'support@konvwa.com'

interface Section {
  title: string
  body: ReactNode
}

function LegalPage({ title, intro, sections }: { title: string; intro: string; sections: Section[] }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-20 pt-6 sm:px-6 md:pt-10">
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{tr('Dernière mise à jour :')}{' '}{UPDATED}</p>
      <p className="mt-6 text-base leading-relaxed text-muted-foreground">{intro}</p>

      <nav aria-label={tr('Sommaire')} className="mt-8 rounded-2xl border border-border bg-muted/30 p-5">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">{tr('Sommaire')}</p>
        <ol className="space-y-1.5 text-sm">
          {sections.map((s, i) => (
            <li key={s.title}>
              <a href={`#s${i + 1}`} className="text-primary hover:underline">
                {i + 1}. {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-10 space-y-10">
        {sections.map((s, i) => (
          <section key={s.title} id={`s${i + 1}`} className="scroll-mt-24">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {i + 1}. {s.title}
            </h2>
            <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted-foreground [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground">
              {s.body}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-14 flex flex-wrap gap-4 border-t border-border pt-6 text-sm">
        <Link to="/terms" className="text-primary hover:underline">{tr('Conditions d\'utilisation')}</Link>
        <Link to="/privacy" className="text-primary hover:underline">{tr('Politique de confidentialité')}</Link>
        <Link to="/" className="ml-auto text-muted-foreground hover:text-foreground">{tr('Retour à l\'accueil')}</Link>
      </div>
    </div>
  )
}

const contact = (
  <p>
    {tr('Pour toute question, écrivez-nous à')}{' '}
    <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-primary hover:underline">{CONTACT_EMAIL}</a>{' '}
    {tr('ou utilisez la rubrique Support de votre espace client.')}
  </p>
)

export function TermsPage() {
  return (
    <LegalPage
      title={tr('Conditions d\'utilisation')}
      intro={tr('Bienvenue sur KONVWA. En créant un compte ou en utilisant le service, vous acceptez les présentes conditions. Lisez-les attentivement avant de passer commande.')}
      sections={[
        {
          title: tr('Le service'),
          body: (
            <>
              <p>
                {tr('KONVWA est un service d\'importation destiné aux clients résidant en Haïti. Il vous permet de soumettre un lien de produit (Alibaba, Shein, Temu ou autre boutique), de recevoir un devis, de payer en gourdes (HTG) et de suivre l\'achat, l\'expédition, le dédouanement et la livraison.')}
              </p>
              <p>
                {tr('KONVWA agit comme intermédiaire d\'achat et d\'expédition. Nous ne fabriquons pas les produits et ne sommes pas le vendeur d\'origine.')}
              </p>
            </>
          ),
        },
        {
          title: tr('Votre compte'),
          body: (
            <>
              <p>
                {tr('Vous devez fournir des informations exactes et à jour, et être majeur ou autorisé par un représentant légal. Vous pouvez vous connecter avec votre e-mail et un mot de passe, ou avec votre compte Google ou Facebook.')}
              </p>
              <p>
                {tr('Vous êtes responsable de la confidentialité de vos identifiants et de toute activité réalisée depuis votre compte. Prévenez-nous sans délai en cas d\'utilisation non autorisée.')}
              </p>
            </>
          ),
        },
        {
          title: tr('Devis, prix et commandes'),
          body: (
            <>
              <p>
                {tr('Chaque commande donne lieu à un devis détaillé : prix du produit, frais de service, expédition, douane estimée et livraison locale. Les montants sont exprimés en HTG.')}
              </p>
              <ul>
                <li>{tr('Un devis est valable pendant la durée indiquée sur celui-ci.')}</li>
                <li>{tr('Les frais de douane et d\'expédition sont des')}{' '}<strong>{tr('estimations')}</strong>{' '}{tr('; ils peuvent varier selon le poids, le volume réels et la réglementation en vigueur.')}</li>
                <li>{tr('Une commande n\'est engagée qu\'après votre acceptation du devis et la confirmation du paiement.')}</li>
                <li>{tr('Le fournisseur peut modifier un prix ou rendre un produit indisponible ; nous vous informons alors des options possibles.')}</li>
              </ul>
            </>
          ),
        },
        {
          title: tr('Paiement et portefeuille'),
          body: (
            <>
              <p>
                {tr('Le paiement s\'effectue via votre portefeuille KONVWA, que vous approvisionnez par MonCash, NatCash ou les autres moyens proposés dans l\'application. Un dépôt est crédité après vérification par notre équipe, ce qui peut prendre jusqu\'à 24 à 48 heures.')}
              </p>
              <p>
                {tr('Vous devez utiliser des moyens de paiement dont vous êtes titulaire. Toute preuve de paiement falsifiée entraîne le rejet de l\'opération et peut conduire à la suspension du compte.')}
              </p>
            </>
          ),
        },
        {
          title: tr('Expédition, délais et livraison'),
          body: (
            <>
              <p>
                {tr('Les délais communiqués (généralement de 3 à 6 semaines) sont')}{' '}<strong>{tr('indicatifs')}</strong>{tr('. Ils dépendent du fournisseur, du transporteur, de la douane et d\'événements indépendants de notre volonté. Le suivi de commande vous informe des grandes étapes.')}
              </p>
              <p>
                {tr('Vous devez fournir une adresse et un numéro de téléphone exacts. Un colis non réceptionné ou livré à une adresse erronée par votre faute peut entraîner des frais supplémentaires.')}
              </p>
            </>
          ),
        },
        {
          title: tr('Produits interdits ou restreints'),
          body: (
            <p>
              {tr('Il est interdit de commander des produits illégaux ou dont l\'importation en Haïti est interdite ou soumise à autorisation (par exemple armes, stupéfiants, contrefaçons, certains produits chimiques ou médicaux). Nous pouvons refuser ou annuler une commande concernée, sans obligation de remboursement des frais déjà engagés auprès de tiers lorsque la faute vous est imputable.')}
            </p>
          ),
        },
        {
          title: tr('Annulation, retours et remboursements'),
          body: (
            <>
              <ul>
                <li>{tr('Avant l\'achat auprès du fournisseur, vous pouvez demander l\'annulation et être remboursé sur votre portefeuille.')}</li>
                <li>{tr('Une fois l\'achat effectué, l\'annulation dépend des conditions du fournisseur ; des frais peuvent rester dus.')}</li>
                <li>{tr('En cas de produit manquant, endommagé ou non conforme, signalez-le depuis la rubrique Support dans les meilleurs délais, avec photos à l\'appui.')}</li>
                <li>{tr('Les remboursements sont effectués sous forme de crédit sur votre portefeuille KONVWA.')}</li>
              </ul>
            </>
          ),
        },
        {
          title: tr('Responsabilité'),
          body: (
            <>
              <p>
                {tr('Nous mettons tout en œuvre pour fournir un service fiable, mais nous ne pouvons garantir une disponibilité ininterrompue ni l\'absence totale d\'erreur. Dans les limites permises par la loi, notre responsabilité est limitée au montant payé pour la commande concernée.')}
              </p>
              <p>
                {tr('Nous ne sommes pas responsables des retards ou pertes causés par les fournisseurs, les transporteurs, la douane ou un cas de force majeure.')}
              </p>
            </>
          ),
        },
        {
          title: tr('Comportements interdits'),
          body: (
            <ul>
              <li>{tr('Utiliser le service à des fins frauduleuses ou illégales.')}</li>
              <li>{tr('Tenter d\'accéder sans autorisation aux comptes ou aux systèmes.')}</li>
              <li>{tr('Perturber le fonctionnement de l\'application ou en extraire les données de façon automatisée.')}</li>
              <li>{tr('Usurper l\'identité d\'une autre personne.')}</li>
            </ul>
          ),
        },
        {
          title: tr('Suspension et résiliation'),
          body: (
            <p>
              {tr('Nous pouvons suspendre ou fermer un compte en cas de non-respect des présentes conditions. Vous pouvez demander la fermeture de votre compte à tout moment ; les commandes en cours restent soumises aux présentes conditions jusqu\'à leur terme.')}
            </p>
          ),
        },
        {
          title: tr('Propriété intellectuelle'),
          body: (
            <p>
              {tr('La marque KONVWA, le logo, l\'interface et les contenus de l\'application nous appartiennent. Les marques tierces (Alibaba, Shein, Temu, MonCash, NatCash…) appartiennent à leurs propriétaires respectifs et sont citées à titre d\'information.')}
            </p>
          ),
        },
        {
          title: tr('Modification des conditions et droit applicable'),
          body: (
            <>
              <p>
                {tr('Nous pouvons mettre à jour ces conditions ; la date de dernière mise à jour figure en haut de cette page. En continuant à utiliser le service après une modification, vous l\'acceptez.')}
              </p>
              <p>{tr('Les présentes conditions sont régies par le droit haïtien.')}</p>
            </>
          ),
        },
        { title: tr('Contact'), body: contact },
      ]}
    />
  )
}

export function PrivacyPage() {
  return (
    <LegalPage
      title={tr('Politique de confidentialité')}
      intro={tr('Cette politique explique quelles données KONVWA collecte, pourquoi, avec qui elles sont partagées et quels sont vos droits. Nous ne vendons pas vos données personnelles.')}
      sections={[
        {
          title: tr('Données que nous collectons'),
          body: (
            <ul>
              <li><strong>{tr('Compte :')}</strong>{' '}{tr('nom, adresse e-mail, numéro de téléphone (facultatif), mot de passe (stocké de façon chiffrée, jamais lisible par nous).')}</li>
              <li><strong>{tr('Connexion Google ou Facebook :')}</strong>{' '}{tr('nom, e-mail et photo de profil que ces services nous transmettent avec votre accord. Nous n\'avons jamais accès à votre mot de passe Google ou Facebook.')}</li>
              <li><strong>{tr('Commandes et expéditions :')}</strong>{' '}{tr('liens de produits, adresses de livraison, historique et statut des commandes.')}</li>
              <li><strong>{tr('Paiements :')}</strong>{' '}{tr('montants, moyen de paiement, référence de transaction et preuves de paiement que vous téléversez. Nous ne stockons pas de numéro de carte bancaire.')}</li>
              <li><strong>{tr('Support :')}</strong>{' '}{tr('messages échangés avec notre équipe.')}</li>
              <li><strong>{tr('Technique :')}</strong>{' '}{tr('type d\'appareil et de navigateur, journaux d\'activité utiles à la sécurité.')}</li>
            </ul>
          ),
        },
        {
          title: tr('Pourquoi nous utilisons ces données'),
          body: (
            <ul>
              <li>{tr('Créer et sécuriser votre compte, vous identifier.')}</li>
              <li>{tr('Établir les devis, traiter les commandes, les paiements, l\'expédition et la livraison.')}</li>
              <li>{tr('Vous envoyer des notifications utiles : devis prêt, paiement confirmé, colis expédié ou livré.')}</li>
              <li>{tr('Répondre à vos demandes de support et prévenir la fraude.')}</li>
              <li>{tr('Respecter nos obligations légales et comptables.')}</li>
            </ul>
          ),
        },
        {
          title: tr('Avec qui nous les partageons'),
          body: (
            <>
              <p>{tr('Uniquement lorsque c\'est nécessaire au service :')}</p>
              <ul>
                <li><strong>{tr('Hébergement et base de données :')}</strong>{' '}{tr('Supabase et Vercel, qui stockent et servent l\'application pour notre compte.')}</li>
                <li><strong>{tr('Fournisseurs et transporteurs :')}</strong>{' '}{tr('les informations de livraison indispensables à l\'exécution de votre commande.')}</li>
                <li><strong>{tr('Prestataires de paiement :')}</strong>{' '}{tr('MonCash, NatCash ou autres moyens proposés, pour traiter vos paiements.')}</li>
                <li><strong>{tr('Autorités :')}</strong>{' '}{tr('si la loi nous y oblige.')}</li>
              </ul>
            </>
          ),
        },
        {
          title: tr('Notifications, stockage local et cookies'),
          body: (
            <>
              <p>
                {tr('L\'application utilise le stockage de votre navigateur (session de connexion, préférences) et un service worker pour le mode hors ligne et les notifications. Nous n\'utilisons pas de cookies publicitaires.')}
              </p>
              <p>
                {tr('Les notifications push ne sont envoyées que si vous les activez ; vous pouvez les désactiver à tout moment dans les réglages de votre navigateur ou de l\'application.')}
              </p>
            </>
          ),
        },
        {
          title: tr('Durée de conservation'),
          body: (
            <p>
              {tr('Nous conservons vos données tant que votre compte est actif, puis pendant la durée nécessaire pour respecter nos obligations légales, comptables et de lutte contre la fraude. Les données qui ne sont plus nécessaires sont supprimées ou anonymisées.')}
            </p>
          ),
        },
        {
          title: tr('Sécurité'),
          body: (
            <p>
              {tr('Les échanges sont chiffrés (HTTPS) et l\'accès aux données est restreint par des règles de sécurité au niveau de la base. Aucun système n\'étant infaillible, nous vous conseillons de choisir un mot de passe unique et de ne jamais le partager.')}
            </p>
          ),
        },
        {
          title: tr('Vos droits'),
          body: (
            <>
              <p>{tr('Vous pouvez à tout moment :')}</p>
              <ul>
                <li>{tr('consulter et corriger vos informations depuis votre profil ;')}</li>
                <li>{tr('demander une copie de vos données ;')}</li>
                <li>{tr('demander la suppression de votre compte et de vos données, sous réserve de nos obligations légales ;')}</li>
                <li>{tr('retirer votre accord aux notifications.')}</li>
              </ul>
              <p>{tr('Pour exercer ces droits, contactez-nous (voir section Contact).')}</p>
            </>
          ),
        },
        {
          title: tr('Mineurs'),
          body: (
            <p>
              {tr('Le service s\'adresse aux personnes majeures. Nous ne collectons pas sciemment de données de mineurs sans l\'accord d\'un représentant légal.')}
            </p>
          ),
        },
        {
          title: tr('Modifications de cette politique'),
          body: (
            <p>
              {tr('Nous pouvons la mettre à jour ; la date de dernière mise à jour figure en haut de la page. En cas de changement important, nous vous en informerons dans l\'application.')}
            </p>
          ),
        },
        { title: tr('Contact'), body: contact },
      ]}
    />
  )
}
