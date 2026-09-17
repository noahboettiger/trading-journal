import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from './api'
import type { Journal } from './types'

interface JournalContextValue {
  journals: Journal[]
  journal: Journal | null
  journalId: number | null
  setJournalId: (id: number) => void
  reload: () => Promise<void>
  loading: boolean
}

const JournalContext = createContext<JournalContextValue | null>(null)

const STORAGE_KEY = 'tj-active-journal'

const readStored = (): number | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? Number(raw) : null
  } catch {
    return null
  }
}

/**
 * Which journal is being looked at. Every list, dashboard and analytic is
 * scoped to it, so a 45-day cash-secured put never lands in a day-trading win
 * rate. The choice persists across restarts.
 */
export function JournalProvider({ children }: { children: ReactNode }) {
  const [journals, setJournals] = useState<Journal[]>([])
  const [journalId, setActiveId] = useState<number | null>(readStored)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const list = await api.journals.list()
    setJournals(list)
    setActiveId((current) => {
      // Fall back to the first journal if the stored one was deleted.
      if (current !== null && list.some((j) => j.id === current)) return current
      return list[0]?.id ?? null
    })
    setLoading(false)
  }, [])

  useEffect(() => {
    reload().catch(() => setLoading(false))
  }, [reload])

  const setJournalId = useCallback((id: number) => {
    setActiveId(id)
    try {
      localStorage.setItem(STORAGE_KEY, String(id))
    } catch {
      /* storage blocked; the choice just will not persist */
    }
  }, [])

  const value = useMemo<JournalContextValue>(
    () => ({
      journals,
      journal: journals.find((j) => j.id === journalId) ?? null,
      journalId,
      setJournalId,
      reload,
      loading,
    }),
    [journals, journalId, setJournalId, reload, loading],
  )

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>
}

export function useJournal() {
  const ctx = useContext(JournalContext)
  if (!ctx) throw new Error('useJournal must be used inside JournalProvider')
  return ctx
}

/** True for journals whose results are judged on premium and collateral. */
export const isPremiumSelling = (journal: Journal | null) => journal?.kind === 'options_csp'
