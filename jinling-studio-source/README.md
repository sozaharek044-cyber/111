# 金陵面塑工坊

当前线上第 5 版的可编辑源码。包含十件圆形纸盘浮雕、圆盘展厅、桌面与手机工坊场景、印捏镶滚四步操作、作品图片保存和互动粒子场。

线上版本：https://jinling-dough-studio.loftycandy2048.chatgpt.site/

## 本地运行

解压后在项目目录打开终端，运行：

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Windows 上可以把 `python3` 换成 `py -3`。打开浏览器访问 http://127.0.0.1:8000/。按 Ctrl+C 停止服务。JavaScript 使用 ES 模块，通过本地 HTTP 服务打开。

`dist/` 就是完整站点目录，直接修改其中的 HTML、CSS 和 JavaScript，刷新浏览器即可查看。Three.js、字体及图片均随包提供，运行无需 npm 安装。部署时将 `dist/` 中的文件原样上传到静态网站托管，确保 `index.html` 位于发布目录根部。

## 修改位置

| 要修改的内容 | 文件 |
| --- | --- |
| 页面结构与通用文案 | `dist/index.html` |
| 首页展盘、工坊布局和配色 | `dist/exhibition.css`、`dist/paper-studio.css`、`dist/style.css` |
| 作品名称、说明、步骤和配件位置 | `dist/collection.js` |
| 纸盘尺寸、浮雕轮廓、色彩与分层 | `dist/models.js` |
| 展盘、桌面相机、音效、步骤进度及导出 | `dist/app.js` |
| 按压、拖捏、镶嵌和滚动 | `dist/gestures.js` |
| 粒子取样、运动和操作面板 | `dist/particle-samples.js`、`dist/particle-field.js`、`dist/particle-room.js`、`dist/particles.css` |
| 作品展图、分步备用图和两种工作台背景 | `dist/art/` |

作品目录和模型构建函数使用同一顺序。修改作品造型后，可用下方工具重新渲染首页展图及备用分步图。每件作品的成品图是 `作品键.webp`，前三个完成状态是 `作品键-s1.webp` 至 `作品键-s3.webp`。`paper.webp` 是空纸盘。桌面和手机工作台是 `workbench.webp` 和 `workbench-phone.webp`。

## 重新渲染图片（可选）

需要 Node.js 22+、Blender 4.3+ 和安装了 Pillow 的 Python。以下命令在项目根目录运行。

```sh
node --experimental-vm-modules tools/export-reliefs.mjs
blender -b -P tools/render-reliefs.py
python3 tools/convert-relief-images.py
```

临时模型和渲染文件在 `tools/.render/`，转换后的 WebP 会覆盖 `dist/art/` 对应图片。只渲染指定作品时，可在 Blender 命令末尾加 `-- plum`（将 `plum` 换成相应作品键，或用 `paper` 渲染空盘）。

浏览器字体为 Noto Sans CJK SC 和 Noto Serif CJK SC 的字形子集。若增加了较多新文字，可用系统中文字体或替换为带有所需字形的同名 WOFF 文件。Three.js 和字体许可见 `dist/THREE-LICENSE.txt` 及 `dist/FONT-LICENSE.txt`。
