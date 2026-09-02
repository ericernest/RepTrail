# 我的健身 PWA（Android + GitHub Pages）

这是一个**纯静态 PWA**，不需要后端、不需要数据库。

## 功能

- Day 1 / Day 2 / Day 3 三日训练计划
- Workout Guide 三帧动作速查
- 每次训练记录：重量、三组次数、RIR、有氧
- 自动显示上次成绩与下一次重量建议
- 体重、腰围记录
- 训练历史
- JSON 导出 / 导入备份
- Android Chrome 可“安装应用”
- Service Worker 离线缓存：首次在线打开后可离线查看页面和动作图

## 数据隐私

训练记录使用浏览器 `localStorage`，只存储在当前设备的这个站点中，**不会提交到 GitHub，也不会上传服务器**。

注意：清除 Chrome 网站数据、恢复手机、部分卸载操作可能导致数据消失。建议每周或每月点一次“导出备份”。

## GitHub Pages 部署

1. 在 GitHub 新建仓库 `RepTrail`。仓库可以设为 private，但 GitHub Pages 对私有仓库的可用性取决于账号套餐和组织策略。
2. 推送本目录所有文件和文件夹到 `main` 分支。
3. 打开仓库 `Settings` → `Pages`，将 Source 设为 `GitHub Actions`。
4. 页面发布后，地址通常是：
   `https://你的GitHub用户名.github.io/RepTrail/`

仓库中的 `.github/workflows/pages.yml` 会自动发布根目录静态文件；项目全部使用相对路径，因此放在 GitHub Pages 的项目子路径下也能正常工作。

## Android 安装

1. 用 **Chrome** 打开 GitHub Pages 的 HTTPS 地址。
2. 页面如果显示“安装到手机”，直接点击。
3. 若没出现：Chrome 右上角 `⋮` → `安装应用` 或 `添加到主屏幕`。
4. 安装完成后会像普通 App 一样从桌面启动，并以 standalone 模式显示。

## 离线使用

第一次在线打开后，Service Worker 会缓存应用本体，并尝试缓存训练计划所需的 Workout Guide 三帧 SVG。
之后网络差或临时离线时仍可打开。

## 素材许可

- Workout Guide 代码/文档：MIT
- Workout Guide 视觉素材：CC BY-SA 4.0
- 部分原始姿势源自 Everkinetic

公开部署时请保留应用底部的素材署名。
