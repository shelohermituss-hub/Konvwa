-- Notification texts are written in French by the database; this table gives their English version so each
-- user receives (in-app and push) the language saved on their profile. Free-text notifications written by an
-- admin simply have no English version and are shown as written.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title_en text, ADD COLUMN IF NOT EXISTS body_en text;

CREATE TABLE IF NOT EXISTS notif_i18n (
  id          serial PRIMARY KEY,
  kind        text NOT NULL CHECK (kind IN ('title', 'body')),
  ord         integer NOT NULL,
  fr_regex    text NOT NULL,
  en_template text NOT NULL
);
ALTER TABLE notif_i18n ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE notif_i18n FROM anon, authenticated;

INSERT INTO notif_i18n (kind, ord, fr_regex, en_template) VALUES
  ('title', 0, $q$^Devis disponible — (.+)$$q$, $q$Quote available — \1$q$),
  ('title', 1, $q$^Commande soumise$$q$, $q$Order submitted$q$),
  ('title', 2, $q$^Nouvelle commande — (.+)$$q$, $q$New order — \1$q$),
  ('title', 3, $q$^Paiement confirmé — expédition #(.+)$$q$, $q$Payment confirmed — shipment #\1$q$),
  ('title', 4, $q$^Paiement confirmé — (.+)$$q$, $q$Payment confirmed — \1$q$),
  ('title', 5, $q$^Paiement reçu — (.+)$$q$, $q$Payment received — \1$q$),
  ('title', 6, $q$^Disponible en entrepôt — Choisissez votre expédition$$q$, $q$Available at the warehouse — Choose your shipping$q$),
  ('title', 7, $q$^Expédiée depuis la Chine — (.+)$$q$, $q$Shipped from China — \1$q$),
  ('title', 8, $q$^Arrivée en Haïti — (.+)$$q$, $q$Arrived in Haiti — \1$q$),
  ('title', 9, $q$^Livraison en cours — (.+)$$q$, $q$Out for delivery — \1$q$),
  ('title', 10, $q$^Livrée — (.+)$$q$, $q$Delivered — \1$q$),
  ('title', 11, $q$^Commande annulée — (.+)$$q$, $q$Order cancelled — \1$q$),
  ('title', 12, $q$^Cargaison expédiée — #(.+)$$q$, $q$Cargo shipped — #\1$q$),
  ('title', 13, $q$^Cargaison arrivée en Haïti — #(.+)$$q$, $q$Cargo arrived in Haiti — #\1$q$),
  ('title', 14, $q$^Cargaison livrée — #(.+)$$q$, $q$Cargo delivered — #\1$q$),
  ('title', 15, $q$^Dépôt en attente de confirmation$$q$, $q$Deposit awaiting confirmation$q$),
  ('title', 16, $q$^Preuve de dépôt à vérifier$$q$, $q$Deposit proof to review$q$),
  ('title', 17, $q$^Dépôt confirmé$$q$, $q$Deposit confirmed$q$),
  ('title', 18, $q$^Dépôt refusé$$q$, $q$Deposit declined$q$),
  ('title', 19, $q$^Remboursement reçu$$q$, $q$Refund received$q$),
  ('title', 20, $q$^Ajustement de portefeuille$$q$, $q$Wallet adjustment$q$),
  ('title', 21, $q$^Solde reçu — expédition #(.+)$$q$, $q$Balance received — shipment #\1$q$),
  ('title', 22, $q$^Solde réglé — expédition #(.+)$$q$, $q$Balance paid — shipment #\1$q$),
  ('title', 23, $q$^Acompte reçu — expédition #(.+)$$q$, $q$Deposit received — shipment #\1$q$),
  ('title', 24, $q$^Devis d'expédition disponible — #(.+)$$q$, $q$Shipping quote available — #\1$q$),
  ('title', 25, $q$^Acompte expédition reçu — #(.+)$$q$, $q$Shipment deposit received — #\1$q$),
  ('title', 26, $q$^Paiement expédition reçu — #(.+)$$q$, $q$Shipment payment received — #\1$q$),
  ('title', 27, $q$^Dernier jour pour régler votre expédition #(.+)$$q$, $q$Last day to pay for your shipment #\1$q$),
  ('title', 28, $q$^Rappel : ([0-9]+) jours pour régler votre expédition #(.+)$$q$, $q$Reminder: \1 days left to pay for your shipment #\2$q$),
  ('title', 29, $q$^Frais de retard : (.+) HTG — expédition #(.+)$$q$, $q$Late fee: \1 HTG — shipment #\2$q$),
  ('title', 30, $q$^Devis expédition impayé — #(.+)$$q$, $q$Unpaid shipping quote — #\1$q$),
  ('title', 31, $q$^Expédition facturée$$q$, $q$Shipment invoiced$q$),
  ('title', 32, $q$^Colis reçu en entrepôt$$q$, $q$Parcel received at the warehouse$q$),
  ('title', 33, $q$^Demande d'expédition en cours d'examen$$q$, $q$Shipping request under review$q$),
  ('title', 34, $q$^Nouvelle demande d'expédition$$q$, $q$New shipping request$q$),
  ('title', 35, $q$^Réponse de support$$q$, $q$Support reply$q$),
  ('title', 36, $q$^Demande refusée$$q$, $q$Request declined$q$),
  ('body', 37, $q$^Votre commande (.+) a été reçue\. Notre équipe prépare votre devis\.$$q$, $q$Your order \1 has been received. Our team is preparing your quote.$q$),
  ('body', 38, $q$^Une nouvelle commande vient d'être soumise\. Préparez le devis\.$$q$, $q$A new order has just been submitted. Prepare the quote.$q$),
  ('body', 39, $q$^Le devis de votre commande (.+) est prêt\. Consultez-le et procédez au paiement\.$$q$, $q$The quote for your order \1 is ready. Review it and proceed to payment.$q$),
  ('body', 40, $q$^Votre paiement pour la commande (.+) a été confirmé\. L'achat va commencer\.$$q$, $q$Your payment for order \1 has been confirmed. The purchase will begin.$q$),
  ('body', 41, $q$^Le paiement de la commande (.+) est confirmé\. Vous pouvez lancer l'achat\.$$q$, $q$Payment for order \1 is confirmed. You can start the purchase.$q$),
  ('body', 42, $q$^Votre commande (.+) est prête en entrepôt Chine\. Allez sur Expéditions pour choisir votre mode d'envoi\.$$q$, $q$Your order \1 is ready at the China warehouse. Go to Shipments to choose your shipping method.$q$),
  ('body', 43, $q$^Votre commande (.+) est en route vers Haïti\.$$q$, $q$Your order \1 is on its way to Haiti.$q$),
  ('body', 44, $q$^Votre commande (.+) est arrivée en Haïti\. Le dédouanement va commencer\.$$q$, $q$Your order \1 has arrived in Haiti. Customs clearance will begin.$q$),
  ('body', 45, $q$^Votre commande (.+) est en cours de livraison\. Soyez disponible à votre adresse\.$$q$, $q$Your order \1 is out for delivery. Please be available at your address.$q$),
  ('body', 46, $q$^Votre commande (.+) a été livrée\. Merci de votre confiance chez Konvwa !$$q$, $q$Your order \1 has been delivered. Thank you for trusting Konvwa!$q$),
  ('body', 47, $q$^Votre commande (.+) a été annulée\. Contactez-nous si vous avez des questions\.$$q$, $q$Your order \1 has been cancelled. Contact us if you have any questions.$q$),
  ('body', 48, $q$^La commande (.+) a été annulée\.$$q$, $q$Order \1 has been cancelled.$q$),
  ('body', 49, $q$^Votre dépôt de (.+) est en cours de vérification\. Délai habituel : 24–48h\.$$q$, $q$Your deposit of \1 is being verified. Usual time: 24–48h.$q$),
  ('body', 50, $q$^Un dépôt de (.+) via (.+) attend votre validation\.$$q$, $q$A deposit of \1 via \2 is awaiting your approval.$q$),
  ('body', 51, $q$^Votre dépôt de (.+) a été crédité sur votre portefeuille\.$$q$, $q$Your deposit of \1 has been credited to your wallet.$q$),
  ('body', 52, $q$^Votre dépôt de (.+) a été validé\. Le solde est disponible dans votre portefeuille\.$$q$, $q$Your deposit of \1 has been approved. The balance is available in your wallet.$q$),
  ('body', 53, $q$^Votre demande de dépôt de (.+) a été refusée\. Contactez le support si besoin\.$$q$, $q$Your deposit request of \1 was declined. Contact support if needed.$q$),
  ('body', 54, $q$^Un remboursement de (.+) a été crédité sur votre portefeuille\.$$q$, $q$A refund of \1 has been credited to your wallet.$q$),
  ('body', 55, $q$^Un ajustement de (.+) a été appliqué à votre portefeuille\.$$q$, $q$An adjustment of \1 has been applied to your wallet.$q$),
  ('body', 56, $q$^Votre cargaison a quitté l'entrepôt et est en route vers Haïti\.$$q$, $q$Your cargo has left the warehouse and is on its way to Haiti.$q$),
  ('body', 57, $q$^Votre cargaison est arrivée en Haïti\. Le dédouanement va commencer\. Solde de (.+) HTG à régler à la livraison \(ou dès maintenant depuis votre portefeuille\)\.$$q$, $q$Your cargo has arrived in Haiti. Customs clearance will begin. Balance of \1 HTG due on delivery (or right now from your wallet).$q$),
  ('body', 58, $q$^Votre cargaison est arrivée en Haïti\. Le dédouanement va commencer\.$$q$, $q$Your cargo has arrived in Haiti. Customs clearance will begin.$q$),
  ('body', 59, $q$^Votre cargaison est en cours de livraison\. Soyez disponible à votre adresse\. Solde de (.+) HTG à régler à la livraison \(ou dès maintenant depuis votre portefeuille\)\.$$q$, $q$Your cargo is out for delivery. Please be available at your address. Balance of \1 HTG due on delivery (or right now from your wallet).$q$),
  ('body', 60, $q$^Votre cargaison est en cours de livraison\. Soyez disponible à votre adresse\.$$q$, $q$Your cargo is out for delivery. Please be available at your address.$q$),
  ('body', 61, $q$^Votre cargaison a été livrée\. Merci de votre confiance chez Konvwa !$$q$, $q$Your cargo has been delivered. Thank you for trusting Konvwa!$q$),
  ('body', 62, $q$^Nous avons reçu (.+) HTG\. Il reste (.+) HTG à régler à la livraison\.$$q$, $q$We received \1 HTG. \2 HTG remain to be paid on delivery.$q$),
  ('body', 63, $q$^Votre paiement de (.+) HTG a bien été reçu\.$$q$, $q$Your payment of \1 HTG has been received.$q$),
  ('body', 64, $q$^(.+) HTG reçus \(acompte, solde à la livraison : (.+) HTG\)\.$$q$, $q$\1 HTG received (deposit, balance on delivery: \2 HTG).$q$),
  ('body', 65, $q$^(.+) HTG reçus\.$$q$, $q$\1 HTG received.$q$),
  ('body', 66, $q$^Merci ! Votre expédition est entièrement payée \((.+) HTG reçus\)\.$$q$, $q$Thank you! Your shipment is fully paid (\1 HTG received).$q$),
  ('body', 67, $q$^Nous avons bien reçu le solde de (.+) HTG\. Merci !$$q$, $q$We have received the balance of \1 HTG. Thank you!$q$),
  ('body', 68, $q$^Votre devis est prêt : (.+) HTG\. Réglez-le avant le (.+) : au-delà, (.+) HTG de frais de retard s'ajoutent par jour\. Vous pouvez aussi payer (.+) % maintenant \((.+) HTG\) et le reste à la livraison\.$$q$, $q$Your quote is ready: \1 HTG. Pay it before \2: after that, \3 HTG in late fees are added per day. You can also pay \4% now (\5 HTG) and the rest on delivery.$q$),
  ('body', 69, $q$^Votre devis est prêt : (.+) HTG\. Vous pouvez aussi payer (.+) % maintenant \((.+) HTG\) et le reste à la livraison\.$$q$, $q$Your quote is ready: \1 HTG. You can also pay \2% now (\3 HTG) and the rest on delivery.$q$),
  ('body', 70, $q$^Votre devis de (.+) HTG est à régler avant le (.+)\. Passé ce délai, (.+) HTG de frais de retard s'ajoutent par jour\. Option : payez (.+) % maintenant \((.+) HTG\)\.$$q$, $q$Your quote of \1 HTG is due before \2. After that, \3 HTG in late fees are added per day. Option: pay \4% now (\5 HTG).$q$),
  ('body', 71, $q$^Votre devis est en retard de 1 jour\. Total à régler : (.+) HTG \((.+) HTG de plus chaque jour\)\. Réglez dès maintenant pour arrêter les frais\.$$q$, $q$Your quote is 1 day late. Total to pay: \1 HTG (\2 HTG more each day). Pay now to stop the fees.$q$),
  ('body', 72, $q$^Votre devis est en retard de ([0-9]+) jours\. Total à régler : (.+) HTG \((.+) HTG de plus chaque jour\)\. Réglez dès maintenant pour arrêter les frais\.$$q$, $q$Your quote is \1 days late. Total to pay: \2 HTG (\3 HTG more each day). Pay now to stop the fees.$q$),
  ('body', 73, $q$^(.+) a dépassé l'échéance\. Les frais de retard de (.+) HTG/jour courent depuis aujourd'hui\.$$q$, $q$\1 has passed the due date. Late fees of \2 HTG/day are running as of today.$q$),
  ('body', 74, $q$^(.+) HTG débités pour votre expédition\.$$q$, $q$\1 HTG charged for your shipment.$q$),
  ('body', 75, $q$^Vos colis ont bien été reçus dans notre entrepôt\. La facture arrivera prochainement\.$$q$, $q$Your parcels were received at our warehouse. The invoice will follow shortly.$q$),
  ('body', 76, $q$^Notre équipe examine votre demande d'expédition\. Vous recevrez un devis prochainement\.$$q$, $q$Our team is reviewing your shipping request. You will receive a quote shortly.$q$),
  ('body', 77, $q$^Un client vient de soumettre une nouvelle demande d'expédition\.$$q$, $q$A customer has just submitted a new shipping request.$q$),
  ('body', 78, $q$^Notre équipe a répondu à votre ticket: "(.+)"$$q$, $q$Our team replied to your ticket: "\1"$q$),
  ('body', 79, $q$^Votre demande pour "(.+)" n'a pas pu être traitée\.$$q$, $q$Your request for "\1" could not be processed.$q$);

CREATE OR REPLACE FUNCTION translate_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.title_en IS NULL THEN
    SELECT regexp_replace(NEW.title, t.fr_regex, t.en_template) INTO NEW.title_en
      FROM notif_i18n t WHERE t.kind = 'title' AND NEW.title ~ t.fr_regex ORDER BY t.ord LIMIT 1;
  END IF;
  IF NEW.body_en IS NULL THEN
    SELECT regexp_replace(NEW.body, t.fr_regex, t.en_template) INTO NEW.body_en
      FROM notif_i18n t WHERE t.kind = 'body' AND NEW.body ~ t.fr_regex ORDER BY t.ord LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION translate_notification() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_notifications_translate
  BEFORE INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION translate_notification();

-- Push: carry both languages; send-push picks the one saved on the recipient's profile
CREATE OR REPLACE FUNCTION notify_push_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://aklwkbzkumcldumrmgmr.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrbHdrYnprdW1jbGR1bXJtZ21yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MTU5MzUsImV4cCI6MjA5ODA5MTkzNX0.SK9RM2GqKYtBSNhePDCJBILsrDsn30HnTm5nGce4d50'
    ),
    body := jsonb_build_object(
      'user_id',   NEW.user_id,
      'title',     NEW.title,
      'body',      NEW.body,
      'title_en',  NEW.title_en,
      'body_en',   NEW.body_en,
      'icon',      '/icon-192.png',
      'type',      COALESCE(NEW.type, 'info'),
      'click_url', COALESCE(NEW.link, '/notifications')
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
