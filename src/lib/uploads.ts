import { supabase } from './supabaseClient'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic'])
const SIGNATURES: { mime: string; test: (bytes: Uint8Array) => boolean }[] = [
  { mime: 'image/jpeg', test: (b) => b.length > 2 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', test: (b) => b.length > 7 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: 'image/webp', test: (b) => b.length > 11 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 },
  {
    mime: 'image/heic',
    test: (b) =>
      b.length > 11 &&
      b[4] === 0x66 &&
      b[5] === 0x74 &&
      b[6] === 0x79 &&
      b[7] === 0x70 &&
      ((b[8] === 0x68 && b[9] === 0x65 && b[10] === 0x69 && b[11] === 0x63) ||
        (b[8] === 0x6d && b[9] === 0x69 && b[10] === 0x66 && b[11] === 0x31)),
  },
]

function extensionOf(name: string) {
  const base = name.split(/[/\\]/).pop() ?? 'bin'
  const parts = base.toLowerCase().split('.')
  if (parts.length < 2) return ''
  return parts[parts.length - 1] ?? ''
}

async function sniffImage(file: File) {
  const buf = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  const hit = SIGNATURES.find((row) => row.test(buf))
  if (hit) return hit.mime
  return null
}

export async function uploadPublicImage(
  bucket: 'inspection-photos' | 'complaint-photos' | 'incident-photos',
  folder: string,
  file: File,
) {
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    throw new Error('Photo must be an image under 5 MB.')
  }
  const ext = extensionOf(file.name)
  if (!ALLOWED_EXT.has(ext) || ext.includes('/')) {
    throw new Error('Only JPEG, PNG, WebP, or HEIC photos are allowed.')
  }
  const mime = await sniffImage(file)
  if (!mime) {
    throw new Error('File is not a recognized image.')
  }
  const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '')
  if (!safeFolder) throw new Error('Invalid upload folder.')
  const path = `${safeFolder}/${crypto.randomUUID()}.${ext === 'jpeg' ? 'jpg' : ext}`
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: false,
    contentType: mime,
  })
  if (error) throw error
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return { path, url: data.publicUrl }
}
