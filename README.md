# PicX Mini

A minimal, single-user GitHub image host for Cloudflare Workers, based on the
behavior of [PicX v2](https://github.com/XPoet/picx/tree/v2). It keeps the tiny
part that matters: open the page, enter a password, drag images in, get WebP
jsDelivr links in Markdown, and browse every image already in your repo.

## Features

- Password-protected page via Cloudflare Worker Basic Auth
- Drag & drop, file picker, and clipboard paste upload
- Client-side WebP conversion with quality and max-width controls
- One GitHub Contents API request per image (independent success/failure)
- Recursive Git Trees listing of every image in the configured branch
- jsDelivr CDN URL + Markdown copy, single or batch
- Search, lazy thumbnails, and a jsDelivr cache-purge button
- No OAuth, no database, no server-side upload; the Worker only serves static
  files and checks the password
- One runtime dependency: `solid-js`

## Requirements

- Node.js >= 22.12
- A GitHub **public** repository for the images (jsDelivr cannot serve private
  repositories)
- A GitHub personal access token with Contents read/write access
- A free Cloudflare account (Workers free plan)

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`, go to **设置**, and fill in:

- **GitHub Token**: classic token with `repo`, or fine-grained token with
  Contents read/write
- **Owner / 仓库 / 分支**: the repository that already contains your PicX images
- **上传目录**: optional, supports `{yyyy}`, `{mm}`, `{dd}`; leave empty for the
  repo root
- **WebP quality / max width**: defaults are 0.82 and original width

Click **测试连接** to verify the token, repository, branch, and push permission,
then **保存配置**.

The Vite dev server has no password. Do not expose it publicly; use
`npm run worker:dev` to test the real Worker + Basic Auth locally.

## Deploy to Cloudflare Workers

```bash
npm run build
npx wrangler login
npx wrangler secret put BASIC_USER   # e.g. me
npx wrangler secret put BASIC_PASS   # use a long random password
npm run deploy
```

The first deploy prints a `https://picx-mini.<your-subdomain>.workers.dev` URL.
Open it; the browser asks for the Basic Auth username and password. The username
is whatever you set in `BASIC_USER` (recommended: `me`); the password is
`BASIC_PASS`.

To test locally with the Worker:

```bash
cp .dev.vars.example .dev.vars
# edit .dev.vars with your Basic Auth credentials
npm run worker:dev
```

`wrangler dev` serves the built `dist/` and enforces Basic Auth. The Worker
configuration is in `wrangler.jsonc`:

- `assets.directory: ./dist`
- `assets.binding: ASSETS`
- `assets.run_worker_first: true` — required so assets cannot bypass the
  password check

## How it works

- **Password**: `worker/index.ts` compares the `Authorization` header against
  `BASIC_USER` / `BASIC_PASS` (constant-time comparison, fails closed if the
  secrets are missing). It then forwards the request to Workers Static Assets.
- **Upload**: the browser talks directly to `api.github.com` with your PAT. Each
  image is one `PUT /repos/{owner}/{repo}/contents/{path}`; a batch upload runs
  at most three requests concurrently. There is no server-side token and no
  Worker CPU spent on image data.
- **WebP**: `createImageBitmap` (or an `<img>` fallback) + Canvas
  `toBlob('image/webp', quality)`. GIF and SVG are uploaded as-is to preserve
  animation/vector content. If the browser cannot encode WebP, the original file
  is uploaded and the UI says so.
- **Gallery**: `GET /branches/{branch}` → tree SHA →
  `GET /git/trees/{sha}?recursive=1`, filtered by image extension. Existing
  PicX images are listed with jsDelivr URLs; the old files and old links are not
  modified.
- **Links**: `https://cdn.jsdelivr.net/gh/{owner}/{repo}@{branch}/{path}` and
  `![alt](url)`. Path segments are URL-encoded.

## Limits and notes

- Input limit: 30 MB per file. Output above ~20 MB is rejected because jsDelivr
  will not serve it.
- Only images in the configured branch are listed. Images on other branches keep
  their old links but are not shown.
- jsDelivr may briefly 404 a newly uploaded file. Use the **刷新 CDN** button
  (it calls `purge.jsdelivr.net`) or wait a few minutes.
- Private repositories: GitHub API access still works, but jsDelivr links will
  not be publicly readable. The settings page warns about this.
- Git LFS images are not served by jsDelivr.
- A very large repository may return a truncated tree; the gallery shows a
  warning. The UI renders 120 images at a time with **显示更多**.
- The GitHub token is stored in `localStorage`; switching devices or domains
  requires entering it again. Do not use this app on a shared browser.
- The Basic Auth password is separate from the GitHub token. Change it with
  `npx wrangler secret put BASIC_PASS`.
- If you want stronger authentication than Basic Auth, put the Worker behind
  Cloudflare Access (free for up to 50 users).
- The browser must be able to reach `api.github.com` and `cdn.jsdelivr.net`. If
  you use a proxy, make sure the browser itself uses it (not only the terminal).
- `*.workers.dev` can be slow or blocked on some mainland China networks; bind a
  custom domain to the Worker if you need more reliable direct access.

## Migrating from PicX v2

The old `v2.picx.xpoet.cn` domain is gone, but your images are still in GitHub.
PicX v2 stored its settings under the old origin, so this app cannot read them.
Re-enter the same `owner / repo / branch / upload directory` and use the same
jsDelivr link rule. Existing image files and links are unaffected.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server (no password) |
| `npm run build` | Build static assets into `dist/` |
| `npm run preview` | Preview the build locally |
| `npm run typecheck` | Type-check frontend and Worker |
| `npm test` | Node built-in tests for pure helpers |
| `npm run check` | typecheck + test + build |
| `npm run worker:dev` | Build and run the real Worker with `.dev.vars` |
| `npm run deploy` | Build and deploy with Wrangler |

## Project layout

```
src/lib/        links, WebP conversion, GitHub API, storage
src/components/ upload, gallery, settings, toast, copy button
worker/         Basic Auth + static assets
tests/          pure-function tests (Node test runner)
```

## License and attribution

This project is a minimal reimplementation inspired by
[PicX](https://github.com/XPoet/picx) v2 and therefore distributed under the
GNU Affero General Public License v3.0. See `LICENSE`. It is not an official
PicX project and is not affiliated with the original author.
