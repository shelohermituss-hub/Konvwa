-- Following the ship of a shipment from the AIS feed (the position signals ships broadcast).
-- The team picks the ship (name -> MMSI) and what the clients may see; the Edge Function `vessel-track` saves the positions (service role, never the browser);
-- a client reads them through get_shipment_vessel(), which checks that the shipment is theirs and leaves out what the team chose to hide.

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS vessel_mmsi   text CHECK (vessel_mmsi IS NULL OR vessel_mmsi ~ '^[0-9]{9}$'),
  ADD COLUMN IF NOT EXISTS vessel_imo    text CHECK (vessel_imo IS NULL OR vessel_imo ~ '^[0-9]{7}$'),
  ADD COLUMN IF NOT EXISTS voyage_number text CHECK (voyage_number IS NULL OR length(voyage_number) <= 30),
  ADD COLUMN IF NOT EXISTS ais_enabled   boolean NOT NULL DEFAULT false,
  -- what a client may see: position (map), speed, destination, ETA, history (the steps)
  ADD COLUMN IF NOT EXISTS ais_show      jsonb NOT NULL DEFAULT '{"position":true,"speed":true,"destination":true,"eta":true,"history":true}'::jsonb
    CHECK (jsonb_typeof(ais_show) = 'object'),
  ADD COLUMN IF NOT EXISTS ais_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS ais_error     text;

-- One row per saved position (append-only: the function only inserts). Only the team reads the table; clients go through get_shipment_vessel().
CREATE TABLE IF NOT EXISTS public.vessel_positions (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  recorded_at timestamptz NOT NULL,
  lat         numeric(8, 5) NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng         numeric(8, 5) NOT NULL CHECK (lng BETWEEN -180 AND 180),
  speed_kn    numeric(4, 1) CHECK (speed_kn IS NULL OR speed_kn >= 0),
  course      smallint CHECK (course IS NULL OR course BETWEEN 0 AND 360),
  nav_status  smallint,
  destination text,
  eta         timestamptz,
  -- a line of the history shown to the client (null: just a point of the route)
  event       text CHECK (event IS NULL OR event IN ('first', 'departed', 'stopped', 'destination')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vessel_positions_shipment_idx ON public.vessel_positions (shipment_id, recorded_at DESC);

ALTER TABLE public.vessel_positions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vessel_positions_admin_read ON public.vessel_positions;
CREATE POLICY vessel_positions_admin_read ON public.vessel_positions FOR SELECT TO authenticated USING (public.is_admin());
REVOKE ALL ON public.vessel_positions FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.vessel_positions FROM authenticated;

-- What a client sees of the ship that carries their cargo (null: nothing to show, or the shipment is not theirs).
CREATE OR REPLACE FUNCTION public.get_shipment_vessel(p_shipment uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   uuid := (SELECT auth.uid());
  s       record;
  l       record;
  v_show  jsonb;
  v_out   jsonb;
  v_hist  jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO s FROM shipments WHERE id = p_shipment;
  IF NOT FOUND OR NOT s.ais_enabled THEN RETURN NULL; END IF;
  IF NOT (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM product_requests r WHERE r.shipment_id = p_shipment AND r.user_id = v_uid)
    OR EXISTS (SELECT 1 FROM order_shipments os JOIN orders o ON o.id = os.order_id WHERE os.shipment_id = p_shipment AND o.user_id = v_uid)
  ) THEN RETURN NULL; END IF;

  SELECT * INTO l FROM vessel_positions WHERE shipment_id = p_shipment ORDER BY recorded_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_show := s.ais_show;
  v_out := jsonb_build_object('vessel', s.vessel_info, 'voyage', s.voyage_number, 'at', l.recorded_at);
  IF coalesce((v_show ->> 'position')::boolean, false) THEN v_out := v_out || jsonb_build_object('lat', l.lat, 'lng', l.lng); END IF;
  IF coalesce((v_show ->> 'speed')::boolean, false) AND l.speed_kn IS NOT NULL THEN v_out := v_out || jsonb_build_object('speed_kn', l.speed_kn); END IF;
  IF coalesce((v_show ->> 'destination')::boolean, false) AND l.destination IS NOT NULL THEN v_out := v_out || jsonb_build_object('destination', l.destination); END IF;
  IF coalesce((v_show ->> 'eta')::boolean, false) AND l.eta IS NOT NULL THEN v_out := v_out || jsonb_build_object('eta', l.eta); END IF;
  IF coalesce((v_show ->> 'history')::boolean, false) THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('at', h.recorded_at, 'event', h.event, 'destination', h.destination) ORDER BY h.recorded_at DESC), '[]'::jsonb)
      INTO v_hist
      FROM (SELECT recorded_at, event, destination FROM vessel_positions WHERE shipment_id = p_shipment AND event IS NOT NULL ORDER BY recorded_at DESC LIMIT 20) h;
    v_out := v_out || jsonb_build_object('history', v_hist);
  END IF;
  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION public.get_shipment_vessel(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_shipment_vessel(uuid) TO authenticated;

-- The job: every 30 minutes, if a shipment is at sea with its ship followed, the Edge Function listens to the feed for a minute.
CREATE OR REPLACE FUNCTION public.vessel_track_tick()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_secret text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM shipments WHERE ais_enabled AND vessel_mmsi IS NOT NULL AND status IN ('shipped', 'in_transit')) THEN RETURN 'nothing_to_track'; END IF;
  SELECT value INTO v_secret FROM app_settings WHERE key = 'auto_post_secret';
  IF v_secret IS NULL THEN RETURN 'no_secret'; END IF;
  PERFORM net.http_post(
    url => 'https://aklwkbzkumcldumrmgmr.supabase.co/functions/v1/vessel-track',
    headers => jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body => '{}'::jsonb,
    timeout_milliseconds => 100000
  );
  RETURN 'sent';
END;
$$;
REVOKE ALL ON FUNCTION public.vessel_track_tick() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('konvwa-vessel-track', '*/30 * * * *', 'SELECT public.vessel_track_tick()');
