import { useCallback, useEffect, useRef, useState } from 'react'
import { ImagePlus, Trash2, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import type { TradeImage } from '@/lib/types'

/**
 * Chart screenshots. Accepts paste (Ctrl/Cmd+V anywhere on the page while the
 * form is open), drag and drop, or a file picker. Files are stored on disk
 * under data/uploads and referenced by path.
 */
export function ChartUpload({ images, onChange }: { images: TradeImage[]; onChange: (next: TradeImage[]) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const imagesRef = useRef(images)
  imagesRef.current = images

  const upload = useCallback(
    async (files: File[]) => {
      const pics = files.filter((f) => f.type.startsWith('image/'))
      if (!pics.length) return
      setBusy(true)
      setError(null)
      try {
        const saved = await api.upload(pics)
        const base = imagesRef.current
        onChange([
          ...base,
          ...saved.map((s, i) => ({ path: s.path, caption: null, sort_order: base.length + i })),
        ])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed')
      } finally {
        setBusy(false)
      }
    },
    [onChange],
  )

  // Paste anywhere on the page, which is how a TradingView screenshot arrives.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.items ?? [])]
        .filter((i) => i.kind === 'file')
        .map((i) => i.getAsFile())
        .filter((f): f is File => !!f)
      if (files.length) {
        e.preventDefault()
        upload(files)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [upload])

  const remove = (index: number) =>
    onChange(images.filter((_, i) => i !== index).map((img, i) => ({ ...img, sort_order: i })))

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          upload([...e.dataTransfer.files])
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl2 border-2 border-dashed px-6 py-8 text-center transition ${
          dragging ? 'border-accent bg-accent/5' : 'border-line bg-surface-2/50 hover:border-ink-faint'
        }`}
      >
        {busy ? (
          <Loader2 size={22} className="animate-spin text-accent" />
        ) : (
          <ImagePlus size={22} className="text-ink-faint" />
        )}
        <div>
          <p className="text-sm font-medium">{busy ? 'Uploading...' : 'Paste, drop, or click to add a chart'}</p>
          <p className="mt-0.5 text-xs text-ink-faint">
            Screenshot from TradingView and press {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+V anywhere
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            upload([...(e.target.files ?? [])])
            e.target.value = ''
          }}
        />
      </div>

      {error && <p className="text-xs text-loss">{error}</p>}

      {images.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {images.map((img, i) => (
            <figure key={img.path} className="group relative overflow-hidden rounded-lg border border-line bg-surface-2">
              <img src={img.path} alt={img.caption ?? `Chart ${i + 1}`} className="w-full object-contain" />
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="Remove chart"
                className="absolute right-2 top-2 rounded-md bg-surface-0/85 p-1.5 text-loss opacity-0 backdrop-blur transition group-hover:opacity-100 focus:opacity-100"
              >
                <Trash2 size={14} />
              </button>
              <input
                value={img.caption ?? ''}
                onChange={(e) =>
                  onChange(images.map((m, idx) => (idx === i ? { ...m, caption: e.target.value } : m)))
                }
                placeholder="Caption (optional)"
                className="w-full border-t border-line bg-surface-1 px-3 py-2 text-xs text-ink placeholder:text-ink-faint outline-none"
              />
            </figure>
          ))}
        </div>
      )}
    </div>
  )
}
