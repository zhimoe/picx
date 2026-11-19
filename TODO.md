# PicX — 待办与清单

## 当前状态（2026-11-19）

已完成：

- 品牌统一为 PicX：页面标题、Worker 名、包名、README、默认配置
- 默认值：`zhimoe/picx-images-hosting` @ `master` · `pic/`；质量 0.85；最大宽度 0
- 代码仓库：https://github.com/zhimoe/picx
- Worker：`picx`；账号子域：`zhi-moe`
- 公开地址：https://picx.zhi-moe.workers.dev
- `BASIC_USER=me` 已设置
- `npm run check` 通过：16 个测试 + 生产构建
- 已包含：并发 409 退避重试、GitHub API 硬超时（避免图库无限加载）
- README 已包含简介、GitHub Token 选择、Cloudflare 部署和使用说明

待完成：

- 在你自己的浏览器里登录并填入 GitHub Token（默认值已预填，只需填 Token）
- 线上上传一张图片做最终确认（相同代码路径已在本地验证过）

## 网页密码

`BASIC_PASS` 已生成并设置。密码保存在本地私有文件：

```text
~/.config/picx/basic-pass
```

文件权限为 `600`。请把它保存到密码管理器，然后删除这个文件。如果要换成
自己的密码，在项目根目录、自己的终端里运行：

```bash
npx wrangler secret put BASIC_PASS
```

不要用 Claude Code 的 `!`，隐藏输入可能被读成空值。

已验证（HTTP）：

- 无密码 → 401
- 错误密码 → 401
- 正确密码 → 200
- 静态资源无密码 → 401；带密码 → 200
- `WWW-Authenticate: Basic realm="PicX"`
- `X-Content-Type-Options`、`Referrer-Policy`、`X-Frame-Options` 正常

## 线上验收清单

- [x] Worker 部署到 Cloudflare
- [x] 账号子域改为 `zhi-moe`
- [x] `BASIC_PASS` 设置
- [x] `https://picx.zhi-moe.workers.dev` 无密码/错误密码 → 401
- [x] 正确密码 → 200（HTTP + HTTPS 均已验证）
- [x] HTTPS 证书生效（TLS 1.3，证书校验通过）
- [x] 浏览器能进入上传页
- [x] 设置页默认值已填：`zhimoe/picx-images-hosting` @ `master` · `pic/`
- [x] 图库能列出图片（30 张），搜索、批量复制、缩略图加载正常
- [ ] 填入 GitHub Token，测试连接成功（你浏览器里操作）
- [ ] 上传一张图片，生成 `.webp`、jsDelivr 链接和 Markdown（你浏览器里操作）

## 使用说明

1. 打开部署地址，输入 `BASIC_USER` / `BASIC_PASS`
2. 设置页填 GitHub Token（fine-grained 的 Contents 读写，或 classic 的 `public_repo`）
3. 点“测试连接”，确认后保存
4. 上传页拖拽或粘贴图片，复制 Markdown
5. 图库页搜索、批量复制、刷新 CDN

## 已知限制

- jsDelivr 只服务公开仓库
- GIF/SVG 不转 WebP，避免丢失动画/矢量
- GitHub Token 存在 localStorage，换域名或设备需要重新填写
- `workers.dev` 在部分网络下不稳定，长期使用建议绑定自定义域名
- 网页密码（`BASIC_USER` / `BASIC_PASS`）和 GitHub Token 是两件事
- 本地目录名可在会话结束后改为 `~/code/picx`（可选）

## 常用命令

```bash
npm run dev        # 本地 UI（无密码）
npm run check      # 类型检查 + 测试 + 构建
npm run worker:dev # 本地 Worker + Basic Auth（读取 .dev.vars）
npm run deploy     # 构建并部署
npx wrangler secret put BASIC_PASS
```
