import { extensionForMime, extensionOf, fitSize, IMAGE_EXTENSIONS } from './links.ts'

export const INPUT_LIMIT = 30 * 1024 * 1024
export const OUTPUT_LIMIT = 20 * 1024 * 1024

const CONVERTIBLE_MIMES = new Set(['image/jpeg', 'image/png', 'image/bmp', 'image/avif', 'image/webp'])
const CONVERTIBLE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'bmp', 'avif', 'webp'])

export interface ConvertOptions {
  quality: number
  maxWidth: number
}

export interface ConvertResult {
  blob: Blob
  width: number
  height: number
  converted: boolean
  note?: string
}

export function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  const extension = extensionOf(file.name).slice(1)
  return IMAGE_EXTENSIONS.has(extension)
}

export function shouldAttemptConversion(file: File, maxWidth: number): boolean {
  const extension = extensionOf(file.name).slice(1)
  if (extension === 'gif' || extension === 'svg') return false
  if ((file.type === 'image/webp' || extension === 'webp') && !maxWidth) return false
  return CONVERTIBLE_MIMES.has(file.type) || CONVERTIBLE_EXTENSIONS.has(extension)
}

export function skipNote(file: File, maxWidth: number): string {
  const extension = extensionOf(file.name).slice(1)
  if (extension === 'gif') return 'GIF 保持原格式，避免丢失动画'
  if (extension === 'svg') return 'SVG 保持原格式，保留矢量'
  if ((file.type === 'image/webp' || extension === 'webp') && !maxWidth) {
    return '已是 WebP，原样上传'
  }
  return '该格式不做转换，原样上传'
}

interface DecodedImage {
  image: CanvasImageSource
  width: number
  height: number
  dispose: () => void
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return {
        image: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      }
    } catch {
      // Fall back to an <img> element below.
    }
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('无法解码图片'))
      element.src = objectUrl
    })

    return {
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      dispose: () => URL.revokeObjectURL(objectUrl),
    }
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }
}

function createCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

async function canvasToWebp(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  quality: number,
): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: 'image/webp', quality })
  }

  return new Promise<Blob>((resolve, reject) => {
    ;(canvas as HTMLCanvasElement).toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('WebP 编码失败'))),
      'image/webp',
      quality,
    )
  })
}

export async function convertToWebp(file: File, options: ConvertOptions): Promise<ConvertResult> {
  const maxWidth = Math.max(0, Math.round(options.maxWidth))
  const quality = Math.min(1, Math.max(0.1, options.quality))

  if (!shouldAttemptConversion(file, maxWidth)) {
    return {
      blob: file,
      width: 0,
      height: 0,
      converted: false,
      note: skipNote(file, maxWidth),
    }
  }

  let decoded: DecodedImage | undefined

  try {
    decoded = await decodeImage(file)
    const size = fitSize(decoded.width, decoded.height, maxWidth)
    const canvas = createCanvas(size.width, size.height)
    const context = canvas.getContext('2d')

    if (!context) throw new Error('无法创建 Canvas 上下文')

    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(decoded.image, 0, 0, size.width, size.height)

    const blob = await canvasToWebp(canvas, quality)
    if (blob.type !== 'image/webp') {
      return {
        blob: file,
        width: decoded.width,
        height: decoded.height,
        converted: false,
        note: '当前浏览器不支持 WebP 编码，已保留原格式',
      }
    }

    return {
      blob,
      width: size.width,
      height: size.height,
      converted: true,
    }
  } catch {
    return {
      blob: file,
      width: decoded?.width ?? 0,
      height: decoded?.height ?? 0,
      converted: false,
      note: '图片转换失败，已保留原格式',
    }
  } finally {
    decoded?.dispose()
  }
}

export function finalExtension(result: ConvertResult, sourceName: string): string {
  return result.converted ? '.webp' : extensionForMime(result.blob.type, sourceName)
}
