import { Show, createEffect, createSignal } from 'solid-js'
import type { Settings, TestConnectionResult } from '../types'
import { describeGitHubError, testConnection } from '../lib/github'
import { isConfigured } from '../lib/storage'
import Icon from './Icon'
import { toast } from './Toast'

interface Props {
  initial: Settings
  onSave: (settings: Settings) => void
  onClear: () => void
}

export default function SettingsView(props: Props) {
  const [token, setToken] = createSignal(props.initial.token)
  const [owner, setOwner] = createSignal(props.initial.owner)
  const [repo, setRepo] = createSignal(props.initial.repo)
  const [branch, setBranch] = createSignal(props.initial.branch)
  const [dir, setDir] = createSignal(props.initial.dir)
  const [quality, setQuality] = createSignal(props.initial.quality)
  const [maxWidth, setMaxWidth] = createSignal(props.initial.maxWidth)
  const [randomSuffix, setRandomSuffix] = createSignal(props.initial.randomSuffix)
  const [showToken, setShowToken] = createSignal(false)
  const [testing, setTesting] = createSignal(false)
  const [testResult, setTestResult] = createSignal<TestConnectionResult | null>(null)
  const [testError, setTestError] = createSignal('')
  const [saveMessage, setSaveMessage] = createSignal('')
  const [saveError, setSaveError] = createSignal('')
  let testRequest = 0

  const connectionValues = () => ({
    token: token().trim(),
    owner: owner().trim(),
    repo: repo().trim(),
    branch: branch().trim(),
  })

  createEffect(() => {
    const settings = props.initial
    setToken(settings.token)
    setOwner(settings.owner)
    setRepo(settings.repo)
    setBranch(settings.branch)
    setDir(settings.dir)
    setQuality(settings.quality)
    setMaxWidth(settings.maxWidth)
    setRandomSuffix(settings.randomSuffix)
  })

  createEffect(() => {
    connectionValues()
    testRequest += 1
    setTestResult(null)
    setTestError('')
    setTesting(false)
  })

  createEffect(() => {
    connectionValues()
    dir()
    quality()
    maxWidth()
    randomSuffix()
    setSaveMessage('')
    setSaveError('')
  })

  const submit = (event: SubmitEvent) => {
    event.preventDefault()
    const next: Settings = {
      ...connectionValues(),
      dir: dir().trim(),
      quality: quality(),
      maxWidth: maxWidth(),
      randomSuffix: randomSuffix(),
    }

    if (!isConfigured(next)) {
      setSaveError('请填写 GitHub Token、仓库所有者、仓库名称和分支。')
      return
    }

    setSaveError('')
    props.onSave(next)
    setSaveMessage('配置已保存')
  }

  const test = async () => {
    const values = connectionValues()

    if (!isConfigured({ ...props.initial, ...values })) {
      setTestError('请填写 GitHub Token、仓库所有者、仓库名称和分支。')
      return
    }

    const request = ++testRequest
    setTesting(true)
    setTestError('')
    setTestResult(null)

    try {
      const result = await testConnection(values.token, values.owner, values.repo, values.branch)
      if (request === testRequest) setTestResult(result)
    } catch (error) {
      if (request === testRequest) setTestError(describeGitHubError(error))
    } finally {
      if (request === testRequest) setTesting(false)
    }
  }

  return (
    <section>
      <header class="page-heading settings-heading">
        <h1 tabindex="-1">设置</h1>
        <p>连接 GitHub 仓库，管理每次上传使用的默认参数。</p>
        <div class="settings-actions">
          <button type="submit" form="settings-form" class="button primary">
            {isConfigured(props.initial) ? '保存配置' : '保存并前往上传'}
            <Show when={!isConfigured(props.initial)}><Icon name="arrow" size={17} /></Show>
          </button>
          <span class="save-message" role="status">{saveMessage()}</span>
        </div>
        <Show when={saveError()}><p class="notice notice-error" role="alert">{saveError()}</p></Show>
      </header>

      <div class="workspace-grid settings-layout">
        <form id="settings-form" class="panel-stack" onSubmit={submit}>
          <section class="panel form-panel" aria-labelledby="connection-heading">
            <div class="section-heading">
              <span class="section-icon"><Icon name="repo" /></span>
              <h2 id="connection-heading">GitHub 连接</h2>
            </div>

            <div class="field">
              <div class="field-title token-label">
                <label for="github-token">GitHub Token</label>
                <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
                  创建 Token <Icon name="external" size={15} />
                </a>
              </div>
              <div class="input-row">
                <input
                  id="github-token"
                  type={showToken() ? 'text' : 'password'}
                  value={token()}
                  onInput={(event) => setToken(event.currentTarget.value)}
                  placeholder="github_pat_… 或 ghp_…"
                  autocomplete="new-password"
                  spellcheck={false}
                  aria-describedby="token-hint"
                  required
                />
                <button type="button" class="button" onClick={() => setShowToken((value) => !value)}>
                  {showToken() ? '隐藏' : '显示'}
                </button>
              </div>
              <small id="token-hint" class="hint">Token 仅保存在此浏览器，用于访问 GitHub API。</small>
            </div>

            <div class="field-grid">
              <label class="field">
                <span>仓库所有者</span>
                <input
                  value={owner()}
                  onInput={(event) => setOwner(event.currentTarget.value)}
                  autocomplete="off"
                  spellcheck={false}
                  required
                />
              </label>

              <label class="field">
                <span>仓库名称</span>
                <input
                  value={repo()}
                  onInput={(event) => setRepo(event.currentTarget.value)}
                  autocomplete="off"
                  spellcheck={false}
                  required
                />
              </label>

              <label class="field">
                <span>分支</span>
                <input
                  value={branch()}
                  onInput={(event) => setBranch(event.currentTarget.value)}
                  autocomplete="off"
                  spellcheck={false}
                  required
                />
              </label>

              <label class="field">
                <span>上传目录 <span class="hint">（选填）</span></span>
                <input
                  value={dir()}
                  onInput={(event) => setDir(event.currentTarget.value)}
                  placeholder="仓库根目录"
                  autocomplete="off"
                  spellcheck={false}
                  aria-describedby="dir-hint"
                />
                <small id="dir-hint" class="hint">留空上传到根目录，支持 <code>pic/{'{yyyy}'}/{'{mm}'}/{'{dd}'}</code>。</small>
              </label>
            </div>

            <div class="form-actions connection-actions">
              <button type="button" class="button" onClick={test} disabled={testing()}>
                <Icon name="refresh" size={16} />
                {testing() ? '测试中…' : '测试连接'}
              </button>
            </div>

            <Show when={testError()}>
              <p class="notice notice-error" role="alert">{testError()}</p>
            </Show>

            <Show when={testResult()}>
              {(result) => (
                <div class="connection-result" role="status">
                  <p class="notice notice-success">
                    <Icon name="check" size={17} />
                    <span>
                      已连接 <strong>{result().repo.full_name}</strong> · {result().branch.name}
                      <br />当前账号 {result().user.login}
                    </span>
                  </p>
                  <Show when={result().repo.private}>
                    <p class="notice notice-warning">这是私有仓库，生成的 jsDelivr 链接无法公开访问。</p>
                  </Show>
                  <Show when={result().repo.permissions?.push === false}>
                    <p class="notice notice-warning">当前 Token 缺少推送权限，请检查仓库授权。</p>
                  </Show>
                  <Show when={result().repo.default_branch !== branch().trim()}>
                    <p class="notice notice-warning">
                      默认分支为 <code>{result().repo.default_branch}</code>，当前选择 <code>{result().branch.name}</code>。
                    </p>
                  </Show>
                </div>
              )}
            </Show>
          </section>

          <section class="panel form-panel" aria-labelledby="defaults-heading">
            <div class="section-heading">
              <span class="section-icon"><Icon name="settings" /></span>
              <h2 id="defaults-heading">上传默认值</h2>
            </div>

            <div class="field-grid">
              <label class="field">
                <span class="field-title">WebP 质量 <strong>{quality().toFixed(2)}</strong></span>
                <input
                  type="range"
                  min="0.5"
                  max="1"
                  step="0.01"
                  value={quality()}
                  onInput={(event) => setQuality(Number(event.currentTarget.value))}
                  aria-describedby="default-quality-hint"
                />
                <small id="default-quality-hint" class="hint">值越低，文件体积通常越小。</small>
              </label>

              <label class="field">
                <span>最大宽度（px）</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={maxWidth()}
                  onInput={(event) => setMaxWidth(Number(event.currentTarget.value) || 0)}
                  aria-describedby="default-width-hint"
                />
                <small id="default-width-hint" class="hint">填 0 保留图片原始尺寸。</small>
              </label>
            </div>

            <label class="check-row">
              <input
                type="checkbox"
                checked={randomSuffix()}
                onChange={(event) => setRandomSuffix(event.currentTarget.checked)}
              />
              <span>文件名添加随机后缀 <small class="hint">减少重名和 CDN 缓存问题</small></span>
            </label>
          </section>
        </form>

        <aside class="panel-stack">
          <section class="panel context-panel" aria-labelledby="guide-heading">
            <div class="section-heading">
              <span class="section-icon"><Icon name="info" /></span>
              <h2 id="guide-heading">配置指南</h2>
            </div>
            <div class="guide-item">
              <h3>选择公开仓库</h3>
              <p>jsDelivr 通过公开仓库提供图片链接。</p>
              <a href="https://github.com/new" target="_blank" rel="noreferrer">
                新建仓库 <Icon name="external" size={15} />
              </a>
            </div>
            <div class="guide-item">
              <h3>授予 Token 权限</h3>
              <p>细粒度 Token 仅授权目标仓库的 Contents 读写。公开仓库也可以使用带 <code>public_repo</code> 的经典 Token。</p>
            </div>
          </section>

          <Show when={isConfigured(props.initial)}>
            <section class="panel context-panel" aria-labelledby="local-heading">
              <div class="section-heading">
                <span class="section-icon"><Icon name="shield" /></span>
                <h2 id="local-heading">本地配置</h2>
              </div>
              <p>清除后需要重新填写 Token 和仓库信息。已上传的图片仍保留在 GitHub。</p>
              <button
                type="button"
                class="button danger"
                onClick={() => {
                  if (window.confirm('确定清除此浏览器保存的 GitHub Token 和配置？')) {
                    setShowToken(false)
                    props.onClear()
                    toast('已清除本地配置', 'info')
                  }
                }}
              >
                <Icon name="trash" size={16} />清除本地配置
              </button>
            </section>
          </Show>
        </aside>
      </div>
    </section>
  )
}
