import assert from 'node:assert/strict'
import test from 'node:test'
import {
  finalExtension,
  isImageFile,
  shouldAttemptConversion,
} from '../src/lib/image.ts'

function file(name: string, type: string): File {
  return new File(['x'], name, { type })
}

test('isImageFile accepts MIME types and known extensions', () => {
  assert.equal(isImageFile(file('photo.jpg', 'image/jpeg')), true)
  assert.equal(isImageFile(file('photo.PNG', '')), true)
  assert.equal(isImageFile(file('notes.txt', 'text/plain')), false)
})

test('conversion skips GIF/SVG and untouched WebP', () => {
  assert.equal(shouldAttemptConversion(file('photo.jpg', 'image/jpeg'), 0), true)
  assert.equal(shouldAttemptConversion(file('anim.gif', 'image/gif'), 0), false)
  assert.equal(shouldAttemptConversion(file('icon.svg', 'image/svg+xml'), 0), false)
  assert.equal(shouldAttemptConversion(file('photo.webp', 'image/webp'), 0), false)
  assert.equal(shouldAttemptConversion(file('photo.webp', ''), 0), false)
  assert.equal(shouldAttemptConversion(file('photo.webp', 'image/webp'), 1600), true)
  assert.equal(shouldAttemptConversion(file('photo.tiff', 'image/tiff'), 0), false)
})

test('finalExtension follows the converted blob type', () => {
  const webp = {
    blob: new Blob(['x'], { type: 'image/webp' }),
    width: 100,
    height: 100,
    converted: true,
  }
  const original = {
    blob: new Blob(['x'], { type: 'image/jpeg' }),
    width: 100,
    height: 100,
    converted: false,
  }

  assert.equal(finalExtension(webp, 'photo.jpg'), '.webp')
  assert.equal(finalExtension(original, 'photo.jpg'), '.jpg')
})
