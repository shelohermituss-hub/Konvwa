-- Advertising cards shown on the client home screen, managed by the team (image or video, optional link, schedule).
CREATE TABLE IF NOT EXISTS public.ad_banners (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eyebrow     text,
  eyebrow_en  text,
  title       text NOT NULL,
  title_en    text,
  subtitle    text,
  subtitle_en text,
  media_type  text NOT NULL DEFAULT 'image',
  media_path  text,
  link_url    text,
  active      boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_by  uuid DEFAULT auth.uid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ad_banners_media_type_chk CHECK (media_type IN ('image', 'video')),
  CONSTRAINT ad_banners_title_len_chk CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  CONSTRAINT ad_banners_text_len_chk CHECK (
    coalesce(char_length(eyebrow), 0) <= 60 AND coalesce(char_length(eyebrow_en), 0) <= 60
    AND coalesce(char_length(title_en), 0) <= 120
    AND coalesce(char_length(subtitle), 0) <= 200 AND coalesce(char_length(subtitle_en), 0) <= 200),
  CONSTRAINT ad_banners_link_chk CHECK (link_url IS NULL OR link_url ~ '^(https://[^[:space:]]+|/[A-Za-z0-9/_?=&#.%-]*)$'),
  CONSTRAINT ad_banners_media_path_chk CHECK (media_path IS NULL OR media_path ~ '^[A-Za-z0-9._/-]{1,200}$'),
  CONSTRAINT ad_banners_schedule_chk CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS ad_banners_active_sort_idx ON public.ad_banners (active, sort_order);

CREATE OR REPLACE FUNCTION public.ad_banners_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
REVOKE EXECUTE ON FUNCTION public.ad_banners_touch() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER ad_banners_touch BEFORE UPDATE ON public.ad_banners FOR EACH ROW EXECUTE FUNCTION public.ad_banners_touch();

ALTER TABLE public.ad_banners ENABLE ROW LEVEL SECURITY;

-- clients only see live ads (active and inside their schedule); the team sees everything
CREATE POLICY ad_banners_select ON public.ad_banners FOR SELECT TO authenticated
  USING (is_admin() OR (active AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now())));
CREATE POLICY ad_banners_insert ON public.ad_banners FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY ad_banners_update ON public.ad_banners FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY ad_banners_delete ON public.ad_banners FOR DELETE TO authenticated USING (is_admin());

-- media bucket: public read (the files are ads), writes only by the team
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ads', 'ads', true, 31457280, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY ads_obj_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ads' AND is_admin());
CREATE POLICY ads_obj_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'ads' AND is_admin());
CREATE POLICY ads_obj_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'ads' AND is_admin());
