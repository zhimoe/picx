import { Show, createEffect, createSignal } from 'solid-js'
import type { Settings, TestConnectionResult } from '../types'
import { describeGitHubError, testConnection } from '../lib/github'
import { DEFAULT_SETTINGS } from '../lib/storage'

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

  const submit = (event: SubmitEvent) => {
    event.preventDefault()
    setTestError('')
    const next: Settings = {
      token: token().trim(),
      owner: owner().trim(),
      repo: repo().trim(),
      branch: branch().trim(),
      dir: dir().trim(),
      quality: quality(),
      maxWidth: maxWidth(),
      randomSuffix: randomSuffix(),
    }

    if (!next.token || !next.owner || !next.repo || !next.branch) {
      setTestError('请填写 Token、owner、repo 和 branch。')
      return
    }

    props.onSave(next)
  }

  const test = async () => {
    const values = {
      token: token().trim(),
      owner: owner().trim(),
      repo: repo().trim(),
      branch: branch().trim(),
    }

    if (!values.token || !values.owner || !values.repo || !values.branch) {
      setTestError('请先填写 Token、owner、repo 和 branch。')
      return
    }

    setTesting(true)
    setTestError('')
    setTestResult(null)

    try {
      const result = await testConnection(
        values.token,
        values.owner,
        values.repo,
        values.branch,
      )
      setTestResult(result)
    } catch (error) {
      setTestError(describeGitHubError(error))
    } finally {
      setTesting(false)
    }
  }

  return (
    <section class="panel settings-panel">
      <div class="panel-heading">
        <div>
          <h2>连接 GitHub</h2>
          <p class="muted">
            配置只保存在当前浏览器。网页密码由 Cloudflare Worker 校验，和这里的 GitHub Token 是两回事。
          </p>
        </div>
      </div>

      <form class="settings-form" onSubmit={submit}>
        <label class="field field-wide">
          <span>GitHub Token</span>
          <div class="input-row">
            <input
              type={showToken() ? 'text' : 'password'}
              value={token()}
              onInput={(event) => setToken(event.currentTarget.value)}
              placeholder="ghp_... 或 github_pat_..."
              autocomplete="new-password"
              spellcheck={false}
            />
            <button
              type="button"
              class="button ghost"
              onClick={() => setShowToken((value) => !value)}
            >
              {showToken() ? '隐藏' : '显示'}
            </button>
          </div>
          <small class="hint">
            公开仓库用 classic Token 的 <code>public_repo</code> 即可，私有仓库才需要{' '}
            <code>repo</code>。更推荐 fine-grained Token，只授权目标仓库的 Contents 读写。
            <a href="https://github.com/settings/tokens/new" target="_blank" rel="noreferrer">
              生成 Token
            </a>
          </small>
        </label>

        <div class="field-grid">
          <label class="field">
            <span>Owner</span>
            <input
              value={owner()}
              onInput={(event) => setOwner(event.currentTarget.value)}
              placeholder="zhimoe"
              autocomplete="off"
              spellcheck={false}
            />
          </label>

          <label class="field">
            <span>仓库</span>
            <input
              value={repo()}
              onInput={(event) => setRepo(event.currentTarget.value)}
              placeholder="picx-images-hosting"
              autocomplete="off"
              spellcheck={false}
            />
          </label>

          <label class="field">
            <span>分支</span>
            <input
              value={branch()}
              onInput={(event) => setBranch(event.currentTarget.value)}
              placeholder="master"
              autocomplete="off"
              spellcheck={false}
            />
          </label>

          <label class="field">
            <span>上传目录</span>
            <input
              value={dir()}
              onInput={(event) => setDir(event.currentTarget.value)}
              placeholder="pic"
              autocomplete="off"
              spellcheck={false}
            />
            <small class="hint">
              支持 <code>{'{yyyy}'}</code>、<code>{'{mm}'}</code>、<code>{'{dd}'}</code>；
              留空表示仓库根目录。
            </small>
          </label>
        </div>

        <div class="field-grid">
          <label class="field">
            <span>WebP 质量：{quality().toFixed(2)}</span>
            <input
              type="range"
              min="0.5"
              max="1"
              step="0.01"
              value={quality()}
              onInput={(event) => setQuality(Number(event.currentTarget.value))}
            />
            <small class="hint">默认 0.85；越低体积越小。</small>
          </label>

          <label class="field">
            <span>最大宽度（px）</span>
            <input
              type="number"
              min="0"
              step="100"
              value={maxWidth()}
              onInput={(event) => setMaxWidth(Number(event.currentTarget.value) || 0)}
            />
            <small class="hint">0 表示保持原始尺寸；博客配图常用 1600～2000。</small>
          </label>
        </div>

        <label class="check-row">
          <input
            type="checkbox"
            checked={randomSuffix()}
            onChange={(event) => setRandomSuffix(event.currentTarget.checked)}
          />
          <span>文件名添加随机后缀（减少 CDN 缓存和重名问题）</span>
        </label>

        <div class="form-actions">
          <button type="submit" class="button primary">
            保存配置
          </button>
          <button type="button" class="button" onClick={test} disabled={testing()}>
            {testing() ? '测试中…' : '测试连接'}
          </button>
          <button
            type="button"
            class="button danger"
            onClick={() => {
              if (window.confirm('确定清除本地保存的 GitHub Token 和配置？')) {
                props.onClear()
              }
            }}
          >
            清除本地配置
          </button>
          <a class="button ghost" href="https://github.com/new" target="_blank" rel="noreferrer">
            新建仓库
          </a>
        </div>

        <Show when={testError()}>
          <p class="notice notice-error">{testError()}</p>
        </Show>

        <Show when={testResult()}>
          {(result) => (
            <div class="notice notice-success">
              <p>
                已连接 <strong>{result().user.login}</strong> ·{' '}
                <strong>{result().repo.full_name}</strong> · 分支{' '}
                <strong>{result().branch.name}</strong>
              </p>
              <Show when={result().repo.private}>
                <p class="notice-warning">
                  这是私有仓库：API 可以读写，但 jsDelivr 无法公开访问，生成的图片链接会 404。
                </p>
              </Show>
              <Show when={result().repo.permissions?.push === false}>
                <p class="notice-warning">
                  Token 没有推送权限，上传会失败。请检查 Token 权限。
                </p>
              </Show>
              <Show when={result().repo.default_branch !== branch()}>
                <p class="notice-warning">
                  仓库默认分支是 <code>{result().repo.default_branch}</code>，当前配置的是{' '}
                  <code>{branch()}</code>。确认这是你想要的。
                </p>
              </Show>
            </div>
          )}
        </Show>
      </form>

      <p class="muted small">
        图片仍保存在你自己的 GitHub 仓库。旧图片不会被修改；只要仓库、分支和路径不变，旧链接继续有效。
      </p>
      <p class="muted small">
        当前默认值：{DEFAULT_SETTINGS.owner}/{DEFAULT_SETTINGS.repo} @{' '}
        {DEFAULT_SETTINGS.branch} · 目录 <code>{DEFAULT_SETTINGS.dir || '/'}</code> · 质量{' '}
        {DEFAULT_SETTINGS.quality}。
      </p>
    </section>
  )
}
