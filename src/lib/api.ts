import type { AppSettings, Journal, Lookup, Lookups, Playbook, Stats, Tag, Trade } from './types'

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body instanceof FormData ? init?.headers : { 'content-type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    const msg = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(msg.error || `Request failed (${res.status})`)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

const qs = (params: Record<string, unknown>) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '' && v !== 'all') p.set(k, String(v))
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

export type TradeFilters = Record<string, unknown>

export const api = {
  trades: {
    list: (f: TradeFilters = {}) => req<Trade[]>(`/api/trades${qs(f)}`),
    get: (id: number) => req<Trade>(`/api/trades/${id}`),
    create: (body: unknown) => req<Trade>('/api/trades', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: unknown) => req<Trade>(`/api/trades/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id: number) => req<void>(`/api/trades/${id}`, { method: 'DELETE' }),
    nextNumber: () => req<{ trade_no: number }>('/api/trades/next-number'),
    facets: () => req<Record<string, string[]>>('/api/trades/meta/facets'),
  },
  journals: {
    list: () => req<Journal[]>('/api/journals'),
    create: (body: unknown) => req<Journal>('/api/journals', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: unknown) => req<Journal>(`/api/journals/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id: number) => req<void>(`/api/journals/${id}`, { method: 'DELETE' }),
    reorder: (ids: number[]) => req<Journal[]>('/api/journals/reorder', { method: 'PUT', body: JSON.stringify({ ids }) }),
  },
  lookups: {
    grouped: () => req<Lookups>('/api/lookups?grouped=true'),
    list: (kind?: string) => req<Lookup[]>(`/api/lookups${qs({ kind })}`),
    create: (body: unknown) => req<Lookup>('/api/lookups', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: unknown) => req<Lookup>(`/api/lookups/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id: number) => req<void>(`/api/lookups/${id}`, { method: 'DELETE' }),
    reorder: (kind: string, ids: number[]) =>
      req<Lookup[]>('/api/lookups/reorder', { method: 'PUT', body: JSON.stringify({ kind, ids }) }),
  },
  playbooks: {
    list: () => req<Playbook[]>('/api/playbooks'),
    create: (body: unknown) => req<Playbook>('/api/playbooks', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: unknown) => req<Playbook>(`/api/playbooks/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id: number) => req<void>(`/api/playbooks/${id}`, { method: 'DELETE' }),
    saveRules: (id: number, rules: unknown[]) =>
      req<Playbook>(`/api/playbooks/${id}/rules`, { method: 'PUT', body: JSON.stringify({ rules }) }),
  },
  tags: {
    list: (kind?: string) => req<Tag[]>(`/api/tags${qs({ kind })}`),
    create: (name: string, kind = 'mistake') => req<Tag>('/api/tags', { method: 'POST', body: JSON.stringify({ name, kind }) }),
  },
  settings: {
    get: () => req<AppSettings>('/api/settings'),
    save: (patch: Partial<AppSettings>) =>
      req<AppSettings>('/api/settings', { method: 'PUT', body: JSON.stringify(patch) }),
  },
  stats: (f: TradeFilters = {}) => req<Stats>(`/api/stats${qs(f)}`),
  journalList: (f: TradeFilters = {}) => req<any[]>(`/api/journal${qs(f)}`),
  journalSave: (body: unknown) => req<any>('/api/journal', { method: 'PUT', body: JSON.stringify(body) }),
  journalDelete: (id: number) => req<void>(`/api/journal/${id}`, { method: 'DELETE' }),
  upload: async (files: File[]) => {
    const fd = new FormData()
    files.forEach((f) => fd.append('files', f))
    return req<{ path: string; size: number }[]>('/api/uploads', { method: 'POST', body: fd })
  },
  backupUrl: '/api/backup',
  snapshot: () => req<{ file: string; size: number; skipped: boolean }>('/api/backup/snapshot', { method: 'POST' }),
  restore: (payload: unknown) =>
    req<{ restored: Record<string, number> }>('/api/backup/restore', { method: 'POST', body: JSON.stringify(payload) }),
}
