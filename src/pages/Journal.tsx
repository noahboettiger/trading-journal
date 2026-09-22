import { useEffect, useState } from 'react'
import { Save, NotebookPen, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useAsync, useReference } from '@/lib/hooks'
import { formatDay, todayISO } from '@/lib/format'
import { PageHeader } from '@/components/Layout'
import { Card, CardHeader, Field, Input, Select, Textarea, Spinner, ErrorNote, EmptyState } from '@/components/ui'
import { useJournal } from '@/lib/journals'

// The bias is written before the open and the rest after the close, so the
// numbering is the order they get filled in, not the order they were thought of.
const TEMPLATE = `1. Daily bias (before the open). What am I specifically looking for today, and why? If it is conditional, write out the branches: if this happens, then I do this. Only trades that line up with what is written here are on the table.


2. How was my sleep?


3. What else is going on in my life right now? Any stress outside of trading?


4. How would I rate the day overall?


5. The trades I took:


6. What would perfect trading have looked like today?


7. What is the gap between that and what I actually did?


8. What one thing closes that gap tomorrow?
`

interface Entry { id: number; entry_date: string; session: string | null; content: string; mood: string | null }

export default function Journal() {
  const reference = useReference()
  const { journalId, journal } = useJournal()
  const { data: entries, loading, error, reload } = useAsync<Entry[]>(
    () => (journalId === null ? Promise.resolve([]) : api.journalList({ journal_id: journalId })),
    [journalId],
  )
  const [draft, setDraft] = useState({ entry_date: todayISO(), session: '', content: '', mood: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<unknown>(null)

  // The entry already filed under the open date and session, if there is one.
  // Saving edits that entry rather than filing a second one beside it.
  const current = (entries ?? []).find(
    (e) => e.entry_date === draft.entry_date && (e.session ?? '') === draft.session,
  )

  // Load an existing entry when the date or session selection changes.
  useEffect(() => {
    const match = (entries ?? []).find(
      (e) => e.entry_date === draft.entry_date && (e.session ?? '') === draft.session,
    )
    setDraft((d) => ({ ...d, content: match?.content ?? '', mood: match?.mood ?? '' }))
  }, [draft.entry_date, draft.session, entries])

  const save = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      await api.journalSave({
        ...draft,
        session: draft.session || null,
        mood: draft.mood || null,
        journal_id: journalId,
      })
      await reload()
    } catch (e) {
      setSaveError(e)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (entry: Entry) => {
    if (!confirm(`Delete the entry for ${formatDay(entry.entry_date)}? This cannot be undone.`)) return
    setSaveError(null)
    try {
      await api.journalDelete(entry.id)
      if (entry.id === current?.id) setDraft((d) => ({ ...d, content: '', mood: '' }))
      await reload()
    } catch (e) {
      setSaveError(e)
    }
  }

  return (
    <>
      <PageHeader
        title={journal ? `${journal.name} notes` : 'Session journal'}
        subtitle="Notes that belong to a day, not a single trade"
      />
      <div className="grid gap-5 px-4 py-5 lg:px-7 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader
            title="Write"
            icon={<NotebookPen size={15} />}
            right={
              <div className="flex items-center gap-2">
                {current && (
                  <button className="btn-danger" onClick={() => remove(current)} title="Delete this entry">
                    <Trash2 size={14} /> Delete
                  </button>
                )}
                <button className="btn-primary" onClick={save} disabled={saving || !draft.content.trim()}>
                  <Save size={14} /> {saving ? 'Saving...' : current ? 'Update entry' : 'Save entry'}
                </button>
              </div>
            }
          />
          <div className="space-y-4 p-5">
            <ErrorNote error={saveError} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Date">
                <Input type="date" value={draft.entry_date} onChange={(e) => setDraft({ ...draft, entry_date: e.target.value })} />
              </Field>
              <Field label="Session">
                <Select value={draft.session} options={reference.values('session')} placeholder="Whole day" onChange={(e) => setDraft({ ...draft, session: e.target.value })} />
              </Field>
              <Field label="Mood">
                <Select value={draft.mood} options={reference.values('emotion')} placeholder="Not recorded" onChange={(e) => setDraft({ ...draft, mood: e.target.value })} />
              </Field>
            </div>
            <Field
              label="Entry"
              hint={
                !draft.content && (
                  <button className="text-accent hover:underline" onClick={() => setDraft({ ...draft, content: TEMPLATE })}>
                    Insert a starter template
                  </button>
                )
              }
            >
              <Textarea rows={24} value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} placeholder="How did the session go?" />
            </Field>
          </div>
        </Card>

        <Card className="self-start">
          <CardHeader title="Past entries" />
          {loading ? (
            <Spinner label="Loading" />
          ) : error ? (
            <div className="p-4"><ErrorNote error={error} /></div>
          ) : !entries?.length ? (
            <EmptyState title="No entries yet" body="Write your first session recap." />
          ) : (
            <ul className="max-h-[640px] divide-y divide-line overflow-y-auto">
              {entries.map((e) => (
                <li key={e.id} className={`flex items-start transition hover:bg-surface-2 ${e.id === current?.id ? 'bg-surface-2' : ''}`}>
                  <button
                    className="min-w-0 flex-1 px-4 py-3 text-left"
                    onClick={() => setDraft({ entry_date: e.entry_date, session: e.session ?? '', content: e.content, mood: e.mood ?? '' })}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{formatDay(e.entry_date)}</span>
                      {e.session && <span className="text-[11px] text-ink-faint">{e.session}</span>}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-ink-faint">{e.content.replace(/\s+/g, ' ').slice(0, 120)}</p>
                  </button>
                  <button
                    className="mr-2 mt-3 shrink-0 rounded p-1.5 text-ink-faint transition hover:bg-loss/15 hover:text-loss"
                    onClick={() => remove(e)}
                    aria-label={`Delete the entry for ${e.entry_date}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
