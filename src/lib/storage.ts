import type { Settings } from '../types'

const STORAGE_KEY = 'picx:settings:v1'
const STORAGE_VERSION = 2
// Settings saved before version 2 kept the old default quality.
const LEGACY_DEFAULT_QUALITY = 0.82

export const DEFAULT_SETTINGS: Settings = {
  token: '',
  owner: 'zhimoe',
  repo: 'picx-images-hosting',
  branch: 'master',
  dir: 'pic',
  quality: 0.85,
  maxWidth: 0,
  randomSuffix: false,
}

type StoredSettings = Partial<Settings> & { version?: number }

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
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
    const parsed: unknown = JSON.parse(raw)
    const stored: StoredSettings = isRecord(parsed) ? parsed : {}
    if (stored.version === undefined && Number(stored.quality) === LEGACY_DEFAULT_QUALITY) {
      stored.quality = DEFAULT_SETTINGS.quality
    }
    const normalized = normalizeSettings(stored)
    if (stored.version === undefined) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...normalized, version: STORAGE_VERSION }))
      } catch {
        // Keep using the migrated settings even when the rewrite is blocked.
      }
    }
    return normalized
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: Settings): Settings {
  const normalized = normalizeSettings(settings)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...normalized, version: STORAGE_VERSION }))
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
