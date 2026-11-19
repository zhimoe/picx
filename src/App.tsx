import { Show, createSignal } from 'solid-js'
import type { Settings } from './types'
import {
  DEFAULT_SETTINGS,
  clearSettings,
  isConfigured,
  loadSettings,
  saveSettings,
} from './lib/storage'
import GalleryView from './components/GalleryView'
import SettingsView from './components/SettingsView'
import UploadView from './components/UploadView'
import { ToastHost, toast } from './components/Toast'

type Tab = 'upload' | 'gallery' | 'settings'

export default function App() {
  const [settings, setSettings] = createSignal(loadSettings())
  const [tab, setTab] = createSignal<Tab>(
    isConfigured(settings()) ? 'upload' : 'settings',
  )
  const [galleryVersion, setGalleryVersion] = createSignal(0)

  const configured = () => isConfigured(settings())

  const onSave = (next: Settings) => {
    const normalized = saveSettings(next)
    setSettings(normalized)
    toast('配置已保存', 'success')
    if (isConfigured(normalized)) setTab('upload')
  }

  const onClear = () => {
    clearSettings()
    setSettings({ ...DEFAULT_SETTINGS })
    setTab('settings')
    toast('已清除本地配置', 'info')
  }

  const selectTab = (next: Tab) => {
    if (next !== 'settings' && !configured()) {
      toast('请先完成 GitHub 设置', 'error')
      setTab('settings')
      return
    }
    setTab(next)
  }

  return (
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">
          <span class="brand-mark">P</span>
          <div class="brand-text">
            <strong>PicX</strong>
            <span class="muted small">GitHub 图床 · 单人版</span>
          </div>
        </div>

        <nav class="tabs" aria-label="主导航">
          <button
            type="button"
            classList={{ active: tab() === 'upload' }}
            onClick={() => selectTab('upload')}
          >
            上传
          </button>
          <button
            type="button"
            classList={{ active: tab() === 'gallery' }}
            onClick={() => selectTab('gallery')}
          >
            图库
          </button>
          <button
            type="button"
            classList={{ active: tab() === 'settings' }}
            onClick={() => selectTab('settings')}
          >
            设置
          </button>
        </nav>

        <div class="topbar-meta">
          <Show when={configured()}>
            <span class="muted small">
              {settings().owner}/{settings().repo} @ {settings().branch}
            </span>
          </Show>
        </div>
      </header>

      <main class="main">
        <div class="view" classList={{ active: tab() === 'upload' }}>
          <UploadView
            settings={settings()}
            active={tab() === 'upload'}
            onUploaded={() => setGalleryVersion((value) => value + 1)}
          />
        </div>

        <div class="view" classList={{ active: tab() === 'gallery' }}>
          <GalleryView settings={settings()} version={galleryVersion()} />
        </div>

        <div class="view" classList={{ active: tab() === 'settings' }}>
          <SettingsView initial={settings()} onSave={onSave} onClear={onClear} />
        </div>
      </main>

      <footer class="footer muted small">
        图片保存在你自己的 GitHub 仓库 · AGPL-3.0
      </footer>

      <ToastHost />
    </div>
  )
}
