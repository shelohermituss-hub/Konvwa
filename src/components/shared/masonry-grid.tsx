import type { ReactNode } from 'react'

/**
 * Two staggered columns. Items go to a column by their position (even → left, odd → right), so loading more items only
 * appends to the bottom of each column: what is already on screen never moves (CSS `columns` re-flows everything).
 */
export function MasonryGrid<T>({ items, getKey, render }: { items: T[]; getKey: (item: T) => string; render: (item: T) => ReactNode }) {
  const columns: T[][] = [[], []]
  items.forEach((item, i) => columns[i % 2].push(item))
  return (
    <div className="flex items-start gap-3">
      {columns.map((col, c) => (
        <div key={c} className="min-w-0 flex-1">
          {col.map((item) => <div key={getKey(item)}>{render(item)}</div>)}
        </div>
      ))}
    </div>
  )
}
