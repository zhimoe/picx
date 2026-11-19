import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createMemo,
  createResource,
  createSignal,
} from 'solid-js'
import type { RepoImage, Settings } from '../types'
import { copyText } from '../lib/copy'
import { describeGitHubError, listImageTree, purgeJsdelivr } from '../lib/github'
import { formatBytes } from '../lib/links'
import { isConfigured } from '../lib/storage'
import { CopyButton } from './CopyButton'
import Icon from './Icon'
import { toast } from './Toast'

interface Props {
  settings: Settings
  enabled: boolean
  version: number
  onSettings: () => void
  onUpload: () => void
}

const PAGE_SIZE = 120

function ImageCard(props: {
  image: RepoImage
  onPurge: (image: RepoImage) => Promise<void>
}) {
  const [broken, setBroken] = createSignal(false)
  const [purging, setPurging] = createSignal(false)
  const extension = createMemo(() => props.image.name.split('.').pop()?.toUpperCase() || 'IMAGE')

  const purge = async () => {
    setPurging(true)
    try {
      await props.onPurge(props.image)
    } finally {
      setPurging(false)
    }
  }

  return (
    <article class="gallery-card">
      <a
        class="gallery-thumb"
        href={props.image.url}
        target="_blank"
        rel="noreferrer"
        aria-label={`在新标签页打开 ${props.image.name}`}
      >
        <Show
          when={!broken()}
          fallback={<span class="thumb-placeholder"><Icon name="images" size={25} />预览失败</span>}
        >
          <img src={props.image.url} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />
        </Show>
        <span class="format-badge">{extension()}</span>
        <span class="preview-link"><Icon name="external" size={16} /></span>
      </a>
      <div class="gallery-info">
        <h2 title={props.image.name}>{props.image.name}</h2>
        <div>
          <span title={props.image.path}>{props.image.path}</span>
          <span>{formatBytes(props.image.size)}</span>
        </div>
      </div>
      <div class="gallery-actions">
        <CopyButton text={props.image.markdown} label="Markdown" icon="copy" />
        <CopyButton text={props.image.url} label="URL" icon="link" />
        <button
          type="button"
          class="button small ghost icon-button"
          title="刷新 CDN 缓存"
          aria-label={`刷新 ${props.image.name} 的 CDN 缓存`}
          disabled={purging()}
          onClick={purge}
        >
          <Icon name="refresh" size={16} />
        </button>
      </div>
    </article>
  )
}

