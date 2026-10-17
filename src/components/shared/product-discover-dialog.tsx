import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, ExternalLink, Flame, Loader2, Search, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from '@/components/ui/native-select'
import { Progress } from '@/components/ui/progress'
import { supabase } from '@/lib/supabase'
import { discoverAmazonProducts, type DiscoveredProduct } from '@/lib/product-import-api'
import { importAndSave, loadImportRates, runPool } from '@/lib/bulk-import'
import { tr } from '@/lib/i18n'

const SOURCES: Array<[string, string]> = [['movers', 'Amazon : tendances du moment'], ['bestsellers', 'Amazon : meilleures ventes'], ['new', 'Amazon : nouveautés populaires'], ['amazon_search', 'Amazon : catégorie précise (les mieux notés)'], ['alibaba', 'Alibaba : catégorie précise'], ['muscle_strength', 'Muscle & Strength : classements'], ['neewer', 'Neewer : produits tendance']]
/** Ranking lists of the two shops that have their own (same lists as the `product-discover` function; '' = the first one). */
const SHOP_LISTS: Record<string, Array<[string, string]>> = {
  muscle_strength: [['', 'Top 50 des ventes'], ['best-protein-supplements', 'Protéines'], ['best-pre-workouts', 'Pré-workout'], ['best-creatine', 'Créatine'], ['best-bcaas', 'BCAA'], ['best-weight-gainers', 'Prise de masse'], ['best-protein-bars', 'Barres protéinées'], ['best-womens', 'Pour les femmes'], ['best-fat-burners', 'Brûleurs de graisse'], ['best-multivitamins', 'Multivitamines'], ['goals/build-muscle', 'Prise de muscle'], ['goals/improve-sports', 'Performance sportive'], ['category/clearance.html', 'Déstockage']],
  neewer: [['', 'Top ventes du jour'], ['best-selling', 'Meilleures ventes'], ['top-50-products', 'Top produits'], ['hot-sale-1', 'Promos du moment'], ['new-releases', 'Nouveautés'], ['featured-products', 'Produits vedettes'], ['ring-lights', 'Ring lights'], ['all-lights', 'Tous les éclairages'], ['2-pack-bundles', 'Packs de 2'], ['50-off-selected-products', 'Promos -50 %'], ['topic-microphones', 'Microphones'], ['topic-tripods', 'Trépieds et stabilisateurs'], ['topic-softboxes', 'Softbox et parapluies'], ['topic-led-lights', 'Lumières LED vidéo'], ['topic-backdrops', 'Fonds et arrière-plans'], ['topic-flash', 'Flashs et déclencheurs'], ['topic-batteries', 'Batteries et chargeurs'], ['topic-cages', 'Cages et supports caméra'], ['topic-phone', 'Accessoires téléphone'], ['topic-bags', 'Sacs et étuis'], ['topic-monitors', 'Moniteurs de terrain']],
}
const DEPARTMENTS: Array<[string, string]> = [
  ['', 'Tous les rayons'], ['electronics', 'Électronique'], ['beauty', 'Beauté'], ['hpc', 'Santé et soins personnels'], ['home-garden', 'Maison et jardin'],
  ['kitchen', 'Cuisine'], ['sporting-goods', 'Sports et plein air'], ['toys-and-games', 'Jouets et jeux'], ['fashion', 'Mode'], ['automotive', 'Auto et moto'],
  ['pet-supplies', 'Animaux'], ['baby-products', 'Bébé'], ['office-products', 'Bureau'], ['hi', 'Bricolage et outils'], ['videogames', 'Jeux vidéo'],
  ['arts-crafts', 'Loisirs créatifs'], ['musical-instruments', 'Instruments de musique'], ['wireless', 'Téléphones et accessoires'], ['pc', 'Ordinateurs et accessoires'],
  ['photo', 'Photo et caméras'], ['appliances', 'Électroménager'], ['lawn-garden', 'Jardin et extérieur'], ['jewelry', 'Bijoux'], ['watches', 'Montres'], ['shoes', 'Chaussures'],
  ['luggage', 'Bagagerie'], ['industrial', 'Industrie et sciences'],
]
/** Precise categories (same list as the `product-discover` function): search terms, grouped for the picker. */
const TOPIC_GROUPS: Array<[string, Array<[string, string]>]> = [
  ["Téléphones et accessoires", [["smartphone unlocked", "Smartphones"], ["iphone case", "Coques de téléphone"], ["phone charger fast charging", "Chargeurs de téléphone"], ["phone screen protector", "Protections d'écran"], ["power bank", "Batteries externes"], ["car phone mount", "Supports téléphone auto"], ["selfie stick tripod", "Perches et trépieds"]]],
  ["Ordinateurs et tablettes", [["laptop", "Laptops"], ["gaming laptop", "Laptops gaming"], ["chromebook", "Chromebooks"], ["tablet", "Tablettes"], ["kids tablet", "Tablettes enfants"], ["monitor", "Écrans d'ordinateur"], ["computer keyboard", "Claviers"], ["computer mouse", "Souris"], ["laptop backpack", "Sacs pour laptop"], ["external hard drive ssd", "Disques durs et SSD"], ["usb flash drive", "Clés USB"], ["webcam", "Webcams"], ["wifi router", "Routeurs Wi-Fi"], ["printer", "Imprimantes"]]],
  ["Audio et vidéo", [["wireless earbuds", "Écouteurs sans fil"], ["headphones", "Casques audio"], ["bluetooth speaker", "Haut-parleurs Bluetooth"], ["smart watch", "Montres connectées"], ["microphone", "Microphones"], ["smart tv", "Télévisions"], ["projector", "Projecteurs"], ["tv stick streaming", "Clés streaming TV"]]],
  ["Photo, drones et sécurité", [["security camera", "Caméras de surveillance"], ["action camera", "Caméras sport"], ["drone", "Drones"], ["ring light", "Ring lights"], ["doorbell camera", "Sonnettes connectées"]]],
  ["Jeux vidéo", [["gaming console", "Consoles de jeu"], ["game controller", "Manettes"], ["gaming headset", "Casques gaming"], ["gaming chair", "Chaises gaming"]]],
  ["Maison et cuisine", [["air fryer", "Friteuses à air"], ["blender", "Blenders"], ["coffee maker", "Cafetières"], ["electric kettle", "Bouilloires"], ["rice cooker", "Cuiseurs à riz"], ["vacuum cleaner", "Aspirateurs"], ["robot vacuum", "Aspirateurs robots"], ["fan", "Ventilateurs"], ["led strip lights", "Rubans LED"], ["solar light", "Lampes solaires"], ["portable generator", "Générateurs portables"], ["storage organizer", "Rangements"], ["bedding set", "Linge de lit"], ["water bottle", "Gourdes"]]],
  ["Beauté et soins", [["hair dryer", "Sèche-cheveux"], ["hair straightener", "Lisseurs"], ["electric shaver", "Rasoirs électriques"], ["beard trimmer", "Tondeuses barbe"], ["makeup brush set", "Pinceaux maquillage"], ["skincare serum", "Sérums visage"], ["perfume", "Parfums"], ["nail kit", "Manucure"]]],
  ["Mode et accessoires", [["women sneakers", "Baskets femme"], ["men sneakers", "Baskets homme"], ["backpack", "Sacs à dos"], ["handbag", "Sacs à main"], ["sunglasses", "Lunettes de soleil"], ["men watch", "Montres homme"], ["women jewelry", "Bijoux femme"]]],
  ["Bébé, animaux, sport", [["baby stroller", "Poussettes"], ["baby monitor", "Babyphones"], ["dog bed", "Lits pour chien"], ["cat litter box", "Litières"], ["yoga mat", "Tapis de yoga"], ["dumbbell set", "Haltères"], ["bicycle", "Vélos"]]],
  ["Auto, outils, jouets", [["car vacuum", "Aspirateurs auto"], ["dash cam", "Dashcams"], ["tool set", "Caisses à outils"], ["cordless drill", "Perceuses"], ["lego", "Jouets de construction"], ["rc car", "Voitures télécommandées"]]],
]
/** Products read at the same time: each one takes about half a minute (page, translation, pictures). */
const PARALLEL = 3

