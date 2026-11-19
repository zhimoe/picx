import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../src/lib/storage.ts'

function mockStorage(context: TestContext, initial: Record<string, string> = {}) {
  const entries = new Map(Object.entries(initial))
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => {
        entries.set(key, value)
      },
      removeItem: (key: string) => {
        entries.delete(key)
      },
    },
  })
  context.after(() => {
    if (previous) {
      Object.defineProperty(globalThis, 'localStorage', previous)
    } else {
      Reflect.deleteProperty(globalThis, 'localStorage')
    }
  })
  return entries
}

test('uses the 0.85 quality default when nothing is saved', (context) => {
  mockStorage(context)
  assert.equal(DEFAULT_SETTINGS.quality, 0.85)
  assert.equal(loadSettings().quality, 0.85)
})

test('migrates the legacy 0.82 default once', (context) => {
  const entries = mockStorage(context, {
    'picx:settings:v1': JSON.stringify({ token: 't', owner: 'o', repo: 'r', branch: 'main', quality: 0.82 }),
  })

  assert.equal(loadSettings().quality, 0.85)
  const migrated = JSON.parse(entries.get('picx:settings:v1') ?? '{}')
  assert.equal(migrated.quality, 0.85)
  assert.equal(migrated.version, 2)

  entries.set('picx:settings:v1', JSON.stringify({ ...migrated, quality: 0.82 }))
  assert.equal(loadSettings().quality, 0.82)
})

test('keeps a legacy quality that was not the old default', (context) => {
  mockStorage(context, {
    'picx:settings:v1': JSON.stringify({ quality: 0.7 }),
  })
  assert.equal(loadSettings().quality, 0.7)
})

test('saveSettings stamps the storage version', (context) => {
  const entries = mockStorage(context)
  const saved = saveSettings({ ...DEFAULT_SETTINGS, quality: 0.9 })
  assert.equal(saved.quality, 0.9)

  const stored = JSON.parse(entries.get('picx:settings:v1') ?? '{}')
  assert.equal(stored.version, 2)
  assert.equal(stored.quality, 0.9)
})
