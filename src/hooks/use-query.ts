import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export function useQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: unknown }>,
  deps: unknown[] = []
) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)

  const execute = useCallback(() => {
    let mounted = true
    setLoading(true)

    queryFn()
      .then((result) => {
        if (!mounted) return
        if (result.error) {
          setError(result.error instanceof Error ? result.error : new Error(String(result.error)))
        } else {
          setData(result.data)
        }
      })
      .then(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryFn, ...deps])

  useEffect(() => {
    const cleanup = execute()
    return cleanup
  }, [execute])

  return { data, error, loading }
}

export function useSupabaseQuery<T>(
  table: string,
  columns: string = '*',
  filter?: { column: string; value: unknown }
) {
  const [data, setData] = useState<T[]>([])
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)

    let query = supabase.from(table).select(columns)
    if (filter) {
      query = query.eq(filter.column, filter.value)
    }

    query
      .then((result) => {
        if (!mounted) return
        if (result.error) {
          setError(new Error(result.error.message))
        } else {
          setData(result.data as T[])
        }
      })
      .then(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, columns, filter?.column, filter?.value])

  return { data, error, loading, refetch: () => setLoading(true) }
}
