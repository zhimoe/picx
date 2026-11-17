import type {
  GitHubBranch,
  GitHubRepo,
  GitHubUser,
  RepoImage,
  TestConnectionResult,
} from '../types'
import {
  altFromName,
  encodePath,
  isImagePath,
  jsdelivrUrl,
  markdownFor,
  purgeUrl,
} from './links.ts'

const API_BASE = 'https://api.github.com'
const API_VERSION = '2022-11-28'
const GET_TIMEOUT = 15_000
const PUT_TIMEOUT = 120_000

export class GitHubError extends Error {
  readonly status: number
  readonly details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = 'GitHubError'
    this.status = status
    this.details = details
  }
}

interface GitHubRequestInit {
  method?: string
  body?: unknown
  signal?: AbortSignal
}

interface GitTreeEntry {
  path: string
  mode: string
  type: 'blob' | 'tree' | 'commit'
  sha: string
  size?: number
  url: string
}

interface GitTreeResponse {
  sha: string
  tree: GitTreeEntry[]
  truncated: boolean
}

export interface ImageTreeResult {
  images: RepoImage[]
  truncated: boolean
}

export interface PutContentResult {
  path: string
  size: number
  sha: string
}

function repoPath(owner: string, repo: string): string {
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
}

function timeoutSignal(timeout: number): AbortSignal | undefined {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeout)
  }

  if (typeof AbortController === 'undefined') return undefined
  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeout)
  return controller.signal
}

async function ghFetch<T>(
  token: string,
  path: string,
  init: GitHubRequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': API_VERSION,
  }

  if (init.body !== undefined) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal:
        init.signal ??
        timeoutSignal(init.method === 'PUT' ? PUT_TIMEOUT : GET_TIMEOUT),
      cache: 'no-store',
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new GitHubError(0, '请求超时')
    }
    throw new GitHubError(0, error instanceof Error ? error.message : '网络请求失败')
  }

  const raw = await response.text()
  let data: unknown = null

  if (raw) {
    try {
      data = JSON.parse(raw)
    } catch {
      data = raw
    }
  }

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'message' in data
        ? String((data as { message: unknown }).message)
        : `GitHub API 返回 ${response.status}`
    throw new GitHubError(response.status, message, data)
  }

  return data as T
}

export function getUser(token: string): Promise<GitHubUser> {
  return ghFetch<GitHubUser>(token, '/user')
}

export function getRepo(token: string, owner: string, repo: string): Promise<GitHubRepo> {
  return ghFetch<GitHubRepo>(token, repoPath(owner, repo))
}

export function getBranch(
  token: string,
  owner: string,
  repo: string,
  branch: string,
): Promise<GitHubBranch> {
  return ghFetch<GitHubBranch>(
    token,
    `${repoPath(owner, repo)}/branches/${encodeURIComponent(branch)}`,
  )
}

export async function testConnection(
  token: string,
  owner: string,
  repo: string,
  branch: string,
): Promise<TestConnectionResult> {
  const user = await getUser(token)
  const repoInfo = await getRepo(token, owner, repo)
  const branchInfo = await getBranch(token, owner, repo, branch)
  return { user, repo: repoInfo, branch: branchInfo }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'))
    reader.readAsDataURL(blob)
  })
}

export async function putContent(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  path: string,
  blob: Blob,
): Promise<PutContentResult> {
  const content = await blobToBase64(blob)
  const name = path.split('/').pop() || path
  const data = await ghFetch<{
    content: { path: string; size: number; sha: string }
  }>(token, `${repoPath(owner, repo)}/contents/${encodePath(path)}`, {
    method: 'PUT',
    body: {
      message: `Upload ${name} via PicX Mini`,
      content,
      branch,
    },
  })

  return {
    path: data.content.path,
    size: data.content.size,
    sha: data.content.sha,
  }
}

export async function listImageTree(
  token: string,
  owner: string,
  repo: string,
  branch: string,
): Promise<ImageTreeResult> {
  const branchInfo = await getBranch(token, owner, repo, branch)
  const treeSha = branchInfo.commit?.commit?.tree?.sha

  if (!treeSha) throw new GitHubError(0, '无法读取分支的 tree SHA')

  const tree = await ghFetch<GitTreeResponse>(
    token,
    `${repoPath(owner, repo)}/git/trees/${treeSha}?recursive=1`,
  )

  const images = tree.tree
    .filter((entry) => entry.type === 'blob' && isImagePath(entry.path))
    .map((entry) => {
      const name = entry.path.split('/').pop() || entry.path
      const url = jsdelivrUrl(owner, repo, branch, entry.path)
      return {
        path: entry.path,
        name,
        size: entry.size ?? 0,
        sha: entry.sha,
        url,
        markdown: markdownFor(altFromName(name), url),
      }
    })
    .sort((left, right) => left.path.localeCompare(right.path))

  return { images, truncated: Boolean(tree.truncated) }
}

export function isDuplicateError(error: unknown): boolean {
  return (
    error instanceof GitHubError &&
    error.status === 422 &&
    /sha|already exists|already_exists/i.test(error.message)
  )
}

export async function purgeJsdelivr(
  owner: string,
  repo: string,
  branch: string,
  path: string,
): Promise<boolean> {
  try {
    const response = await fetch(purgeUrl(owner, repo, branch, path), {
      cache: 'no-store',
    })
    return response.ok
  } catch {
    return false
  }
}

export function describeGitHubError(error: unknown): string {
  if (error instanceof GitHubError) {
    if (error.status === 0) {
      return error.message === '请求超时'
        ? '请求超时，请检查网络后重试。'
        : `无法连接 GitHub API：${error.message}。请检查网络、代理或浏览器 CORS 限制。`
    }

    switch (error.status) {
      case 401:
        return 'GitHub Token 无效或已过期，请重新生成 Token。'
      case 403:
        return /rate limit/i.test(error.message)
          ? 'GitHub API 已限流，请稍后再试。'
          : '没有权限执行操作，请检查 Token 权限和仓库权限。'
      case 404:
        return '仓库或分支不存在，或 Token 无权访问。'
      case 409:
        return '仓库为空或存在冲突，请先在 GitHub 创建首次提交。'
      case 422:
        return `GitHub 拒绝了请求：${error.message}`
      default:
        return `GitHub API 错误（${error.status}）：${error.message}`
    }
  }

  return error instanceof Error ? error.message : '请求失败，请重试。'
}
