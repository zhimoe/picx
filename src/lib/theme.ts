export const themes = ['terracotta', 'dark', 'light'] as const
export type Theme = (typeof themes)[number]

const STORAGE_KEY = 'picx:theme:v1'

export function isTheme(value: string | null): value is Theme {
  return themes.some((theme) => theme === value)
}

export function loadTheme(): Theme | undefined {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return isTheme(value) ? value : undefined
  } catch {
    return undefined
  }
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // The active theme still applies when browser storage is unavailable.
  }
}
