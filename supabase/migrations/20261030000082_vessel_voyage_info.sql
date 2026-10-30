-- The ship and its voyage show before the ship is heard: name, IMO, voyage number and the dates of the shipment (a ship at the quay may not be heard for days).
-- get_shipment_vessel() then answers {"waiting": true} instead of nothing, and the position joins it as soon as the ship is heard.
-- The job also starts as soon as the goods are in the warehouse: the first signal of the ship is saved whenever it comes.
CREATE OR REPLACE FUNCTION public.get_shipment_vessel(p_shipment uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   uuid := (SELECT auth.uid());
  s       record;
  l       record;
  v_show  jsonb;
  v_base  jsonb;
  v_out   jsonb;
  v_hist  jsonb;
  v_track jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO s FROM shipments WHERE id = p_shipment;
  IF NOT FOUND OR NOT s.ais_enabled THEN RETURN NULL; END IF;
  IF NOT (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM product_requests r WHERE r.shipment_id = p_shipment AND r.user_id = v_uid)
    OR EXISTS (SELECT 1 FROM order_shipments os JOIN orders o ON o.id = os.order_id WHERE os.shipment_id = p_shipment AND o.user_id = v_uid)
  ) THEN RETURN NULL; END IF;

  v_show := s.ais_show;
  v_base := jsonb_strip_nulls(jsonb_build_object('vessel', s.vessel_info, 'voyage', s.voyage_number, 'imo', s.vessel_imo));
  IF coalesce((v_show ->> 'eta')::boolean, false) THEN
    v_base := v_base || jsonb_strip_nulls(jsonb_build_object('depart', s.departure_date, 'arrive', s.estimated_arrival));
  END IF;

  SELECT * INTO l FROM vessel_positions WHERE shipment_id = p_shipment ORDER BY recorded_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN v_base || jsonb_build_object('waiting', true); END IF;

  v_out := v_base || jsonb_build_object('at', l.recorded_at);
  IF coalesce((v_show ->> 'position')::boolean, false) THEN
    v_out := v_out || jsonb_build_object('lat', l.lat, 'lng', l.lng);
    IF l.course IS NOT NULL THEN v_out := v_out || jsonb_build_object('course', l.course); END IF;
    -- the route travelled: the last 150 saved positions, oldest first
    SELECT coalesce(jsonb_agg(jsonb_build_array(t.lat, t.lng) ORDER BY t.recorded_at), '[]'::jsonb)
      INTO v_track
      FROM (SELECT lat, lng, recorded_at FROM vessel_positions WHERE shipment_id = p_shipment ORDER BY recorded_at DESC LIMIT 150) t;
    v_out := v_out || jsonb_build_object('track', v_track);
  END IF;
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

CREATE OR REPLACE FUNCTION public.vessel_track_tick()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_secret text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM shipments WHERE ais_enabled AND vessel_mmsi IS NOT NULL AND status IN ('in_china_warehouse', 'shipped', 'in_transit')) THEN RETURN 'nothing_to_track'; END IF;
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
