import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, ImageOff, Info, Loader2, Package, Pencil, ScanSearch, Square, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { probeImages } from '@/lib/image-probe'
import { SAFE_FIXES, analyzeCatalogue, isImageUrl, type Fix, type HealthProduct, type HealthVariant, type Issue, type IssueCode, type Severity } from '@/lib/product-health'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { tr } from '@/lib/i18n'

type Row = HealthProduct & { images: string[] }

const MESSAGE: Record<IssueCode, (p: Array<string | number>) => string> = {
  no_image: () => tr('Produit visible sans aucune photo utilisable.'),
  bad_image_url: (p) => tr('{0} lien(s) de photo inutilisable(s) ou en double.', p[0]),
  broken_image: (p) => tr('{0} photo(s) sur {1} ne s\'ouvrent pas (lien cassé).', p[0], p[1]),
  variant_broken_image: (p) => tr('{0} variante(s) avec une photo qui ne s\'ouvre pas.', p[0]),
  variant_same_image: (p) => tr('{0} variante(s) réutilisent la photo d\'une autre variante : la photo ne correspond sûrement pas.', p[0]),
  variant_foreign_image: (p) => tr('{0} variante(s) ont une photo qui ne vient pas du même site que celles du produit : lien probablement erroné.', p[0]),
  no_price: () => tr('Prix à zéro ou manquant.'),
  variant_no_price: (p) => tr('{0} variante(s) sans prix.', p[0]),
  duplicate: (p) => tr('Doublon de « {0} ».', p[0]),
  no_category: (p) => (p[0] ? tr('Pas de catégorie. Proposition : {0}.', p[0]) : tr('Pas de catégorie.')),
  no_description: () => tr('Pas de description.'),
  tiers: (p) => tr('{0} palier(s) de prix incorrect(s) (quantité sous le minimum, prix supérieur au prix de base ou illisible).', p[0]),
  no_weight: () => tr('Ni poids ni dimensions : l\'estimation d\'expédition sera approximative.'),
}
const FIX_TEXT: Record<Fix['kind'], () => string> = {
  deactivate: () => tr('Masquer le produit'), set_images: () => tr('Nettoyer les photos'), clear_variant_images: () => tr('Retirer ces photos de variantes'),
  set_category: () => tr('Appliquer la catégorie'), set_tiers: () => tr('Corriger les paliers'),
}

const CODE_LABEL: Record<IssueCode, () => string> = {
  no_image: () => tr('Sans photo'), bad_image_url: () => tr('Liens de photos inutilisables'), broken_image: () => tr('Photos cassées'), variant_broken_image: () => tr('Photos de variantes cassées'),
  variant_same_image: () => tr('Variantes avec la même photo'), variant_foreign_image: () => tr('Photos de variantes d\'un autre site'), no_price: () => tr('Prix manquant'),
  variant_no_price: () => tr('Variantes sans prix'), duplicate: () => tr('Doublons'), no_category: () => tr('Sans catégorie'), no_description: () => tr('Sans description'),
  tiers: () => tr('Paliers de prix incorrects'), no_weight: () => tr('Sans poids ni dimensions'),
}

const SEV: Record<Severity, { label: () => string; cls: string; Icon: typeof AlertTriangle }> = {
  error: { label: () => tr('Erreurs'), cls: 'text-red-700 bg-red-50 border-red-100', Icon: AlertTriangle },
  warning: { label: () => tr('À vérifier'), cls: 'text-amber-800 bg-amber-50 border-amber-100', Icon: AlertTriangle },
  info: { label: () => tr('Infos'), cls: 'text-sky-800 bg-sky-50 border-sky-100', Icon: Info },
}

async function fetchVariants(): Promise<HealthVariant[]> {
  const out: HealthVariant[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('product_variants').select('id, product_id, label, group_name, image, price_htg').eq('active', true).order('id').range(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...((data ?? []) as HealthVariant[]))
    if ((data ?? []).length < 1000) return out
  }
}

interface Props {
  products: Row[]
  /** Called after fixes were applied, so that the catalogue is reloaded. */
  onChanged: () => void
  onEdit: (id: string) => void
}

/**
 * Admin: the quality check of the catalogue. It lists what is wrong or incomplete (pictures that do not open, variants with a picture that cannot match,
 * duplicates, missing prices…) from the data already loaded, can also test that every picture really opens, and repairs each issue in one click.
 */
