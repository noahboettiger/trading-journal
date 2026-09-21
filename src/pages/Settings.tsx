import { useEffect, useState } from 'react'
import { Plus, Trash2, GripVertical, Save, Download, Upload, AlertTriangle, DatabaseBackup, Book } from 'lucide-react'

import { api } from '@/lib/api'
import { useReference } from '@/lib/hooks'
import type { Playbook, Rule, LookupKind, Journal } from '@/lib/types'
import { useJournal } from '@/lib/journals'
import { PageHeader } from '@/components/Layout'
import { Card, CardHeader, Field, Input, Select, Spinner, ErrorNote, Badge, Segmented } from '@/components/ui'

// Hints say what the list is for rather than naming examples, which would go
// stale the moment the list is reordered or edited.
const LIST_KINDS: { kind: LookupKind; label: string; hint: string }[] = [
  { kind: 'setup', label: 'Entry models', hint: 'The setups you trade' },
  { kind: 'style', label: 'Trade styles', hint: 'How long you hold' },
  { kind: 'session', label: 'Sessions', hint: 'When the trade was taken' },
  { kind: 'source', label: 'Sources', hint: 'Which account or funding the trade sits in' },
  { kind: 'emotion', label: 'Emotional states', hint: 'How you felt, multi-select on a trade' },
  { kind: 'timeframe', label: 'Timeframes', hint: 'Chart timeframes you enter from' },
]

function ListEditor({ kind, label, hint, reference }: { kind: LookupKind; label: string; hint: string; reference: ReturnType<typeof useReference> }) {
  const [draft, setDraft] = useState('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const serverItems = reference.lookups[kind] ?? []
  // Local copy so a drag can reorder instantly; the server call follows on drop.
  const [items, setItems] = useState(serverItems)
  const signature = serverItems.map((i) => `${i.id}:${i.value}`).join('|')
  useEffect(() => {
    setItems(serverItems)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  const add = async () => {
    const value = draft.trim()
    if (!value) return
    await api.lookups.create({ kind, value, sort_order: items.length })
    setDraft('')
    reference.reload()
  }

  const persist = async (next: typeof items) => {
    setSaving(true)
    try {
      await api.lookups.reorder(kind, next.map((i) => i.id))
      await reference.reload()
    } finally {
      setSaving(false)
    }
  }

  /** Move an entry to a new position, returning the reordered list. */
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return null
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setItems(next)
    return next
  }

  const nudge = (index: number, delta: number) => {
    const next = move(index, index + delta)
    if (next) persist(next)
  }

  return (
    <Card>
      <CardHeader
        title={label}
        subtitle={hint}
        right={saving ? <span className="text-[11px] text-ink-faint">Saving...</span> : <Badge>{items.length}</Badge>}
      />
      <div className="p-4">
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, index) => (
            <span
              key={item.id}
              draggable
              tabIndex={0}
              onDragStart={(e) => {
                setDragIndex(index)
                e.dataTransfer.effectAllowed = 'move'
                // Firefox refuses to start a drag without payload.
                e.dataTransfer.setData('text/plain', String(item.id))
              }}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                if (dragIndex === null || dragIndex === index) return
                move(dragIndex, index)
                setDragIndex(index)
              }}
              onDrop={(e) => e.preventDefault()}
              onDragEnd={() => {
                setDragIndex(null)
                persist(items)
              }}
              onKeyDown={(e) => {
                // Keyboard equivalent, and easier than dragging for one step.
                if (!e.altKey) return
                if (e.key === 'ArrowLeft') {
                  e.preventDefault()
                  nudge(index, -1)
                } else if (e.key === 'ArrowRight') {
                  e.preventDefault()
                  nudge(index, 1)
                }
              }}
              title="Drag to reorder, or focus and press Alt with the arrow keys"
              className={`chip !pr-1.5 cursor-grab select-none active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-accent/40 ${
                dragIndex === index ? 'opacity-40' : ''
              }`}
            >
              <GripVertical size={11} className="shrink-0 text-ink-faint" />
              {item.value}
              <button
                onClick={async () => {
                  await api.lookups.remove(item.id)
                  reference.reload()
                }}
                draggable={false}
                aria-label={`Remove ${item.value}`}
                className="rounded p-0.5 text-ink-faint transition hover:bg-loss/15 hover:text-loss"
              >
                <Trash2 size={12} />
              </button>
            </span>
          ))}
          {!items.length && <span className="text-xs text-ink-faint">Nothing in this list yet.</span>}
        </div>

        {items.length > 1 && (
          <p className="mt-2.5 text-[11px] text-ink-faint">
            Drag to reorder. The order here is the order on the trade form.
          </p>
        )}

        <div className="mt-3 flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder={`Add to ${label.toLowerCase()}`}
          />
          <button className="btn-ghost" onClick={add} disabled={!draft.trim()}><Plus size={15} /></button>
        </div>
      </div>
    </Card>
  )
}

