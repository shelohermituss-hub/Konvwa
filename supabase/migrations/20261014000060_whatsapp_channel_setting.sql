-- Link of the KONVWA WhatsApp channel, edited by the admin in Paramètres. Public by nature (it is an invitation link): visitors read this ONE key,
-- nothing else of app_settings (the other policies stay for authenticated users only).
INSERT INTO public.app_settings (key, value, label, description, sensitive)
VALUES ('whatsapp_channel_url', '', 'Lien de la chaîne WhatsApp', 'Adresse de la chaîne WhatsApp de KONVWA (https://whatsapp.com/channel/…). Vide : les boutons « Suivre la chaîne » sont cachés.', false)
ON CONFLICT (key) DO NOTHING;

-- a visitor can only read, never write, app_settings (RLS already refused it: the rights are removed too)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.app_settings FROM anon;

DROP POLICY IF EXISTS app_settings_channel_guest_read ON public.app_settings;
CREATE POLICY app_settings_channel_guest_read ON public.app_settings FOR SELECT TO anon
  USING (key = 'whatsapp_channel_url' AND sensitive = false);
