import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

const UPDATED = '2 octobre 2026'
const CONTACT_EMAIL = 'support@konvwa.com'

interface Section {
  title: string
  body: ReactNode
}

function LegalPage({ title, intro, sections }: { title: string; intro: string; sections: Section[] }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-20 pt-6 sm:px-6 md:pt-10">
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Dernière mise à jour : {UPDATED}</p>
      <p className="mt-6 text-base leading-relaxed text-muted-foreground">{intro}</p>

      <nav aria-label="Sommaire" className="mt-8 rounded-2xl border border-border bg-muted/30 p-5">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Sommaire</p>
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
        <Link to="/terms" className="text-primary hover:underline">Conditions d'utilisation</Link>
        <Link to="/privacy" className="text-primary hover:underline">Politique de confidentialité</Link>
        <Link to="/" className="ml-auto text-muted-foreground hover:text-foreground">Retour à l'accueil</Link>
      </div>
    </div>
  )
}

const contact = (
  <p>
    Pour toute question, écrivez-nous à{' '}
    <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-primary hover:underline">{CONTACT_EMAIL}</a>{' '}
    ou utilisez la rubrique Support de votre espace client.
  </p>
)

export function TermsPage() {
  return (
    <LegalPage
      title="Conditions d'utilisation"
      intro="Bienvenue sur KONVWA. En créant un compte ou en utilisant le service, vous acceptez les présentes conditions. Lisez-les attentivement avant de passer commande."
      sections={[
        {
          title: 'Le service',
          body: (
            <>
              <p>
                KONVWA est un service d'importation destiné aux clients résidant en Haïti. Il vous permet de
                soumettre un lien de produit (Alibaba, Shein, Temu ou autre boutique), de recevoir un devis,
                de payer en gourdes (HTG) et de suivre l'achat, l'expédition, le dédouanement et la livraison.
              </p>
              <p>
                KONVWA agit comme intermédiaire d'achat et d'expédition. Nous ne fabriquons pas les produits
                et ne sommes pas le vendeur d'origine.
              </p>
            </>
          ),
        },
        {
          title: 'Votre compte',
          body: (
            <>
              <p>
                Vous devez fournir des informations exactes et à jour, et être majeur ou autorisé par un
                représentant légal. Vous pouvez vous connecter avec votre e-mail et un mot de passe, ou avec
                votre compte Google ou Facebook.
              </p>
              <p>
                Vous êtes responsable de la confidentialité de vos identifiants et de toute activité réalisée
                depuis votre compte. Prévenez-nous sans délai en cas d'utilisation non autorisée.
              </p>
            </>
          ),
        },
        {
          title: 'Devis, prix et commandes',
          body: (
            <>
              <p>
                Chaque commande donne lieu à un devis détaillé : prix du produit, frais de service,
                expédition, douane estimée et livraison locale. Les montants sont exprimés en HTG.
              </p>
              <ul>
                <li>Un devis est valable pendant la durée indiquée sur celui-ci.</li>
                <li>Les frais de douane et d'expédition sont des <strong>estimations</strong> ; ils peuvent varier selon le poids, le volume réels et la réglementation en vigueur.</li>
                <li>Une commande n'est engagée qu'après votre acceptation du devis et la confirmation du paiement.</li>
                <li>Le fournisseur peut modifier un prix ou rendre un produit indisponible ; nous vous informons alors des options possibles.</li>
              </ul>
            </>
          ),
        },
        {
          title: 'Paiement et portefeuille',
          body: (
            <>
              <p>
                Le paiement s'effectue via votre portefeuille KONVWA, que vous approvisionnez par MonCash,
                NatCash ou les autres moyens proposés dans l'application. Un dépôt est crédité après
                vérification par notre équipe, ce qui peut prendre jusqu'à 24 à 48 heures.
              </p>
              <p>
                Vous devez utiliser des moyens de paiement dont vous êtes titulaire. Toute preuve de paiement
                falsifiée entraîne le rejet de l'opération et peut conduire à la suspension du compte.
              </p>
            </>
          ),
        },
        {
          title: 'Expédition, délais et livraison',
          body: (
            <>
              <p>
                Les délais communiqués (généralement de 3 à 6 semaines) sont <strong>indicatifs</strong>. Ils
                dépendent du fournisseur, du transporteur, de la douane et d'événements indépendants de notre
                volonté. Le suivi de commande vous informe des grandes étapes.
              </p>
              <p>
                Vous devez fournir une adresse et un numéro de téléphone exacts. Un colis non réceptionné ou
                livré à une adresse erronée par votre faute peut entraîner des frais supplémentaires.
              </p>
            </>
          ),
        },
        {
          title: 'Produits interdits ou restreints',
          body: (
            <p>
              Il est interdit de commander des produits illégaux ou dont l'importation en Haïti est interdite
              ou soumise à autorisation (par exemple armes, stupéfiants, contrefaçons, certains produits
              chimiques ou médicaux). Nous pouvons refuser ou annuler une commande concernée, sans obligation
              de remboursement des frais déjà engagés auprès de tiers lorsque la faute vous est imputable.
            </p>
          ),
        },
        {
          title: 'Annulation, retours et remboursements',
          body: (
            <>
              <ul>
                <li>Avant l'achat auprès du fournisseur, vous pouvez demander l'annulation et être remboursé sur votre portefeuille.</li>
                <li>Une fois l'achat effectué, l'annulation dépend des conditions du fournisseur ; des frais peuvent rester dus.</li>
                <li>En cas de produit manquant, endommagé ou non conforme, signalez-le depuis la rubrique Support dans les meilleurs délais, avec photos à l'appui.</li>
                <li>Les remboursements sont effectués sous forme de crédit sur votre portefeuille KONVWA.</li>
              </ul>
            </>
          ),
        },
        {
          title: 'Responsabilité',
          body: (
            <>
              <p>
                Nous mettons tout en œuvre pour fournir un service fiable, mais nous ne pouvons garantir une
                disponibilité ininterrompue ni l'absence totale d'erreur. Dans les limites permises par la loi,
                notre responsabilité est limitée au montant payé pour la commande concernée.
              </p>
              <p>
                Nous ne sommes pas responsables des retards ou pertes causés par les fournisseurs, les
                transporteurs, la douane ou un cas de force majeure.
              </p>
            </>
          ),
        },
        {
          title: 'Comportements interdits',
          body: (
            <ul>
              <li>Utiliser le service à des fins frauduleuses ou illégales.</li>
              <li>Tenter d'accéder sans autorisation aux comptes ou aux systèmes.</li>
              <li>Perturber le fonctionnement de l'application ou en extraire les données de façon automatisée.</li>
              <li>Usurper l'identité d'une autre personne.</li>
            </ul>
          ),
        },
        {
          title: 'Suspension et résiliation',
          body: (
            <p>
              Nous pouvons suspendre ou fermer un compte en cas de non-respect des présentes conditions.
              Vous pouvez demander la fermeture de votre compte à tout moment ; les commandes en cours restent
              soumises aux présentes conditions jusqu'à leur terme.
            </p>
          ),
        },
        {
          title: 'Propriété intellectuelle',
          body: (
            <p>
              La marque KONVWA, le logo, l'interface et les contenus de l'application nous appartiennent.
              Les marques tierces (Alibaba, Shein, Temu, MonCash, NatCash…) appartiennent à leurs
              propriétaires respectifs et sont citées à titre d'information.
            </p>
          ),
        },
        {
          title: 'Modification des conditions et droit applicable',
          body: (
            <>
              <p>
                Nous pouvons mettre à jour ces conditions ; la date de dernière mise à jour figure en haut de
                cette page. En continuant à utiliser le service après une modification, vous l'acceptez.
              </p>
              <p>Les présentes conditions sont régies par le droit haïtien.</p>
            </>
          ),
        },
        { title: 'Contact', body: contact },
      ]}
    />
  )
}

