# Kotoba Chion

> 言葉（kotoba）+ chion —— 一款面向日语学习者的日中双语 / 纯日语 EPUB 阅读器与精读工具。

**Kotoba Chion** 是一个桌面阅读应用，专为「一边读日文原著、一边查词与理解」的精读场景打造。
它把日语分词、假名注音、词典联动、AI 流式讲解、按需翻译与本地语音朗读整合进同一个阅读界面，
让查词、看译文、听朗读都发生在你正在读的那一段旁边，尽量不打断阅读的连贯性。

- 软件许可：**专有软件**（见 [`LICENSE`](./LICENSE)）；第三方组件保留各自的开源许可
- 平台：Windows（基于 Electron，理论上可扩展到 macOS / Linux）
- 界面语言：简体中文

---

## 目录

- [核心特性](#核心特性)
- [界面与交互](#界面与交互)
- [技术栈](#技术栈)
- [环境要求](#环境要求)
- [安装](#安装)
- [GPT-SoVITS 语音朗读（可选）](#gpt-sovits-语音朗读可选)
- [使用说明](#使用说明)
- [数据与隐私](#数据与隐私)
- [项目结构](#项目结构)
- [开发命令](#开发命令)
- [软件许可](#软件许可)

---

## 核心特性

### 双模式阅读
- **日中双语书**：日文原文与内置中文译文成对呈现，按 `t` 即可展开该段译文。
- **纯日语书**：只有日文原文；按 `t` 时调用 AI 即时翻译并落库复用，下次同段无需重复请求。
- 导入时手动指定书籍类型，两条解析路径互不干扰。

### 日语分词与注音
- 基于 **Sudachi** 词典进行分词，支持 A / B / C 三种切分粒度。
- 逐词假名注音（furigana），可一键开关。
- 分词与注音在渲染层的 Web Worker 中完成，不阻塞阅读滚动。

### 词典联动
- 点击任意单词即写入系统剪贴板，可与 **GoldenDict** 等外部词典工具的「剪贴板取词」联动。
- 支持点词、选段、Shift 多选，选中内容同时写入剪贴板并暂存到 AI 输入框。

### AI 流式分析
- 选中文本后交给 AI 做流式讲解（语法、词义、语境等），支持多轮对话。
- **多档案切换**：可配置多套 AI 服务（baseURL / apiKey / model / 系统提示词），随时切换。
- 兼容 OpenAI 风格的 Chat Completions 接口（如 DeepSeek 等）。
- **对话存档**：每轮回答自动按「逻辑日」持久化，可回翻、搜索、按天删除。

### 即时翻译
- 纯日语书按 `t` 时，对未翻译段落调用 AI 翻译并落库；译文与 AI 分析相互独立、互不干扰。
- 双语书永远只显示内置译文，绝不触发 AI 翻译。

### 本地语音朗读（可选）
- 接入本地 **GPT-SoVITS**，可朗读词 / 句 / 段，或从当前段开始连续朗读。
- 连读支持自动翻章、预取合成、自动滚屏跟随，并把当前段同步到剪贴板与 AI 输入框。
- 语音引擎以「声音档案」管理，可配置参考音频、语速等参数。

### 高度可定制的外观
- 明暗主题 + 多套内置外观预设（护眼纸、豆沙绿、夜间黑、墨蓝夜等）。
- 正文 / 注音 / 译文字号、行距、字距、段距、内容宽度、边距等均可调。
- 支持导入自定义字体（日文 / 中文字体族可分别指定）。
- **可自定义快捷键**：切译文、上一章、下一章。

---

## 界面与交互

三栏布局：左侧目录（可收起）、中间阅读区、右侧 AI 面板（可收起）。

- **左键点词**：写剪贴板 + 暂存到 AI 输入框；朗读模式下同时朗读该词。
- **右键点段**：整段原文写剪贴板 + 暂存；朗读模式下同时朗读该段。
- **`t` 键**：切换鼠标悬停段（或连读时的当前段）的译文显示。
- **左 / 右方向键**：上一章 / 下一章（快捷键可在设置中修改）。
- 阅读区采用虚拟列表按视口渲染，长章节也能流畅滚动。

---

## 技术栈

| 层 | 技术 |
| --- | --- |
| 桌面框架 | Electron 33 |
| 前端 | React 19 + TypeScript |
| 构建 | Vite（经 `electron-vite` 串联 main / preload / renderer 三入口） |
| 样式 | Tailwind CSS v4 + shadcn/ui |
| 存储 | SQLite（better-sqlite3，主进程原生模块） |
| 配置 | electron-store |
| 分词 | Sudachi（WASM，渲染层 Web Worker） |
| 语音 | GPT-SoVITS（本地 HTTP 服务，可选） |

---

## 环境要求

- **Node.js**：开发和打包需要 22.12 或更高版本；发行版用户不需要安装 Node.js。
- **Git**：用于克隆仓库。
- **操作系统**：主要在 Windows 下开发与测试。
- **（可选）GPT-SoVITS**：仅在需要语音朗读时安装，见下文。

---

## 安装

### Windows 发行版

- **安装版**：运行 `Kotoba-Chion-Setup-3.0.0-x64.exe`，按向导选择安装目录。
- **免安装版**：完整解压 `Kotoba-Chion-Portable-3.0.0-x64.zip`，运行其中的
  `Kotoba Chion.exe`。

发行版已经内置 Electron、与 Electron ABI 匹配的 `better-sqlite3` 和 Sudachi 词典，目标电脑
不需要安装 Node.js。安装版和免安装版共用 `%APPDATA%\kotoba-chion` 中的书库与设置。

当前发行版未购买代码签名证书，Windows SmartScreen 可能显示“Windows 已保护你的电脑”。
确认下载来源并核对 `SHA256SUMS.txt` 后，可选择“更多信息 → 仍要运行”。

### 私有源码开发

私有仓库的开发环境仍按以下顺序准备：

```bash
npm install --ignore-scripts
npm run setup
npm run setup:dict
npm run dev
```

`better-sqlite3` 必须针对 Electron ABI 编译。换 Electron 版本或重装依赖后需重新运行
`npm run rebuild`。

---

## GPT-SoVITS 语音朗读（可选）

语音朗读依赖本地运行的 **GPT-SoVITS** API 服务（`api_v2.py`，默认监听 `127.0.0.1:9880`）。
不配置也不影响阅读、查词、AI 分析与按 `t` 看译文——语音是纯增值功能。

### 1. 准备 GPT-SoVITS

从 [GPT-SoVITS 官方项目](https://github.com/RVC-Boss/GPT-SoVITS) 获取整合包（含内置
`runtime\python.exe` 与 `api_v2.py` 的版本）。按其文档准备好底模与你的声音模型。
本项目在 `GPT-SoVITS-v2pro` 系列整合包上测试通过。

### 2. 配置启动脚本

编辑仓库根目录的 `启动全部.bat`，把顶部的 `SOVITS_DIR` 改成你的 GPT-SoVITS 整合包目录：

```bat
REM 例：
set "SOVITS_DIR=D:\GPT-SoVITS-v2pro-20250604"
```

- 该目录需同时包含 `api_v2.py` 与 `runtime\python.exe`。
- 留空，或找不到上述文件，则自动跳过语音服务、只启动阅读器。
- 路径不写死在代码中，因为每台机器的安装位置不同。

### 3. 启动

双击 `启动全部.bat`：先在独立窗口后台启动 GPT-SoVITS（首次加载模型约 1 分钟），
再启动阅读器。不需要朗读时，直接关闭那个语音服务窗口即可。

也可以手动启动语音服务：

```bash
cd <你的 SOVITS_DIR>
runtime\python.exe api_v2.py -a 127.0.0.1 -p 9880
```

### 4. 在应用内配置声音档案

进入 **设置 → 声音**：

1. 选择一段**参考音频**（3–10 秒的 wav，通常取自 GPT-SoVITS 整合包的 `slicer_opt/` 目录）。
   该路径需是**语音服务本机可读的绝对路径**。
2. 填写 **promptText**（即该参考音频里念的日文台词内容）。
3. 可按需调整语速等参数。

配置好后，在阅读界面开启「朗读模式」，即可点词 / 点段朗读或连续朗读。

> 参考音频路径与提示词默认留空，需由你手动填写——因为它们同样与本机安装位置强相关。

---

## 使用说明

1. 启动应用后进入书架，点击「导入」选择本地 EPUB 文件，并选择书籍类型（日中双语 / 纯日语）。
2. 打开书籍进入阅读界面：左键点词查词、右键点段、`t` 键看译文、方向键翻章。
3. 选中文本会自动填入右侧 AI 面板的输入框，编辑后发送即可开始流式分析。
4. 在 **设置** 中调整外观、字体、注音、AI 档案、翻译、声音与快捷键。
5. 如需朗读，先配置并启动 GPT-SoVITS，再在设置中配好声音档案并开启朗读模式。

> 出于版权考虑，本仓库不包含任何 EPUB 书籍，请自行准备。

---

## 数据与隐私

- 书库、阅读进度、AI 档案、声音档案（含 API Key）等均由 **electron-store / SQLite** 存储在系统用户数据目录
  （Windows 下为 `%APPDATA%\kotoba-chion`），**不在仓库内**，不会进入发行包。
- 导入的 EPUB 中的插图会落盘到 `%APPDATA%\kotoba-chion\books\`。
- API Key 仅保存在本地，直接由应用连接你配置的 AI 服务，不经任何第三方中转。
- `.gitignore` 已排除 `*.epub`、Sudachi 词典、`node_modules`、`.env` 等，避免误提交书籍或密钥。

---

## 项目结构

```
src/
  main/                   # 主进程（Node）：SQLite、EPUB 解析入库、electron-store、IPC
    modules/storage/      #   书库与进度持久化（SQLite）
    modules/epub-import/  #   EPUB 解析、双语配对、图片落盘
    modules/ai-store/     #   AI 档案与对话存档
    modules/voice-store/  #   声音档案与语音合成代发（绕 CORS）
    modules/font-store/   #   自定义字体落盘
  preload/                # contextBridge：渲染层与主进程之间的 IPC 门面
  worker/                 # 渲染层 Web Worker：Sudachi 分词（A/B/C 模式）
  renderer/               # 渲染进程（React）
    src/modules/
      reader-view/        #   阅读区、分词渲染、注音、翻章
      interaction/        #   点词 / 选段 / 剪贴板 / 暂存 / 快捷键
      ai-analysis/        #   AI 流式分析会话与面板
      ai-translation/     #   按需 AI 翻译
      library/            #   书架、导入
      settings/           #   设置面板（外观 / 字体 / AI / 翻译 / 声音 / 快捷键）
      tts/                #   朗读：声音档案、播放会话、连读编排
docs/                     # 内部设计文档（领域语言、总纲、会话记录等）
scripts/                  # 构建 / 自测 / 词典下载等脚本
```

---

## 开发命令

```bash
npm run dev             # 开发模式启动（热重载）
npm run build           # 生成 main / preload / renderer 生产构建
npm run release:win -- --output "%TEMP%\kotoba-release" # Windows x64 完整发行流程
npm run typecheck       # TypeScript 全量类型检查（主进程 + 渲染层）
npm run setup           # 下载 Electron 二进制并重编 better-sqlite3
npm run rebuild         # 单独重编 better-sqlite3（换 Electron 版本后运行）
npm run setup:dict      # 下载 Sudachi 词典
npm run test:tokenizer  # 分词自测（需先 setup:dict）
npm run test:tts        # 语音相关模块自测
```

各功能模块均带有独立的自测脚本（`npm run test:*`），可单独运行验证。

---

## 软件许可

Kotoba Chion 是专有软件，版权所有 © 2026 Chion240。安装和使用须遵守 [`LICENSE`](./LICENSE)
中的最终用户许可协议。第三方组件继续遵守各自的开源许可证，详见
[`THIRD_PARTY_NOTICES.txt`](./THIRD_PARTY_NOTICES.txt)。

过去已经依据 GPL 获得的软件副本继续受当时授权条款保护；本许可变更不撤回既有授权。