const JOURNAL_KINDS = [
  { value: 'futures_day', label: 'Futures day trading' },
  { value: 'options_swing', label: 'Options swing trading' },
  { value: 'options_csp', label: 'Cash-secured puts' },
  { value: 'general', label: 'General' },
]

/**
 * Journals are separate books. Each holds its own trades and its own numbers,
 * so a long premium-selling position never distorts a day-trading win rate.
 */
function JournalsEditor({ playbooks }: { playbooks: Playbook[] }) {
  const { journals, journalId, setJournalId, reload } = useJournal()
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  const patch = async (j: Journal, body: Partial<Journal>) => {
    setError(null)
    setBusy(true)
    try {
      await api.journals.update(j.id, body)
      await reload()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (j: Journal) => {
    if (!confirm(`Delete the "${j.name}" journal?`)) return
    setError(null)
    try {
      await api.journals.remove(j.id)
      await reload()
    } catch (e) {
      setError(e)
    }
  }

  return (
    <Card>
      <CardHeader
        title="Journals"
        subtitle="Separate books, each with its own trades, dashboard and analytics"
        icon={<Book size={15} />}
        right={busy ? <span className="text-[11px] text-ink-faint">Saving...</span> : <Badge>{journals.length}</Badge>}
      />
      <div className="space-y-3 p-4">
        <ErrorNote error={error} />
        {journals.map((j) => (
          <div
            key={j.id}
            className={`rounded-lg border p-3 ${j.id === journalId ? 'border-accent/45 bg-accent/5' : 'border-line bg-surface-2/40'}`}
          >
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto]">
              <Field label="Name">
                <Input
                  defaultValue={j.name}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== j.name && patch(j, { name: e.target.value.trim() })}
                />
              </Field>
              <Field label="Kind" hint="Shapes the dashboard">
                <Select value={j.kind} options={JOURNAL_KINDS} onChange={(e) => patch(j, { kind: e.target.value as Journal['kind'] })} />
              </Field>
              <Field label="Default rule set">
                <Select
                  value={String(j.default_playbook_id ?? '')}
                  options={playbooks.map((p) => ({ value: String(p.id), label: p.name }))}
                  placeholder="None"
                  onChange={(e) => patch(j, { default_playbook_id: e.target.value ? Number(e.target.value) : null })}
                />
              </Field>
              <div className="flex items-end gap-2 pb-0.5">
                {j.id !== journalId && (
                  <button className="btn-ghost !py-1.5" onClick={() => setJournalId(j.id)}>Open</button>
                )}
                <button
                  className="rounded p-2 text-ink-faint transition hover:bg-loss/15 hover:text-loss"
                  onClick={() => remove(j)}
                  aria-label={`Delete ${j.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <p className="mt-1 text-[11px] text-ink-faint">
              {j.trade_count} trade{j.trade_count === 1 ? '' : 's'}
              {j.id === journalId && ' · currently open'}
            </p>
          </div>
        ))}

        <button
          className="btn-ghost w-full"
          onClick={async () => {
            const name = prompt('Name this journal')
            if (!name?.trim()) return
            setError(null)
            try {
              const created = await api.journals.create({ name: name.trim(), kind: 'general' })
              await reload()
              setJournalId(created.id)
            } catch (e) {
              setError(e)
            }
          }}
        >
          <Plus size={15} /> New journal
        </button>

        <p className="text-[11px] leading-relaxed text-ink-faint">
          A journal holding trades cannot be deleted. Move those trades to another journal from the trade form first,
          which keeps the record rather than quietly detaching it.
        </p>
      </div>
    </Card>
  )
}

function RuleEditor({ playbook, onSaved }: { playbook: Playbook; onSaved: () => void }) {
  const [rules, setRules] = useState<Rule[]>(playbook.rules)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setRules(playbook.rules)
    setDirty(false)
  }, [playbook])

  const update = (i: number, patch: Partial<Rule>) => {
    setRules((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
    setDirty(true)
  }
  const move = (i: number, delta: number) => {
    const j = i + delta
    if (j < 0 || j >= rules.length) return
    const next = [...rules]
    ;[next[i], next[j]] = [next[j], next[i]]
    setRules(next.map((r, idx) => ({ ...r, sort_order: idx })))
    setDirty(true)
  }
  const remove = (i: number) => {
    setRules((rs) => rs.filter((_, idx) => idx !== i))
    setDirty(true)
  }
  const add = () => {
    setRules((rs) => [
      ...rs,
      { section: rs.at(-1)?.section ?? 'Model Compliance', text: '', detail: null, is_critical: false, is_active: true, sort_order: rs.length },
    ])
    setDirty(true)
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await api.playbooks.saveRules(playbook.id, rules.filter((r) => r.text.trim()).map((r, i) => ({ ...r, sort_order: i })))
      setDirty(false)
      onSaved()
    } catch (e) {
      setError(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title={playbook.name}
        subtitle={playbook.description ?? undefined}
        right={
          <button className="btn-primary" onClick={save} disabled={saving || !dirty}>
            <Save size={14} /> {saving ? 'Saving...' : dirty ? 'Save rules' : 'Saved'}
          </button>
        }
      />
      <div className="space-y-2 p-4">
        <ErrorNote error={error} />
        <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs leading-relaxed text-ink-faint">
          Editing a rule here changes it for <em>future</em> trades only. Trades already logged keep the exact rule text
          they were graded against, so your historical compliance stats stay honest.
        </p>

        {rules.map((rule, i) => (
          <div key={rule.id ?? `new-${i}`} className="flex items-start gap-2 rounded-lg border border-line bg-surface-2/50 p-2.5">
            <div className="flex flex-col pt-1.5">
              <button className="text-ink-faint hover:text-ink" onClick={() => move(i, -1)} aria-label="Move up">▲</button>
              <GripVertical size={13} className="my-0.5 text-ink-faint" />
              <button className="text-ink-faint hover:text-ink" onClick={() => move(i, 1)} aria-label="Move down">▼</button>
            </div>

            <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[150px_minmax(0,1fr)]">
              <Input value={rule.section} onChange={(e) => update(i, { section: e.target.value })} placeholder="Section" />
              <div className="space-y-2">
                <Input value={rule.text} onChange={(e) => update(i, { text: e.target.value })} placeholder="Rule text" />
                <Input value={rule.detail ?? ''} onChange={(e) => update(i, { detail: e.target.value })} placeholder="Detail (optional)" className="!text-xs" />
              </div>
            </div>

            <label className="flex shrink-0 cursor-pointer items-center gap-1.5 pt-2 text-xs text-ink-muted" title="Breaking a critical rule is flagged on the trade">
              <input type="checkbox" checked={rule.is_critical} onChange={(e) => update(i, { is_critical: e.target.checked })} className="accent-[rgb(var(--accent))]" />
              Critical
            </label>

            <button className="mt-1.5 shrink-0 rounded p-1.5 text-ink-faint transition hover:bg-loss/15 hover:text-loss" onClick={() => remove(i)} aria-label="Delete rule">
              <Trash2 size={14} />
            </button>
          </div>
        ))}

        <button className="btn-ghost w-full" onClick={add}><Plus size={15} /> Add rule</button>
      </div>
    </Card>
  )
}

function DataSection({ onRestored }: { onRestored: () => void }) {
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [snapshotting, setSnapshotting] = useState(false)

  const takeSnapshot = async () => {
    setSnapshotting(true)
    setError(null)
    try {
      const res = await api.snapshot()
      setStatus(
        res.skipped
          ? 'A snapshot for this minute already exists.'
          : `Snapshot saved: ${res.file} (${(res.size / 1024).toFixed(0)} KB)`,
      )
    } catch (e) {
      setError(e)
    } finally {
      setSnapshotting(false)
    }
  }

  const restore = async (file: File) => {
    if (!confirm('Restoring replaces every trade, rule and list in this journal. Continue?')) return
    setError(null)
    try {
      const payload = JSON.parse(await file.text())
      const res = await api.restore(payload)
      setStatus(`Restored ${Object.entries(res.restored).map(([t, n]) => `${n} ${t}`).join(', ')}`)
      onRestored()
    } catch (e) {
      setError(e)
    }
  }

  return (
    <Card>
      <CardHeader title="Backup and restore" subtitle="Everything lives in the data/ folder on this computer" />
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={takeSnapshot} disabled={snapshotting}>
            <DatabaseBackup size={15} /> {snapshotting ? 'Saving...' : 'Snapshot now'}
          </button>
          <a className="btn-ghost" href={api.backupUrl} download>
            <Download size={15} /> Download backup
          </a>
          <label className="btn-ghost cursor-pointer">
            <Upload size={15} /> Restore from file
            <input
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) restore(f)
                e.target.value = ''
              }}
            />
          </label>
        </div>
        <div className="space-y-2 text-xs leading-relaxed text-ink-faint">
          <p>
            <strong className="text-ink-muted">Snapshot now</strong> writes a complete copy of the database to{' '}
            <code>data/backups/</code>. This also happens automatically once a day, keeping the 30 most recent.
          </p>
          <p className="flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            Neither a snapshot nor the JSON download includes your chart screenshots, which are ordinary image files in{' '}
            <code>data/uploads/</code>. Copying the whole <code>data/</code> folder is the one complete backup.
          </p>
        </div>
        {status && <p className="text-xs text-win">{status}</p>}
        <ErrorNote error={error} />
      </div>
    </Card>
  )
}

export default function Settings() {
  const reference = useReference()
  // Rules and lists are what gets edited regularly; journals change rarely.
  const [tab, setTab] = useState<'journals' | 'rules' | 'lists' | 'data'>('rules')
  const [activePlaybook, setActivePlaybook] = useState<number | null>(null)

  useEffect(() => {
    if (activePlaybook === null && reference.playbooks.length) setActivePlaybook(reference.playbooks[0].id)
  }, [reference.playbooks, activePlaybook])

  if (reference.loading) return <Spinner label="Loading settings" />

  const playbook = reference.playbooks.find((p) => p.id === activePlaybook)

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Journals, rules, dropdown lists and your data"
        actions={
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'journals', label: 'Journals' },
              { value: 'rules', label: 'Rules' },
              { value: 'lists', label: 'Lists' },
              { value: 'data', label: 'Data' },
            ]}
          />
        }
      />

      <div className="space-y-5 px-4 py-5 lg:px-7">
        {tab === 'journals' && <JournalsEditor playbooks={reference.playbooks} />}

        {tab === 'rules' && (
          <>
            <div className="flex flex-wrap gap-2">
              {reference.playbooks.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActivePlaybook(p.id)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    p.id === activePlaybook ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-surface-1 text-ink-muted hover:text-ink'
                  }`}
                >
                  {p.name}
                  <span className="ml-2 text-xs text-ink-faint">{p.rules.length}</span>
                </button>
              ))}
              <button
                className="btn-ghost"
                onClick={async () => {
                  const name = prompt('Name this playbook')
                  if (!name) return
                  const created = await api.playbooks.create({ name, asset_class: 'futures', sort_order: reference.playbooks.length })
                  await reference.reload()
                  setActivePlaybook(created.id)
                }}
              >
                <Plus size={15} /> New playbook
              </button>
            </div>
            {playbook && <RuleEditor key={playbook.id} playbook={playbook} onSaved={reference.reload} />}
          </>
        )}

        {tab === 'lists' && (
          <div className="grid gap-5 lg:grid-cols-2">
            {LIST_KINDS.map((l) => (
              <ListEditor key={l.kind} {...l} reference={reference} />
            ))}
          </div>
        )}

        {tab === 'data' && <DataSection onRestored={reference.reload} />}
      </div>
    </>
  )
}
