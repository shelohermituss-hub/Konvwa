-- More precise shop categories (the storefront's filter chips, the home shelves and the import's AI all read them), and the existing products sorted into them.
-- The four broad categories (Électronique, Beauté & Santé, Mode & Vêtements, Sport & Loisirs) are replaced by precise ones; Maison & Cuisine and Jouets & Jeux stay.
INSERT INTO public.categories (name, slug, icon) VALUES
  ('Téléphones & Accessoires', 'phones', 'Smartphone'),
  ('Ordinateurs & Tablettes', 'computers', 'Laptop'),
  ('Écrans & Moniteurs', 'monitors', 'Monitor'),
  ('Audio & Écouteurs', 'audio', 'Headphones'),
  ('Montres & Objets connectés', 'wearables', 'Watch'),
  ('TV & Projecteurs', 'tv', 'Tv'),
  ('Photo, Vidéo & Éclairage', 'photo-video', 'Camera'),
  ('Drones & Caméras d''action', 'drones', 'Plane'),
  ('Sécurité & Surveillance', 'security', 'ShieldCheck'),
  ('Jeux vidéo & Consoles', 'video-games', 'Gamepad2'),
  ('Chargeurs, Câbles & Batteries', 'chargers', 'BatteryCharging'),
  ('Réseau & Stockage', 'network-storage', 'Wifi'),
  ('Optique & Observation', 'optics', 'Telescope'),
  ('Bureau & Mobilier', 'office-furniture', 'Armchair'),
  ('Climatisation & Électroménager', 'appliances', 'Fan'),
  ('Outils & Bricolage', 'tools', 'Wrench'),
  ('Maison intelligente', 'smart-home', 'Lock'),
  ('Soins du visage & Peau', 'skincare', 'Sparkles'),
  ('Parfums', 'perfumes', 'SprayCan'),
  ('Rasage & Coiffure', 'grooming', 'Scissors'),
  ('Santé & Bien-être', 'health', 'HeartPulse'),
  ('Nutrition sportive', 'sports-nutrition', 'Pill'),
  ('Vêtements Homme', 'men-clothing', 'Shirt'),
  ('Vêtements Femme', 'women-clothing', 'Shirt'),
  ('Chaussures', 'shoes', 'Footprints'),
  ('Sacs & Bagages', 'bags', 'Briefcase'),
  ('Bijoux & Lunettes', 'jewelry-eyewear', 'Glasses'),
  ('Sport & Fitness', 'fitness', 'Dumbbell'),
  ('Bébé & Enfants', 'baby-kids', 'Baby'),
  ('Livres & Loisirs', 'books-hobbies', 'BookOpen'),
  ('Autres produits', 'other', 'Package')
ON CONFLICT (slug) DO NOTHING;

DELETE FROM public.categories WHERE slug IN ('electronics', 'beauty', 'fashion', 'sports');

