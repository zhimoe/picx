export interface Settings {
  token: string
  owner: string
  repo: string
  branch: string
  dir: string
  quality: number
  maxWidth: number
  randomSuffix: boolean
}

export interface GitHubUser {
  login: string
  name?: string | null
  avatar_url?: string
}

export interface GitHubRepo {
  full_name: string
  private: boolean
  default_branch: string
  permissions?: {
    admin?: boolean
    maintain?: boolean
    push?: boolean
    triage?: boolean
    pull?: boolean
  }
}

export interface GitHubBranch {
  name: string
  commit: {
    sha: string
    commit: {
      tree: {
        sha: string
      }
    }
  }
}

export interface RepoImage {
  path: string
  name: string
  size: number
  sha: string
  url: string
  markdown: string
}

export type UploadStatus = 'queued' | 'converting' | 'uploading' | 'done' | 'error'

export interface UploadItem {
  id: string
  file: File
  previewUrl: string
  status: UploadStatus
  error?: string
  outputName?: string
  outputSize?: number
  outputType?: string
  converted: boolean
  note?: string
  width?: number
  height?: number
  path?: string
  url?: string
  markdown?: string
}

export interface TestConnectionResult {
  user: GitHubUser
  repo: GitHubRepo
  branch: GitHubBranch
}
