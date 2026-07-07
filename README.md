# 呼吸计时器

一个适合睡前使用的 10 分钟呼吸引导工具：准备 3 秒，吸气 5 秒、呼气 5 秒，共 60 个周期。

当前推荐使用无需 Xcode 的网页 App 版本。它能通过 Safari 添加到 iPhone 桌面，独立全屏运行，并在首次加载后离线使用。

## 已实现

- 深色柔光呼吸球与 5 秒阶段倒计时
- 10 分钟总计时、暂停、继续、退出确认与完成页
- 使用绝对时间差计时，避免刷新延迟造成累计漂移
- 可关闭的柔和双音提示和设备振动（以浏览器支持为准）
- 进入后台时自动暂停、支持“减少动态效果”
- 本地保存偏好，不联网、不收集数据
- Web App 图标、竖屏模式、离线缓存和 GitHub Pages 发布配置

## 本机预览

在项目目录运行：

```sh
python3 -m http.server 4173 --directory web
```

然后打开 `http://localhost:4173`。

## 发布并安装到 iPhone

1. 将项目推送到 GitHub 仓库的 `main` 分支。
2. 在仓库 Settings → Pages → Build and deployment 中选择 **GitHub Actions**。
3. 等待 `Deploy breathing timer` 工作流完成，打开生成的 HTTPS 地址。
4. 在 iPhone 的 Safari 中打开该地址，点“分享” → “添加到主屏幕” → “添加”。

以后直接点桌面上的“呼吸计时器”即可。首次打开需要网络，成功加载一次后可离线使用。iOS Safari 通常不提供网页振动反馈，因此 iPhone 上主要使用视觉和声音提示。

## 项目结构

- `web/`：推荐使用的可安装网页 App
- `web/tests/`：计时边界测试
- `BreathTimer/`：原生 SwiftUI 版本源码，保留供后续 App Store 开发
- `PRD.md`：产品需求文档

本工具不提供医疗诊断或治疗建议；如练习时感到头晕或不适，应恢复自然呼吸并停止练习。
