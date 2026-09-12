# Chion RUAD V3 — 项目交接文档（PROJECT_HANDOFF）

> 写给下一个接手的 AI 总管理者。读完这份，你应能零上下文全盘接管这个项目、继续当项目经理。
> 本文是**导航与状态总览**；细节永远以三份基准文档为准（见第 2 节）。
> 最后更新：会话 13 收尾后（契约 v5）。

---

## 1. 你是谁 · 你的职责

你是这个项目的**总纲层 / 项目经理**，不是码农。因为单个会话上下文有限，本项目采用「一个管理者 + 多个执行子会话」的模式：

- **你做**：把需求拆成模块任务卡、派给子会话；子会话交付后**亲自实测核对**（不只看绿灯）；守契约与铁律；签收或打回；维护台账 `SESSION_LOG.md`；处理跨模块协调与契约变更审批；写文档收尾。
- **你不做**：亲自写业务模块代码。除非是文档、台账、契约注入这类总纲层收尾工作，或极小的协调性改动。

### 工作循环（每批任务）

1. 读需求 → 判断落哪个模块、是否动契约、依赖顺序。
2. 写**详细任务卡**（具体动作+场景，不用抽象词），交给用户去开新会话执行。
3. 子会话干完 → 你**实测核对**：跑 `typecheck`/`build`/全部 `test:*`/`smoke`；必要时查库、查文件、比时间线，**打到真实数据/真实操作**。
4. 通过 → 更新台账（状态表 + 集成核对记录）、签收；不通过 → 指出根因、打回或派补丁会话。
5. 契约有变 → 只能走 CR 流程（见第 5 节），审批后由你注入总纲、推版本号。

---

## 2. 基准文档 · 谁说了算

四份文档，冲突时优先级从高到低：

| 文档 | 角色 | 何时读 |
|------|------|--------|
| `V3_MASTER_PLAN.md` | **宪法/绝对基准**。技术栈、模块划分、4 个契约、交互模型、关键决策。 | 每次开工必读 |
| `CONTEXT.md` | **领域语言词汇表**（DDD）。AI 分析会话/译文/段/暂存输入等概念的精确定义与"避免"词。 | 命名、概念澄清时 |
| `SESSION_LOG.md` | **当前状态与接缝**（活文档）。模块状态表、每会话记录、下游须知、契约变更请求、集成核对记录。 | 每次开工必读 + 每次收工必更 |
| `HANDOFF_V3.md` | **v2→v3 历史教训**。双语配对安全（绝不隐藏日文）、性能红线来源。被总纲引用。 | 碰导入/配对/性能时 |

- 契约是**唯一跨会话真值**。想改契约 → 走 `SESSION_LOG.md` 的「契约变更请求」区，**禁止子会话自行改契约定义**。
- 总纲与 CONTEXT 冲突时以总纲为准；总纲与 HANDOFF 的历史细节冲突时以总纲为准（HANDOFF 是教训参考不是现状）。

---

## 3. 项目是什么

**Chion RUAD V3** —— 日中双语 / 纯日语 EPUB 阅读器 + 语言学习桌面应用（Electron 桌面端，win32）。面向"边读日语轻小说边学"。

三条核心动作（总纲 + CONTEXT）：
1. **点词 → 写剪贴板**：点一个词，其原形进剪贴板，联动外部 GoldenDict 弹词典（应用本身无词典 UI）。
2. **选中文本 → 流式 AI 分析**：选中→暂存→手动发送→OpenAI 兼容接口流式讲解语法/翻译，多轮累积，按逻辑日存档。
3. **朗读 (TTS)**：本地 GPT-SoVITS 或在线，带情感分类选语气。

阅读侧：支持**双语 EPUB**（一段日一段中，按 `t` 看内置译文）与**纯日语 EPUB**（按 `t` 走 AI 译文）。日文段承载分词/注音/交互，中文是附属译文。

**铁律（总纲第 0 节，任何会话不得违反）**：
1. 绝不隐藏日文（双语配对安全，见 `HANDOFF_V3.md`）。有假名的段一律当日文显示。
2. 性能红线：视口懒加载 + 后台预取，绝不一次性分词/渲染整章（v2 卡死的病根）。
3. 双语书按 `t` 只用内置译文，**绝不走 AI**；AI 译文只用于纯日语书。
4. 每个模块交付必须带**可独立跑的自测**（`test:*`）。
5. 收工必更 `SESSION_LOG.md`；改契约必走 CR 流程。

