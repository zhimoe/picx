# PicX Mini — 待办与恢复清单

## 当前状态（2026-11-18 19:20）

已完成并验证：

- 代码完成：SolidJS + TypeScript + Vite 8（内置 Rolldown），唯一运行时依赖 `solid-js`
- `npm run check` 通过：类型检查、16 个测试、生产构建
- 代码仓库已创建并推送：https://github.com/zhimoe/picx-mini（public，`main`）
- Worker 本地实测（`npm run worker:dev`，http://localhost:8787）：
  - 无密码 → 401，错误用户名/密码 → 401，正确密码 → 200
  - `WWW-Authenticate`、`X-Content-Type-Options`、`Referrer-Policy`、
    `X-Frame-Options` 均正确
  - 静态 JS 资源带密码可访问；不存在的路径 → 404
- UI 本地实测（http://localhost:5173）：
  - 上传 / 图库 / 设置 导航正常
  - 设置页空值校验提示正确
  - 保存配置后顶部仓库信息更新；清除配置有确认框且 localStorage 被清空
  - 移动端 390×844 布局正常，无横向溢出
- 真实 GitHub 上传验证通过（图片仓库 `zhimoe/picx-images-hosting` @ `master`）：
  - 中文名 PNG 2.5 MB → 195.9 KB WebP，1200×800，质量 0.82
  - 写入 `pic/测试-图片.webp`，jsDelivr 返回 200（200568 字节）
  - 同目录重名自动变为 `测试-图片-2.webp`
  - GIF/SVG 原样上传，界面显示“GIF 保持原格式，避免丢失动画”
    “SVG 保持原格式，保留矢量”
  - 图库缩略图加载、搜索、单条/批量复制 Markdown 正常
  - 验证完成后测试文件已删除（commit `c468f754`），图库恢复为 29 张
- 并发上传修复并实测：同一批 3 张图会触发 GitHub Contents API `409 Conflict`
  （分支 ref 竞争）。现在遇到可重试的 409 会退避重试（200/400/800/1600 ms），
  实测连续 2 次 409 后全部成功；空仓库的 409 不重试并提示明确原因。
- 断网失败路径、WebP 转换（450.9 KB PNG → 7.7 KB WebP）等本地实测通过

剩余阻塞：

- Wrangler 未登录（之前保存的 OAuth token 已过期，无法非交互刷新）
- 因此尚未部署到 Cloudflare，线上验证清单还未执行

## 需要你操作的部分

### 1. Cloudflare 登录 + 部署（必须）

在 Claude Code 输入框中运行（`!` 前缀会把命令结果带回会话）：

```bash
! npx wrangler login
! npx wrangler secret put BASIC_USER    # 建议填 me
! npx wrangler secret put BASIC_PASS    # 自己输入长随机密码，不要发到聊天里
! npm run deploy
```

说明：

- `wrangler login` 会打开浏览器，登录你的 Cloudflare 账号并授权。
- `BASIC_USER` / `BASIC_PASS` 是打开网页时的登录框，和 GitHub Token 无关。
- 运行完 `wrangler login` 和两个 secret 后，直接告诉 Claude“已登录”，
  由 Claude 执行 `npm run deploy` 并做线上验证。
- 也可以自己运行 `npm run deploy`，把 `*.workers.dev` 地址发过来。
- 图片仓库的默认分支是 `master`，设置页的分支要填 `master`，不是 `main`。

### 2. 测试图片

已按你的选择清理完毕，无需操作。

## 部署后的线上验证清单

- [ ] 打开 `https://picx-mini.<你的子域>.workers.dev`
- [ ] 不输入密码 → 401；正确密码 → 200；错误密码 → 401
- [ ] 手机或其他浏览器能登录
- [ ] 设置页填写 GitHub Token / `zhimoe` / `picx-images-hosting` / `master` / `pic`
- [ ] 点“测试连接”成功，仓库信息正确
- [ ] 上传一张图片，生成 `.webp`、jsDelivr 链接、Markdown
- [ ] 浏览器打开生成的 jsDelivr 链接（新文件可能延迟，用“刷新 CDN”）
- [ ] 图库能列出仓库中已有图片，搜索/批量复制正常
- [ ] 在 Workers 免费额度内（10 万请求/天，单人远低于）

## 本地测试环境说明

- `.dev.vars` 已创建，内含随机测试密码，仅用于本地 `npm run worker:dev`，
  已被 `.gitignore` 忽略。可自行修改或删除。
- 本次真实上传验证的临时图片在 `/tmp/picx-mini-test/`，可随时删除。
- 项目内没有提交任何 Token 或密码。

## 已知限制

- 网页密码是 Worker Basic Auth（用户名建议 `me`），与 GitHub Token 是两件事
- GitHub Token 存在浏览器 localStorage；换设备/换域名需要重新填
- jsDelivr 只对 public 仓库生效；私有仓库会 404
- GIF/SVG 不转 WebP（避免丢动画/矢量）
- 旧 PicX v2 的 localStorage 属于已失效的旧域名，新站无法读取，需要重新填配置
- 图库只列当前配置分支；旧图片在其他分支时不会显示，但旧链接不受影响
- Git LFS 文件不会被 jsDelivr 直接提供
- 国内网络需要浏览器能访问 `api.github.com` 和 `cdn.jsdelivr.net`；
  `*.workers.dev` 可能不稳定，可绑定自定义域名
- 同批次并发上传遇到 409 会自动重试；重试仍失败时界面会提示“请重试”

## 快速命令

```bash
cd ~/code/picx-mini

npm run dev        # 本地 UI（无密码）
npm run check      # 类型检查 + 测试 + 构建
npm test           # 仅跑测试

npm run worker:dev               # http://localhost:8787，带 Basic Auth
                                 # 读取 .dev.vars

npx wrangler login
npx wrangler secret put BASIC_USER
npx wrangler secret put BASIC_PASS
npm run deploy
```

## 恢复时的第一步

```bash
cd ~/code/picx-mini
git status
npm run check
curl -sS -o /dev/null -w '%{http_code}\n' https://api.github.com/zen
```

网络返回 `200` 后，直接让 Claude 继续完成 Cloudflare 部署和线上验证。
