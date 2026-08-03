# NTU Life

NTU Life 是一个面向 iPhone Safari 的个人生活管理 PWA。它以本地 IndexedDB 保存课表、账目和日程，支持离线打开、添加到主屏幕、JSON 备份恢复、ICS 导出到 iPhone 系统日历，以及浏览器端 OCR 导入课表。

## 功能

- 首页：当前日期、教学周、今日课程、本周 Online Video、下一节课、本月收支和快捷入口。
- 课表：AY26 T1 Week 1-12 周切换、按星期分组、彩色课程卡、Online Video 作为本周任务、手动新增/编辑/删除。
- 导入课表：粘贴文本解析、加载示例、上传图片本地 OCR、导入确认草稿、低置信度提示、事务写入。
- 记账：收入/支出、整数分金额存储、SGD 默认货币、分类统计、交易列表、编辑和删除确认。
- 日程：新建/编辑/删除、提醒分钟、完成状态、今日/未来/已完成分组。
- 快速记录：语音 API 可用时可扩展使用 SpeechRecognition；不可用时提示使用 iPhone 键盘麦克风听写，文本解析仍可用。
- 设置：PWA 安装说明、能力检测、JSON 备份/恢复、课表/日程 ICS 导出、持久存储请求、二次确认清空、隐私说明。

## 技术栈

React、TypeScript strict、Vite、vite-plugin-pwa、React Router HashRouter、Dexie.js、Zod、date-fns、Tesseract.js、Vitest、React Testing Library、Playwright。

没有后端、远程数据库、API Key、OpenAI API、远程字体或运行时 CDN。OCR worker、WASM 和英文 traineddata 位于 `public/tesseract`，由同源站点提供并由 Service Worker 缓存。

## Windows 本地开发

PowerShell 如果禁止 `npm.ps1`，请使用 `npm.cmd`：

```powershell
npm.cmd install
npm.cmd run dev
```

本地生产预览：

```powershell
npm.cmd run build
npm.cmd run preview -- --port 4173
```

当前预览地址：

```text
http://127.0.0.1:4173
```

## 测试和构建

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run test:e2e
```

首次运行 E2E 如缺少浏览器：

```powershell
npx.cmd playwright install webkit
```

## GitHub Pages 免费部署

1. 在 GitHub 创建一个空仓库。
2. 本地提交代码并添加远程：

```powershell
git add .
git commit -m "Create NTU Life PWA"
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin master
```

3. 打开仓库 Settings -> Pages。
4. Source 选择 GitHub Actions。
5. 推送后 `.github/workflows/pages.yml` 会自动运行 lint、typecheck、test、build，并部署 `dist`。

Vite 使用 `base: './'` 和 HashRouter，兼容 GitHub Pages 子路径与刷新。

## iPhone 添加到主屏幕

1. 用 iPhone Safari 打开 GitHub Pages 地址。
2. 点击底部分享按钮。
3. 选择“添加到主屏幕”。
4. 从主屏幕打开 NTU Life。Standalone 模式下会以独立窗口运行。

## 数据、备份和风险

主体数据保存在 IndexedDB。清除 Safari 网站数据、重置浏览器或卸载站点数据可能删除本地课表、账目和日程，因此请在设置页定期导出 JSON 备份。

恢复 JSON 前会先用 Zod 校验，并显示摘要。默认合并恢复，不会在校验失败时覆盖现有数据。完全替换模式的底层能力已实现，UI 第一版默认使用更保守的合并恢复。

## ICS 导出

设置页可导出：

- `ntu-life-schedule-ay26-t1.ics`
- `ntu-life-agenda.ics`

课程按教学周和规则展开为实际日期的 VEVENT；日程按 `reminderMinutes` 生成 VALARM。Online Video 默认不导出为固定时间事件。

## 已知限制

- iPhone Safari 的真实 Standalone、安装引导、状态栏、安全区和真实离线重载仍需真机复验。
- 浏览器 SpeechRecognition 在 Safari/PWA 中支持不稳定；不可用时使用 iPhone 键盘听写作为降级。
- OCR 是浏览器端 Tesseract，首次缓存 OCR 资源较大，识别质量取决于截图清晰度；失败后可编辑识别文本重新解析。
- 第一版只预置 AY26 T1，不实现复杂多学期管理。
- 没有云同步、多用户、登录、预算系统或后台通知。