---

## 4. 已完成的进度（会话 1 → 13 全景）

**地基第一阶段 + ai-analysis + settings 全部完成并核准**。完整链路已打通并实测：
导入(选双语/纯日) → 配对入库 → 书架 → 打开书 → 按章加载 → 视口分词(A/B/C) → 虚拟化渲染 → Sudachi 注音(可关) → 中文展开(悬停+t) → 点词写剪贴板 → 选择暂存 → 流式 AI 分析(多轮+多档案+按逻辑日存档) → 进度保存 → 删书。左侧目录可收起+可拖宽，右侧面板可收起+可拖宽。全局设置面板（阅读/目录/注音/外观/字体/AI档案，含自定义字体导入）统一管所有视觉旋钮 + 明暗。

**后续里程碑**：会话 11/11.1 修分词失效（StrictMode 双挂载杀 worker）+ 词框旋钮；会话 12 settings 模块（契约推 v5，CR-4 字体导入）；会话 13 修 AI 会话收起即销毁（会话状态提到模块级 store）。

### 模块状态总表

| 模块 | 路径 | 状态 | 会话 | 契约 | 自测命令 |
|------|------|------|------|------|----------|
| 脚手架 | (根/electron-vite) | ✅ 已核准 | 1 | — | `npm run smoke` |
| storage | `src/main/modules/storage` | ✅ 已核准 | 2 | 1,4 | `npm run test:storage` |
| ui-kit | `src/renderer/src/modules/ui-kit`+`components/ui` | ✅ 已核准 | 3 | — | typecheck+build |
| epub-import | `src/main/modules/epub-import` | ✅ 已核准 | 4,9 | 1,4 | `npm run test:epub` |
| tokenizer | `src/worker` | ✅ 已核准 | 5 | 2 | `npm run test:tokenizer` |
| reader-view | `src/renderer/src/modules/reader-view` | ✅ 已核准 | 6,9,9.1,11,11.1 | 1,2,4 | `npm run test:reader` |
| interaction | `src/renderer/src/modules/interaction` | ✅ 已核准 | 7 | 3 | `npm run test:interaction` |
| library | `src/renderer/src/modules/library` | ✅ 已核准 | 8,12 | 4 | `test:library`/`library-integ`/`progress` |
| ai-analysis | `src/renderer/src/modules/ai-analysis`+`main/modules/ai-store` | ✅ 已核准 | 10,13 | CONTEXT+4(v4) | `npm run test:ai` |
| settings | `src/renderer/src/modules/settings`+`main/modules/font-store` | ✅ 已核准 | 12 | 4(CR-4,v5) | `npm run test:settings` |
| ai-translation | `src/renderer/src/modules/ai-translation` | ✅ 已核准 | 15 | 4(v1) | `npm run test:ai-translation` |
| tts | `src/renderer/src/modules/tts`+`main/modules/voice-store` | Phase 1 完成待集成 | 17 | 4(CR-5,v6) | `npm run test:tts` |

### 各模块要点（细节见 SESSION_LOG 对应会话记录）