export function ProductHealth({ products, onChanged, onEdit }: Props) {
  const [variants, setVariants] = useState<HealthVariant[] | null>(null)
  const [broken, setBroken] = useState<Set<string>>(new Set())
  const [probe, setProbe] = useState<{ done: number; total: number; broken: number } | null>(null)
  const [probed, setProbed] = useState(false)
  const [onlyActive, setOnlyActive] = useState(true)
  const [sev, setSev] = useState<Severity | 'all'>('all')
  const [code, setCode] = useState<IssueCode | 'all'>('all')
  const [busy, setBusy] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<Issue[] | null>(null)
  const [limit, setLimit] = useState(30)
  const abort = useRef<AbortController | null>(null)

  const loadVariants = useCallback(async () => {
    try { setVariants(await fetchVariants()) } catch (e) { toast.error(e instanceof Error ? e.message : tr('Erreur réseau')); setVariants((v) => v ?? []) }
  }, [])
  useEffect(() => { void loadVariants() }, [loadVariants])
  useEffect(() => () => abort.current?.abort(), [])

  const issues = useMemo(() => (variants ? analyzeCatalogue(products, variants, { broken }) : []), [products, variants, broken])
  const filtered = useMemo(() => issues.filter((i) => (sev === 'all' || i.severity === sev) && (code === 'all' || i.code === code)), [issues, sev, code])
  const counts = useMemo(() => {
    const c: Record<Severity, number> = { error: 0, warning: 0, info: 0 }
    for (const i of issues) c[i.severity]++
    return c
  }, [issues])
  const flagged = useMemo(() => new Set(issues.filter((i) => i.severity !== 'info').map((i) => i.productId)).size, [issues])
  const byProduct = useMemo(() => {
    const m = new Map<string, Issue[]>()
    for (const i of filtered) m.set(i.productId, [...(m.get(i.productId) ?? []), i])
    return [...m.entries()]
  }, [filtered])
  const safe = useMemo(() => issues.filter((i) => i.fix && SAFE_FIXES.has(i.code)), [issues])
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const codesPresent = useMemo(() => [...new Set(issues.map((i) => i.code))], [issues])

  async function startProbe() {
    const scope = products.filter((p) => !onlyActive || p.active)
    const urls = new Set<string>()
    for (const p of scope) for (const u of p.images) if (isImageUrl(u)) urls.add(u.trim())
    for (const v of variants ?? []) if (isImageUrl(v.image) && (!onlyActive || productById.get(v.product_id)?.active)) urls.add(v.image.trim())
    const list = [...urls]
    if (list.length === 0) { toast.info(tr('Aucune photo à vérifier.')); return }
    abort.current = new AbortController()
    setProbe({ done: 0, total: list.length, broken: 0 })
    const found = await probeImages(list, (done, bad) => setProbe({ done, total: list.length, broken: bad }), abort.current.signal)
    const stopped = abort.current.signal.aborted
    setBroken((cur) => new Set([...cur, ...found]))
    setProbed(true)
    setProbe(null)
    toast[found.size > 0 ? 'warning' : 'success'](
      stopped ? tr('Vérification arrêtée : {0} photo(s) cassée(s) trouvée(s).', found.size) : found.size > 0 ? tr('{0} photo(s) ne s\'ouvrent pas.', found.size) : tr('Toutes les photos s\'ouvrent.'),
    )
  }

  /** Applies the fixes of some issues (one write per product and kind). */
  async function apply(list: Issue[], id: string) {
    setBusy(id)
    let done = 0; let failed = ''
    try {
      for (const i of list) {
        const fix = i.fix
        if (!fix) continue
        const { error } = await applyFix(i.productId, fix)
        if (error) { failed = error; break }
        done++
      }
    } finally {
      setBusy(null)
    }
    if (failed) toast.error(failed)
    if (done > 0) {
      toast.success(done === 1 ? tr('Correction appliquée.') : tr('{0} corrections appliquées.', done))
      // the pictures that were removed are no longer broken: the list is recomputed from the reloaded catalogue
      await loadVariants()
      onChanged()
    }
  }

  const rank = (s: Severity) => ['error', 'warning', 'info'].indexOf(s)

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-muted-foreground">
        {tr('Le site passe le catalogue en revue : photos manquantes ou cassées, variantes dont la photo ne correspond pas, doublons, prix absents… Chaque problème vient avec une correction en un clic.')}
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        {(['error', 'warning', 'info'] as const).map((s) => {
          const { Icon, cls, label } = SEV[s]
          return (
            <button
              key={s} type="button" onClick={() => setSev(sev === s ? 'all' : s)} aria-pressed={sev === s}
              className={cn('flex items-center gap-3 rounded-2xl border p-4 text-left transition-shadow', cls, sev === s && 'ring-2 ring-primary/40')}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              <span><span className="block text-2xl font-bold tabular-nums">{variants ? counts[s] : '…'}</span><span className="text-sm font-medium">{label()}</span></span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3">
        {probe ? (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Progress value={(probe.done / probe.total) * 100} className="h-2 max-w-xs flex-1" aria-label={tr('Vérification des photos')} />
            <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">{tr('{0} / {1} photos · {2} cassée(s)', probe.done, probe.total, probe.broken)}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => abort.current?.abort()} className="gap-1.5 rounded-xl"><Square className="h-3.5 w-3.5" />{tr('Arrêter')}</Button>
          </div>
        ) : (
          <>
            <Button type="button" onClick={() => void startProbe()} disabled={variants === null} className="gap-2 rounded-xl"><ScanSearch className="h-4 w-4" />{probed ? tr('Revérifier les photos') : tr('Vérifier que les photos s\'ouvrent')}</Button>
            <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" className="h-4 w-4 rounded" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />{tr('Produits visibles seulement')}</label>
          </>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <NativeSelect value={code} onChange={(e) => { setCode(e.target.value as IssueCode | 'all'); setLimit(30) }} size="sm" aria-label={tr('Type de problème')}>
            <NativeSelectOption value="all">{tr('Tous les problèmes')}</NativeSelectOption>
            {codesPresent.map((c) => <NativeSelectOption key={c} value={c}>{CODE_LABEL[c]()}</NativeSelectOption>)}
          </NativeSelect>
          <Button type="button" variant="outline" disabled={safe.length === 0 || busy !== null} onClick={() => setConfirm(safe)} className="gap-1.5 rounded-xl">
            <Wrench className="h-4 w-4" />{tr('Corriger les cas sûrs ({0})', safe.length)}
          </Button>
        </div>
      </div>
      {!probed && variants && <p className="-mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><ImageOff className="h-3.5 w-3.5" />{tr('Les liens de photos cassés ne se voient que si on les ouvre : lancez la vérification pour les trouver.')}</p>}

      {variants === null ? (
        <div className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{tr('Analyse du catalogue…')}</div>
      ) : byProduct.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-200 bg-white py-14 text-center">
          <CheckCircle2 className="h-9 w-9 text-emerald-500" />
          <p className="text-sm font-medium">{issues.length === 0 ? tr('Aucun problème trouvé dans le catalogue.') : tr('Aucun problème dans cette liste.')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{tr('{0} produit(s) à regarder sur {1}.', flagged, products.length)}</p>
          <ul className="space-y-3">
            {byProduct.slice(0, limit).map(([pid, list]) => {
              const p = productById.get(pid)
              if (!p) return null
              return (
                <li key={pid} className="rounded-2xl border border-gray-100 bg-white p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
                      {p.images[0] && !broken.has(p.images[0]) ? <img src={p.images[0]} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Package className="h-5 w-5 text-muted-foreground/30" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-semibold">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.active ? tr('Visible') : tr('Masqué')}</p>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={() => onEdit(pid)} className="gap-1.5 rounded-xl"><Pencil className="h-3.5 w-3.5" />{tr('Modifier')}</Button>
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {[...list].sort((a, b) => rank(a.severity) - rank(b.severity)).map((i) => (
                      <li key={i.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-gray-50/70 px-3 py-2">
                        <Badge variant="secondary" className={cn('shrink-0 text-[10px]', i.severity === 'error' ? 'bg-red-100 text-red-800' : i.severity === 'warning' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800')}>
                          {i.severity === 'error' ? tr('Erreur') : i.severity === 'warning' ? tr('À vérifier') : tr('Info')}
                        </Badge>
                        <span className="min-w-0 flex-1 text-sm">{MESSAGE[i.code](i.params)}</span>
                        {i.fix && (
                          <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void apply([i], i.id)} className="gap-1.5 rounded-xl">
                            {busy === i.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}{FIX_TEXT[i.fix.kind]()}
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              )
            })}
          </ul>
          {byProduct.length > limit && <div className="text-center"><Button type="button" variant="outline" onClick={() => setLimit(limit + 30)} className="rounded-xl">{tr('Afficher plus ({0} restants)', byProduct.length - limit)}</Button></div>}
        </div>
      )}

      <AlertDialog open={confirm !== null} onOpenChange={(o) => { if (!o) setConfirm(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr('Corriger {0} problèmes ?', confirm?.length ?? 0)}</AlertDialogTitle>
            <AlertDialogDescription>
              {tr('Seuls les cas certains sont corrigés : liens de photos inutilisables ou cassés retirés, paliers de prix incorrects supprimés, produits sans aucune photo masqués. Les produits masqués restent dans le catalogue.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr('Annuler')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const l = confirm ?? []; setConfirm(null); void apply(l, 'all') }}>{tr('Corriger')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/** One repair, written with the staff's own rights (the tables' policies decide what is allowed). */
async function applyFix(productId: string, fix: Fix): Promise<{ error: string | null }> {
  switch (fix.kind) {
    case 'deactivate': { const { error } = await supabase.from('products').update({ active: false }).eq('id', productId); return { error: error?.message ?? null } }
    case 'set_images': { const { error } = await supabase.from('products').update({ images: fix.images }).eq('id', productId); return { error: error?.message ?? null } }
    case 'set_category': { const { error } = await supabase.from('products').update({ category: fix.category }).eq('id', productId); return { error: error?.message ?? null } }
    case 'set_tiers': { const { error } = await supabase.from('products').update({ price_tiers: fix.tiers }).eq('id', productId); return { error: error?.message ?? null } }
    case 'clear_variant_images': { const { error } = await supabase.from('product_variants').update({ image: null }).in('id', fix.variantIds).eq('product_id', productId); return { error: error?.message ?? null } }
  }
}
