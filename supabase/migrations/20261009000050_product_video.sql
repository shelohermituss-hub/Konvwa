-- Product video: a link to one video file per product, copied by the import tool into its own public bucket.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS video_url text
  CONSTRAINT products_video_url_check CHECK (video_url IS NULL OR (video_url ~ '^https://' AND length(video_url) <= 600));

-- Public read (the files are shown on product pages); writes only by the service role (the import Edge Function): no storage policy is created.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-videos', 'product-videos', true, 31457280, ARRAY['video/mp4', 'video/webm'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 31457280, allowed_mime_types = ARRAY['video/mp4', 'video/webm'];