- **storage**（会话 2）：SQLite 三表 `books`/`chapters`/`segments`（`src/main/modules/storage/db.ts`）+ 进度走 electron-store（`progress.ts`，非 SQLite）。只依赖 better-sqlite3、不 import electron（便于自测）。`index.ts` 注册契约 4 数据类 IPC。**不复用 seq/id**（AUTOINCREMENT）。
- **ui-kit**（会话 3）：设计 token 在 `src/renderer/src/index.css`（oklch 亮/暗双主题 + `--font-reading-jp` 日文正文字体栈）。shadcn 组件在 `components/ui/`（button/dialog/tabs/switch/slider，手写 Tailwind v4）。**下游用语义色 class，别写死颜色**；暗色挂 `.dark`。
- **epub-import**（会话 4+9）：`zip.ts` 手写最小 ZIP 读取（零依赖）；`parse.ts` XHTML→段+双语配对（纯正则，`plainText` 会话 9 加 `CJK_GAP` 清 CJK 间空格）；`import.ts` 编排，seq 每本书从 0 连续。图片落盘 `<userData>/books/<bookId>/images/`，`image_ref` 存相对路径。
- **tokenizer**（会话 5）：renderer 侧 Web Worker（`src/worker/tokenizer.worker.ts`）跑 Sudachi WASM（`sudachi-wasm333`）。词典 ~200MB 走 `npm run setup:dict` 下到 `src/renderer/public/sudachi/system.dic`（不入 git）。`sudachi.ts` 是纯核心。A/B/C 三模式，输出契约 2 Token。**主/渲染线程永不跑 Sudachi**。
- **reader-view**（会话 6+9+9.1+11+11.1）：react-virtuoso 虚拟化，**按章加载**（listChapters 的 startSeq/endSeq）。`tokenizer-client.ts` 包 worker（correlation-id 绕契约 2 只返 seq 的局限）。`ruby.ts` Sudachi 读音注音（弃书自带 ruby）。`reader-logic.ts` 纯逻辑（t 键悬停切译文 + 面板宽度夹取 + 词框间距/底色夹取）。左目录/右面板可收起+可拖宽。t 键作用于**鼠标悬停段**。**会话 11 教训**：一次性资源（worker/socket/observer）必须在 effect 里建 + cleanup 清 ref，否则 StrictMode 双挂载留死引用（分词全静默丢失的根因）。**会话 12 后**：正文字号/行距/边距/颜色/注音/字体/词框旋钮全由 settings 的 CSS 变量驱动（reader.css 写死值已 var 化），A/B/C 模式 + 注音 + 中文开关改读 settings store（持久化，不再每次打开书重置）。
- **interaction**（会话 7）：契约 3 落地。`selection.ts`（点词原形/shift 多选表层/覆盖语义）、`staged-store.ts`（暂存输入单一真值，草稿保护，`useSyncExternalStore`）、`clipboard.ts`、`keybindings.ts`。`StagedInputBox.tsx` 占位 AI 输入框，`onSend` 留给 ai-analysis。
- **library**（会话 8）：书架/导入/删书/进度 UI。`useLibrary.ts` + `import-flow.ts`（导入状态机）+ `ReaderScreen.tsx`（进度往返，防抖 800ms saveProgress）。`App.tsx` 书架↔阅读器路由。删书清三处（db 两库 + 进度 + 图片目录，main 编排）。
- **ai-analysis**（会话 10+13，契约 v4/CR-3）：流式 AI 分析会话，renderer 直连 OpenAI 兼容接口(SSE)不经 IPC。`ai-client.ts`（`parseSSE` 纯函数 + `streamChat` fetch+AbortController）、`session-logic.ts`（纯 reducer）、`session-store.ts`（**会话状态住模块级作用域**，会话 13 加）、`useAISession.ts`（`useSyncExternalStore` 薄订阅，**单一真值无镜像**，到 done 写档）、`useAiProfiles.ts`（多档案，种 DeepSeek 默认）、`AIPanel.tsx`（档案标签+消息列表+复用 StagedInputBox；配置已搬进 settings）。持久化走主进程 `main/modules/ai-store/`（AI 档案 + 对话存档，仿 progress.ts 可注入；`logical-day.ts` 纯逻辑）。挂在 reader-view 右面板。**apiKey 明文存**；存档不回灌实时框。**会话 13 修**：会话状态原在 `useReducer`（组件本地态），AIPanel 在 `{panelOpen&&…}` 下条件渲染 → 收起面板即销毁会话，违背 CONTEXT「收起不销毁」铁律；提到模块级 store 后存活（仿 staged-store/settings-store）。
- **settings**（会话 12，契约 v5/CR-4）：全局设置面板，**CSS 变量驱动**。`settings-store.ts`（模块级单一真值 + `useSyncExternalStore`，单键 `chion-settings` 存 localStorage，`applySettings` 写 CSS 变量到 `document.documentElement` + 切 `.dark`）、`settings-logic.ts`（纯逻辑：clamp/sanitizeColor/sanitizeFontFamily 防 CSS 注入/coerce 向前兼容/toCssVars）、`SettingsDialog.tsx`+`SettingsControls.tsx`+`FontTab.tsx`+`ProfileTab.tsx`（六分区 Tabs：阅读/目录/注音/外观/字体/AI档案）。两处入口（阅读器工具栏 + 书架）。字体导入落主进程 `main/modules/font-store/`（CR-4，字体文件落 `<userData>/fonts/`，渲染层 `@font-face src:file://<path>` 注册）。**视觉/阅读偏好 + 模式/注音/中文开关走 localStorage**（持久化，行为变更已同意）；AI 档案仍走 electron-store；仅字体文件（大）落主进程磁盘。

