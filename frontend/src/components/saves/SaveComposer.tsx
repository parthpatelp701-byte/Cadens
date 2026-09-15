import { useState, useRef } from 'react'
import { X, Link as LinkIcon, FileText, Image as ImageIcon, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { createSave, uploadSaveImage, unfurlLink } from '@/lib/saves'
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface SaveComposerProps {
  open: boolean
  onClose: () => void
  initialUrl?: string
  initialText?: string
}

type Mode = 'note' | 'link' | 'image'

export function SaveComposer({ open, onClose, initialUrl = '', initialText = '' }: SaveComposerProps) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<Mode>(initialUrl ? 'link' : 'note')
  const [body, setBody] = useState(initialText)
  const [linkUrl, setLinkUrl] = useState(initialUrl)
  const [linkTitle, setLinkTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      let image_path: string | undefined
      let finalTitle = linkTitle
      let finalDesc: string | undefined

      if (mode === 'image' && file) {
        image_path = await uploadSaveImage(file)
      }

      if (mode === 'link' && linkUrl.trim()) {
        if (!finalTitle) {
          const meta = await unfurlLink(linkUrl.trim())
          finalTitle = meta.title || ''
          finalDesc = meta.description
        }
      }

      return createSave({
        body: body.trim() || undefined,
        link_url: mode === 'link' ? linkUrl.trim() : undefined,
        link_title: finalTitle || undefined,
        link_description: finalDesc,
        image_path,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saves'] })
      reset()
      onClose()
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to save')
    },
  })

  function reset() {
    setBody('')
    setLinkUrl('')
    setLinkTitle('')
    setFile(null)
    setPreview(null)
    setError('')
    setMode('note')
  }

  function handleFile(f: File | null) {
    setFile(f)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(f ? URL.createObjectURL(f) : null)
    if (f) setMode('image')
  }

  if (!open) return null

  const canSubmit =
    (mode === 'note' && body.trim().length > 0) ||
    (mode === 'link' && linkUrl.trim().length > 0) ||
    (mode === 'image' && file)

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-lg bg-[var(--color-s1)] border-[1.5px] border-[var(--color-line)] rounded-t-[var(--radius-lg)] sm:rounded-[var(--radius-lg)] shadow-[var(--shadow-elevated)] max-h-[90dvh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-[var(--color-line2)] bg-[var(--color-s1)] z-10">
          <h2 className="font-bold text-lg">New Save</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[var(--color-s2)] text-[var(--color-mute)]"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Mode tabs */}
          <div className="flex gap-2 p-1 rounded-xl bg-[var(--color-s2)]">
            {(
              [
                { id: 'note' as Mode, icon: FileText, label: 'Note' },
                { id: 'link' as Mode, icon: LinkIcon, label: 'Link' },
                { id: 'image' as Mode, icon: ImageIcon, label: 'Image' },
              ] as const
            ).map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  mode === id
                    ? 'bg-[var(--color-acc)] text-[var(--color-ink)]'
                    : 'text-[var(--color-dim)] hover:text-[var(--color-txt)]'
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          {mode === 'note' && (
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write a note, idea, or reminder…"
              rows={5}
              className="w-full px-4 py-3 rounded-xl bg-[var(--color-s2)] border border-[var(--color-line)] text-[var(--color-txt)] placeholder:text-[var(--color-mute)] focus:outline-none focus:ring-2 focus:ring-[var(--color-acc)]/40 resize-none"
              autoFocus
            />
          )}

          {mode === 'link' && (
            <div className="space-y-3">
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://…"
                className="w-full px-4 py-3 rounded-xl bg-[var(--color-s2)] border border-[var(--color-line)] text-[var(--color-txt)] placeholder:text-[var(--color-mute)] focus:outline-none focus:ring-2 focus:ring-[var(--color-acc)]/40"
                autoFocus
              />
              <input
                type="text"
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                placeholder="Title (optional)"
                className="w-full px-4 py-3 rounded-xl bg-[var(--color-s2)] border border-[var(--color-line)] text-[var(--color-txt)] placeholder:text-[var(--color-mute)] focus:outline-none focus:ring-2 focus:ring-[var(--color-acc)]/40"
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Notes about this link (optional)"
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-[var(--color-s2)] border border-[var(--color-line)] text-[var(--color-txt)] placeholder:text-[var(--color-mute)] focus:outline-none focus:ring-2 focus:ring-[var(--color-acc)]/40 resize-none"
              />
            </div>
          )}

          {mode === 'image' && (
            <div className="space-y-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] || null)}
              />
              {preview ? (
                <div className="relative rounded-xl overflow-hidden bg-[var(--color-s3)]">
                  <img src={preview} alt="" className="w-full max-h-64 object-contain" />
                  <button
                    type="button"
                    onClick={() => handleFile(null)}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full py-12 rounded-xl border-2 border-dashed border-[var(--color-line)] text-[var(--color-mute)] hover:border-[var(--color-acc)] hover:text-[var(--color-acc)] transition-colors"
                >
                  <ImageIcon size={28} className="mx-auto mb-2" />
                  <div className="text-sm font-medium">Tap to choose an image</div>
                  <div className="text-xs mt-1">JPEG, PNG, WebP · max 2 MB</div>
                </button>
              )}
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Caption (optional)"
                rows={2}
                className="w-full px-4 py-3 rounded-xl bg-[var(--color-s2)] border border-[var(--color-line)] text-[var(--color-txt)] placeholder:text-[var(--color-mute)] focus:outline-none focus:ring-2 focus:ring-[var(--color-acc)]/40 resize-none"
              />
            </div>
          )}

          {error && (
            <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger)]/10 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => mutation.mutate()}
              disabled={!canSubmit || mutation.isPending}
              leftIcon={mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : undefined}
            >
              {mutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
