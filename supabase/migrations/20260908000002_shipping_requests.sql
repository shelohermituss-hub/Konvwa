-- Add request_type to product_requests to distinguish shipping-only from product import requests
ALTER TABLE product_requests
  ADD COLUMN IF NOT EXISTS request_type text NOT NULL DEFAULT 'product'
    CHECK (request_type IN ('product', 'shipping'));

-- Index for efficient filtering by user + type
CREATE INDEX IF NOT EXISTS idx_product_requests_user_type
  ON product_requests (user_id, request_type, status, created_at DESC);