---

## 5. 契约 v5 速查（唯一跨会话真值）

定义在 `V3_MASTER_PLAN.md` 第 4 节。当前 **v5**。

- **契约 1 — Segment**（storage ↔ 全体）：`{ id, book_id, chapter_id, seq, type:'pair'|'heading'|'image', jp_text, zh_text, zh_source:'builtin'|'ai'|null, ruby:[{base,rt}], image_ref }`。seq 每本书从 0 连续。
- **契约 2 — 分词**（reader-view ↔ tokenizer Worker）：`TokenizeReq={seq,text,mode:'A'|'B'|'C'}` → `Token={surface,dictionaryForm,reading,pos}`。**已知局限**：响应只带 seq，reader-view 用客户端 correlation-id 绕过。
- **契约 3 — Selection**（interaction → 剪贴板+暂存）：`{ kind:'word'|'segment', surface, dictionaryForm?, seqs[] }`。点词带原形，多选用表层。
- **契约 4 — IPC**（renderer ↔ main）：
  - v1：`importBook(path,mode)` / `getSegments(bookId,from,to)`(闭区间) / `saveProgress` / `getProgress` / `getImagePath` / `saveAiTranslation(segId,zh)`
  - v2 (CR-1，会话8)：`listBooks():BookMeta[]` / `deleteBook(bookId)` / `pickEpubFile():string|null`
  - v3 (CR-2，会话9)：`listChapters(bookId):ChapterMeta[]`（`ChapterMeta={id,ordinal,title,startSeq,endSeq}`）
  - v4 (CR-3，会话10)：`getAiProfiles()`/`saveAiProfiles(state)` / `appendChatArchive(round)`/`listChatArchive():ChatArchiveDay[]`（AI 档案含 apiKey 明文 + 对话存档按逻辑日合并；流式请求 renderer 直连 SSE 不经 IPC）
  - v5 (CR-4，会话12)：`importFont():FontMeta|null` / `listFonts():FontMeta[]` / `deleteFont(id)`（`FontMeta={id,family,fileName,path}`，字体文件落 `<userData>/fonts/`；视觉旋钮走 localStorage 不入契约）

演进史：v1 初版 → v2 (CR-1 书架/删书/文件选择器) → v3 (CR-2 列章节) → v4 (CR-3 AI 档案+对话存档) → v5 (CR-4 字体导入)。契约 1/2/3 从未改过，只有契约 4 在新增。

---

## 6. 架构与数据流

### 三进程 + Worker（electron-vite 三入口）

```
main (Node)         : SQLite、electron-store、文件系统、dialog；注册契约 4 IPC handler
  ↑ ipcMain.handle
preload             : contextBridge 暴露 window.chion.*（契约 4 的门）
  ↑ window.chion
renderer (React)    : 书架/阅读器 UI；通过 window.chion 调 main
  ↕ postMessage
worker (Web Worker) : Sudachi 分词（契约 2）；渲染线程发文本、收 Token
```

### 完整数据流

```
选 epub + 选 mode → importBook → zip 解压 → parse(XHTML→段+配对) → 图片落盘
  → insertBook/Chapter/Segments(SQLite, seq 从0连续)
书架 listBooks → 点书 → getProgress → 按章 listChapters + getSegments(章内区间)
  → Virtuoso 只挂视口段 → worker 分词(视口+预取) → 渲染 token+Sudachi 注音
  → 点词/选段(interaction) → 写剪贴板 + 暂存(staged-store)
  → 滚动 → 防抖 saveProgress
```

