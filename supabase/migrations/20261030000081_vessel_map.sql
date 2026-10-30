-- The live map of the ship: get_shipment_vessel() now also gives the heading (to turn the ship on the map) and the route travelled so far.
-- Both follow the "position" choice of the team: a client who may not see the position gets neither.
CREATE OR REPLACE FUNCTION public.get_shipment_vessel(p_shipment uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   uuid := (SELECT auth.uid());
  s       record;
  l       record;
  v_show  jsonb;
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

  SELECT * INTO l FROM vessel_positions WHERE shipment_id = p_shipment ORDER BY recorded_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_show := s.ais_show;
  v_out := jsonb_build_object('vessel', s.vessel_info, 'voyage', s.voyage_number, 'at', l.recorded_at);
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
