import {
  For,
  Show,
  createEffect,
  createMemo,
  createResource,
  createSignal,
} from 'solid-js'
import type { RepoImage, Settings } from '../types'
import { copyText } from '../lib/copy'
import { describeGitHubError, listImageTree, purgeJsdelivr } from '../lib/github'
import { formatBytes } from '../lib/links'
import { CopyButton } from './CopyButton'
import { toast } from './Toast'

interface Props {
  settings: Settings
  version: number
}

const PAGE_SIZE = 120

function ImageCard(props: {
  image: RepoImage
  onPurge: (image: RepoImage) => void
}) {
  const [broken, setBroken] = createSignal(false)
  const extension = createMemo(() => {
    const index = props.image.name.lastIndexOf('.')
    return index > 0 ? props.image.name.slice(index + 1).toUpperCase() : 'IMAGE'
  })

  return (
    <article class="gallery-card">
      <div class="gallery-thumb">
        <Show
          when={!broken()}
          fallback={<div class="thumb-placeholder">预览失败</div>}
        >
          <img
            src={props.image.url}
            alt={props.image.name}
            loading="lazy"
            decoding="async"
            onError={() => setBroken(true)}
          />
        </Show>
        <span class="format-badge">{extension()}</span>
      </div>
      <div class="gallery-info">
        <strong title={props.image.path}>{props.image.name}</strong>
        <span class="muted small" title={props.image.path}>
          {props.image.path}
        </span>
        <span class="muted small">{formatBytes(props.image.size)}</span>
      </div>
      <div class="gallery-actions">
        <CopyButton text={props.image.markdown} label="复制 Markdown" />
        <CopyButton text={props.image.url} label="复制 URL" />
        <button
          type="button"
          class="button small ghost"
          onClick={() => props.onPurge(props.image)}
        >
          刷新 CDN
        </button>
      </div>
    </article>
  )
}

export default function GalleryView(props: Props) {
  const [search, setSearch] = createSignal('')
  const [visibleCount, setVisibleCount] = createSignal(PAGE_SIZE)

  const sourceKey = createMemo(() => {
    const settings = props.settings
    if (!settings.token || !settings.owner || !settings.repo || !settings.branch) {
      return null
    }
    return `${settings.token}|${settings.owner}|${settings.repo}|${settings.branch}|${props.version}`
  })

  const [data, { refetch }] = createResource(sourceKey, async () => {
    const settings = props.settings
    return listImageTree(settings.token, settings.owner, settings.repo, settings.branch)
  })

  const filtered = createMemo(() => {
    const images = data()?.images ?? []
    const term = search().trim().toLowerCase()
    if (!term) return images
    return images.filter((image) => image.path.toLowerCase().includes(term))
  })

  const visible = createMemo(() => filtered().slice(0, visibleCount()))

  createEffect(() => {
    search()
    data()
    setVisibleCount(PAGE_SIZE)
  })

  const purge = async (image: RepoImage) => {
    const settings = props.settings
    const ok = await purgeJsdelivr(
      settings.owner,
      settings.repo,
      settings.branch,
      image.path,
    )
    toast(ok ? '已请求刷新 jsDelivr 缓存' : '刷新请求失败，稍后再试', ok ? 'success' : 'error')
  }

  const copyAll = async () => {
    const text = filtered()
      .map((image) => image.markdown)
      .join('\n')
    if (!text) {
      toast('当前没有可复制的图片', 'info')
      return
    }
    const ok = await copyText(text)
    toast(
      ok ? `已复制 ${filtered().length} 条 Markdown` : '复制失败，请手动选择',
      ok ? 'success' : 'error',
    )
  }

  return (
    <section class="panel gallery-panel">
      <div class="panel-heading">
        <div>
          <h2>图库</h2>
          <p class="muted">
            当前仓库 {props.settings.owner}/{props.settings.repo} @ {props.settings.branch}
            <Show when={data()}>
              {' · '}
              {filtered().length} 张图片
            </Show>
          </p>
        </div>
        <div class="gallery-toolbar">
          <input
            type="search"
            value={search()}
            onInput={(event) => setSearch(event.currentTarget.value)}
            placeholder="搜索文件名或路径…"
            aria-label="搜索图片"
          />
          <button type="button" class="button" onClick={() => refetch()} disabled={data.loading}>
            刷新
          </button>
          <button
            type="button"
            class="button"
            onClick={copyAll}
            disabled={filtered().length === 0}
          >
            复制全部 Markdown
          </button>
        </div>
      </div>

      <Show when={data()?.truncated}>
        <p class="notice notice-warning">
          仓库文件太多，GitHub 返回的 tree 被截断，图库只显示了部分图片。
        </p>
      </Show>

      <Show when={data.loading}>
        <div class="gallery-loading">正在读取仓库图片…</div>
      </Show>

      <Show when={data.error}>
        <div class="notice notice-error">
          <p>{describeGitHubError(data.error)}</p>
          <button type="button" class="button" onClick={() => refetch()}>
            重试
          </button>
        </div>
      </Show>

      <Show when={!data.loading && !data.error && filtered().length === 0}>
        <div class="empty-state">
          <p>{search() ? '没有匹配的图片。' : '这个仓库/分支里还没有图片。'}</p>
          <p class="muted small">
            上传后会自动出现在这里；旧 PicX 图片也会被列出，只要它们在当前分支中。
          </p>
        </div>
      </Show>

      <Show when={visible().length > 0}>
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
    </section>
  )
}
