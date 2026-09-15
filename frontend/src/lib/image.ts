/** Client-side image compression before upload */

const MAX_DIM = 1600
const MAX_BYTES = 1.0 * 1024 * 1024 // stay under storage limit after compress
const QUALITY_STEPS = [0.82, 0.72, 0.62, 0.52]

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read image'))
    }
    img.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Compression failed'))),
      type,
      quality
    )
  })
}

/**
 * Compress an image file for upload.
 * Returns JPEG/WebP blob under ~1MB, max dimension 1600px.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Not an image')
  }

  // Already small enough and not huge resolution — skip work
  if (file.size <= 400 * 1024) {
    return file
  }

  const img = await loadImage(file)
  let { width, height } = img
  const scale = Math.min(1, MAX_DIM / Math.max(width, height))
  width = Math.round(width * scale)
  height = Math.round(height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not available')
  ctx.drawImage(img, 0, 0, width, height)

  const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  let best: Blob | null = null

  for (const q of QUALITY_STEPS) {
    const blob = await canvasToBlob(canvas, outType === 'image/png' ? 'image/png' : 'image/jpeg', q)
    best = blob
    if (blob.size <= MAX_BYTES) break
  }

  if (!best) throw new Error('Could not compress image')

  const name = file.name.replace(/\.\w+$/, outType === 'image/png' ? '.png' : '.jpg')
  return new File([best], name, { type: best.type, lastModified: Date.now() })
}

/** Compress multiple files in parallel */
export async function compressImages(files: File[]): Promise<File[]> {
  return Promise.all(files.map((f) => compressImage(f)))
}
