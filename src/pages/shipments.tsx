import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Ship, Package, MapPin, Calendar, Anchor, CheckCircle2, Clock, Truck, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

import IconNavire from 'flat-color-icons/svg/in_transit.svg'

interface MyShipment {
  shipment_id: string
  batch_code: string
  status: string
  vessel_info: string | null
  departure_date: string | null
  estimated_arrival: string | null
  actual_arrival: string | null
  container_number: string | null
  order_id: string
  order_tracking: string
  product_name: string
}

const SHIPMENT_STEPS = [
  { key: 'pending', label: 'En attente', icon: Clock },
  { key: 'consolidating', label: 'Consolidation', icon: Package },
  { key: 'packed', label: 'Emballé', icon: Package },
  { key: 'loaded', label: 'Chargé', icon: Anchor },
  { key: 'sailing', label: 'En mer', icon: Ship },
  { key: 'arrived', label: 'Arrivé', icon: MapPin },
  { key: 'cleared', label: 'Dédouané', icon: CheckCircle2 },
  { key: 'distributing', label: 'Distribution', icon: Truck },
  { key: 'completed', label: 'Livré', icon: CheckCircle2 },
]

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  consolidating: 'bg-warning/15 text-warning',
  packed: 'bg-warning/15 text-warning',
  loaded: 'bg-accent/15 text-accent',
  sailing: 'bg-primary/15 text-primary',
  arrived: 'bg-success/15 text-success',
  cleared: 'bg-success/15 text-success',
  distributing: 'bg-success/15 text-success',
  completed: 'bg-success/15 text-success',
}

function getStepIndex(status: string) {
  return SHIPMENT_STEPS.findIndex(s => s.key === status)
}

function ShipmentCard({ shipment }: { shipment: MyShipment }) {
  const [expanded, setExpanded] = useState(false)
  const stepIdx = getStepIndex(shipment.status)

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 shrink-0">
          <img src={IconNavire} alt="" className="h-8 w-8 object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-sm font-mono">{shipment.batch_code}</p>
            <Badge className={cn('rounded-full text-[10px] px-2 py-0 h-4', STATUS_COLOR[shipment.status])}>
              {SHIPMENT_STEPS.find(s => s.key === shipment.status)?.label || shipment.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{shipment.product_name}</p>
          {shipment.vessel_info && (
            <p className="text-xs text-muted-foreground/70 mt-0.5 flex items-center gap-1">
              <Anchor className="h-3 w-3" />
              {shipment.vessel_info}
            </p>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </div>

      {/* Expanded timeline */}
      {expanded && (
        <div className="px-4 pb-5 pt-2 border-t border-border">
          {/* Dates */}
          <div className="flex gap-4 mb-5 text-xs">
            {shipment.departure_date && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>Départ: {new Date(shipment.departure_date).toLocaleDateString('fr-HT', { day: 'numeric', month: 'short' })}</span>
              </div>
            )}
            {shipment.estimated_arrival && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span>Arrivée: {new Date(shipment.estimated_arrival).toLocaleDateString('fr-HT', { day: 'numeric', month: 'short' })}</span>
              </div>
            )}
          </div>

          {/* Step progress */}
          <div className="space-y-2">
            {SHIPMENT_STEPS.map((step, idx) => {
              const Icon = step.icon
              const isDone = idx < stepIdx
              const isCurrent = idx === stepIdx
              return (
                <div key={step.key} className="flex items-center gap-3">
                  <div className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full shrink-0 transition-all',
                    isDone ? 'bg-primary text-primary-foreground' :
                    isCurrent ? 'bg-primary/20 text-primary ring-2 ring-primary/30' :
                    'bg-muted text-muted-foreground'
                  )}>
                    {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 flex items-center justify-between">
                    <span className={cn('text-sm', isDone || isCurrent ? 'font-medium' : 'text-muted-foreground')}>
                      {step.label}
                    </span>
                    {isCurrent && (
                      <Badge className="bg-primary/10 text-primary text-[10px] px-2 rounded-full">Actuel</Badge>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Commande info */}
          <div className="mt-4 rounded-xl bg-muted/40 p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Code commande</p>
              <p className="text-sm font-mono font-semibold">{shipment.order_tracking}</p>
            </div>
            {shipment.container_number && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Conteneur</p>
                <p className="text-sm font-mono font-semibold">{shipment.container_number}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function ShipmentsPage() {
  const { user } = useAuth()
  const [shipments, setShipments] = useState<MyShipment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'active' | 'completed'>('active')

  useEffect(() => {
    if (!user) return
    supabase
      .from('order_shipments')
      .select(`
        order_id,
        orders!inner(tracking_code, user_id, quotes(product_requests(product_name))),
        shipments(id, batch_code, status, vessel_info, departure_date, estimated_arrival, actual_arrival, container_number)
      `)
      .eq('orders.user_id', user.id)
      .then(({ data }) => {
        if (data) {
          const rows: MyShipment[] = data.map((d: any) => ({
            shipment_id: d.shipments?.id || '',
            batch_code: d.shipments?.batch_code || '',
            status: d.shipments?.status || 'pending',
            vessel_info: d.shipments?.vessel_info,
            departure_date: d.shipments?.departure_date,
            estimated_arrival: d.shipments?.estimated_arrival,
            actual_arrival: d.shipments?.actual_arrival,
            container_number: d.shipments?.container_number,
            order_id: d.order_id,
            order_tracking: d.orders?.tracking_code || '',
            product_name: d.orders?.quotes?.product_requests?.product_name || 'Produit',
          }))
          setShipments(rows)
        }
        setLoading(false)
      })
  }, [user])

  const filtered = shipments.filter(s =>
    filter === 'active' ? s.status !== 'completed' : s.status === 'completed'
  )

  return (
    <div className="min-h-full bg-background">
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Expéditions</h1>
        <p className="text-sm text-muted-foreground">{shipments.length} expédition{shipments.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Tabs */}
      <div className="px-4 pb-4 flex gap-2">
        {(['active', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'flex-1 rounded-full py-2 text-sm font-semibold transition-colors border',
              filter === f ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border'
            )}
          >
            {f === 'active' ? 'En cours' : 'Terminées'}
          </button>
        ))}
      </div>

      <div className="px-4 pb-6 space-y-3">
        {loading ? (
          [1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <img src={IconNavire} alt="" className="h-12 w-12 mx-auto opacity-40 mb-3" />
            <p className="font-semibold text-muted-foreground">
              {filter === 'active' ? 'Aucune expédition en cours' : 'Aucune expédition terminée'}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {filter === 'active' ? 'Vos commandes payées apparaîtront ici' : 'Les livraisons complètes apparaîtront ici'}
            </p>
          </div>
        ) : (
          filtered.map(s => <ShipmentCard key={`${s.shipment_id}-${s.order_id}`} shipment={s} />)
        )}
      </div>
    </div>
  )
}
