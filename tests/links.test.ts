import assert from 'node:assert/strict'
import test from 'node:test'
import {
  altFromName,
  encodePath,
  extensionForMime,
  extensionOf,
  fitSize,
  formatBytes,
  isImagePath,
  joinPath,
  jsdelivrUrl,
  markdownFor,
  randomSuffix,
  resolveDir,
  sanitizeBaseName,
  splitFileName,
  uniqueName,
} from '../src/lib/links.ts'

test('splitFileName uses the last dot', () => {
  assert.deepEqual(splitFileName('photo.v2.png'), { base: 'photo.v2', ext: '.png' })
  assert.deepEqual(splitFileName('no-extension'), { base: 'no-extension', ext: '' })
  assert.deepEqual(splitFileName('.hidden'), { base: '.hidden', ext: '' })
})

test('extension and image detection are case insensitive', () => {
  assert.equal(extensionOf('PHOTO.PNG'), '.png')
  assert.equal(isImagePath('blog/PHOTO.PNG'), true)
  assert.equal(isImagePath('blog/readme.txt'), false)
})

test('sanitizeBaseName keeps readable unicode and removes unsafe characters', () => {
  assert.equal(sanitizeBaseName('  My Photo  '), 'My-Photo')
  assert.equal(sanitizeBaseName('你好 world'), '你好-world')
  assert.equal(sanitizeBaseName('a/b?c#d'), 'a-b-c-d')
  assert.equal(sanitizeBaseName('***'), 'image')
})

test('resolveDir supports date placeholders and strips traversal', () => {
  const date = new Date(2026, 10, 17)
  assert.equal(resolveDir('blog/{yyyy}/{mm}/{dd}', date), 'blog/2026/11/17')
  assert.equal(resolveDir('/blog/../2026//', date), 'blog/2026')
  assert.equal(resolveDir('', date), '')
})

test('joinPath and encodePath', () => {
  assert.equal(joinPath('blog/2026', 'photo.webp'), 'blog/2026/photo.webp')
  assert.equal(joinPath('', 'photo.webp'), 'photo.webp')
  assert.equal(encodePath('blog/2026/photo one.webp'), 'blog/2026/photo%20one.webp')
})

test('uniqueName avoids collisions', () => {
  const used = new Set<string>()
  assert.equal(uniqueName('photo', '.webp', used), 'photo.webp')
  assert.equal(uniqueName('photo', '.webp', used), 'photo-2.webp')
  assert.equal(uniqueName('photo', '.webp', used), 'photo-3.webp')
})

test('jsDelivr URL and Markdown encode paths', () => {
  const url = jsdelivrUrl('me', 'images', 'main', 'blog/photo one.webp')
  assert.equal(
    url,
    'https://cdn.jsdelivr.net/gh/me/images@main/blog/photo%20one.webp',
  )
  assert.equal(altFromName('photo.v2.webp'), 'photo.v2')
  assert.equal(markdownFor('a[b]', url), '![a\\[b\\]](https://cdn.jsdelivr.net/gh/me/images@main/blog/photo%20one.webp)')
})

test('formatBytes', () => {
  assert.equal(formatBytes(0), '0 B')
  assert.equal(formatBytes(1024), '1.0 KB')
  assert.equal(formatBytes(1024 * 1024), '1.0 MB')
})

test('fitSize keeps aspect ratio', () => {
  assert.deepEqual(fitSize(4000, 3000, 2000), { width: 2000, height: 1500 })
  assert.deepEqual(fitSize(800, 600, 2000), { width: 800, height: 600 })
  assert.deepEqual(fitSize(4000, 3000, 0), { width: 4000, height: 3000 })
})

test('extensionForMime and randomSuffix', () => {
  assert.equal(extensionForMime('image/webp', 'photo.jpg'), '.webp')
  assert.equal(extensionForMime('application/octet-stream', 'photo.PNG'), '.png')
  const suffix = randomSuffix(8)
  assert.equal(suffix.length, 8)
  assert.match(suffix, /^[a-z0-9]{8}$/)
})
