# PicX Mini — 待办与恢复清单

## 当前状态（2026-11-18）

已完成并验证：

- 代码完成：SolidJS + TypeScript + Vite 8（内置 Rolldown），唯一运行时依赖 `solid-js`
- `npm run check` 通过：类型检查、15 个测试、生产构建
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
- WebP 转换实测：450.9 KB PNG → 7.7 KB WebP，1200×800，质量 0.82
- 上传失败路径实测：断网时显示“无法连接 GitHub API：Failed to fetch”，不崩溃

当前阻塞：

- 本机代理 `127.0.0.1:7890` 间歇性返回 503，GitHub API 目前不可达
- Wrangler 未登录（之前保存的 OAuth token 已过期，无法非交互刷新）
- 因此“真实 GitHub 上传”和“部署到 Cloudflare”尚未完成

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
- 如果你更习惯自己部署，运行 `npm run deploy` 即可；部署完把 `*.workers.dev`
  地址发给我，我来做线上验证。
- 如果你运行完 `wrangler login` 和两个 secret，直接告诉我“已登录”，我来执行
  `npm run deploy` 并验证。

### 2. 网络恢复后：真实 GitHub 上传验证

如果 Claude 会话还在，直接说“网络好了 / 继续”，我会用你的 GitHub 账号完成：

- 在 `zhimoe/picx-images-hosting` 上传一张测试图片（会产生一次真实 commit）
- 验证 WebP 文件名、转换前后大小
- 验证 `https://cdn.jsdelivr.net/gh/zhimoe/picx-images-hosting@main/...` 可访问
- 验证 Markdown 复制、图库列表、搜索、批量复制
- 验证同目录重名自动加 `-2`
- 验证 GIF/SVG 原样上传并标注“未转换”

如果你想自己先验证：

1. `npm run dev`，打开 http://localhost:5173
2. 设置页填写：Token、`zhimoe`、`picx-images-hosting`、`main`，点“测试连接”
3. 上传一张 JPG/PNG，检查结果
4. 注意：Token 只填在设置页，**不要发到聊天或提交到仓库**

### 3. 代码仓库（后台任务会尝试自动完成）

已选择公开仓库 `zhimoe/picx-mini`。后台任务会在网络恢复后自动创建并推送。
如果结束时仓库仍未创建，手动执行：

```bash
cd ~/code/picx-mini
gh repo create picx-mini --public --source=. --remote=origin --push
```

如果已在网页手动建好空仓库：

```bash
git remote add origin https://github.com/zhimoe/picx-mini.git
git push -u origin main
```

推送前确认 `.dev.vars`、Token、`node_modules`、`dist`、`.wrangler` 没有被提交
（`.gitignore` 已覆盖）。

## 部署后的线上验证清单

- [ ] 打开 `https://picx-mini.<你的子域>.workers.dev`
- [ ] 不输入密码 → 401；正确密码 → 200；错误密码 → 401
- [ ] 手机或其他浏览器能登录
- [ ] 设置页填写 GitHub Token / owner / repo / branch / 上传目录
- [ ] 点“测试连接”成功，私有仓库提示正确
- [ ] 上传一张图片，生成 `.webp`、jsDelivr 链接、Markdown
- [ ] 浏览器打开生成的 jsDelivr 链接（新文件可能延迟，用“刷新 CDN”）
- [ ] 图库能列出仓库中已有图片，搜索/批量复制正常
- [ ] 在 Workers 免费额度内（10 万请求/天，单人远低于）

## 本地测试环境说明

- `.dev.vars` 已创建，内含随机测试密码，仅用于本地 `npm run worker:dev`，
  已被 `.gitignore` 忽略。可自行修改或删除。
- 测试图片和截图在 `/tmp`，不在项目里。
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

网络返回 `200` 后，直接让 Claude 继续完成真实上传验证和部署。
