import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import type { Lookups, Playbook, Tag } from './types'

/** Run an async fetch, exposing data/loading/error plus a manual reload. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const alive = useRef(true)
  const fnRef = useRef(fn)
  fnRef.current = fn

  const run = useCallback(() => {
    setLoading(true)
    fnRef
      .current()
      .then((d) => {
        if (alive.current) {
          setData(d)
          setError(null)
        }
      })
      .catch((e) => alive.current && setError(e))
      .finally(() => alive.current && setLoading(false))
  }, [])

  useEffect(() => {
    alive.current = true
    run()
    return () => {
      alive.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, error, loading, reload: run, setData }
}

/**
 * Dropdown lists, playbooks and mistake tags. Loaded together because every
 * form needs all three, and they change rarely.
 */
export function useReference() {
  const [lookups, setLookups] = useState<Lookups>({})
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const [l, p, t] = await Promise.all([api.lookups.grouped(), api.playbooks.list(), api.tags.list('mistake')])
    setLookups(l)
    setPlaybooks(p)
    setTags(t)
    setLoading(false)
  }, [])

  useEffect(() => {
    reload().catch(() => setLoading(false))
  }, [reload])

  const values = useCallback(
    (kind: keyof Lookups) => (lookups[kind] ?? []).filter((x) => x.is_active).map((x) => x.value),
    [lookups],
  )

  return { lookups, playbooks, tags, loading, reload, values, setTags }
}

/** Debounce any fast-changing value (search boxes, filter inputs). */
export function useDebounced<T>(value: T, ms = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return debounced
}

/** Persisted UI preference that degrades gracefully when storage is blocked. */
export function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* ignore */
    }
  }, [key, value])
  return [value, setValue] as const
}
