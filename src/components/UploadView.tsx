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
import {
  describeGitHubError,
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

interface Props {
  settings: Settings
  active: boolean
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
  let fileInput: HTMLInputElement | undefined

  const dragging = () => dragDepth() > 0
  const targetDir = createMemo(() => resolveDir(props.settings.dir))
  const pendingCount = createMemo(
    () => items().filter((item) => item.status === 'queued' || item.status === 'error').length,
  )
  const doneItems = createMemo(() => items().filter((item) => item.status === 'done'))

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
    for (const file of files) {
      if (!isImageFile(file)) {
        toast(`${file.name} 不是图片，已跳过`, 'error')
        continue
      }
      if (file.size > INPUT_LIMIT) {
        toast(`${file.name} 超过 30MB，已跳过`, 'error')
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

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const name = uniqueName(baseName, ext, used)
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
        if (isDuplicateError(error) && attempt < 4) continue
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

    if (
      !props.settings.token ||
      !props.settings.owner ||
      !props.settings.repo ||
      !props.settings.branch
    ) {
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
    <section class="panel upload-panel">
      <div class="panel-heading">
        <div>
          <h2>上传图片</h2>
          <p class="muted">
            目标：<strong>{props.settings.owner}/{props.settings.repo}</strong> @{' '}
            <strong>{props.settings.branch}</strong> ·{' '}
            {targetDir() ? <code>{targetDir()}/</code> : '仓库根目录'}
          </p>
        </div>
        <Show when={doneItems().length > 0}>
          <button type="button" class="button" onClick={copyAllDone}>
            复制全部 Markdown
          </button>
        </Show>
      </div>

      <div class="upload-controls">
        <label>
          <span>WebP 质量：{quality().toFixed(2)}</span>
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
        <label>
          <span>最大宽度</span>
          <input
            type="number"
            min="0"
            step="100"
            value={maxWidth()}
            disabled={uploading()}
            onInput={(event) => setMaxWidth(Number(event.currentTarget.value) || 0)}
          />
        </label>
        <span class="muted small">
          0 = 原尺寸。设置页里的值作为默认值，这里只影响本次上传。
        </span>
      </div>

      <label
        class="dropzone"
        classList={{ dragging: dragging() }}
        role="button"
        tabindex="0"
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            fileInput?.click()
          }
        }}
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
        <span class="dropzone-icon">＋</span>
        <span class="dropzone-title">拖拽图片到这里，或点击选择</span>
        <span class="muted small">
          也可以直接 Ctrl/⌘ + V 粘贴截图。支持 JPG / PNG / WebP / AVIF / GIF / SVG，单张 ≤ 30MB。
        </span>
      </label>

      <Show when={items().length > 0}>
        <div class="upload-actions">
          <button
            type="button"
            class="button primary"
            disabled={uploading() || pendingCount() === 0}
            onClick={uploadAll}
          >
            {uploading() ? '上传中…' : `上传全部（${pendingCount()}）`}
          </button>
          <button
            type="button"
            class="button"
            disabled={uploading() || doneItems().length === 0}
            onClick={clearDone}
          >
            清除已完成
          </button>
          <button type="button" class="button danger" disabled={uploading()} onClick={clearItems}>
            清空列表
          </button>
        </div>

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
                        <button
                          type="button"
                          class="button small ghost"
                          onClick={() => purgeImage(item)}
                        >
                          刷新 CDN
                        </button>
                      </div>
                    </div>
                  </Show>
                </div>
                <button
                  type="button"
                  class="icon-button"
                  title="移除"
                  aria-label="移除"
                  disabled={item.status === 'uploading' || item.status === 'converting'}
                  onClick={() => removeItem(item.id)}
                >
                  ×
                </button>
              </article>
            )}
          </For>
        </div>
      </Show>
    </section>
  )
}