export default function GalleryView(props: Props) {
  const [search, setSearch] = createSignal('')
  const [visibleCount, setVisibleCount] = createSignal(PAGE_SIZE)
  const configured = () => isConfigured(props.settings)

  const source = createMemo(() => {
    if (!props.enabled || !configured()) return false
    const { token, owner, repo, branch } = props.settings
    return JSON.stringify([token, owner, repo, branch, props.version])
  })

  const [data, { refetch }] = createResource(source, () => {
    const { token, owner, repo, branch } = props.settings
    return listImageTree(token, owner, repo, branch)
  })

  const images = () => (data.error ? undefined : data())?.images ?? []
  const filtered = createMemo(() => {
    const term = search().trim().toLowerCase()
    return term ? images().filter((image) => image.path.toLowerCase().includes(term)) : images()
  })

  const visible = createMemo(() => filtered().slice(0, visibleCount()))

  createEffect(() => {
    search()
    images()
    setVisibleCount(PAGE_SIZE)
  })

  const purge = async (image: RepoImage) => {
    const { owner, repo, branch } = props.settings
    const ok = await purgeJsdelivr(owner, repo, branch, image.path)
    toast(ok ? '已请求刷新 jsDelivr 缓存' : '刷新请求失败，稍后再试', ok ? 'success' : 'error')
  }

  const copyAll = async () => {
    const selection = filtered()
    if (!selection.length) return
    const ok = await copyText(selection.map((image) => image.markdown).join('\n'))
    toast(
      ok ? `已复制 ${selection.length} 条 Markdown` : '复制失败，请重试',
      ok ? 'success' : 'error',
    )
  }

  return (
    <section>
      <header class="page-heading gallery-heading">
        <div>
          <h1 tabindex="-1">图库</h1>
          <p>浏览仓库中的图片，搜索文件或复制链接。</p>
        </div>
        <Show when={configured()}>
          <div class="gallery-source">
            <Icon name="repo" size={16} />
            <span>{props.settings.owner}/{props.settings.repo}</span>
            <span class="gallery-branch">{props.settings.branch}</span>
          </div>
        </Show>
      </header>

      <Show when={configured()} fallback={
        <div class="panel empty-state">
          <span class="empty-icon"><Icon name="repo" size={25} /></span>
          <h2>先配置图片仓库</h2>
          <p>填好 GitHub Token 和仓库信息后，就可以在这里浏览图片。</p>
          <button type="button" class="button primary" onClick={props.onSettings}>
            前往设置 <Icon name="arrow" size={16} />
          </button>
        </div>
      }>
        <div class="panel gallery-toolbar">
          <label class="search-field">
            <Icon name="search" size={17} />
            <input
              type="search"
              value={search()}
              onInput={(event) => setSearch(event.currentTarget.value)}
              placeholder="搜索文件名或路径"
              aria-label="搜索图片"
            />
          </label>
          <div class="gallery-tools">
            <button type="button" class="button" onClick={() => refetch()} disabled={data.loading}>
              <Icon name="refresh" size={16} />刷新
            </button>
            <button
              type="button"
              class="button"
              onClick={copyAll}
              disabled={data.loading || filtered().length === 0}
            >
              <Icon name="copy" size={16} />
              {search().trim() ? '复制结果 Markdown' : '复制全部 Markdown'}
            </button>
          </div>
        </div>

        <Switch>
          <Match when={data.loading}>
            <p class="panel empty-state gallery-loading" role="status">正在读取仓库图片…</p>
          </Match>
          <Match when={data.error}>
            <div class="panel empty-state">
              <span class="empty-icon"><Icon name="info" size={25} /></span>
              <h2>读取图库失败</h2>
              <p role="alert">{describeGitHubError(data.error)}</p>
              <button type="button" class="button" onClick={() => refetch()}>
                <Icon name="refresh" size={16} />重试
              </button>
            </div>
          </Match>
          <Match when={data()}>
            <div class="gallery-summary" role="status">
              {search().trim() ? `找到 ${filtered().length} 张 / 共 ${images().length} 张` : `${images().length} 张图片`}
            </div>

            <Show when={data()?.truncated}>
              <p class="notice notice-warning gallery-notice" role="status">
                GitHub 返回的仓库文件列表达到上限，图库只显示部分图片。
              </p>
            </Show>

            <Show when={visible().length > 0} fallback={
              <div class="panel empty-state">
                <span class="empty-icon"><Icon name={search().trim() ? 'search' : 'images'} size={25} /></span>
                <Show when={search().trim()} fallback={
                  <>
                    <h2>此分支还没有图片</h2>
                    <p>上传的图片会出现在这里。</p>
                    <button type="button" class="button primary" onClick={props.onUpload}>
                      <Icon name="upload" size={16} />上传图片
                    </button>
                  </>
                }>
                  <h2>没有匹配的图片</h2>
                  <p>试试其他文件名或路径。</p>
                  <button type="button" class="button" onClick={() => setSearch('')}>清除搜索</button>
                </Show>
              </div>
            }>
              <div class="gallery-grid">
                <For each={visible()}>
                  {(image) => <ImageCard image={image} onPurge={purge} />}
                </For>
              </div>
            </Show>

            <Show when={filtered().length > visible().length}>
              <div class="gallery-more">
                <button
                  type="button"
                  class="button"
                  onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                >
                  显示更多（还有 {filtered().length - visible().length} 张）
                </button>
              </div>
            </Show>
          </Match>
        </Switch>
      </Show>
    </section>
  )
}