-- Existing products: only those still in an old broad category (or none) are sorted, by what their name says; anything chosen by hand later is left alone.
WITH p AS (
  SELECT id, lower(name) AS n, supplier_name AS s, category AS old FROM public.products
   WHERE category IS NULL OR category IN ('Électronique', 'Beauté & Santé', 'Mode & Vêtements', 'Sport & Loisirs', 'Maison & Cuisine', 'Jouets & Jeux', 'Mecanique')
), r AS (
  SELECT id, CASE
  WHEN n ~ 'pression artérielle|blood pressure|brosse à dents|genou' THEN 'Santé & Bien-être'
  WHEN s ILIKE '%muscle%' OR n ~ 'protéine|protein|whey|créatine|creatine|gainer|bcaa|pré-?workout|anabol|cell-tech|serious mass' THEN 'Nutrition sportive'
  WHEN n ~ 'parfum|eau de toilette|cologne|perfume|armaf|elixir' THEN 'Parfums'
  WHEN n ~ 'sérum|serum|lotion|crème|savon|exfoli|gommage|baume|écran solaire|nettoyant|routine anti|soins de la peau|skincare|niacinamide' THEN 'Soins du visage & Peau'
  WHEN n ~ 'tondeuse|rasoir|sèche-cheveux|lisseur|trimmer|clipper|shaver' THEN 'Rasage & Coiffure'
  WHEN n ~ 'bébé|baby|garçon' THEN 'Bébé & Enfants'
  WHEN n ~ 'apple watch|montre connectée|smart band|bracelet intelligent|oura|lunettes intelligentes|bague intelligente|smart watch|airtag|traceur|tracker' THEN 'Montres & Objets connectés'
  WHEN n ~ 'lunettes|chaîne en maillons|bague|collier' THEN 'Bijoux & Lunettes'
  WHEN n ~ 'chargeur|câble usb|station de charge|batterie externe|power bank' THEN 'Chargeurs, Câbles & Batteries'
  WHEN n ~ 'dessiner|livre|c''était ça ou mourir|cours étape' THEN 'Livres & Loisirs'
  WHEN n ~ 'leapfrog|vtech|jouet|tikduck|flying orb|avion rc|avion télécommandé|drone q9s|drone scoot' THEN 'Jouets & Jeux'
  WHEN n ~ 'ps5|playstation|xbox|nintendo|console de jeu|manette|gamesir|call of duty|zelda|ea sports|grand theft|castlevania|final fantasy|spider-man|wolverine|hellraiser|control resonant|toy story|meta quest|casque vr|contrôleur de jeu|jeux mobiles|souris de jeu|jeu pour' AND n !~ 'écran' THEN 'Jeux vidéo & Consoles'
  WHEN n ~ 'ipod|microphone|dji mic|écouteurs|casque audio|casque sans fil|enceinte|haut-parleur|airpods|powerbeats|earpods|speaker' THEN 'Audio & Écouteurs'
  WHEN s = 'Neewer' OR n ~ 'appareil photo|osmo pocket|prise de vue|téléobjectif|éclairage|softbox|ring light|godox|instax|barre lumineuse|smallrig' THEN 'Photo, Vidéo & Éclairage'
  WHEN n ~ 'écran|moniteur|monitor|zenscreen|display' THEN 'Écrans & Moniteurs'
  WHEN n ~ 'jumelles|télescope|monoculaire|microscope|vision nocturne' THEN 'Optique & Observation'
  WHEN n ~ 'drone|caméra d''action|dji' THEN 'Drones & Caméras d''action'
  WHEN n ~ 'caméra de surveillance|caméras de surveillance|caméra de sécurité|sonnette|détecteur de dispositifs|surveillance|quarkview' THEN 'Sécurité & Surveillance'
  WHEN n ~ 'sac à|sac de|sacs|backpack|bagage' THEN 'Sacs & Bagages'
  WHEN n ~ 'macbook|laptop|ordinateur|chromebook|ipad|tablette|tablet|kindle|mac mini|imprimante|clavier|souris' THEN 'Ordinateurs & Tablettes'
  WHEN n ~ 'téléviseur|projecteur|fire tv|tv stick|télévision' THEN 'TV & Projecteurs'
  WHEN n ~ 'wifi|répéteur|routeur|ssd|disque dur|clé usb|boîtier' THEN 'Réseau & Stockage'
  WHEN n ~ 'smartphone|iphone|google pixel|xiaomi redmi|auto clicker' THEN 'Téléphones & Accessoires'
  WHEN n ~ 'serrure|toilette intelligente|bidet|homeview|alexa|domotique' THEN 'Maison intelligente'
  WHEN n ~ 'climatiseur|déshumidificateur|ventilateur|défroisseur|aspirateur|friteuse|blender|cafetière|bouilloire' THEN 'Climatisation & Électroménager'
  WHEN n ~ 'bureau|chaise|table de|organisateur de câbles|destructeur|compteur et détecteur|détecteur de billets' THEN 'Bureau & Mobilier'
  WHEN n ~ 'outil|tournevis|perceuse|perforateur|percforateur|excavatrice|machine à transfert|bricolage' THEN 'Outils & Bricolage'
  WHEN n ~ 'chaussures|baskets|sneakers' THEN 'Chaussures'
  WHEN n ~ 'ballon|basketball|protège-genoux|gants de football|rashguard|chaussettes de course|camouflage|casque d''air' THEN 'Sport & Fitness'
  WHEN n ~ 'femme|women|jelly bra|shapewear' THEN 'Vêtements Femme'
  WHEN n ~ 'homme|men''s|t-shirt|chemise|pantalon|pull |cardigan|polo|short|ensemble|maillot' THEN 'Vêtements Homme'
  ELSE CASE WHEN old IN ('Maison & Cuisine', 'Jouets & Jeux') THEN old ELSE 'Autres produits' END
END AS new FROM p
)
UPDATE public.products SET category = r.new FROM r WHERE products.id = r.id AND products.category IS DISTINCT FROM r.new;
