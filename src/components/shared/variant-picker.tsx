import { useEffect, useState } from 'react'
import { choose, optionsAt, partsOf, resolve, type DimVariant, type Dimensions } from '@/lib/variant-dimensions'
import { cn } from '@/lib/utils'
import { tr } from '@/lib/i18n'

interface Props<T extends DimVariant> {
  dims: Dimensions<T>
  chosenId: string | null
  /** A complete choice was made: the variant to use. */
  onPick: (v: T) => void
  /** A choice that is not complete yet shows its picture (the colour is chosen before the size). */
  onPreview: (image: string) => void
  /** The price shown on the last choice when the prices of its values differ. */
  priceOf: (v: T) => string
}

/**
 * The variants of a product chosen one dimension after the other: the first one (the colour) always, each next one (the size) once the previous is chosen,
 * with only the values that exist after what was chosen. Out-of-stock values stay visible but cannot be picked.
 */
export function VariantPicker<T extends DimVariant>({ dims, chosenId, onPick, onPreview, priceOf }: Props<T>) {
  const [sel, setSel] = useState<string[]>(() => partsOf(dims, chosenId))
  // a variant chosen elsewhere (a card of the feed, the gallery) is reflected here
  useEffect(() => {
    if (chosenId && resolve(dims, sel)?.id !== chosenId) setSel(partsOf(dims, chosenId))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosenId, dims])

  function pick(i: number, value: string, image: string | null) {
    const next = choose(dims, sel, i, value)
    setSel(next)
    const v = resolve(dims, next)
    if (v) onPick(v)
    else if (image) onPreview(image)
  }

  const shown = dims.names.filter((_, i) => i === 0 || sel.length >= i)
  const missing = dims.names[sel.length] ?? null

  return (
    <div className="space-y-3">
      {shown.map((name, i) => {
        const options = optionsAt(dims, sel, i)
        const last = i === dims.names.length - 1
        const prices = last ? new Set(options.map((o) => priceOf(o.variant))) : new Set<string>()
        return (
          <div key={name}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {name}
              {sel[i] && <span className="ml-1.5 normal-case text-foreground">· {sel[i]}</span>}
            </p>
            <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2">
              {options.map((o) => {
                const on = sel[i] === o.value
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={!o.available}
                    onClick={() => pick(i, o.value, o.image)}
                    className={cn(
                      'flex min-h-11 items-center gap-2 rounded-xl border-2 px-3 py-1.5 text-left text-sm transition-colors active:scale-[0.98]',
                      on ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white hover:border-gray-300',
                      !o.available && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    {o.image && !last && <img src={o.image} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-lg object-cover" />}
                    <span className="min-w-0">
                      <span className={cn('block max-w-[11rem] truncate font-semibold', !o.available && 'line-through')}>{o.value}</span>
                      {last && (!o.available
                        ? <span className="block text-xs text-muted-foreground">{tr('Rupture de stock')}</span>
                        : prices.size > 1 && <span className="block text-xs tabular-nums text-muted-foreground">{priceOf(o.variant)}</span>)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
      {missing && <p className="text-sm text-muted-foreground">{tr('Choisissez : {0}', missing.toLowerCase())}</p>}
    </div>
  )
}
