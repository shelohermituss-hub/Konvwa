-- Add shipment_id to product_requests so a cargo request can be assigned to a batch
ALTER TABLE product_requests
  ADD COLUMN IF NOT EXISTS shipment_id uuid REFERENCES shipments(id) ON DELETE SET NULL;
