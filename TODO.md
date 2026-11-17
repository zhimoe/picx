# PicX Mini — 待办与恢复清单

## 当前状态

- 代码已完成：SolidJS + TypeScript + Vite 8（内置 Rolldown），唯一运行时依赖 `solid-js`
- `npm run check` 已通过：TypeScript 7 类型检查、15 个测试、生产构建
- 本地已验证：设置页、上传队列、图库、暗色模式、移动端
- 本地已验证：WebP 转换（PNG 23.6KB → WebP 18.6KB）
- 本地已验证：用 mock GitHub API 跑通上传，生成正确的 jsDelivr + Markdown
- 本地已验证：Worker Basic Auth 401/200/错误密码、静态资源保护、安全头
- `wrangler deploy --dry-run` 已通过
- **尚未做真实 GitHub API 验证**
- **尚未部署到 Cloudflare**
- **尚未初始化远程 GitHub 仓库/推送**
- 阻塞：本机代理 `127.0.0.1:7890` 对 GitHub 返回 503，终端和浏览器都无法访问 `api.github.com`

## 1. 网络恢复后的真实 GitHub 验证

- [ ] 确认 GitHub 可访问：`curl -sS -o /dev/null -w '%{http_code}\n' https://api.github.com/zen` 返回 `200`
- [ ] 启动本地开发：`npm run dev`，打开 http://localhost:5173
- [ ] 设置页填写 GitHub Token、owner、repo、branch，点“测试连接”
- [ ] 上传一张 JPG/PNG，确认：
  - [ ] 自动转为 `.webp`
  - [ ] 显示转换前后大小
  - [ ] 生成 `https://cdn.jsdelivr.net/gh/...` 链接
  - [ ] 生成 `![name](url)` Markdown
- [ ] 用浏览器打开生成的 jsDelivr 链接（新文件可能延迟，用“刷新 CDN”）
- [ ] 图库能列出仓库中已有的 PicX 旧图片，搜索/批量复制正常
- [ ] 验证同目录重名文件自动加 `-2`
- [ ] 验证 GIF/SVG 原样上传并标注“未转换”
- [ ] 验证私有仓库会提示 jsDelivr 不可用（如果有私有测试仓库）
- [ ] 验证换目录 `blog/{yyyy}/{mm}` 能正确解析

## 2. 部署到 Cloudflare Workers

- [ ] `cd ~/code/picx-mini`
- [ ] `npx wrangler login`
- [ ] `npx wrangler secret put BASIC_USER`（建议 `me`）
- [ ] `npx wrangler secret put BASIC_PASS`（自己输入长随机密码，不要发到聊天里）
- [ ] `npm run deploy`
- [ ] 打开输出的 `https://picx-mini.<subdomain>.workers.dev`
- [ ] 验证无密码 401、正确密码 200、错误密码 401
- [ ] 验证手机/其他浏览器可正常登录和上传
- [ ] 确认在 Workers 免费额度内（10 万请求/天；单人远低于）

## 3. 备份到 GitHub（可选但建议）

- [ ] 在 GitHub 新建仓库（代码是 AGPL-3.0；private/public 均可）
- [ ] `git remote add origin <你的仓库地址>`
- [ ] `git push -u origin main`
- [ ] 确认 `.dev.vars`、Token、`node_modules`、`dist`、`.wrangler` 没有被提交

## 4. 已知限制

- 网页密码是 Worker Basic Auth（用户名建议 `me`），与 GitHub Token 是两件事
- GitHub Token 存在浏览器 localStorage；换设备/换域名需要重新填
- jsDelivr 只对 public 仓库生效；私有仓库会 404
- GIF/SVG 不转 WebP（避免丢动画/矢量）
- 旧 PicX v2 的 localStorage 属于已失效的旧域名，新站无法读取，需要重新填配置
- 图库只列当前配置分支；旧图片在其他分支时不会显示，但旧链接不受影响
- Git LFS 文件不会被 jsDelivr 直接提供
- 国内网络需要浏览器能访问 `api.github.com` 和 `cdn.jsdelivr.net`；`*.workers.dev` 可能不稳定，可绑定自定义域名

## 5. 快速命令

```bash
cd ~/code/picx-mini

npm run dev        # 本地 UI（无密码）
npm run check      # 类型检查 + 测试 + 构建
npm test           # 仅跑测试

cp .dev.vars.example .dev.vars   # 本地 Worker 测试前
# 编辑 BASIC_USER / BASIC_PASS
npm run worker:dev               # http://localhost:8787，带 Basic Auth

npx wrangler login
npx wrangler secret put BASIC_USER
npx wrangler secret put BASIC_PASS
npm run deploy
```

## 6. 恢复时的第一步

重启电脑、修好网络后，先运行：

```bash
cd ~/code/picx-mini
git status
npm run check
curl -sS -o /dev/null -w '%{http_code}\n' https://api.github.com/zen
```

然后回到 `TODO.md` 第 1 节做真实 GitHub 验证。
