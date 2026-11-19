import { For, createEffect, createSignal } from 'solid-js'
import type { Settings } from './types'
import {
  DEFAULT_SETTINGS,
  clearSettings,
  isConfigured,
  loadSettings,
  saveSettings,
} from './lib/storage'
import { isTheme, loadTheme, resolveTheme, saveTheme, themes, type Theme } from './lib/theme'
import GalleryView from './components/GalleryView'
import Icon, { type IconName } from './components/Icon'
import SettingsView from './components/SettingsView'
import UploadView from './components/UploadView'
import { ToastHost, toast } from './components/Toast'

type Tab = 'upload' | 'gallery' | 'settings'

const navigation: { tab: Tab; label: string; icon: IconName }[] = [
  { tab: 'upload', label: '上传', icon: 'upload' },
  { tab: 'gallery', label: '图库', icon: 'images' },
  { tab: 'settings', label: '设置', icon: 'settings' },
]

const themeLabels: Record<Theme, string> = {
  terracotta: '陶土红',
  dark: '商务深色',
  light: '商务浅色',
}

const themeIcons: Record<Theme, string> = {
  light: '/favicon-light.svg',
  dark: '/favicon-dark.svg',
  terracotta: '/favicon.svg',
}

export default function App() {
  const [preferredTheme, setPreferredTheme] = createSignal(loadTheme())
  const theme = () => resolveTheme(preferredTheme())

  createEffect(() => {
    const active = theme()
    const root = document.documentElement
    root.dataset.theme = active
    const background = getComputedStyle(root).getPropertyValue('--bg').trim()
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background)
    document.querySelector('link[rel="icon"]')?.setAttribute('href', themeIcons[active])
  })

  const [settings, setSettings] = createSignal(loadSettings())
  const configured = () => isConfigured(settings())
  const [tab, setTab] = createSignal<Tab>(configured() ? 'upload' : 'settings')
  const [galleryOpened, setGalleryOpened] = createSignal(false)
  const [galleryVersion, setGalleryVersion] = createSignal(0)
  let main: HTMLElement | undefined

  const selectTab = (next: Tab) => {
    if (tab() === next) return
    if (next === 'gallery') setGalleryOpened(true)
    setTab(next)
    window.scrollTo(0, 0)
    main?.querySelector<HTMLElement>('.view:not([hidden]) h1')?.focus({ preventScroll: true })
  }

  const onSave = (next: Settings) => {
    const firstSave = !configured()
    setSettings(saveSettings(next))
    if (firstSave) {
      selectTab('upload')
      toast('配置已保存', 'success')
    }
  }

  const onClear = () => {
    clearSettings()
    setSettings({ ...DEFAULT_SETTINGS })
  }

  return (
    <div class="app-shell" classList={{ 'settings-open': tab() === 'settings' }}>
      <aside class="sidebar">
        <div class="brand">
          <img src={themeIcons[theme()]} class="brand-mark" alt="" />
          <div class="brand-text">
            <strong>PicX</strong>
            <span>GitHub 图床</span>
          </div>
        </div>

        <nav class="navigation" aria-label="主导航">
          <For each={navigation}>
            {(item) => (
              <button
                type="button"
                aria-current={tab() === item.tab ? 'page' : undefined}
                onClick={() => selectTab(item.tab)}
              >
                <Icon name={item.icon} />
                {item.label}
              </button>
            )}
          </For>
        </nav>

        <div class="sidebar-foot">
          <div class="theme-picker">
            <Icon name="appearance" size={17} />
            <select
              aria-label="外观主题"
              onChange={(event) => {
                const next = event.currentTarget.value
                if (!isTheme(next)) return
                setPreferredTheme(next)
                saveTheme(next)
              }}
            >
              <For each={themes}>
                {(option) => <option value={option} selected={theme() === option}>{themeLabels[option]}</option>}
              </For>
            </select>
            <Icon name="chevron" size={15} />
          </div>
        </div>
      </aside>

      <main class="main" ref={main}>
        <div class="view" hidden={tab() !== 'upload'}>
          <UploadView
            settings={settings()}
            active={tab() === 'upload'}
            onSettings={() => selectTab('settings')}
            onUploaded={() => setGalleryVersion((value) => value + 1)}
          />
        </div>

        <div class="view" hidden={tab() !== 'gallery'}>
          <GalleryView
            settings={settings()}
            enabled={galleryOpened()}
            version={galleryVersion()}
            onSettings={() => selectTab('settings')}
            onUpload={() => selectTab('upload')}
          />
        </div>

        <div class="view" hidden={tab() !== 'settings'}>
          <SettingsView initial={settings()} onSave={onSave} onClear={onClear} />
        </div>

        <footer class="footer">
          <span>图片存储于你的 GitHub 仓库</span>
          <span>AGPL-3.0</span>
        </footer>
      </main>

      <ToastHost />
    </div>
  )
}
