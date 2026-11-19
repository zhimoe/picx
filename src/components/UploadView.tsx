import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
} from 'solid-js'
import type { Settings, UploadItem, UploadStatus } from '../types'
import { copyText } from '../lib/copy'
import { isConfigured } from '../lib/storage'
import {
  describeGitHubError,
  isConflictError,
  isDuplicateError,
  purgeJsdelivr,
  putContent,
} from '../lib/github'
import {
  INPUT_LIMIT,
  OUTPUT_LIMIT,
  convertToWebp,
  finalExtension,
  isImageFile,
} from '../lib/image'
import {
  altFromName,
  formatBytes,
  joinPath,
  jsdelivrUrl,
  markdownFor,
  randomSuffix,
  resolveDir,
  sanitizeBaseName,
  splitFileName,
  uniqueName,
} from '../lib/links'
import { toast } from './Toast'
import { CopyButton } from './CopyButton'
import Icon from './Icon'

interface Props {
  settings: Settings
  active: boolean
  onSettings: () => void
  onUploaded: () => void
}

function newId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function statusText(status: UploadStatus): string {
  switch (status) {
    case 'queued':
      return '待上传'
    case 'converting':
      return '转换中'
    case 'uploading':
      return '上传中'
    case 'done':
      return '已完成'
    case 'error':
      return '失败'
  }
}

