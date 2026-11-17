import type { Settings } from '../types'

const STORAGE_KEY = 'picx-mini:settings:v1'

export const DEFAULT_SETTINGS: Settings = {
  token: '',
  owner: '',
  repo: '',
  branch: 'main',
  dir: '',
  quality: 0.82,
  maxWidth: 0,
  randomSuffix: false,
}

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

export function normalizeSettings(value: Partial<Settings> | null | undefined): Settings {
  const input = value && typeof value === 'object' ? value : {}
  const branch = typeof input.branch === 'string' ? input.branch.trim() : ''

  return {
    token: typeof input.token === 'string' ? input.token.trim() : '',
    owner: typeof input.owner === 'string' ? input.owner.trim() : '',
    repo: typeof input.repo === 'string' ? input.repo.trim() : '',
    branch: branch || DEFAULT_SETTINGS.branch,
    dir:
      typeof input.dir === 'string'
        ? input.dir.trim().replace(/^\/+|\/+$/g, '')
        : DEFAULT_SETTINGS.dir,
    quality: clampNumber(
      Number(input.quality),
      0.5,
      1,
      DEFAULT_SETTINGS.quality,
    ),
    maxWidth: Math.max(0, Math.round(Number(input.maxWidth) || 0)),
    randomSuffix: Boolean(input.randomSuffix),
  }
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return normalizeSettings(JSON.parse(raw) as Partial<Settings>)
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: Settings): Settings {
  const normalized = normalizeSettings(settings)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
  } catch {
    // Storage can be unavailable in private modes; the in-memory settings still work.
  }
  return normalized
}

export function clearSettings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore storage failures.
  }
}

export function isConfigured(settings: Settings): boolean {
  return Boolean(settings.token && settings.owner && settings.repo && settings.branch)
}
