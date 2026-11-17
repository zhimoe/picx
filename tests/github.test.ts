import assert from 'node:assert/strict'
import test from 'node:test'
import {
  GitHubError,
  describeGitHubError,
  isDuplicateError,
} from '../src/lib/github.ts'

test('detects the GitHub Contents API duplicate-file error', () => {
  assert.equal(
    isDuplicateError(new GitHubError(422, 'Invalid request. "sha" was not supplied.')),
    true,
  )
  assert.equal(isDuplicateError(new GitHubError(422, 'Validation Failed')), false)
  assert.equal(isDuplicateError(new GitHubError(401, 'sha')), false)
})

test('describes common GitHub errors', () => {
  assert.match(describeGitHubError(new GitHubError(401, 'Bad credentials')), /Token 无效/)
  assert.match(describeGitHubError(new GitHubError(403, 'API rate limit exceeded')), /限流/)
  assert.match(describeGitHubError(new GitHubError(404, 'Not Found')), /仓库或分支不存在/)
  assert.match(describeGitHubError(new GitHubError(409, 'Git Repository is empty')), /仓库为空/)
  assert.match(describeGitHubError(new GitHubError(422, 'Invalid request')), /拒绝了请求/)
  assert.match(describeGitHubError(new GitHubError(0, 'Failed to fetch')), /无法连接 GitHub API/)
})
