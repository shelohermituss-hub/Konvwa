import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { tr } from '@/lib/i18n'

interface Props {
  lat: number
  lng: number
  /** Heading in degrees: the ship points that way. */
  course?: number
  /** The route travelled so far, oldest first. */
  track?: Array<[number, number]>
  /** A signal received a few minutes ago: the ship pulses. */
  live: boolean
}

// a ship-shaped arrow turned to its heading (an arrow, not a default Leaflet pin: nothing to download, and it shows where the ship is going)
const shipIcon = (course: number | undefined, live: boolean) => L.divIcon({
  className: '',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  html: `<div style="position:relative;width:40px;height:40px">
    ${live ? '<span class="absolute inset-1 animate-ping rounded-full bg-[#F05A28]/40"></span>' : ''}
    <svg viewBox="0 0 40 40" width="40" height="40" style="position:absolute;inset:0;transform:rotate(${course ?? 0}deg);filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))" aria-hidden="true">
      ${course === undefined
        ? '<circle cx="20" cy="20" r="8" fill="#F05A28" stroke="#fff" stroke-width="3"/>'
        : '<path d="M20 4 L31 33 L20 27 L9 33 Z" fill="#F05A28" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/>'}
    </svg>
  </div>`,
})

/** The map of the ship: its position, its heading and the route it has travelled. The map is created once; later positions move the ship and extend the route. */
export default function VesselMap({ lat, lng, course, track, live }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const ship = useRef<L.Marker | null>(null)
  const route = useRef<L.Polyline | null>(null)

  useEffect(() => {
    if (!box.current || map.current) return
    // one finger scrolls the page on a phone (two fingers move the map); the wheel does not zoom while scrolling the page
    const m = L.map(box.current, { zoomControl: true, scrollWheelZoom: false, dragging: !L.Browser.mobile, attributionControl: true })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 12, attribution: '© OpenStreetMap' }).addTo(m)
    route.current = L.polyline([], { color: '#0369a1', weight: 3, opacity: 0.8, dashArray: '6 8' }).addTo(m)
    ship.current = L.marker([lat, lng], { icon: shipIcon(course, live), keyboard: false, interactive: false }).addTo(m)
    route.current.setLatLngs([...(track ?? []), [lat, lng]])
    // the first view frames the ship and the latest stretch of its route (the whole route of an ocean crossing would make the ship a dot)
    const recent = [...(track ?? []).slice(-12), [lat, lng] as [number, number]]
    if (recent.length > 1) m.fitBounds(L.latLngBounds(recent), { padding: [40, 40], maxZoom: 6 })
    else m.setView([lat, lng], 6)
    map.current = m
    return () => { m.remove(); map.current = null; ship.current = null; route.current = null }
  // created once: the effect below follows the props
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!map.current || !ship.current || !route.current) return
    ship.current.setLatLng([lat, lng]).setIcon(shipIcon(course, live))
    route.current.setLatLngs([...(track ?? []), [lat, lng]])
    // a ship that sails out of the view is followed
    if (!map.current.getBounds().contains([lat, lng])) map.current.panTo([lat, lng])
  }, [lat, lng, course, track, live])

  return <div ref={box} role="img" aria-label={tr('Carte de la position du bateau')} className="h-56 w-full overflow-hidden rounded-xl border border-gray-100 bg-sky-50" />
}