export default function UploadView(props: Props) {
  const [items, setItems] = createSignal<UploadItem[]>([])
  const [uploading, setUploading] = createSignal(false)
  const [quality, setQuality] = createSignal(props.settings.quality)
  const [maxWidth, setMaxWidth] = createSignal(props.settings.maxWidth)
  const [dragDepth, setDragDepth] = createSignal(0)
  const [fileErrors, setFileErrors] = createSignal<string[]>([])
  let fileInput: HTMLInputElement | undefined

  const dragging = () => dragDepth() > 0
  const configured = () => isConfigured(props.settings)
  const targetDir = createMemo(() => resolveDir(props.settings.dir))
  const queueCounts = createMemo(() => {
    const counts: Record<UploadStatus, number> = {
      queued: 0,
      converting: 0,
      uploading: 0,
      done: 0,
      error: 0,
    }
    for (const item of items()) counts[item.status] += 1
    return counts
  })
  const pendingCount = () => queueCounts().queued + queueCounts().error
  const doneItems = createMemo(() => items().filter((item) => item.status === 'done'))
  const queueAnnouncement = () => {
    const counts = queueCounts()
    const statuses: UploadStatus[] = ['queued', 'converting', 'uploading', 'done', 'error']
    const summary = statuses
      .filter((status) => counts[status] > 0)
      .map((status) => `${statusText(status)} ${counts[status]} 张`)
      .join('，')
    return summary ? `上传队列：${summary}` : '上传队列为空'
  }

  createEffect(() => {
    setQuality(props.settings.quality)
    setMaxWidth(props.settings.maxWidth)
  })

  const updateItem = (id: string, patch: Partial<UploadItem>) => {
    setItems((list) =>
      list.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    )
  }

  const addFiles = (files: File[]) => {
    if (!files.length) return

    const accepted: UploadItem[] = []
    const errors: string[] = []
    for (const file of files) {
      if (!isImageFile(file)) {
        errors.push(`${file.name} 不是图片，已跳过。`)
        continue
      }
      if (file.size > INPUT_LIMIT) {
        errors.push(`${file.name} 超过 30 MB，已跳过。`)
        continue
      }

      accepted.push({
        id: newId(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: 'queued',
        converted: false,
      })
    }

    setFileErrors(errors)
    if (accepted.length) setItems((list) => [...list, ...accepted])
  }

  const removeItem = (id: string) => {
    const item = items().find((entry) => entry.id === id)
    if (!item || item.status === 'uploading' || item.status === 'converting') return
    URL.revokeObjectURL(item.previewUrl)
    setItems((list) => list.filter((entry) => entry.id !== id))
  }

  const clearItems = () => {
    if (uploading()) return
    for (const item of items()) URL.revokeObjectURL(item.previewUrl)
    setItems([])
  }

  const clearDone = () => {
    if (uploading()) return
    for (const item of doneItems()) URL.revokeObjectURL(item.previewUrl)
    setItems((list) => list.filter((item) => item.status !== 'done'))
  }

  const copyAllDone = async () => {
    const text = doneItems()
      .map((item) => item.markdown)
      .filter((value): value is string => Boolean(value))
      .join('\n')
    if (!text) {
      toast('还没有已完成的图片', 'info')
      return
    }
    const ok = await copyText(text)
    toast(
      ok ? `已复制 ${doneItems().length} 条 Markdown` : '复制失败，请手动选择',
      ok ? 'success' : 'error',
    )
  }

  const purgeImage = async (item: UploadItem) => {
    if (!item.path) return
    const ok = await purgeJsdelivr(
      props.settings.owner,
      props.settings.repo,
      props.settings.branch,
      item.path,
    )
    toast(ok ? '已请求刷新 jsDelivr 缓存' : '刷新请求失败，稍后再试', ok ? 'success' : 'error')
  }

  const uploadOne = async (
    item: UploadItem,
    settings: Settings,
    used: Set<string>,
    dir: string,
    qualityValue: number,
    maxWidthValue: number,
    randomSuffixEnabled: boolean,
  ): Promise<boolean> => {
    updateItem(item.id, { status: 'converting', error: undefined })

    const conversion = await convertToWebp(item.file, {
      quality: qualityValue,
      maxWidth: maxWidthValue,
    })

    if (conversion.blob.size > OUTPUT_LIMIT) {
      updateItem(item.id, {
        status: 'error',
        error: `转换后仍超过 ${formatBytes(OUTPUT_LIMIT)}，jsDelivr 可能无法提供该文件。`,
      })
      return false
    }

    const { base } = splitFileName(item.file.name)
    const baseName =
      sanitizeBaseName(base) + (randomSuffixEnabled ? `-${randomSuffix()}` : '')
    const ext = finalExtension(conversion, item.file.name)

    updateItem(item.id, {
      status: 'uploading',
      converted: conversion.converted,
      note: conversion.note,
      outputSize: conversion.blob.size,
      outputType: conversion.blob.type,
      width: conversion.width,
      height: conversion.height,
    })

    let name = uniqueName(baseName, ext, used)

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const path = joinPath(dir, name)

      try {
        const result = await putContent(
          settings.token,
          settings.owner,
          settings.repo,
          settings.branch,
          path,
          conversion.blob,
        )
        const url = jsdelivrUrl(
          settings.owner,
          settings.repo,
          settings.branch,
          result.path,
        )
        updateItem(item.id, {
          status: 'done',
          outputName: name,
          path: result.path,
          url,
          markdown: markdownFor(altFromName(name), url),
          error: undefined,
        })
        return true
      } catch (error) {
        if (attempt < 4) {
          if (isDuplicateError(error)) {
            name = uniqueName(baseName, ext, used)
            continue
          }
          if (isConflictError(error)) {
            await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** attempt))
            continue
          }
        }

        updateItem(item.id, {
          status: 'error',
          error: describeGitHubError(error),
        })
        return false
      }
    }

    updateItem(item.id, {
      status: 'error',
      error: '文件名冲突，请重试。',
    })
    return false
  }

  const uploadAll = async () => {
    if (uploading()) return

    if (!configured()) {
      toast('请先在设置中完成 GitHub 配置', 'error')
      return
    }

    const queue = items().filter(
      (item) => item.status === 'queued' || item.status === 'error',
    )
    if (!queue.length) {
      toast('没有待上传的图片', 'info')
      return
    }

    const settings = { ...props.settings }
    const qualityValue = quality()
    const maxWidthValue = maxWidth()
    const randomSuffixEnabled = settings.randomSuffix
    const dir = resolveDir(settings.dir)
    const used = new Set<string>()
    let cursor = 0
    let success = 0

    setUploading(true)

    const worker = async () => {
      while (true) {
        const index = cursor
        cursor += 1
        if (index >= queue.length) return
        if (!items().some((entry) => entry.id === queue[index].id)) continue

        try {
          const ok = await uploadOne(
            queue[index],
            settings,
            used,
            dir,
            qualityValue,
            maxWidthValue,
            randomSuffixEnabled,
          )
          if (ok) success += 1
        } catch (error) {
          updateItem(queue[index].id, {
            status: 'error',
            error: describeGitHubError(error),
          })
        }
      }
    }

    try {
      await Promise.all(
        Array.from({ length: Math.min(3, queue.length) }, () => worker()),
      )
    } finally {
      setUploading(false)
      if (success > 0) {
        toast(`已上传 ${success} 张图片`, 'success')
        props.onUploaded()
      } else {
        toast('上传完成，但没有成功的图片，请查看错误信息', 'error')
      }
    }
  }

  createEffect(() => {
    if (!props.active) return

    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? [])
      if (!files.length) return
      event.preventDefault()
      addFiles(files)
    }

    window.addEventListener('paste', onPaste)
    onCleanup(() => window.removeEventListener('paste', onPaste))
  })

  onCleanup(() => {
    for (const item of items()) URL.revokeObjectURL(item.previewUrl)
  })

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragDepth(0)
    addFiles(Array.from(event.dataTransfer?.files ?? []))
  }

  return (
    <section>
      <header class="page-heading">
        <h1 tabindex="-1">上传图片</h1>
        <p>将图片上传到 GitHub，获取可直接使用的链接和 Markdown。</p>
      </header>

      <div class="workspace-grid upload-layout">
        <section class="panel upload-panel" aria-label="选择图片">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => {
              addFiles(Array.from(event.currentTarget.files ?? []))
              event.currentTarget.value = ''
            }}
          />
          <button
            type="button"
            class="dropzone"
            classList={{ dragging: dragging() }}
            aria-label="选择图片"
            aria-describedby="dropzone-hint"
            onClick={() => fileInput?.click()}
            onDragEnter={(event) => {
              event.preventDefault()
              setDragDepth((depth) => depth + 1)
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              event.preventDefault()
              setDragDepth((depth) => Math.max(0, depth - 1))
            }}
            onDrop={onDrop}
          >
            <span class="drop-art" aria-hidden="true">
              <span class="drop-art-back" />
              <span class="drop-art-front"><Icon name="images" size={36} /></span>
              <span class="drop-art-action"><Icon name="upload" size={17} /></span>
            </span>
            <span class="dropzone-title">{dragging() ? '松开鼠标添加图片' : '拖拽图片到这里'}</span>
            <span class="button primary dropzone-action">选择图片</span>
            <span id="dropzone-hint" class="dropzone-hint">
              也可以按 <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>V</kbd> 粘贴截图
            </span>
          </button>

          <div class="dropzone-meta">
            <span>JPG、PNG、WebP、AVIF、GIF、SVG 等</span>
            <span>单张最多 30 MB</span>
          </div>
          <Show when={fileErrors().length > 0}>
            <ul class="notice notice-error file-errors" role="alert">
              <For each={fileErrors()}>{(error) => <li>{error}</li>}</For>
            </ul>
          </Show>
        </section>

        <aside class="panel-stack upload-context">
          <section class="panel context-panel" aria-labelledby="target-heading">
            <div class="section-heading">
              <span class="section-icon"><Icon name="repo" /></span>
              <h2 id="target-heading">上传目标</h2>
            </div>
            <Show
              when={configured()}
              fallback={
                <p>配置 GitHub 仓库和 Token 后，即可上传队列中的图片。</p>
              }
            >
              <strong class="target-repo">{props.settings.owner}/{props.settings.repo}</strong>
              <div class="target-meta">
                <span title="分支"><Icon name="branch" size={15} />{props.settings.branch}</span>
                <span title="目录"><Icon name="folder" size={15} />{targetDir() ? `${targetDir()}/` : '仓库根目录'}</span>
              </div>
            </Show>
            <button type="button" class="text-button" onClick={props.onSettings}>
              {configured() ? '修改配置' : '前往设置'} <Icon name="arrow" size={15} />
            </button>
          </section>

          <section class="panel context-panel upload-parameters" aria-labelledby="parameters-heading">
            <div class="section-heading">
              <span class="section-icon"><Icon name="settings" /></span>
              <h2 id="parameters-heading">本次上传参数</h2>
            </div>
            <label class="field">
              <span class="field-title">WebP 质量 <strong>{quality().toFixed(2)}</strong></span>
              <input
                type="range"
                min="0.5"
                max="1"
                step="0.01"
                value={quality()}
                disabled={uploading()}
                onInput={(event) => setQuality(Number(event.currentTarget.value))}
              />
            </label>
            <label class="field">
              <span>最大宽度（px）</span>
              <input
                type="number"
                min="0"
                step="1"
                value={maxWidth()}
                disabled={uploading()}
                onInput={(event) => setMaxWidth(Math.max(0, Math.round(Number(event.currentTarget.value) || 0)))}
                aria-describedby="upload-width-hint"
              />
              <small id="upload-width-hint" class="hint">填 0 保留原始尺寸。</small>
            </label>
          </section>
        </aside>

        <section class="panel queue-panel" aria-labelledby="queue-heading">
          <div class="sr-only" role="status">{queueAnnouncement()}</div>
          <div class="queue-heading">
            <div class="section-heading">
              <span class="section-icon"><Icon name="inbox" /></span>
              <h2 id="queue-heading">上传队列</h2>
              <Show when={items().length > 0}>
                <span class="queue-count">{items().length} 张</span>
              </Show>
            </div>
            <Show when={items().length > 0}>
              <div class="queue-controls">
                <div class="queue-tools">
                  <Show when={doneItems().length > 0}>
                    <button type="button" class="button small" onClick={copyAllDone}>
                      <Icon name="copy" size={15} />复制全部 Markdown
                    </button>
                    <button type="button" class="button small ghost" disabled={uploading()} onClick={clearDone}>
                      清除已完成
                    </button>
                  </Show>
                  <button type="button" class="button small ghost danger" disabled={uploading()} onClick={clearItems}>
                    <Icon name="trash" size={15} />清空队列
                  </button>
                </div>
                <div class="queue-submit">
                  <Show when={!configured()}>
                    <button type="button" class="text-button" onClick={props.onSettings}>
                      配置仓库后可上传 <Icon name="arrow" size={15} />
                    </button>
                  </Show>
                  <button
                    type="button"
                    class="button primary"
                    disabled={!configured() || uploading() || pendingCount() === 0}
                    onClick={uploadAll}
                  >
                    <Icon name="upload" size={17} />
                    {uploading() ? '上传中…' : pendingCount() ? `开始上传（${pendingCount()}）` : '已全部上传'}
                  </button>
                </div>
              </div>
            </Show>
          </div>

          <Show when={items().length > 0} fallback={<p class="queue-empty">队列为空，添加图片后即可批量上传。</p>}>
            <div class="upload-list">
              <For each={items()}>
                {(item) => (
                  <article class="upload-item" classList={{ done: item.status === 'done', failed: item.status === 'error' }}>
                    <img class="thumb" src={item.previewUrl} alt="" />
                    <div class="item-main">
                      <div class="item-title">
                        <strong title={item.file.name}>{item.file.name}</strong>
                        <span class={`badge badge-${item.status}`}>{statusText(item.status)}</span>
                      </div>
                      <div class="item-meta">
                        {formatBytes(item.file.size)}
                        <Show when={item.outputSize !== undefined}>
                          {' → '}
                          {formatBytes(item.outputSize ?? 0)}
                        </Show>
                        <Show when={item.width && item.height}>
                          {' · '}
                          {item.width}×{item.height}
                        </Show>
                        <Show when={item.note}>
                          {' · '}
                          {item.note}
                        </Show>
                      </div>
                      <Show when={item.error}>
                        <p class="error-text">{item.error}</p>
                      </Show>
                      <Show when={item.markdown}>
                        <div class="result">
                          <code>{item.markdown}</code>
                          <div class="result-actions">
                            <CopyButton text={item.markdown ?? ''} label="复制 Markdown" />
                            <CopyButton text={item.url ?? ''} label="复制 URL" />
                            <button type="button" class="button small ghost" onClick={() => purgeImage(item)}>
                              刷新 CDN
                            </button>
                          </div>
                        </div>
                      </Show>
                    </div>
                    <button
                      type="button"
                      class="button icon-button ghost danger"
                      title="移除"
                      aria-label={`移除 ${item.file.name}`}
                      disabled={item.status === 'uploading' || item.status === 'converting'}
                      onClick={() => removeItem(item.id)}
                    >
                      <Icon name="close" size={17} />
                    </button>
                  </article>
                )}
              </For>
            </div>
          </Show>
        </section>
      </div>
    </section>
  )
}
