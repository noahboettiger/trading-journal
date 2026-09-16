import { useEffect, useState } from 'react'
import { Plus, Trash2, GripVertical, Save, Download, Upload, AlertTriangle, DatabaseBackup } from 'lucide-react'

import { api } from '@/lib/api'
import { useReference } from '@/lib/hooks'
import type { Playbook, Rule, LookupKind } from '@/lib/types'
import { PageHeader } from '@/components/Layout'
import { Card, CardHeader, Input, Select, Spinner, ErrorNote, Badge, Segmented } from '@/components/ui'

const LIST_KINDS: { kind: LookupKind; label: string; hint: string }[] = [
  { kind: 'setup', label: 'Entry models', hint: 'Freestyle, iFVG Reversal, Mech Model, 2022 Model...' },
  { kind: 'style', label: 'Trade styles', hint: 'Day Trade, Swing Trade, Scalp...' },
  { kind: 'session', label: 'Sessions', hint: 'Asia, London, NY AM...' },
  { kind: 'source', label: 'Sources', hint: 'Prop, Personal, Eval...' },
  { kind: 'emotion', label: 'Emotional states', hint: 'Calm, FOMO, Frustrated...' },
  { kind: 'timeframe', label: 'Timeframes', hint: '1m, 5m, 15m...' },
]

function ListEditor({ kind, label, hint, reference }: { kind: LookupKind; label: string; hint: string; reference: ReturnType<typeof useReference> }) {
  const [draft, setDraft] = useState('')
  const items = reference.lookups[kind] ?? []

  const add = async () => {
    const value = draft.trim()
    if (!value) return
    await api.lookups.create({ kind, value, sort_order: items.length })
    setDraft('')
    reference.reload()
  }

  return (
    <Card>
      <CardHeader title={label} subtitle={hint} right={<Badge>{items.length}</Badge>} />
      <div className="p-4">
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span key={item.id} className="chip group !pr-1.5">
              {item.value}
              <button
                onClick={async () => {
                  await api.lookups.remove(item.id)
                  reference.reload()
                }}
                aria-label={`Remove ${item.value}`}
                className="rounded p-0.5 text-ink-faint transition hover:bg-loss/15 hover:text-loss"
              >
                <Trash2 size={12} />
              </button>
            </span>
          ))}
          {!items.length && <span className="text-xs text-ink-faint">Nothing in this list yet.</span>}
        </div>
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
  const [tab, setTab] = useState<'rules' | 'lists' | 'data'>('rules')
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
        subtitle="Rules, dropdown lists and your data"
        actions={
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'rules', label: 'Rules' },
              { value: 'lists', label: 'Lists' },
              { value: 'data', label: 'Data' },
            ]}
          />
        }
      />

      <div className="space-y-5 px-4 py-5 lg:px-7">
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