export function PrivacyPage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      intro="Cette politique explique quelles données KONVWA collecte, pourquoi, avec qui elles sont partagées et quels sont vos droits. Nous ne vendons pas vos données personnelles."
      sections={[
        {
          title: 'Données que nous collectons',
          body: (
            <ul>
              <li><strong>Compte :</strong> nom, adresse e-mail, numéro de téléphone (facultatif), mot de passe (stocké de façon chiffrée, jamais lisible par nous).</li>
              <li><strong>Connexion Google ou Facebook :</strong> nom, e-mail et photo de profil que ces services nous transmettent avec votre accord. Nous n'avons jamais accès à votre mot de passe Google ou Facebook.</li>
              <li><strong>Commandes et expéditions :</strong> liens de produits, adresses de livraison, historique et statut des commandes.</li>
              <li><strong>Paiements :</strong> montants, moyen de paiement, référence de transaction et preuves de paiement que vous téléversez. Nous ne stockons pas de numéro de carte bancaire.</li>
              <li><strong>Support :</strong> messages échangés avec notre équipe.</li>
              <li><strong>Technique :</strong> type d'appareil et de navigateur, journaux d'activité utiles à la sécurité.</li>
            </ul>
          ),
        },
        {
          title: 'Pourquoi nous utilisons ces données',
          body: (
            <ul>
              <li>Créer et sécuriser votre compte, vous identifier.</li>
              <li>Établir les devis, traiter les commandes, les paiements, l'expédition et la livraison.</li>
              <li>Vous envoyer des notifications utiles : devis prêt, paiement confirmé, colis expédié ou livré.</li>
              <li>Répondre à vos demandes de support et prévenir la fraude.</li>
              <li>Respecter nos obligations légales et comptables.</li>
            </ul>
          ),
        },
        {
          title: 'Avec qui nous les partageons',
          body: (
            <>
              <p>Uniquement lorsque c'est nécessaire au service :</p>
              <ul>
                <li><strong>Hébergement et base de données :</strong> Supabase et Vercel, qui stockent et servent l'application pour notre compte.</li>
                <li><strong>Fournisseurs et transporteurs :</strong> les informations de livraison indispensables à l'exécution de votre commande.</li>
                <li><strong>Prestataires de paiement :</strong> MonCash, NatCash ou autres moyens proposés, pour traiter vos paiements.</li>
                <li><strong>Autorités :</strong> si la loi nous y oblige.</li>
              </ul>
            </>
          ),
        },
        {
          title: 'Notifications, stockage local et cookies',
          body: (
            <>
              <p>
                L'application utilise le stockage de votre navigateur (session de connexion, préférences) et
                un service worker pour le mode hors ligne et les notifications. Nous n'utilisons pas de
                cookies publicitaires.
              </p>
              <p>
                Les notifications push ne sont envoyées que si vous les activez ; vous pouvez les désactiver à
                tout moment dans les réglages de votre navigateur ou de l'application.
              </p>
            </>
          ),
        },
        {
          title: 'Durée de conservation',
          body: (
            <p>
              Nous conservons vos données tant que votre compte est actif, puis pendant la durée nécessaire
              pour respecter nos obligations légales, comptables et de lutte contre la fraude. Les données qui
              ne sont plus nécessaires sont supprimées ou anonymisées.
            </p>
          ),
        },
        {
          title: 'Sécurité',
          body: (
            <p>
              Les échanges sont chiffrés (HTTPS) et l'accès aux données est restreint par des règles de sécurité
              au niveau de la base. Aucun système n'étant infaillible, nous vous conseillons de choisir un mot
              de passe unique et de ne jamais le partager.
            </p>
          ),
        },
        {
          title: 'Vos droits',
          body: (
            <>
              <p>Vous pouvez à tout moment :</p>
              <ul>
                <li>consulter et corriger vos informations depuis votre profil ;</li>
                <li>demander une copie de vos données ;</li>
                <li>demander la suppression de votre compte et de vos données, sous réserve de nos obligations légales ;</li>
                <li>retirer votre accord aux notifications.</li>
              </ul>
              <p>Pour exercer ces droits, contactez-nous (voir section Contact).</p>
            </>
          ),
        },
        {
          title: 'Mineurs',
          body: (
            <p>
              Le service s'adresse aux personnes majeures. Nous ne collectons pas sciemment de données de
              mineurs sans l'accord d'un représentant légal.
            </p>
          ),
        },
        {
          title: 'Modifications de cette politique',
          body: (
            <p>
              Nous pouvons la mettre à jour ; la date de dernière mise à jour figure en haut de la page.
              En cas de changement important, nous vous en informerons dans l'application.
            </p>
          ),
        },
        { title: 'Contact', body: contact },
      ]}
    />
  )
}
