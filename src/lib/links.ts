export const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'avif',
  'svg',
  'bmp',
  'ico',
  'tif',
  'tiff',
  'heic',
  'heif',
])

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/svg+xml': '.svg',
  'image/bmp': '.bmp',
  'image/x-icon': '.ico',
  'image/vnd.microsoft.icon': '.ico',
  'image/tiff': '.tiff',
  'image/heic': '.heic',
  'image/heif': '.heif',
}

export function extensionOf(name: string): string {
  const index = name.lastIndexOf('.')
  return index > 0 ? name.slice(index).toLowerCase() : ''
}

export function splitFileName(name: string): { base: string; ext: string } {
  const index = name.lastIndexOf('.')
  if (index <= 0) return { base: name, ext: '' }
  return { base: name.slice(0, index), ext: name.slice(index) }
}

export function isImagePath(path: string): boolean {
  const extension = extensionOf(path)
  return extension.length > 1 && IMAGE_EXTENSIONS.has(extension.slice(1))
}

export function extensionForMime(mime: string, fallbackName = ''): string {
  return MIME_EXTENSIONS[mime] ?? extensionOf(fallbackName) ?? ''
}

export function sanitizeBaseName(name: string): string {
  const cleaned = name
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 80)

  return cleaned || 'image'
}

export function resolveDir(dir: string, date = new Date()): string {
  const withDate = dir
    .replaceAll('{yyyy}', String(date.getFullYear()))
    .replaceAll('{mm}', String(date.getMonth() + 1).padStart(2, '0'))
    .replaceAll('{dd}', String(date.getDate()).padStart(2, '0'))

  const segments = withDate
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .map((segment) => sanitizeBaseName(segment))
    .filter(Boolean)

  return segments.join('/')
}

export function joinPath(dir: string, name: string): string {
  return dir ? `${dir}/${name}` : name
}

export function encodePath(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

export function uniqueName(base: string, ext: string, used: Set<string>): string {
  const safeBase = sanitizeBaseName(base)
  let candidate = `${safeBase}${ext}`
  let counter = 2

  while (used.has(candidate)) {
    candidate = `${safeBase}-${counter}${ext}`
    counter += 1
  }

  used.add(candidate)
  return candidate
}

export function randomSuffix(length = 6): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = new Uint8Array(length)

  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let index = 0; index < length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }

  let result = ''
  for (const byte of bytes) result += alphabet[byte % alphabet.length]
  return result
}

export function jsdelivrUrl(owner: string, repo: string, branch: string, path: string): string {
  return `https://cdn.jsdelivr.net/gh/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}@${encodeURIComponent(branch)}/${encodePath(path)}`
}

export function purgeUrl(owner: string, repo: string, branch: string, path: string): string {
  return `https://purge.jsdelivr.net/gh/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}@${encodeURIComponent(branch)}/${encodePath(path)}`
}

export function altFromName(name: string): string {
  return splitFileName(name).base || name
}

export function escapeAlt(text: string): string {
  return text.replaceAll('\\', '\\\\').replaceAll('[', '\\[').replaceAll(']', '\\]')
}

export function markdownFor(alt: string, url: string): string {
  return `![${escapeAlt(alt)}](${url})`
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function fitSize(
  width: number,
  height: number,
  maxWidth: number,
): { width: number; height: number } {
  if (!maxWidth || width <= maxWidth) return { width, height }
  const scale = maxWidth / width
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}
