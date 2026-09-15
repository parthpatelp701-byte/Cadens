import { useState, useRef } from 'react'
import { createPost } from '@/lib/posts'
import { ImagePlus, X } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import type { Group } from '@/types'

interface Props {
  onPosted: () => void
  groups?: Group[]
  /** Pre-select group filter from feed */
  defaultGroupId?: string | null
}

const MAX_IMAGES = 4

export function Composer({ onPosted, groups = [], defaultGroupId = null }: Props) {
  const { toast } = useToast()
  const [text, setText] = useState('')
  const [mood, setMood] = useState('😊')
  const [privacy, setPrivacy] = useState<'private' | 'group' | 'circle'>(
    defaultGroupId ? 'group' : 'private'
  )
  const [groupId, setGroupId] = useState<string | null>(defaultGroupId)
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const moods = ['😊', '😍', '🔥', '💡', '🙏', '😎', '🥳', '💪']
  const activeGroups = groups.filter((g) => g.status === 'active')

  function onPick(list: FileList | null) {
    if (!list?.length) return
    const incoming = Array.from(list).filter((f) =>
      ['image/jpeg', 'image/png', 'image/webp'].includes(f.type)
    )
    const next = [...files, ...incoming].slice(0, MAX_IMAGES)
    // revoke old extras
    previews.slice(next.length).forEach((u) => URL.revokeObjectURL(u))
    const newPreviews = next.map((f, i) =>
      i < previews.length && files[i] === next[i] ? previews[i] : URL.createObjectURL(f)
    )
    setFiles(next)
    setPreviews(newPreviews)
  }

  function removeImage(index: number) {
    URL.revokeObjectURL(previews[index])
    setFiles((f) => f.filter((_, i) => i !== index))
    setPreviews((p) => p.filter((_, i) => i !== index))
  }

  function clearAllImages() {
    previews.forEach((u) => URL.revokeObjectURL(u))
    setFiles([])
    setPreviews([])
  }

  async function submit() {
    if ((!text.trim() && files.length === 0) || loading) return
    setLoading(true)
    setError('')
    try {
      await createPost(text, {
        mood,
        privacy,
        groupId: privacy === 'group' ? groupId : null,
        imageFiles: files,
      })
      setText('')
      clearAllImages()
      toast('Posted', 'success')
      onPosted()
    } catch (err: any) {
      const msg = err.message || 'Could not create post'
      setError(msg)
      toast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-[var(--color-s1)] border border-[var(--color-line2)] rounded-[16px] p-4 space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Share something… use @name to mention"
        rows={3}
        className="w-full bg-transparent resize-none outline-none text-[0.95rem] placeholder:text-[var(--color-mute)]"
      />

      {previews.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {previews.map((src, i) => (
            <div key={src} className="relative rounded-[12px] overflow-hidden aspect-square bg-[var(--color-s2)]">
              <img src={src} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {moods.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMood(m)}
            className={`w-9 h-9 rounded-full text-lg flex items-center justify-center transition ${
              mood === m
                ? 'bg-[color-mix(in_srgb,var(--color-acc)_22%,transparent)] scale-110'
                : 'opacity-60 hover:opacity-100'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={privacy}
            onChange={(e) => {
              const v = e.target.value as 'private' | 'group' | 'circle'
              setPrivacy(v)
              if (v !== 'group') setGroupId(null)
              else if (!groupId && activeGroups[0]) setGroupId(activeGroups[0].id)
            }}
            className="bg-[var(--color-s2)] border border-[var(--color-line)] rounded-full px-3 py-1.5 text-xs font-bold"
          >
            <option value="private">Only me</option>
            <option value="group">Group</option>
            <option value="circle">Approved family</option>
          </select>

          {privacy === 'group' && activeGroups.length > 0 && (
            <select
              value={groupId || ''}
              onChange={(e) => setGroupId(e.target.value || null)}
              className="bg-[var(--color-s2)] border border-[var(--color-line)] rounded-full px-3 py-1.5 text-xs font-bold max-w-[140px]"
            >
              {activeGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={files.length >= MAX_IMAGES}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--color-dim)] hover:bg-[var(--color-s2)] disabled:opacity-40"
            title={`Add photos (${files.length}/${MAX_IMAGES})`}
          >
            <ImagePlus size={18} />
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              onPick(e.target.files)
              e.target.value = ''
            }}
          />
          {files.length > 0 && (
            <span className="text-[11px] text-[var(--color-mute)]">
              {files.length}/{MAX_IMAGES} · compressed on upload
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={(!text.trim() && files.length === 0) || loading}
          className="px-5 min-h-9 rounded-full bg-[var(--color-acc)] text-[var(--color-ink)] text-sm font-bold disabled:opacity-40 active:scale-[0.98] transition"
        >
          {loading ? 'Posting…' : 'Post'}
        </button>
      </div>

      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  )
}