type Status = { state: 'wait' } | { state: 'run' } | { state: 'ok'; id: string; name: string } | { state: 'fail'; error: string }

function Thumb({ src, small }: { src: string | null; small?: boolean }) {
  const [bad, setBad] = useState(false)
  const size = small ? 'h-9 w-9' : 'h-16 w-16'
  if (!src || bad) return <div className={`${size} shrink-0 rounded-lg bg-gray-100`} aria-hidden />
  return <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} className={`${size} shrink-0 rounded-lg border border-gray-100 bg-white object-contain`} />
}

/**
 * Admin: finds 20 trending / well-rated products by itself (Amazon's public rankings, Alibaba, Muscle & Strength's and Neewer's best sellers), then imports them all at once as hidden drafts
 * (same reading, translation and pricing as the single-link import). Nothing is shown to customers until the team publishes them.
 */
export function ProductDiscoverDialog({ open, collection, onClose, onDone }: { open: boolean; collection?: string | null; onClose: () => void; onDone: () => void }) {
  const [source, setSource] = useState('movers')
  const [department, setDepartment] = useState('')
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [found, setFound] = useState<DiscoveredProduct[] | null>(null)
  const [skipped, setSkipped] = useState(0)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [status, setStatus] = useState<Record<string, Status>>({})
  const [publishing, setPublishing] = useState(false)
  const stop = useRef(false)

  useEffect(() => {
    if (!open) return
    setFound(null); setError(''); setStatus({}); setImporting(false); setSearching(false); setPicked(new Set()); stop.current = false
    // opened with a Neewer collection link pasted in the link import: its products are listed right away
    if (collection) { setSource('neewer'); setDepartment(collection); void search('neewer', collection) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, collection])

  const chosen = (found ?? []).filter((c) => picked.has(c.asin))
  const results = Object.entries(status)
  const done = results.filter(([, s]) => s.state === 'ok' || s.state === 'fail').length
  const saved = results.flatMap(([, s]) => (s.state === 'ok' ? [s.id] : []))
  const started = results.length > 0

  async function search(src = source, dep = department) {
    setSearching(true); setError(''); setFound(null); setStatus({})
    try {
      const r = await discoverAmazonProducts({ source: src, department: dep, count: 20 })
      setFound(r.candidates); setSkipped(r.skipped_existing)
      setPicked(new Set(r.candidates.map((c) => c.asin)))
      if (r.candidates.length === 0) setError(tr('Tous les produits trouvés sont déjà dans la boutique. Essayez un autre rayon.'))
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('Erreur réseau'))
    } finally {
      setSearching(false)
    }
  }

  async function importAll() {
    if (chosen.length === 0) return
    stop.current = false
    setImporting(true)
    setStatus(Object.fromEntries(chosen.map((c) => [c.asin, { state: 'wait' } as Status])))
    const set = (asin: string, s: Status) => setStatus((cur) => ({ ...cur, [asin]: s }))
    try {
      const rates = await loadImportRates()
      await runPool(chosen, PARALLEL, async (c) => {
        set(c.asin, { state: 'run' })
        try {
          const r = await importAndSave(c.url, rates)
          set(c.asin, { state: 'ok', ...r })
        } catch (e) {
          set(c.asin, { state: 'fail', error: e instanceof Error ? e.message : tr('Erreur inconnue') })
        }
      }, () => stop.current)
    } finally {
      setImporting(false)
      onDone()
    }
  }

  async function publish() {
    if (saved.length === 0) return
    setPublishing(true)
    const { error: err } = await supabase.from('products').update({ active: true }).in('id', saved)
    setPublishing(false)
    if (err) { toast.error(err.message); return }
    toast.success(tr('{0} produits publiés.', saved.length))
    onDone(); onClose()
  }

  const busy = searching || importing
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !importing) onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Flame className="h-5 w-5 text-primary" />{tr('Produits tendance')}</DialogTitle>
          <DialogDescription>{tr('Trouve jusqu\'à 20 produits populaires sur Amazon.com, Alibaba, Muscle & Strength ou Neewer, sans que vous fournissiez de lien, puis les importe d\'un coup (fiche, photos, variantes, avis, colis) en brouillons masqués. Vous relisez puis publiez.')}</DialogDescription>
        </DialogHeader>

        {!started && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void search() }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm font-semibold">
                {tr('Type de classement')}
                <NativeSelect value={source} onChange={(e) => { setSource(e.target.value); setDepartment('') }} disabled={busy} className="w-full">
                  {SOURCES.map(([v, l]) => <NativeSelectOption key={v} value={v}>{tr(l)}</NativeSelectOption>)}
                </NativeSelect>
              </label>
              <label className="space-y-1 text-sm font-semibold">
                {source === 'alibaba' || source === 'amazon_search' ? tr('Catégorie') : SHOP_LISTS[source] ? tr('Liste') : tr('Rayon')}
                <NativeSelect value={department} onChange={(e) => setDepartment(e.target.value)} disabled={busy} className="w-full">
                  {source === 'alibaba' || source === 'amazon_search'
                    ? <>
                        <NativeSelectOption value="">{tr('Produits populaires')}</NativeSelectOption>
                        {TOPIC_GROUPS.map(([g, items]) => (
                          <NativeSelectOptGroup key={g} label={tr(g)}>{items.map(([v, l]) => <NativeSelectOption key={v} value={v}>{tr(l)}</NativeSelectOption>)}</NativeSelectOptGroup>
                        ))}
                      </>
                    : <>
                        {(SHOP_LISTS[source] ?? DEPARTMENTS).map(([v, l]) => <NativeSelectOption key={v || 'all'} value={v}>{tr(l)}</NativeSelectOption>)}
                        {source === 'neewer' && department && !SHOP_LISTS.neewer.some(([v]) => v === department) && <NativeSelectOption value={department}>{tr('Collection : {0}', department)}</NativeSelectOption>}
                      </>}
                </NativeSelect>
              </label>
            </div>
            <Button type="submit" disabled={busy} className="gap-1.5 rounded-xl">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{tr('Chercher 20 produits')}
            </Button>
            {searching && <p className="text-sm text-muted-foreground" role="status">{tr('Lecture de la page (jusqu\'à deux minutes)…')}</p>}
          </form>
        )}

        {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}

        {found && found.length > 0 && !started && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {tr('{0} produits trouvés', found.length)}{skipped > 0 && ` · ${tr('{0} déjà dans la boutique (ignorés)', skipped)}`}. {tr('Décochez ceux dont vous ne voulez pas.')}
            </p>
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
              {found.map((c) => (
                <li key={c.asin} className="flex items-center gap-3 p-2.5">
                  <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 rounded" checked={picked.has(c.asin)} aria-label={c.title ?? c.asin}
                    onChange={(e) => setPicked((cur) => { const n = new Set(cur); if (e.target.checked) n.add(c.asin); else n.delete(c.asin); return n })} />
                  <Thumb src={c.image} />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="line-clamp-2 font-medium">{c.title ?? c.asin}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      #{c.rank}{c.rating != null && ` · ${String(c.rating).replace('.', ',')} ★`}{c.reviews != null && ` (${c.reviews.toLocaleString('fr-FR')})`}{c.price_usd != null && ` · $${c.price_usd.toFixed(2)}`}
                    </p>
                  </div>
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1 text-muted-foreground hover:text-foreground" aria-label={tr('Voir le produit')}><ExternalLink className="h-4 w-4" /></a>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button type="button" variant="outline" onClick={() => void search()} disabled={busy} className="rounded-xl">{tr('Nouvelle recherche')}</Button>
              <Button type="button" onClick={() => void importAll()} disabled={busy || chosen.length === 0} className="rounded-xl">{tr('Importer {0} produits', chosen.length)}</Button>
            </div>
          </div>
        )}

        {started && (
          <div className="space-y-3">
            <Progress value={(done / Math.max(1, results.length)) * 100} />
            <p className="text-sm text-muted-foreground" role="status">
              {importing ? tr('Import en cours : {0} sur {1}. Gardez cette fenêtre ouverte (environ une demi-minute par produit, 3 à la fois).', done, results.length) : tr('Import terminé : {0} réussis sur {1}.', saved.length, results.length)}
            </p>
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 text-sm">
              {(found ?? []).filter((c) => status[c.asin]).map((c) => {
                const s = status[c.asin]
                return (
                  <li key={c.asin} className="flex items-center gap-2 p-2.5">
                    {s.state === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : s.state === 'fail' ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                      : s.state === 'run' ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" /> : <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-gray-200" />}
                    <Thumb src={c.image} small />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1">{s.state === 'ok' ? s.name : c.title ?? c.asin}</p>
                      {s.state === 'fail' && <p className="text-xs text-destructive">{s.error}</p>}
                    </div>
                  </li>
                )
              })}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-2">
              {importing
                ? <Button type="button" variant="outline" onClick={() => { stop.current = true }} className="rounded-xl">{tr('Arrêter après les produits en cours')}</Button>
                : <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">{tr('Garder en brouillons')}</Button>}
              {!importing && saved.length > 0 && (
                <Button type="button" onClick={() => void publish()} disabled={publishing} className="gap-1.5 rounded-xl">
                  {publishing && <Loader2 className="h-4 w-4 animate-spin" />}{tr('Publier les {0} produits', saved.length)}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
