-- Public bucket for the browser-side AI model used to remove photo backgrounds (admin tool). Read-only for everyone, written only with the service role (no write policy).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('models', 'models', true, 52428800, NULL)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 52428800;
