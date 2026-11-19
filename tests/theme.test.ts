import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import { loadTheme, resolveTheme, saveTheme, themes } from '../src/lib/theme.ts'

function mockStorage(context: TestContext, descriptor: PropertyDescriptor) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, ...descriptor })
  context.after(() => {
    if (previous) {
      Object.defineProperty(globalThis, 'localStorage', previous)
    } else {
      Reflect.deleteProperty(globalThis, 'localStorage')
    }
  })
}

test('remembers each of the three theme choices', (context) => {
  const entries = new Map<string, string>()
  mockStorage(context, {
    value: {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => entries.set(key, value),
    },
  })

  assert.equal(loadTheme(), undefined)
  for (const theme of themes) {
    saveTheme(theme)
    assert.equal(entries.get('picx:theme:v1'), theme)
    assert.equal(loadTheme(), theme)
  }

  entries.set('picx:theme:v1', 'unknown')
  assert.equal(loadTheme(), undefined)
})

test('defaults to the terracotta theme', () => {
  assert.equal(resolveTheme(undefined), 'terracotta')
  assert.equal(resolveTheme('dark'), 'dark')
  assert.equal(resolveTheme('light'), 'light')
})

test('handles browser storage being blocked', (context) => {
  mockStorage(context, {
    get() {
      throw new Error('Storage unavailable')
    },
  })

  assert.equal(loadTheme(), undefined)
  assert.doesNotThrow(() => saveTheme('dark'))
})