### 存储
- **SQLite**（`<userData>/chion.db`）：书内容（books/chapters/segments）。
- **electron-store**（`reading-progress`）：阅读进度，按 bookId 索引。
- **图片**：`<userData>/books/<bookId>/images/<basename>`。
- **词典**：`src/renderer/public/sudachi/system.dic`（dev 由 Vite 服务 `/sudachi/system.dic`）。
- win32 userData 实际路径：`%APPDATA%/kotoba-chion/`（旧版为 `chion-ruad`，会话 18 改名）。

---

## 7. 关键决策与踩过的坑（从台账萃取，必读）

- **better-sqlite3 装机两步**：`npm install --ignore-scripts` → `npm run setup`（编到 Electron ABI）。直接 install 会因 Node ABI 编译失败。换 electron 版本要 `npm run rebuild`。
- **Sudachi 自带词典残缺**：`sudachi-wasm333` 自带的 `system.dic` 无 C-unit 切分数据（A/B/C 模式无差异、误分词）。**必须**用 `npm run setup:dict` 下的官方 SudachiDict。
- **生产 file:// 路径债（打包会话一起清）**：两处同类债——① worker 默认 `fetch('/sudachi/system.dic')`，dev 正常但**打包后 file:// 失效**，需起 worker 后发 `configure(dictUrl)`（`tokenizer-client.ts` 已留口）；② settings 导入字体的 `@font-face src:url('file://<path>')`（`fonts.ts`），打包后严格 CSP/webSecurity 可能拦 file://，需自定义 protocol 或 data URL。另 renderer 直连外部 AI 域名(SSE)打包后也可能被 CSP 拦，需放行。三者都在打包会话处理。
- **StrictMode 生命周期教训（会话 11）**：一次性资源（worker/socket/observer）**必须在 effect 里建 + cleanup 清 ref**，别用 render 阶段 `if(!ref.current) ref.current=new X()`。否则 StrictMode 双挂载留死引用（分词全静默丢失、无报错的根因，纯 Node 自测测不到，只有真 React dev 触发）。
- **单一真值住模块级 store（会话 13）**：会话状态若挂在条件渲染组件（`{open&&<Panel/>}`）的本地 state，收起即销毁。跨"视图可见性"存活的状态（AI 会话、暂存输入、设置）一律提到模块级 store + `useSyncExternalStore`（本项目三例：`staged-store`/`settings-store`/`session-store`）。
- **白屏根因（会话 9 已修）**：Virtuoso `initialTopMostItemIndex` + 首屏空数组 + 双语书头段是 image（冷缓存高度突变）→ 锚定算错。改按章加载 + 数据就绪后 `scrollToIndex` 根治。
- **格式空格污染根因（会话 9 已修）**：`parse.ts plainText` 删 ruby 标签后，CJK 汉字间的缩进空格没清 → `骨色の魔法` 存成 `骨色の 魔 法`。加 `CJK_GAP` 正则清 CJK 间空白、保留拉丁词间空格。**改 parser 后必须重新导入旧书才生效**。
- **进度按章**：存当前顶段 seq，重开恢复到该章大概位置（不必精确）。
- **contract 2 correlation-id**：响应只返 seq，无法区分同 seq 不同 mode/重发；reader-view 客户端用自增 reqId 当 seq 发、本地还原，未改契约。
- **t 键归属**：仍在 reader-view 内部；interaction 的 `keybindings.ts` 有可配置真值但未强夺。settings 会话若做可自定义快捷键需跨模块协调。

---

## 8. 怎么跑 / 怎么验证

### 装机 / 启动
- 首次：`npm install --ignore-scripts` → `npm run setup` → `npm run setup:dict`（200MB，慢）。或双击 `安装依赖.bat`。
- 启动 dev：`npm run dev` 或双击 `启动.bat`。（bat 文件必须 CRLF+UTF8-BOM，否则闪退。）

### 验证清单（签收前跑）
```
npm run typecheck
npm run build
npm run test:storage / test:epub / test:tokenizer / test:reader
npm run test:interaction / test:library / test:library-integ / test:progress
npm run test:ai / test:settings
npm run smoke
```
（当前 11 个 `test:*` + smoke，签收前应全绿。字体落盘/GUI 交互靠实机手验。）

