import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getPostImageUrl } from '@/lib/posts'

interface Props {
  paths: string[]
}

export function MediaCarousel({ paths }: Props) {
  const [urls, setUrls] = useState<(string | null)[]>([])
  const [index, setIndex] = useState(0)

  useEffect(() => {
    let cancelled = false
    setIndex(0)
    Promise.all(
      paths.map((p) =>
        getPostImageUrl(p)
          .then((u) => u)
          .catch(() => null)
      )
    ).then((list) => {
      if (!cancelled) setUrls(list)
    })
    return () => {
      cancelled = true
    }
  }, [paths.join('|')])

  if (!paths.length) return null

  const current = urls[index]
  const multi = paths.length > 1

  return (
    <div className="relative rounded-[12px] overflow-hidden mb-3 -mx-1 bg-[var(--color-s2)]">
      {current ? (
        <img src={current} alt="" className="w-full max-h-96 object-cover" />
      ) : (
        <div className="w-full h-48 animate-pulse bg-[var(--color-s3)]" />
      )}

      {multi && (
        <>
          <button
            type="button"
            onClick={() => setIndex((i) => (i - 1 + paths.length) % paths.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center"
            aria-label="Previous"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => setIndex((i) => (i + 1) % paths.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center"
            aria-label="Next"
          >
            <ChevronRight size={18} />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {paths.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                className={`w-1.5 h-1.5 rounded-full transition ${
                  i === index ? 'bg-white scale-125' : 'bg-white/50'
                }`}
                aria-label={`Image ${i + 1}`}
              />
            ))}
          </div>
          <span className="absolute top-2 right-2 text-[11px] font-bold bg-black/50 text-white px-2 py-0.5 rounded-full">
            {index + 1}/{paths.length}
          </span>
        </>
      )}
    </div>
  )
}