### 查真实数据库（实测核对用，说到做到别只看绿灯）
```powershell
$env:ELECTRON_RUN_AS_NODE=1
'const path=require("path");const D=require("better-sqlite3");' +
  'const db=new D(path.join(process.env.APPDATA,"kotoba-chion","chion.db"),{readonly:true});' +
'console.log(db.prepare("SELECT id,title,kind FROM books").all());' |
  & "node_modules\.bin\electron.cmd" -
```
用它查段文本、章节、seq 范围、created_at 等，验证子会话的改动真落到了数据上。

---

## 9. 待办路线图（剩余功能 + 收尾）

已完成：ai-analysis（会话 10+13）、settings（会话 12，含字体导入 + 全局暗色持久化）。剩余（各自独立会话，不动已核准模块核心）：

1. **ai-translation** — 纯日语书按 `t` 的 AI 译文。reader-view 已留挂点（zh_source=null 时触发翻译→saveAiTranslation 落库复用）。**复用 `ai-analysis` 的 `streamChat`/`parseSSE`（barrel 已导出）+ `useAiProfiles` 的 `activeProfile` 连接配置，但用独立翻译提示词，别复用 `useAISession`**（译文是单句、不进聊天框、不多轮）。译文字号已用 `--reader-zh-size`。**双语书永不走此路径**（铁律 3）。
2. **tts** — 朗读，本地 GPT-SoVITS 或在线，情感分类选语气。挂点：选择/段落。
3. **对话存档 UI** — 翻阅/搜索/按天删除。`listChatArchive()` 已可用；**按天删除需 CR-5**（当前只有 append+list）。存档不回灌实时框（铁律）。
4. **打包会话** — 清三处 file:// 债（生产词典 `configure(dictUrl)` + 字体 `@font-face` + AI 域名 CSP 放行，见第 7 节）；分包优化（当前 renderer bundle ~925KB、worker ~2.3MB）。
5. **快捷键自定义（可选）** — 接管 t 键、读 interaction `keybindings.ts`（跨 reader-view/interaction/settings 协调）。settings 已就绪可挂 UI。

**加密待办**：apiKey 当前明文存 electron-store，若要加密单独议。

---

## 10. 协作规矩（血泪教训，务必遵守）

1. **验收打到真实数据/操作，不只看绿灯**。会话 9 空格代码对但数据没重导（书 created_at 早于代码落盘 35 分钟），当初只看自测绿就签收 → 漏过。涉及数据/格式的改动，签收前必须实际操作一遍 + 查库确认。
2. **需求用「具体动作 + 场景」描述，不用抽象词**。"作用于聚焦段"被实现成"视口顶段"，用户真意是"鼠标悬停段"。关键交互先复述给用户确认（"你按 t 时鼠标停在句子 X 上，期望 X 的中文出现"）再写任务卡。
3. **契约变更必走 CR 流程**：子会话在 SESSION_LOG「契约变更请求」区提 CR，你审批 → 注入总纲第 4 节 → 推版本号 → 归档 CR。子会话禁止自行改契约定义。
4. **子会话只碰自己模块**，改共享文件（App.tsx/preload/main/契约相邻）需在任务卡明示并保持向后兼容。
5. **收工必更台账**：子会话写会话记录，你写集成核对记录 + 状态表。
6. **编号约定**：主会话用整数（1-9）；补丁用小数（9.1）；契约变更用 CR-N。总纲的"节号"是文档结构，与会话号无关。

---

## 11. 如何继续（给你的第一步）

1. 读 `V3_MASTER_PLAN.md` + `SESSION_LOG.md`（尤其顶部集成核对记录 + 模块状态表）+ 本文。
2. 确认状态：跑第 8 节验证清单（11 个 test:* + smoke），应全绿。
3. 问用户下一步做哪个（剩余：ai-translation / tts / 对话存档 UI / 打包）。
4. 按第 1 节工作循环派任务卡。任务卡模板参考 `SESSION_LOG.md` 里历史会话的任务描述风格：**背景 + 职责 + 具体交付逐条 + 只碰哪些文件 + 自测要求 + 收工更台账**。

你现在就是这个项目的经理。地基稳、契约清、路线明——继续往下推。
