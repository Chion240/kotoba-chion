# Chion RUAD V3 — 会话交接台账（Session Log）

> **每个会话开工先读**：`V3_MASTER_PLAN.md`（宪法）+ 本文件（当前状态）。
> **每个会话收工必须**：在「会话记录」区追加一条，并更新「模块集成状态」表。
> **契约是唯一跨会话真值**：想改契约走「契约变更请求」区，**禁止自行修改契约**。
>
> 本文件只记**状态与接缝**，不复制代码。代码在仓库里，台账负责指路。

---

## 契约版本

当前：**v7**（定义见 `V3_MASTER_PLAN.md` 第 4 节的契约 1-4）。

变更历史：
- v1 — 初版，随总纲建立。
- v2 — 契约 4 新增 `listBooks` / `deleteBook` / `pickEpubFile`（CR-1，会话 8）。仅新增不改既有，契约 1/2/3 未动。**已由总纲层批准并注入总纲第 4 节**。
- v3 — 契约 4 新增 `listChapters(bookId): ChapterMeta[]`（CR-2，会话 9）。仅新增不改既有，契约 1/2/3 未动。**已由总纲层批准并注入总纲第 4 节**（实测：book5 listChapters 28 章 startSeq 0→3250 单调递增）。
- v4 — 契约 4 新增 `getAiProfiles`/`saveAiProfiles`/`appendChatArchive`/`listChatArchive`（CR-3，会话 10）。仅新增不改既有，契约 1/2/3 未动。**已由总纲层批准并注入总纲第 4 节**（实测：真实 electron-store 往返——档案含 apiKey 落盘、存档 3 轮同逻辑日合并、凌晨 01:00 归前一日）。
- v5 — 契约 4 新增 `importFont`/`listFonts`/`deleteFont`（CR-4，会话 12）。仅新增不改既有，契约 1/2/3 未动。**已由总纲层批准并注入总纲第 4 节**（实测：真实 7640 字节 TTF 落盘 `<userData>/fonts/`→listFonts→deleteFont 清盘全通；typecheck/build 在真实模块上绿）。
- v6 — 契约 4 新增 `getVoiceProfiles`/`saveVoiceProfiles`/`pickAudioFile`（CR-5，会话 17）。仅新增不改既有，契约 1/2/3 未动。**已注入总纲第 4 节**（实测：真实 electron-store 往返——声音档案落盘 `voice-profiles.json`→新实例读回一致；合成不经 IPC，渲染层直连 localhost:9880）。
- v7 — 契约 4 新增查词软件联动设置、`.exe/.lnk` 选择、安全启动与最近启动错误读取（CR-6，会话 22）。仅新增不改既有，契约 1/2/3 未动。**已注入总纲第 4 节**。

## 总纲层集成核对记录

- **第 1 批（会话 2 storage + 会话 3 ui-kit）已核准**：两会话都改了共享文件（storage 动 preload/main，ui-kit 动 App.tsx/index.css），总纲层集成验证 `typecheck` + `build` + `test:storage` + `smoke` **四项全绿**，无打架。契约仍 v1。
- **第 2 批（会话 4 epub-import + 会话 5 tokenizer）已核准**：契约 2/4 均未动；preload 干净续挂 importBook/getImagePath。集成验证 `typecheck`+`build`+`test:storage`+`test:epub`+`test:tokenizer`+`smoke` **六项全绿**（词典 207MB 就位）。地基五模块全部就绪。
  - **交给 reader-view/library 的两个已知债**：① 生产打包后 Sudachi 词典 `file://` 路径失效，需起 worker 后发 `{type:'config',dictUrl}` 覆盖（worker 已留口）；② epub-import 的纯日语路径(mode='jp')已实现但未用真书验证（手头只有双语书），ai-translation/library 会话首次用纯日语书时留意。
- **会话 6 reader-view 已核准**：`typecheck`+`build`+`test:reader` 绿，前批 storage/epub/smoke 无回归。契约仍 v1。
  - **契约 2 已知局限（记录，暂不改）**：响应只带 `seq`，无法区分"同 seq 不同 mode / 重发"的请求。reader-view 用客户端 correlation-id（自增 reqId 当 seq 发、本地还原）守约绕过，未改契约。若未来多个消费者共用 worker 出现串扰，再评估是否给契约 2 加 `reqId` 字段（需走变更请求）。
  - 债①（生产词典路径）仍开放：dev 已验通，打包后需 `configure(dictUrl)`，留给 library/打包会话。
- **会话 7 interaction 已核准**：契约 3 原样落地；`typecheck`+`build`+`test:interaction`(10 断言) 绿，前批 storage/epub/reader/smoke 无回归。契约仍 v1。只碰自己目录 + reader 必要接线（未动 reader 内部）。
  - **接口债（记录，暂不改）**：token `onTokenClick(seq,idx,token)`（会话 6 定）不带 MouseEvent，shift+左键靠 window keydown/keyup 还原 shift 态；窗口失焦松开 shift 可能漏 keyup，但下次非 shift 点击自愈。若后续要更稳，给 `onTokenClick` 加事件参数（改会话 6 接口，需协调）。
  - **快捷键 `t` 归属未统一**：reader-view 的 `Reader.tsx` 仍内部拥有 `t` 监听；interaction 的 `keybindings.ts` 提供可配置真值但未强夺。settings 会话若要真·可自定义快捷键，需让 reader 改读 keybindings（跨模块协调）。
- **会话 8 library 已核准 + CR-1 批准 → 契约推 v2**：书架/导入/进度/删书落地；守契约变更流程（提 CR 未硬改）。集成验证 `typecheck`+`build`+`test:library`+`test:library-integ`+`test:progress` + 前批六自测（storage/epub/tokenizer/reader/interaction/smoke）**全绿无回归**。进度接线用可选 props 保持 reader-view 向后兼容。
  - **🎉 地基第一阶段（会话 1-8）全部完成并核准**。完整链路打通：导入(选双语/纯日)→配对入库→书架→打开→视口分词(A/B/C)→虚拟化渲染→ruby→中文展开→点词写剪贴板→选择暂存→进度保存→删书。
  - **地基唯一遗留债**：生产打包后 Sudachi 词典 `file://` 路径失效，需 `configure(dictUrl)`（dev 全流程已验通）。留给打包/settings 会话。
- **会话 9 + 9.1 阅读体验重构已核准 + CR-2 批准 → 契约推 v3**（总纲层实测签收，非只看绿灯）：
  - 用户实测报 7 问题，全部处理：①双语白屏（根因 Virtuoso `initialTopMostItemIndex`+首屏空数组+双语书头段是 image 冷缓存高度突变 → 改按章加载+`scrollToIndex` 根治）②分词看不见（token 加常驻框）③**格式混乱真凶**（`parse.ts plainText` 删 ruby 标签后 CJK 间缩进空格未清 → `骨色の魔法` 存成 `骨色の 魔 法`；会话 9 加 `CJK_GAP` 正则清除、保留拉丁词间空格）④左侧目录可收起（全列，空标题占位）⑤右侧面板可收起（含暂存框）⑥按章加载+上下章导航⑦注音统一(弃 seg.ruby 用 Sudachi)+可关默认开。
  - 会话 9.1 补丁：t 键改用**鼠标悬停段**（原用视口顶段→按 t 出的是标题中文）、空悬停不响应；左右面板**可拖拽调宽**（state+localStorage 持久化+clampWidth 夹取）。
  - **踩坑教训（写进协作规矩）**：会话 9 空格代码对但**数据未重导**（书 created_at 早于 parse.ts 落盘 35 分钟），当初我只看自测绿+看台账就签收，没打到真实数据 → 漏过。9.1 起改为**实测打到真实数据/操作**才签收。
  - **实测证据**：重导后 book5（id 3→5 证明真重导）`ピアノの白鍵は` 无空格；listChapters 28 章 startSeq 0→3250 单调；9 项自测+`typecheck`+`build` 全绿无回归。
  - **契约 v2→v3**：CR-2 `listChapters` 已注入总纲第 4 节。
- **会话 10 ai-analysis 已核准 + CR-3 批准 → 契约推 v4**（总纲层实测签收）：
  - MVP 全交付：流式 AI 分析会话（renderer 直连 OpenAI 兼容 SSE，不经 IPC）+ 多档案切换 + 按逻辑日自动存档。`useAISession` 单一真值无镜像（守 CONTEXT 歧义教训）、到 done 才写档、双语书 t 键仍只走内置译文（未触碰 reader 的译文铁律）。
  - **实测（真实 electron-store 往返，不只看绿灯）**：档案含 apiKey 落 `ai-profiles.json`；3 轮同逻辑日合并成 1 天；凌晨 01:00 归前一日（03:00 分界）；两 store 文件真落盘。`test:ai`+九自测+typecheck+build 全绿无回归。
  - **下游须知**：① ai-translation 复用 `streamChat`/`parseSSE`（别复用 useAISession，译文非多轮）；② 存档 UI（翻阅/搜索/删除）第二批做，**按天删除需 CR-4**（CR-3 只给了 append+list）；③ apiKey 明文存，加密留 settings 会话；④ 打包后 renderer 直连外部 API 若遇 CSP 拦截需放行 AI 域名。

---

- **会话 11 分词失效修复已完成（headless GUI 实证签收）**：
  - 用户报日文完全无分词。**根因**：`useReader` 在 render 阶段建 `TokenizerClient`(worker) + effect cleanup dispose，React StrictMode(dev) 双挂载 mount→unmount(terminate worker)→remount 时 ref 仍指死 worker、不重建 → 分词请求全丢进死 worker，静默无 token 无报错。`test:tokenizer`(纯 Node)测不到，只有真 React dev 触发——正是"总纲层跑不了 GUI 漏过"病根。
  - **修**：worker 创建挪进 mount effect、cleanup 清 ref，remount 重建活 worker。**实证**（dev headless 逐层探针 + DOM 计数）：词典完整 217116143 字节加载、createTokenizer 成功、DOM 278 词框(border 可见)+73 注音 rt。
  - 顺带：诊断可见（dev 自动开 devtools + [tokenizer] stdout 转发 + 词典加载生命周期日志 + dict-error 顶部横幅 + worker.onerror 横幅，保留为正式可观察性）；词框间距滑块（中文开关右边，`--token-gap` CSS 变量驱动，localStorage 持久化，clamp[0,0.5]em）。
  - `typecheck`+`build`+全部 `test:*`(reader 扩⑧词距夹取)+`smoke` 全绿无回归。契约未动(v4)。
- **会话 12 settings 已核准 + CR-4 批准 → 契约推 v5**（总纲层实测签收）：
  - 全局设置面板（CSS 变量驱动，决策 A）：阅读/目录/注音/外观/字体/AI档案 六分区 Dialog，两处入口（阅读器工具栏 + 书架）。词框旋钮 + A/B/C 模式 + 注音/中文开关从 reader 工具栏**迁入**设置并**持久化**（用户已同意行为变更）；AI 档案配置从 AIPanel **搬家**进设置（功能不减）；新增字号/行距/边距/颜色/假名/字重/字体族两槽 + **字体导入**（CR-4）。
  - **实测（真实数据，非只看绿灯）**：真实 7640 字节 TTF 落 `<userData>/fonts/` 往返（拷贝→字节校验→list→delete 清盘全通）；reader.css 17 个 CSS 变量已 var 化、工具栏旧旋钮(`useTokenGap/useTokenBg/onTokenGap`)已删、AIPanel `ConfigDialog` 已移除——均静态核对确认。`test:settings`(clamp/颜色/字体名防注入/coerce 往返/toCssVars) + `typecheck` + `build` + 前批**十自测全绿无回归**。
  - **GUI-未验（记录，同会话 11 "总纲层跑不了 GUI" 限制）**：dialog 字体选择器、`@font-face` 活体渲染、设置面板视觉交互、CSS 变量实时重排阅读界面——子会话称 dev 手验，总纲层未亲验。**用户实测时重点看这几处。**
  - **独立待办（非本会话，总纲层挂起）**：会话 10 的 `useAISession` 挂在 AIPanel 内、AIPanel 在 `{panelOpen&&…}` 下条件渲染 → **收起右面板销毁 AI 会话**，违背 CONTEXT「收起不销毁会话」铁律。待单独会话修（提成模块级 store 或提到 App 层）。**→ 会话 13 已修（见下）。**
- **会话 13 修复 AI 会话收起即销毁（总纲层直接实作 + 实证签收）**：
  - **根因**：会话 10 把会话状态放在 `useAISession` 的 `useReducer` 里（组件本地态），而 `AIPanel` 在 `Reader.tsx` 的 `{panelOpen && …}` 下条件渲染——收起右面板 = AIPanel 卸载 = reducer 态随之销毁，展开后 `messages` 清空。违背 CONTEXT「面板只是会话的视图，收起不销毁」铁律 + 示例对话。
  - **修（决策 C，仿 staged-store/settings-store）**：新建 `session-store.ts`，把会话状态 + AbortController + listeners 提到**模块作用域**；`useAISession` 改成 `useSyncExternalStore` 薄订阅。状态不再随组件生灭。纯 reducer `session-logic.ts` 未动（测试全复用）。**公开 API（`{session,send,cancel,reset}`）不变 → AIPanel/Reader 零改动。**
  - **实证**：探针模拟 mount→发一轮→unmount(收起,退订)→remount(展开,重订) —— 会话 `messages` 完整存活、历史保留（修前 remount=空）。`typecheck`+`build`+**全部 11 自测无回归**。契约未动(v5)。
  - **副带**：send 不再需要 `messagesRef` 绕闭包陈旧（store 直读模块级 state）。

## 脚手架

状态：**完成 · 已核准**（会话 1，总纲层核对通过：空壳能跑、三入口串好、契约未动、自测全绿）。
三入口空壳可 `npm run dev` 弹窗；`npm run build`/`typecheck`/`smoke` 全过。
装机两步：`npm install --ignore-scripts` → `npm run setup`（详见 README）。

## 模块集成状态

状态取值：`未开始` / `进行中` / `完成待集成` / `已集成`

### 地基（第一阶段）

| 模块 | 状态 | 负责会话 | 依赖契约 | 自测 |
|------|------|----------|----------|------|
| `ui-kit` | 已核准 | 会话 3 | — | ✅ typecheck+build 绿 |
| `storage` | 已核准 | 会话 2 | 1, 4 | `npm run test:storage` ✅ |
| `epub-import` | 已核准 | 会话 4 | 1, 4 | `npm run test:epub` ✅ |
| `tokenizer` | 已核准 | 会话 5 | 2 | `npm run test:tokenizer` ✅ |
| `reader-view` | 已核准 | 会话 6→9→9.1→11→18→20→22(目录覆盖/独立左右边距) | 1, 2, 4(v3) | `npm run test:reader` ✅ |
| `interaction` | 已核准 | 会话 7→18→22(AI发送快捷键) | 3 | `npm run test:interaction` ✅ |
| `library` | 已核准 | 会话 8 | 4 (v2) | `test:library`+`test:library-integ`+`test:progress` ✅ |

### 后挂（地基稳定后）

| 模块 | 状态 | 负责会话 | 依赖 | 自测 |
|------|------|----------|------|------|
| `ai-analysis` | ✅ 已核准 | 会话 10 | CONTEXT.md + 契约 4(CR-3,v4) | `npm run test:ai` ✅ |
| `settings` | ✅ 已核准 | 会话 12→20→22(左右边距/查词联动) | 契约 4(CR-4,v5; CR-6,v7) | `test:settings`+`test:settings-store`+`test:integration` ✅ |
| `ai-translation` | 完成待集成 | 会话 15 | ai-analysis(streamChat)+契约4 v1(saveAiTranslation) | `npm run test:ai-translation` ✅ |
| `tts` | Phase 2 已集成 | 会话 17→22(按句连读/声音热更新) | 契约 4(CR-5,v6) + reader-view(接线) | `npm run test:tts` ✅ |

### 建议开工顺序

```
第1批（无依赖，可并行）：ui-kit、storage
第2批（依赖 storage）：  epub-import、tokenizer
第3批（依赖上面）：      reader-view → interaction → library
后挂：                   ai-analysis、ai-translation、tts
```

---

## 会话记录（倒序，最新在上）

### 会话 22 — 阅读稳定性、交互联动与独立左右边距

**背景**：用户要求目录开合不再推动正文、可配置 AI 发送快捷键、启动时可自动打开查词软件、全文朗读按句合成、声音设置立即生效；随后将原“左右边距 + 内容宽度”改成独立“左边距 + 右边距”。保留会话 21 的设置背景无模糊，以及既有 AI 回复样式改动，不调整正文颜色、字体或译文表现。

**做完**：目录改成阅读区左侧绝对定位覆盖层，开合和拖宽不参与正文 flex 布局。快捷键增加 `sendToAi`（默认 `Ctrl+Enter`），与输入框按钮共用提交入口，仅在 AI 面板挂载时生效；旧数据补默认并自动消解撞键。新增 `IntegrationSettings` 及受控 IPC，使用 `shell.openPath` 打开单个 `.exe/.lnk`，支持选择、清除、测试、每次启动一次和失败提示。连续朗读按 `。！？!?`/换行生成“段序号:句序号”队列，预取后 3 句，同段只在首句同步界面；声音档案改为模块级共享 store，配置变化立即清旧预取。阅读设置移除统一 `margin` 和 `contentWidth`，新增 `leftMargin/rightMargin`（0–40rem），旧 `margin` 同时迁移到两侧，正文横向位置可非对称控制。

**契约与自测**：CR-6 已批准并注入总纲，契约 v6→v7；契约 1/2/3 未动。自测覆盖快捷键迁移/撞键、集成路径校验与 electron-store 往返、换行断句/句子队列/声音热更新、目录覆盖结构和左右边距迁移；最终运行全部 14 个 `test:*`、`typecheck`、生产 `build` 与 `git diff --check`。

### 会话 21 — 设置弹窗取消背景模糊与染暗

**背景**：用户反馈在设置中调整背景等参数时，弹窗后的阅读区仍像隔着雾玻璃，无法准确判断实时变化。契约无变更（仍 v6）。

**根因与修复**：共享 `DialogOverlay` 默认固定使用 `backdrop-blur-sm + bg-black/40`，设置参数虽已由 `applySettings` 即时写入，阅读区仍被遮罩模糊并压暗。`DialogContent` 新增可选 `overlayClassName` 并传给真实 Overlay；`SettingsDialog` 单独传入 `bg-transparent backdrop-blur-none`。设置打开时背景现保持真实颜色与清晰度，其他导入/确认弹窗继续使用原遮罩。

**自测**：`test:settings` 增加设置专用遮罩回归断言，先在旧实现上稳定失败，修复后通过；`typecheck`、生产 `build`、`git diff --check` 全绿。构建仍只有既有 Sudachi WASM 运行时解析提示。

### 会话 20 — 六种可切换词框样式

**背景**：用户要求在“设置 → 阅读”中提供多种词框视觉模式，重点优化圆润胶囊，并确保不再影响正文、译文、分词、点击、TTS、EPUB 或 AI 接口。该计划明确授权 settings 与 reader-view 跨模块协调：settings 只负责选择和持久化，reader-view 只负责消费根节点样式状态；契约无变更（仍 v6）。

**做完**：settings 新增 `TokenStyle` 六值枚举与 `tokenStyle` 持久化字段，默认 `capsule-soft`；旧 localStorage 缺字段或非法值自动回落。`applySettings` 将当前值写入根节点 `data-token-style`。阅读设置新增 3 列真实词框预览单选格（窄屏 2 列），切换后立即落库并刷新正文。新建 `reader-view/token-styles.css` 统一定义轻柔胶囊、清晰胶囊、近无框胶囊、柔和标记、极简下划线、经典方框，设置预览与正文共享变量；现有颜色、透明度、词间距和字距继续生效。六种模式始终预留 1px 边框，hover/active 不改变尺寸；透明度 0 时静止表面完全透明，但主题交互反馈仍可见。

**自测**：`test:settings` 覆盖六个枚举、默认/非法/旧数据回退、逐样式 JSON 往返和透明度变量映射；新增 `test:settings-store` 验证根节点即时更新、localStorage 持久化和模块重载恢复。`test:reader` 独立覆盖三档透明度（0/0.18/1）×六样式矩阵、marker/underline 特例与交互态不改尺寸。typecheck、生产 build 与全量自测均通过。GUI 视觉自动化受 localhost 浏览安全策略阻断，未完成自动截图；需在 Electron 实机检查亮/暗主题、自定义词框色、字号、注音和换行组合。

**留下的坑 / 下游须知**：词框模式只通过根节点数据属性和 CSS 切换，未改 token DOM 或任何阅读行为。新增视觉模式时应同时扩 `TOKEN_STYLES` 和 `token-styles.css`，并维持静止态边框占位，避免 hover 导致正文跳动。

### 会话 19 — 批量修 7 个 bug + 生产词典 file:// 路径还债 + UI 打磨（苹果风）收尾

**背景**：用户全权委托（睡觉），无回复。任务 = 自己找漏洞修 bug、完善项目、自动化验证。契约无变更（仍 v6），不改地基核心。工作区还挂着会话 18 之后的未提交 UI 打磨（阴影 token/圆角/动效/图标化按钮/滚动条/loading spinner/AI 气泡 iMessage 化），一并验收提交。

**做完（bug 修复，均自测/实测验证）**：
1. **切 A/B/C 分词模式后视口词框全丢**（useReader）：mode 切换只清 tokens 视图，无任何重分触发 → 词框消失、点词失效，直到用户滚动才恢复。修：`lastRangeRef` 记最近分词区间 + mode 变更 effect 延一拍按该区间重分（缓存按 `(seq,mode)` 分键，旧 mode 缓存不干扰）。
2. **快捷键穿透设置对话框**（Reader）：设置打开时按 →/t 会在背后切章/切译文（Radix Tabs 也用方向键）。修：`settingsOpenRef` 守卫，对话框打开不响应。
3. **修饰键组合绑定永远不生效**（Reader）：handler 硬拦 `ctrl/alt/meta` → 用户录了 `ctrl+arrowleft` 也白录。修：去掉硬拦，交给 `matchAction` 归一化判定。
4. **双击导入 mode 卡片重复导入两本书**（useLibrary）：同 tick 内 reducer 态未落位，第二次 `importBook` 照发。修：`importingRef` 在途标记。
5. **播放被抢占时旧音频 ended 事件踩掉新播放状态**（playback-store.playUrl）：`curAudio` 已换仍 set status idle。修：onended/onerror/play-catch 先验 `curAudio === audio`。
6. **VoiceTab speedFactor 空串→0**（SoVITS 0 速合成卡死）、**ProfileTab temperature NaN 落库**：非法值回落默认/undefined。
7. **连读预取 epoch 校验**（useContinuousReading.prefetch）：jump/stop 后旧循环的合成结果不再入缓存（防止旧章节死 URL 残留）。

**做完（健壮性/自测配套）**：
- font-store `addFontFile` 硬校验扩展名（dialog filters 只是建议，用户可 `*.*` 选任意文件 → 拷进 fonts/ 占盘+覆盖同名真字体）；非字体格式抛错。
- smoke.mjs mock self 补 `location`：适配并发会话还的「生产词典 file:// 路径」债（worker `dictUrl` 按 `self.location.protocol` 分流；已核 `out/renderer/assets/worker.js → ../sudachi/system.dic` 与 Vite public 拷贝布局吻合，dev/prod 两分支都通）。
- KeybindingTab 按 Esc 取消录制（防把 Escape 误绑成快捷键）。

**UI 打磨（前序未提交，随本会话验收）**：index.css 加分层阴影 token（--shadow-xs~lg 明暗各一套）+ 全局禁用误选中（阅读区/输入框/AI 气泡恢复可选）+ macOS 风悬浮滚动条 + ::selection 主色；按钮/开关/滑块/Tabs/对话框圆角+spring 动效+按压反馈；Library 封面 hover 抬升、书脊高光、EmptyState 插画、header 毛玻璃；AIPanel 消息气泡 iMessage 化 + 流式贴底跟随（离底 40px 内才自动滚）；TTS 状态 spinner；Reader 工具栏图标化（lucide）+ 加载 spinner；App 启动设置应用提前到 main.tsx（首帧前，防暗色闪白）；main `will-quit` 显式关 SQLite（WAL 干净收尾）；tokenizer-client 缓存带上限 2000（防长书 tokens 只增不减）。

**实测**：`typecheck`（node+web）+ `build` + 全部 13 自测（smoke/storage/tokenizer/epub/reader/interaction/library/library-integ/progress/ai/ai-translation/settings/tts）**全绿无回归**。契约未动（v6）。

**留下的坑 / 下游须知**：
- 生产词典 file:// 分支（worker dictUrl）为**并发会话**所改（本会话修了 smoke 适配），打包路径已静态核对，但未在真实打包后运行验证——打包/发布会话首次用 `npm start`（preview）实跑确认。
- GUI-未验（同「总纲层跑不了 GUI」限制）：mode 切换词框恢复、设置对话框快捷键守卫、双击导入防重——均已静态核对 + 单测兜底，dev 手验清单可加这三项。

### 会话 18 — 修图片显示（data URL）+ 快捷键自定义（切译文/上一章/下一章）

**背景**：两个独立小任务（任务卡 `TASK_keybinding_and_image.md`，plan 阶段已完成诊断+用户决策）。契约无变更（仍 v6），不动地基核心。

**做完（任务 A：修图片显示，data URL 方案）**：
- **根因**（任务卡已实测确认）：图片落盘无 bug（`<userData>/books/<id>/images/*` 齐全）；bug 纯在显示层。`getImagePath` 返 Windows 绝对路径 `C:\...`，`SegmentView` 拼 `file://C:\...` —— ① Windows 需 `file:///C:/...`（三斜杠+正斜杠），`file://C:\` 把 `C:` 当主机名失败；② dev 渲染层是 `http://localhost` 源，Chromium 默认禁 http 源加载 `file://`。就算修好格式 dev 也加载不出。
- **改法（~6 行，2 文件）**：① `epub-import/index.ts` 的 `epub:getImagePath` handler 改为**读盘转 data URL**（`readFileSync` → 按扩展名定 MIME（jpeg/png/gif/webp，兜底 jpeg）→ `data:${mime};base64,${b64}`），读盘失败返空串；② `SegmentView.tsx` 的 `ImageSegment` 删 `file://` 拼接，直接 `setSrc(dataUrl)`（空串保持 placeholder）。data URL 无源限制、生产同样通。

**做完（任务 B：快捷键自定义 3 个）**：
- `interaction/keybindings.ts`：`Action` 改 `'toggleTranslation' | 'prevChapter' | 'nextChapter'`（**去掉** sendStaged/clearStaged——未接线，不放 UI 免误导）；`defaultKeybindings = {t, arrowleft, arrowright}`（翻章用左右箭头，不滚动竖列表相对安全；`eventCombo` 已 toLowerCase 对齐小写）。`eventCombo`/`matchAction` 保留。
- **新建 `interaction/keybindings-store.ts`**（仿 staged-store 模块级 store + useSyncExternalStore）：单键 `chion-keybindings` 存 localStorage；`coerceKeybindings`（脏 JSON/缺字段/非串/空白串逐 action 回落默认 + 大小写归一）；`getKeybindings`/`setKeybinding`(**撞键检测**返 false 不写)/`resetKeybindings`/`useKeybindings`/`subscribe`。barrel 导出 store + `eventCombo`。
- **新建 `settings/KeybindingTab.tsx`**（SettingsDialog 第 9 个 Tab「快捷键」）：三行「切译文/上一章/下一章」，点「录制」进捕获态，下一个 keydown（`preventDefault`+`stopPropagation`，纯修饰键忽略等实键）经 `eventCombo` 归一 → `setKeybinding` 写入 → 撞键提示不写；「恢复默认」→ `resetKeybindings`。视图直读 `useKeybindings`。settings.css 加 `.settings-key-row`（横排）。
- **接线 `SettingsDialog.tsx`**：+import KeybindingTab、+TabsTrigger/TabsContent value="keys"。
- **接线 `reader-view/Reader.tsx`**：t 键 handler 改为 `matchAction(getKeybindings(), e)` 判定，一并处理 prevChapter/nextChapter（`chapterIndexRef`/`chaptersLenRef`/`changeChapterRef` 走 ref 避免陈旧闭包，空 deps 挂一次现读 store）；**输入框守卫**：`e.target` 是 `<textarea>`/`<input>` 时翻章+t 全跳过（防 AI 框打字误触箭头翻章/t）。翻章走边界判定（hasPrev/hasNext 等价）。

**契约变动**：无（纯 renderer + localStorage）。仍 v6。

**自测**：`test:interaction` 扩 ⑫–⑮（eventCombo 修饰键按序/箭头/大小写归一 · matchAction 命中/未命中/大小写不敏感 · coerceKeybindings 空/缺/脏/保留/归一 · store setKeybinding→持久化读回一致+撞键返false不写+resetKeybindings 回默认；注入内存 localStorage 垫片 + 剥 react import 测纯逻辑）。`typecheck`+`build`+**全 12 自测无回归**。

**留下的坑 / 下游须知**：
- **打包 file:// 三债→两债**：图片已用 data URL 根治（生产同样通），消掉「图片 file:// 债」。剩词典 `configure(dictUrl)` + 字体 `@font-face` 两债留打包会话。
- **靠 dev 手验**（总纲跑不了 GUI）：① book5（楽園ノイズ）插图显示；② 设置→快捷键 录制改键、t 切译文、左右箭头翻章、AI 框内打字时箭头/t 不误触。
- **未接线的键**：AI 发送（`StagedInputBox` 硬编码 ctrl/meta+Enter）、清空暂存仍硬编码，未进 UI（用户决策，避免出现改了不生效的项）。
- **data URL 权衡**：大图每次开段都 base64 编码 + 内嵌 DOM（无磁盘缓存复用）；本项目插图少（book5 共 18 张、按段虚拟化只渲视口内），YAGNI 不做缓存。若日后遇超大图册卡顿，再评估回自定义协议方案。

### 会话 17（续3）— 删倍速功能 + 修连读自动滚屏跟随

**背景**：用户手验倍速（speed_factor 方案）体验差——「调整很卡、调很慢还是很快、效果不好」→ 决定**彻底删除倍速**。删后发现连读「不会跳转到那一行」→ 要求连读像**词典笔**「读到哪屏幕跟到哪」。

**做完（删倍速）**：
- `playback-store`：删 `rate` 字段/`RATE_*` 常量/`clampRate`/`readRate`/`setRate`/`KEY_RATE`；`synthesizeToUrl` 不再传 rate；`playUrl` 恢复朴素 `new Audio`（无 playbackRate/preservesPitch）。
- `tts-client`：`buildSovitsBody`/`buildRequest`/`synthesize` 去掉 `rate` 形参，`speed_factor` 回归取 `profile.speedFactor`（档案基准语速仍在，仅去掉全局临时倍速覆盖）。
- `index.ts` barrel 去 `setRate`/`clampRate`；`PlaybackBar` 删滑块 + `useState`/`useEffect` import；`tts.css` 删 `.tts-rate*`；`useContinuousReading` 预取缓存回归 `Map<seq,url>`、去 rate 订阅清缓存 effect。
- 自测：`test:tts` 去 rate→speed_factor + clampRate + playbackRate 断言，fake synthesize/Audio 去 rate 相关。

**做完（修连读自动滚屏）**：
- 根因：滚屏原挂在 `onSegStart` 命令式 `scrollToIndex`，受渲染时序/竞态影响不稳（段开始就滚，Virtuoso 可能还没就绪）。
- 改法：`onSegStart` 只留同步剪贴板/AI 框（去掉 `idxInChapter` 形参）；滚屏改由 **Reader 的 `currentSeq` 驱动 `useEffect`**——`playback.currentSeq` 变 → `segments.findIndex(seq)` → `scrollToIndex({index, align:'center', behavior:'smooth'})`。数据源一致、渲染后再滚，稳。
- hook `onSegStart` 类型 `(seg) => void`（删 idx），`runFromIdx` 调用同步改。

**契约变动**：无（纯 renderer）。仍 v6。

**自测**：`typecheck`+`build`+**全 12 自测无回归**（test:tts / test:interaction 均绿）。

**留下的坑 / 下游须知**：
- **自动滚屏靠 dev 真机手验**：连读时屏幕是否平滑跟随朗读段居中（`behavior:'smooth'` 快速推进时若感觉滚动追不上，可改 `'auto'` 瞬时定位）。
- 倍速功能已彻底移除；若日后要变速，只能改**档案级 `VoiceProfile.speedFactor`**（重合成，非实时）。
- 声音档案的 `speedFactor` 基准仍生效（设置→声音里配），只是没有播放时的临时倍速旋钮了。

### 会话 17（续2）— 修连读并发/预取 bug + 倍速改 SoVITS speed_factor（音质）+ 连读同步剪贴板/AI框

**背景**：用户手验连读报三症状 +1 需求：①「一直在跑却没读出来、cmd 跑到很后面、等很久又好」②「读着读着跳到上面重新读」③倍速低速「很闷」④要「读到的那句同步到剪贴板+AI框，下一句来了上一句清掉」。

**根因（读代码定位）**：
- ①**预取阻塞当前段**：`runFromIdx` 先发 3 个预取再合成当前段；`start`/`jumpTo` 已 `clearPrefetch`，当前段不在缓存 → 其合成请求排在 3 个预取后（SoVITS 串行）→ 干等 ~15s。
- ②**并发陈旧循环**：`activeRef` 单布尔无法作废「某条」旧异步循环。旧循环 `await synthesizeToUrl`（无 abort）期间跳转 → 新循环启动 + 旧循环合成返回后 `activeRef` 仍 true → 两循环并发推进打架 → 跳读/重读。
- ③**低速闷**：`playbackRate`+`preservesPitch` 的 WSOLA 时间拉伸在低倍速重复音频颗粒丢高频，浏览器算法天花板。

**做完（修 bug）**：
- `useContinuousReading` 重构：**世代令牌 `epochRef`**（start/jumpTo/翻章续读都 `++`，`runFromIdx(idx, myEpoch)` 每个 await 后校验 `myEpoch !== epochRef.current → return`，旧循环干净作废）；**当前段先 await 合成/播放，播放启动后才发后面 N 段预取**（不再堵当前段）；连读合成加 **`AbortController`**（jump/stop 中断在途，腾空 SoVITS 队列）；`goToChapterRef`/`onSegStartRef` 稳住回调身份。
- 预取缓存改 `Map<seq, {url, rate}>`（合成级变速，缓存记录合成时倍速，倍速变则作废）。

**做完（方案 A：倍速改 SoVITS `speed_factor` 重合成，用户三选推荐）**：
- 全局临时倍速（覆盖档案 `speedFactor` 基准，不写档案）；从下一段生效（重合成 ~5s，不实时）；音质好、低速不闷（模型级变速，非波形拉伸）。
- `tts-client`：`buildSovitsBody(profile, text, rate?)` → `speed_factor: rate ?? profile.speedFactor ?? 1.0`；`synthesize`/`buildRequest` 透传 rate。
- `playback-store`：`synthesizeToUrl` 合成时传 `state.rate`；`playUrl` 删 `preservesPitch`、`playbackRate` 恒 1（不再拉伸）；`setRate` 只写 state/持久化（不改正在播的）。
- `useContinuousReading`：subscribe rate 变化 → `clearPrefetch`（按新语速重预取）。
- `PlaybackBar`：滑块**松手才应用**（`onPointerUp`/`onKeyUp` 才 `setRate`，拖动只更新本地显示），文案「下一段生效」。

**做完（连读同步剪贴板 + AI 框，连读时总是同步）**：
- `interaction/staged-store` 加 **`stageAuto(text)`**：无条件覆盖 + `origin='auto'`（不叠加、不污染草稿保护语义，与 `setUserText` 区别）。barrel 导出 `stageAuto`+`writeClipboard`。
- Reader `onSegStart`：连读每到一段 `writeClipboard(seg.jp_text)` + `stageAuto(seg.jp_text)` → 新段覆盖旧段（上一句自动清掉）。

**契约变动**：无（纯 renderer；`buildSovitsBody` 加可选参数向后兼容）。仍 v6。

**自测**：`test:tts` 补 rate→speed_factor 覆盖（rate 覆盖档案 speedFactor、都无→1.0、synthesizeToUrl 传当前 rate、playUrl playbackRate 恒 1）；`test:interaction` 补 stageAuto（无条件覆盖用户草稿、origin=auto、新段覆盖旧段、无 selection）。`typecheck`+`build`+**全 12 自测无回归**。

**留下的坑 / 下游须知**：
- **epoch/预取/abort 修复靠 dev 真机手验**（总纲跑不了 GUI + 真 SoVITS）：重点验①点▶后当前段是否立刻出声（不再干等）②连读中途点击跳转是否还会「跳上面重读」③改倍速后下一段是否变速且音质不闷。
- 倍速**从下一段生效**是 speed_factor 固有代价（用户已确认接受）。
- 连读同步是**无条件覆盖**：连读时若用户正在 AI 框手打，会被覆盖（用户明确要「跟随朗读」，可暂停连读再打）。

### 会话 17（续）— tts Phase 2 连续朗读全文 + 无级倍速

**背景**：Phase 1 落地后用户要连读全文（有声书式）+ 无级倍速。均后挂 tts 模块内，不动地基。

**做完（连续朗读，Phase 2）**：
- `playback-store.ts` 重构：拆「合成」`synthesizeToUrl`（→blob URL 供预取缓存）与「播放」`playUrl`（await 播完，返 done/stopped 供编排推进）；`playSingle`=合成+播（单段点击）。state 加 `reading/currentSeq`。
- 新建 `useContinuousReading.ts`（连读编排 hook）：`start(屏顶段起)`/`jumpTo(点击跳转)`/`stop`。按段推进（`nextReadableIdx` 跳 image/空段）+ **预取窗口 `PREFETCH_AHEAD=3`**（短句/分段细的书救场，SoVITS 串行排队就绪）+ 章尾 `goToChapter` 自动翻章（新 segments 到达 useEffect 续读，跨章接受一次 loading 间隙）。纯函数 `firstReadableIdx`/`nextReadableIdx` 抽出可测。
- Reader 接线：`▶朗读全文`/`⏹停止`（PlaybackBar，onStart/onStop 由 Reader 传）；连读中点词/点段=`jumpTo` 该段续读（仍写剪贴板）；`currentSeq` 变→`scrollToIndex align:center` 自动滚屏居中 + `is-speaking` 高亮（`--accent`）；**t 键连读中作用于当前朗读段**（一次性翻该句，无需悬停；非连读仍作用悬停段）。
- 交互修正（用户反馈）：t 键**不是**总开关自动译文，是「按一下翻当前这句」一次性——去掉了曾加的 `followZh` 整套。

**做完（无级倍速）**：
- 技术选型：`HTMLAudioElement.playbackRate` + `preservesPitch=true`（**变速不变调**，实时无级），**不用 SoVITS `speed_factor`**（合成级，改要重合成 5s，无法实时）。两个"速度"互不冲突：`VoiceProfile.speedFactor`=合成基准语速（不动）；`rate`=播放倍速（新增）。
- `playback-store`：state 加 `rate`；`RATE_MIN=0.25`/`RATE_MAX=2.0`/`clampRate`；`setRate(v)`=clamp→持久化 `chion-tts-rate`→**立即改正在播的 `curAudio.playbackRate`**（当场变速不等下一句）；`playUrl` 新音频设 `preservesPitch=true`+`playbackRate=rate`。
- `PlaybackBar`：无级 `<input type=range 0.25–2.0 step0.05>` + `1.50×` 数值，单段+连读都生效。

**契约变动**：无（纯 renderer 内，未碰 IPC/契约，仍 v6）。

**自测**：`test:tts` 补——连读推进 `firstReadableIdx`/`nextReadableIdx`（跳 image/空段、章尾-1）；倍速 `clampRate` 边界(<0.25钳/>2钳/NaN兜底1)、`setRate` 持久化、`playUrl` 后 `preservesPitch===true`+`playbackRate===rate`、播放中 `setRate` 实时改 `curAudio`。`typecheck`+`build`+**全 12 自测无回归**。

**留下的坑 / 下游须知**：
- **GUI + 真实 SoVITS 连读体验靠 dev 手验**（总纲层跑不了 GUI）：连读顺滑度、短句预取是否跟上（PREFETCH_AHEAD 不够可调大）、倍速音质、自动滚屏居中、高亮明显度。
- **跨章预取未做**：翻章那一下接受一次 loading 间隙（章内无缝）。要跨章无缝须提前拉下一章段，复杂度高，留后续。
- **Phase 3 未做**：云端 openai 引擎档案（synthesize 已留 `/audio/speech` 分派）。

### 会话 17 — tts 模块 Phase 1（声音档案多档案 + voice-store + CR-5 + settings「声音」分区 + tts-text 文本规整 + 单单元点击即播 词/句/段）

**背景**：Phase 0 已完成（SoVITS API 起服务 bat + 集成启动 bat + curl 实测返真实洛琪希 wav，见 `TTS_HANDOFF.md` 二节）。本会话进 Phase 1，跑通「文本→规整→SoVITS→出声」闭环。TTS 是后挂模块，不动地基核心。

**做完**：新建 `tts` 模块（renderer）+ `voice-store`（main）全交付。只碰约定文件：`voice-store/*`（新建）、`tts/*`（新建全部）、`preload`（续挂 3 invoke）、`main/index.ts`（注册 1 行 + import）、settings `SettingsDialog.tsx`（+VoiceTab +第 8 个 Tab「声音」）、reader-view `Reader.tsx`（接线：PlaybackBar + 包裹 onTokenClick/onSegmentContextMenu 触发朗读）、`package.json`（+test:tts）、`scripts/`（+tts-selftest）。

- **主进程 `voice-store/`**（仿 ai-store 可注入 cwd）：`openVoiceStore(cwd?)` electron-store（`voice-profiles`）+ `getProfiles/saveProfiles`（整体覆盖写）。`registerVoiceStoreIpc` 挂 CR-5 三通道：`voice:getProfiles`/`voice:saveProfiles`/`voice:pickAudioFile`（dialog 选参考音频，返服务端可达绝对路径字符串，取消返 null）。导出 `VoiceProfile`/`VoiceProfilesState` 供 preload 借。**合成不经 IPC**——渲染层直连 localhost:9880 拿 wav（同 ai-client 直连 SSE）。
- **渲染 `tts/`**：
  - `tts-text.ts`（**纯函数**）：`normalizeForTts(text)` —— 去括号符号保内容(『』「」（）()【】〔〕[]〈〉《》)、去 ruby 残留标签/URL/控制字符(含零宽)/emoji、全角英数→半角、压缩空白去首尾。**日文句末标点 。！？、保留**（SoVITS 断句韵律靠它）。
  - `tts-client.ts`（**纯组装 + fetch**）：`synthesize(profile, rawText, signal?)` —— **入口第一行 `normalizeForTts`**（词/句/段所有路径都经此，单点根治）；规整后空串抛错；engine 分派：sovits POST `/tts`（Phase 0 实测 body：text/text_lang/ref_audio_path/prompt_text/prompt_lang/speed_factor/media_type=wav）、openai POST `/audio/speech`（Phase 3 挂点）。`buildSovitsBody`/`buildOpenAiBody` 抽出可自测。
  - `sentence-split.ts`（**纯逻辑**）：`splitSentences`（按句末标点 。！？!? +闭引号切）+ `sentenceAt(text, offset)`（定位点的词所在句，越界兜底末句）。
  - `utterance.ts`（**纯逻辑**）：`pickUtterance(granularity, segText, token, tokens, tokenIdx)` —— 词=token 表层；段=整段；句=`sentenceAt(segText, tokenOffset(...))`。`tokenOffset` = 该 token 前所有 token 表层长度和。
  - `useVoiceProfiles.ts`（照抄 useAiProfiles）：CRUD + 种一个**洛琪希本地默认档案**（sovits，指向 Phase 0 实测参考音频路径 + prompt_text）；删不到空。
  - `playback-store.ts`（**模块级单一真值** + useSyncExternalStore，仿 session-store/translation-store）：`{enabled, granularity, status:idle/loading/playing/error}`。`enabled`/`granularity` 持久化 localStorage。`play(profile, text)` 抢占语义（先 stop 旧的 + AbortController 取消在途合成）→ synthesize → Blob+URL.createObjectURL → `new Audio().play()` → playing；profile 空/合成失败 → error。`stop()` 停播+取消+释放 blob URL。
  - `PlaybackBar.tsx`：朗读模式开关 🔊 + 粒度选择器(词/句/段) + 合成中/停止/error 状态。Phase 1 无播/停/上一/下一队列控件（Phase 2）。
  - settings `VoiceTab.tsx`：声音档案 CRUD（照抄 ProfileTab）+ 参考音频选择器（pickAudioFile）+ 语速。
- **接线 reader-view**（`Reader.tsx`）：ReaderToolbar 加 `<PlaybackBar/>`；`useVoiceProfiles` 取 activeProfile（ref 防陈旧闭包）；**包裹** interaction 的 `onTokenClick`/`onSegmentContextMenu` —— 先跑原交互（写剪贴板+暂存AI，原样不动），朗读模式 ON 时**同时**触发朗读（用户明确要「同时触发」）：点词按粒度取朗读单元（`pickUtterance`），点段恒读整段。

**契约变动**：**CR-5（按任务卡走 CR 流程 → 总纲层批准 → 注入总纲第 4 节 → 推 v6）**——契约 4 新增 `getVoiceProfiles`/`saveVoiceProfiles`/`pickAudioFile` + 类型 `VoiceProfile`/`VoiceProfilesState`。**仅新增不改既有；契约 1/2/3 未动。** 合成不经 IPC（渲染层直连 localhost:9880）。

**装了哪些依赖**：无（纯 renderer + React 内置 useSyncExternalStore + electron-store/dialog + 复用 ui-kit）。

**自测（铁律 4）**：`npm run test:tts`（纯逻辑无 DOM/网络，transpile 直测 + 注入 fake）：① normalizeForTts 逐条（去括号符号保内容/全半角/去emoji/去ruby残留URL控制符/压空白/日文句末标点保留/空串）② 切句 splitSentences + sentenceAt 定位/越界兜底 ③ client buildSovitsBody/buildOpenAiBody 形状 + **synthesize 入口 normalizeForTts 实证**（脏文本「『おはよう』😀」进→fetch body.text=「おはよう」）+ 规整后空串抛错 + sovits打/tts vs openai打/audio/speech ④ pickUtterance 词/句/段 + tokenOffset ⑤ playback-store（粒度/开关持久化、play loading→playing、无档案→error、stop→idle、合成失败→error、空文本不播）⑥ voice-store 真实 electron-store 往返（临时 cwd 落盘→新实例读回一致）。全绿。`typecheck`+`build`+**前批 12 自测全绿无回归**（storage/epub/tokenizer/reader/interaction/library/library-integ/progress/ai/ai-translation/settings/smoke）。

**留下的坑 / 下游须知**：
- **GUI + 真实 SoVITS 服务未端到端验证**（同会话 11/12「总纲层跑不了 GUI」限制）：文本规整/切句/请求组装/store 状态机全走纯逻辑自测 + typecheck/build；**朗读模式实际出声、合成延迟、点词/点段与原交互同时触发、词级超短文本韵律（TTS_HANDOFF 坑 1）靠 dev 手验**（需启动 `启动全部.bat` 拉起 SoVITS + 真书）。用户实测重点看这几处。
- **声音档案实例漂移**（同 AI 档案）：`useVoiceProfiles` 是 hook 各自实例。VoiceTab 改档案后，已挂载的 Reader 实例不自动刷新 activeProfile（挂载时读一次）——重开书/重启生效。低频，未做跨实例同步（若要，提到模块级 store）。
- **打包后 CSP 债**（TTS_HANDOFF 坑 2）：渲染层 fetch localhost:9880 + 云端 TTS 域名，打包后严格 CSP 会拦。归入打包会话（连同已有 file:// 三债）。
- **两进程生命周期**：关 app 不自动关 SoVITS（独立窗口，用户手动关）。
- **Phase 2/3 未做**：连续朗读 + 预取无缝队列 + 自动滚动（Phase 2）；云端 openai 引擎档案（Phase 3，synthesize 已留 `/audio/speech` 分派 + VoiceProfile 已留 apiKey/model/voice 字段）。

### 会话 16 — 译文样式旋钮补全（字重/透明度/颜色）+ 透明度 bug 修复 + 菜单栏硬隐藏（总纲层小改动，已验收）

**背景**：用户反馈①按 t 出的中文除字号/字体外还想调字重/颜色/透明度；②译文透明度旋钮无效；③字重有些字体用不了、粗细不统一；④原生菜单栏 File/Edit/View 仍在。

**做完**：
- **补 3 个译文旋钮**（`settings-logic.ts` + `SettingsControls.tsx` + `SettingsDialog.tsx` 阅读分区）：`zhWeight`(译文字重 300–700)、`zhOpacity`(译文透明度 0.2–1)、`zhColor`(译文颜色，空=跟随主题)。CSS 变量 `--reader-zh-weight/-opacity/-color`，`reader.css` `.reader-zh` 消费。localStorage 持久化、脏值兜底、缺字段向前兼容（test:settings 遍历 RANGES 自动覆盖）。
- **透明度 bug 根因修复**：`.reader-zh` 的淡入动画 `animation: reader-zh-fade … both`——`both` 填充模式让动画终帧 `to{opacity:1}` **持续压过** base 的 `opacity:var(--reader-zh-opacity)`（填充中动画值恒赢 CSS 属性），故透明度旋钮永远失效。修：keyframe `to` 改停在 `var(--reader-zh-opacity,1)` 而非硬编码 1。淡入保留、透明度生效。
- **字重「粗细不统一」缓解**：`.reader-zh` 加 `font-synthesis: weight style`，强制浏览器对主字体 + 回退字体都合成粗体，尽量一致。**根治不了单字重 .ttf 无中间字重**（浏览器只能合成假粗体、二元）——那是字体文件天花板，需可变字体/多字重字族才能平滑调。**故意不在 `@font-face` 声明字重范围**（一声明浏览器以为单文件覆盖全字重、反而停止合成，字重旋钮彻底失效）。
- **菜单栏三重硬隐藏**（`main/index.ts`）：`Menu.setApplicationMenu(null)`（全局，会话 14 已加）+ BrowserWindow `autoHideMenuBar:true`（Alt 也不召出）+ `win.removeMenu()`（Windows 上比全局更保险）。**主进程改动须整个重启 `npm run dev` 生效**（HMR 只重载渲染进程）。

**验收（总纲层，打到真实数据非只看绿灯）**：探针跑 `coerceSettings`/`toCssVars`——3 新旋钮默认(400/1/空→null)、设值(700/0.5/#ff8800)、越界钳(透明度 5→1、0.05→0.2)、脏值兜底(字重脏→400)、非法颜色→空、缺字段(旧 localStorage)补默认 全对；`.reader-zh` 确认消费 3 变量 + keyframe `to` 引用变量 + font-synthesis；SettingsDialog 3 控件在位；main 三重菜单保险在位。`typecheck`+`build`+`test:settings`+`test:reader` 全绿。契约未动(v5)。

**下游须知**：**字重平滑可调需可变字体**——当前导入单字重 .ttf 只能在正常/假粗体间二元切换，中间值(500/600)无效、回退字体处粗细可能微差。想真正平滑调 300–700 需导入 variable font 或带多字重的字族。**这是字体文件限制，非软件可绕**。

### 会话 15 — ai-translation 模块（纯日语书按 t 走 AI 译文，落库 zh_source='ai' 复用）

**做完**：新建 `ai-translation` 模块（renderer 侧，后挂）全交付。只碰约定文件：`ai-translation/*`（新建全部）、reader-view `Reader.tsx`/`SegmentView.tsx`/`reader.css`（接线，会话 6/9.1 注明的挂点）、library `ReaderScreen.tsx` + `App.tsx`（thread `kind` prop，可选默认 `'bilingual'` 向后兼容）、`package.json`（+test:ai-translation）、`scripts/`（+自测）。**契约未动（v5），无 CR**（`saveAiTranslation` 契约 4 v1 已在）。

- **`translation-logic.ts`（纯逻辑，无 React/DOM/网络，供自测直测）**：
  - `TRANSLATE_SYSTEM_PROMPT`（模块常量，**独立翻译提示词**，非 profile.systemPrompt——那是分析用的）：「你是日译中翻译…只输出译文本身，不要解释/注音/重复原文/引号」。
  - `buildTranslateMessages(jp)` → `[{role:'system',TRANSLATE_SYSTEM_PROMPT},{role:'user',jp}]`（自测点 ②：绝不含 profile.systemPrompt）。
  - `shouldTranslate(kind, seg)`（**安全门，最重要**）：`kind==='jp' && seg.type!=='image' && !seg.zh_text`。**书级 kind 门**——双语书恒 false（zh_text 空也不翻，防「双语某段缺内置译文误触 AI」，铁律 3）。
- **`translate.ts`（纯核心 + fetch，不落库/不碰 DOM）**：`translateSegment(profile, jp, {onDelta,signal})` —— 组 messages → `streamChat`（借 ai-analysis 的连接 + SSE，**不复用 useAISession**，译文非多轮）→ 累积 delta 成整串 `.trim()` 返回。`onDelta` 透传给 store 边收边写。
- **`translation-store.ts`（模块级单一真值，仿 session-store/staged-store）**：`Map<segId, {status:'loading'|'done'|'error', text, error?}>` + listeners + `useSyncExternalStore`。
  - `translate(segId, jp, profile)`：**去重**——该 segId 已 loading/done 直接返回（防按两次 t 重发）；error 态允许重试。profile 为 null 或 apiKey 空 → 置 error（「未配置 AI 档案」），不发请求。否则置 loading → 流式 onDelta 累积写 store（用户看到中文一点点冒出）→ 收完置 done + `void window.chion.saveAiTranslation(segId, translated)` 落库复用 → 失败置 error。
  - `getTranslation` / `subscribe` / `useTranslation(segId)` hook（未变的段返回同一 entry 引用，不触发无谓重渲）。
  - `cancel(segId)`：AbortController 存 `aborts` Map，留口（YAGNI：段滚出视口不强制取消，翻译短、让它跑完落库更划算，reader 未调）。
- **接线 reader-view**：
  - **安全门 + 触发**（`Reader.tsx` t 键 handler）：命中悬停段后先 `toggleHoveredZh`（中文一到就显示），再 `shouldTranslate(kind, seg)` 真 → `translate(seg.id, seg.jp_text, activeProfile)`。t 键 handler 空 deps 只挂一次，用 `segmentsRef/kindRef/profileRef` 读最新值避免陈旧闭包。
  - **档案来源**（决策，任务卡内定）：`Reader` 层调一次 `useAiProfiles()` 拿 `activeProfile` 传参，**不在 store 内部再 new profiles hook**（防与 AIPanel/settings 实例漂移）。
  - **`SegmentView.tsx`**：中文渲染改「内置/已落库 `seg.zh_text` 优先，否则读 `useTranslation(seg.id)`」——`ZhTranslation` 子组件显示流式中文 + loading（「翻译中…」）+ error（可点「重试」）。保持 `.reader-zh` class + 淡入。`useTranslation` 对 image 段也调（hook 不可条件调用；image 恒不翻，entry undefined 无副作用）。重试回调 `onRetryTranslate` 由 Reader 提供（带当前 activeProfile）。
- **thread kind**：`App.tsx`（`openBook.kind`）→ `ReaderScreen`（+`kind?` 默认 `'bilingual'`）→ `Reader`（+`kind?` 默认 `'bilingual'`）。**默认最安全**：不知道就不翻译，向后兼容。
- **CSS**：`reader.css` 加 `.reader-zh-error`（语义色 `--destructive`）+ `.reader-zh-retry`（内联重试按钮，主题 class 不写死色）。

**安全门怎么实现的（书级 kind 门）**：`shouldTranslate` 第一判据就是 `kind==='jp'`——书级，不看段的 `zh_source`。双语书任意段（含缺内置译文的空 zh_text 段）恒返回 false，reader t 键只走原有「展开内置 zh_text」逻辑，绝不调 `translate`。纯日语书才在 `seg.type!=='image' && !seg.zh_text` 时发起 AI 译文；已落库的（`zh_text` 非空）直接读库不再请求。

**store 去重与落库**：同 segId 已 loading/done → 直接返回（防重复请求 / 按两次 t 重发）；error 态放行重试。收完 delta `void saveAiTranslation(segId, translated)` 落库标 `zh_source='ai'`——下次按 t，reader 读 `seg.zh_text`（已有）优先显示，`shouldTranslate` 因 `!zh_text` 为 false 不再翻。

**装了哪些依赖**：无（纯 renderer + React 内置 `useSyncExternalStore` + 复用 ai-analysis 的 `streamChat` + 契约 4 `saveAiTranslation`）。

**自测（铁律 4）**：`npm run test:ai-translation`（纯逻辑无 DOM/网络，transpile `translation-logic.ts` 直测 + `translation-store.ts` 注入 fake `translateSegment`/fake `react`/mock `window.chion`）：① 安全门（jp+pair+空zh→true / jp+已有zh→false / 双语+空zh→false 铁律 / 双语+有zh→false / image→false / jp标题→true）② 提示词组装（system=独立翻译提示词、user=原日文、共两条、不含 profile.systemPrompt）③ store（loading→done + text 流式累积成整串 + 收完落库、done 后再 translate 返回缓存不重发、并发同 segId 去重只发一次、error 态、error 后重试放行、无档案/空 apiKey→error 且不发请求）。全绿。`streamChat`/`parseSSE` 由 test:ai 覆盖不重测。`typecheck`+`build`+**前批 11 自测全绿无回归**（reader/interaction/ai/settings/storage/epub/tokenizer/library/library-integ/progress/smoke）。

**补做（用户追加需求）——翻译 API + 提示词可在面板自定义（决策：完全独立于 AI 分析档案）**：
- **`TranslationConfig`（连接 + 提示词五件套：baseURL/apiKey/model/systemPrompt/temperature）与 AI 分析档案彻底分开**，存 localStorage 单键 `chion-translation-config`（不碰契约、不碰主进程——最省）。`translation-logic.ts` 加类型 + `DEFAULT_TRANSLATION_CONFIG`（DeepSeek 兼容、apiKey 空、提示词默认 `TRANSLATE_SYSTEM_PROMPT`）+ `coerceTranslationConfig`（脏 JSON/缺字段/脏 temperature → 合法，空提示词回落默认常量）。
- **`translation-config.ts`（模块级 store，仿 settings-store）**：`getTranslationConfig`/`setTranslationConfig`（改一项 → coerce → 写 localStorage → emit）/`useTranslationConfig`/`subscribeConfig`。单一真值。
- **`buildTranslateMessages(jp, systemPrompt?)`** 加可选提示词参数（默认 `TRANSLATE_SYSTEM_PROMPT`，空串回落）；`translateSegment(config, jp, …)` 改收 `TranslationConfig`（补占位 id/name 满足 streamChat 的 AiProfile 形状，streamChat 只用 baseURL/apiKey/model/temperature）。
- **`translate(segId, jp)` 去掉 profile 参数**，内部读 `getTranslationConfig()` 拿连接；apiKey 空 → error「未配置翻译 API（设置→翻译，填 apiKey）」。**Reader 不再调 `useAiProfiles`/传 activeProfile**（更解耦）。
- **设置面板新增「翻译」分区**（`TranslationTab.tsx`，第 7 个 Tab）：baseURL/apiKey(password)/model/翻译提示词(textarea)/temperature 全可编辑，视图直读 `useTranslationConfig`。复用 settings.css 的 `.settings-field`，加 `.settings-hint`（提示这套配置与「AI 档案」相互独立）。**碰了 settings `SettingsDialog.tsx`（+import/+Tab）+ `settings.css`（+.settings-hint）**——超原任务卡「只碰」范围，但用户明确追加需求；未动 settings store/logic。
- **自测扩**：② 加自定义提示词（传入用它/空串回落默认）+ ②.5 config coerce（空对象→全默认/保留传入/缺字段兜底/空提示词回落/脏 temperature 兜底/null 不炸）；③ store 测改注入 fake `translation-config`（不再传 profile），空 apiKey→error 路径。全绿。
- **下游须知（翻译配置）**：apiKey 明文存 localStorage（UI 偏好路线，非 electron-store；与 AI 分析档案的 apiKey 各存各的）。翻译与分析连接互不影响，可各用不同服务/模型（如翻译走便宜快模型）。

**留下的坑 / 下游须知**：
- **纯日语书未用真书验证**（地基债，会话 4/5 记：手头只有双语书，epub-import 的 `mode='jp'` 路径实现但未真书验通）。安全门/触发/流式/落库全走纯逻辑自测 + typecheck/build；**流式 fetch 冒字、AI 译文落库复用、DOM 淡入、error 重试的活体交互靠 dev 手验**（需 Electron/网络/纯日语书）。用户首次导纯日语书按 t 时重点看这几处。
- **取消语义**：`cancel(segId)` 留口未接线——段滚出视口 / 组件卸载**不强制取消**（翻译短，让它跑完落库更划算，YAGNI）。若未来要「离开即停」，reader 在 SegmentView unmount 调 `cancel`。注意：取消当前直接抛进 catch → 落 error 态（非「保留半截」），若要留半截需改 store catch 分支判 `signal.aborted`。
- **error 重试语义**：store error 态放行重发（`translate` 去重只挡 loading/done）；`ZhTranslation` 的「重试」按钮走 `onRetryTranslate`（Reader 提供，带当前 activeProfile）。
- **译文 ≠ AI 分析会话**（CONTEXT 铁律已守）：译文单句、一次性、不进聊天框、不多轮——独立 store + 独立提示词，**未碰 useAISession/session-store**，只借 streamChat 连接。
- **档案切换**：译文用 reader 层 `useAiProfiles().activeProfile`（与 AIPanel/settings 同一持久化真值，但各自 hook 实例）。切档案后新触发的译文用新档案连接；已 done/loading 的不受影响。
- **多档案共用连接**：译文复用 activeProfile 的 baseURL/apiKey/model/temperature，但提示词恒为 `TRANSLATE_SYSTEM_PROMPT`（profile.systemPrompt 在译文里不生效，铁律）。

### 会话 14 — 隐藏原生菜单栏 + 交接文档刷新（总纲层小改动）

**做完**：
- **隐藏 Electron 原生菜单栏**（用户觉得顶部 File/Edit/View/Window/Help 碍眼）：`main/index.ts` 加 `import { Menu }` + `whenReady` 里 `Menu.setApplicationMenu(null)` 一行。纯阅读器无需系统菜单；dev 的 devtools 仍由 `openDevTools({mode:'detach'})` 显式开，不受影响。`typecheck`+`build` 绿。契约未动(v5)。
- **刷新 `PROJECT_HANDOFF.md`**：原停在会话 9.1/契约 v3，补齐到会话 13/契约 v5——模块表加 settings 行 + reader-view/ai-analysis 会话号；补 ai-analysis(会话13 store 化)/settings(会话12) 要点；契约速查补 v4/v5；踩坑区加 StrictMode(11)/模块级 store(13)/三处 file:// 债；路线图改为剩余 ai-translation/tts/存档UI/打包。

**下一步给下一个会话（用户可挑一个开新会话）**：
1. **ai-translation（建议优先，挂点全就绪）** — 纯日语书按 `t` → AI 译文落库复用。**复用 `ai-analysis` 的 `streamChat`/`parseSSE`（barrel 已导出）+ `useAiProfiles.activeProfile` 连接配置，但用独立翻译提示词，别复用 `useAISession`**（译文单句、不进聊天框、不多轮——CONTEXT 铁律）。收完 delta → `saveAiTranslation(segId, zh)` 落库（`zh_source='ai'`）。译文字号已 `--reader-zh-size`。**双语书永不走此路径**（铁律 3，reader t 键 handler 已只展开内置 zh_text）。无需 CR（`saveAiTranslation` 契约 v1 已在）。
2. **tts** — 选择/段落朗读，本地 GPT-SoVITS 或在线 + 情感分类选语气。
3. **对话存档 UI** — 翻阅/搜索/按天删除；`listChatArchive()` 已可用，**按天删除需 CR-5**（现只有 append+list）。存档不回灌实时框（铁律）。
4. **打包会话** — 清三处 file:// 债：生产词典 `configure(dictUrl)`（`tokenizer-client.ts` 留口）+ 字体 `@font-face`（`fonts.ts`）+ AI 域名 CSP 放行；分包优化（renderer ~925KB / worker ~2.3MB）。

### 会话 12 — settings 模块（全局设置面板：阅读/目录/注音/外观/字体/AI档案 + 字体导入）

**做完**：新建 `settings` 模块（渲染层，决策 A=CSS 变量驱动）全交付。只碰约定文件：`settings/*`（新建全部）、`font-store/*`（新建）、`preload`（续挂 3 invoke）、`main/index.ts`（注册 1 行）、`App.tsx`（书架入口 + 全局挂 Dialog + 开机 applySettings）、reader-view `Reader.tsx`/`reader.css`（迁旋钮 + var 化）、ai-analysis `AIPanel.tsx`/`ai-analysis.css`（搬家 + var 化）、library `Library.tsx`（书架 ⚙ 入口，可选 prop 向后兼容）、`package.json`（+test:settings）、`scripts/`（+自测）。

- **settings store 单一真值**（`settings-store.ts`，仿 `staged-store.ts`）：模块级 store + `useSyncExternalStore`，视图直读不镜像。整个 `Settings` 以单键 `chion-settings` 存 localStorage（JSON）。`getSettings/setSetting/subscribe/useSettings`。`setSetting` 落库前 `coerceSettings` 保证合法（夹取/sanitize），写 localStorage → `applySettings` 刷 DOM → emit。
- **纯逻辑抽离供自测**（`settings-logic.ts`，无 DOM/electron）：`RANGES`（每旋钮 def/min/max）+ `clampKnob`（NaN/脏值兜底默认）；`sanitizeColor`（#rgb/#rrggbb 校验，空串=跟随主题，脏值回默认）；`sanitizeFontFamily`（剔除 `; { } ( ) < > " ' \ 换行` 防 CSS 注入，保留 CJK）；`coerceSettings`（任意/缺字段/脏 JSON → 合法 Settings，向前兼容）；`toCssVars`（Settings → CSS 变量，颜色/字体空值 → null 移除属性让 CSS 兜底）。
- **applySettings**：把 `toCssVars` 结果写 `document.documentElement.style`（null=removeProperty），并 `classList.toggle('dark', theme==='dark')`（index.css `.dark` 已定义全套变量）。开机在 App `useEffect` 调一次；store 变更时 `setSetting` 内自刷。
- **面板 UI**（`SettingsDialog.tsx` + `SettingsControls.tsx` + `FontTab.tsx` + `ProfileTab.tsx`）：ui-kit `Dialog`+`Tabs`，六分区「阅读｜目录｜注音｜外观｜字体｜AI 档案」。数值走 `Slider`、颜色走 `<input type=color>`、开关走 `Switch`，全主题语义色 class 不写死颜色。外观分区含明暗切换 + 正文色 + AI 字号；字体分区含日文/中文两字体族下拉（预设明朝/黑体 + 已导入 + 手输系统字体名）+ 导入/删除按钮。
- **旋钮清单落地**：数值 15 项（tokenGap/tokenLetterSpacing/tokenBgOpacity/bodySize/lineHeight/margin/contentWidth/segGap/headingSize/zhSize/furiganaSize/furiganaOpacity/tocFontSize/aiFontSize/fontWeight）；颜色 5 项（tokenBgColor/bodyColor/furiganaColor/bgColor/panelBgColor）；字体族 2 槽（fontJp/fontZh）；非 CSS 状态 4 项（mode/furigana/allZh/theme）+ 外观预设 7 个。默认值全保持迁移前现观感。
  - **内容宽度 vs 左右边距**（用户实测澄清的关键区别）：`margin`（`--reader-margin`，0–6rem）是文字块内边距，到 0 就没了；大屏两侧留白真凶是 `.reader-seg` 的 `max-width`，故独立旋钮 `contentWidth`（`--reader-content-width`，24–**160**rem，覆盖 2K/4K 全屏）。`segGap`（`--reader-seg-gap`，0–3rem）是段与段竖向空隙（`.reader-pair` 上下 margin）。
  - **外观预设 `APPEARANCE_PRESETS`**（7 个）：默认亮/默认暗/护眼纸(#f5ecd9)/豆沙绿(#c7edcc)/灰调/夜间黑(#1a1a1a)/墨蓝夜(#0f1720)。`applyPreset` 一键 patch「theme + bgColor + bodyColor + panelBgColor」，之后仍可逐项微调。
  - **背景色**：`bgColor`（阅读区 `--reader-bg`，空回落 `--background`）+ `panelBgColor`（**工具栏 + 目录 + AI 面板三处共用同一旋钮** `--reader-panel-bg`，空回落 `--card`，一处调三处一致）。

**CR-4 落地情况**：`src/main/modules/font-store/index.ts` 新建（`openFontStore(fontsDir)` 可注入 cwd 模式，仿 epub-import 落盘 + storage 注入）。三 IPC 原样落地——`importFont(): Promise<FontMeta|null>`（dialog.showOpenDialog filters ttf/otf/woff2/woff → copyFileSync 到 `<userData>/fonts/` → 返 FontMeta，取消返 null）、`listFonts(): FontMeta[]`（扫目录按扩展过滤）、`deleteFont(id)`（按 id=文件名去扩展删）。**`FontMeta{id,family,fileName,path}` 原样**（id=文件名去扩展、family 默认同 id、path=落盘绝对路径）。preload 续挂 3 invoke（类型 `import type { FontMeta }`）；main whenReady `registerFontStoreIpc(createFontStore())` 一行。**契约 1/2/3 未动，既有 IPC 未改。** 渲染层 `fonts.ts` 用动态 `<style>` 注入 `@font-face { src: url('file://<path>') }` 注册（family 名 + path 已剔注入字符）。

**迁移细节（reader-view）**：ReaderToolbar **删**：A/B/C 模式按钮、注音开关、全书中文开关、词距 Slider、词框颜色 `<input type=color>` + 透明度 Slider。**保留**：目录/返回书架/上下章/章名/AI 面板开合（操作非设置），**新增 ⚙ 设置按钮**开 SettingsDialog。`Reader.tsx` 删 `useTokenGap`/`useTokenBg` 两 hook + `mode`/`allZh`/`showFurigana` 的 useState + `.reader-root` inline CSS 变量（现由全局 applySettings 挂根节点），改 `const settings = useSettings()` 直读 `settings.mode/furigana/allZh`。`reader.css` var 化：`.reader-root` 背景（`--reader-bg`）、`.reader-toolbar`/`.reader-toc`/`.reader-toc-title`(sticky)/`.reader-panel` 背景（`--reader-panel-bg`）、`.reader-pair`（字号 `--reader-body-size`/行距 `--reader-line-height`/段间距 `--reader-seg-gap`/字重/正文色 `--reader-body-color`/日文字体 `--reader-font-jp` 空回落 `--font-reading-jp` 保明朝体）、`.reader-heading`（`--reader-heading-size`/字重）、`.reader-seg`/`.reader-image`/`.reader-chapter-end`（宽度 `--reader-content-width` + 横向 padding `--reader-margin`）、`.reader-zh`（`--reader-zh-size`/中文字体 `--reader-font-zh`）、`rt`（`--furigana-size/-color/-opacity`）、`.reader-toc-item`（`--toc-font-size`）、`.reader-token`（`--token-letter-spacing` 新增，`--token-gap`/`--token-bg-*` 沿用）。删了工具栏 `.reader-gap-control/.reader-gap-label/.reader-gap-slider/.reader-color-input` 死 CSS。默认值全保持现值，仅变可调。

**搬家细节（ai-analysis）**：`AIPanel.tsx` 移除 ⚙ 配置按钮 + `ConfigDialog` + `Field` 组件（整体搬进 settings `ProfileTab.tsx`，`import { useAiProfiles } from '../ai-analysis'` 复用 CRUD，功能不减：档案标签 + 编辑 name/baseURL/apiKey/model/systemPrompt/temperature + 增删）。AIPanel 只留档案标签切换 + 消息列表 + 输入区。`ai-analysis.css` 删 `.ai-tab-config`/`.ai-form`/`.ai-field` 死 CSS，`.ai-msg` 字号 var 化 `--ai-font-size`。`ai-analysis/index.ts` barrel 仍导出 `useAiProfiles`（settings 用，已在）。

**装了哪些依赖**：无（纯用 ui-kit 现成 Dialog/Tabs/Slider/Switch/Button + React 内置 useSyncExternalStore + electron dialog/fs）。

**自测（铁律 4）**：`npm run test:settings`（纯逻辑无 DOM/网络，transpile `settings-logic.ts`）：① 遍历全 15 旋钮 clamp（界内原样/钳 min/钳 max/NaN 兜底/脏值兜底）② 颜色 sanitize（合法 #rgb/#rrggbb 留 / 非法回默认 / 半截回默认 / 空串=跟随主题 / null 回默认）③ 字体名合法化（正常留 / CJK 留 / 剔 `;{}` / 剔引号尖括号 / 剔括号 / 剔换行 / 空串）④ coerce 序列化往返（JSON 往返一致 / 空对象=全默认 / 部分+脏值混合 / 非法枚举回默认 / null/字符串输入不炸）⑤ toCssVars（空颜色/字体/背景→null、有值→覆盖、数值带单位）⑥ 外观预设结构+颜色合法性 + contentWidth 夹取。全绿。`typecheck`+`build`+`test:reader/interaction/storage/tokenizer/epub/library/library-integ/progress/ai`+`smoke` **全绿无回归**。Dialog/Tabs/CSS 变量应用/字体 @font-face/字体落盘靠 typecheck+build+dev 手验（需 DOM/Electron dialog）。

**契约变动**：**CR-4（按任务卡总纲层预批准落地）**——契约 4 新增 `importFont`/`listFonts`/`deleteFont` 3 IPC + 类型 `FontMeta`。**仅新增，不改既有签名/字段；契约 1/2/3 未动。** 未动总纲第 4 节、未改 CR-4 状态（留总纲层实测后注入推 v5）。

**留下的坑 / 下游须知**：
- **行为变更（用户已同意）**：`mode`/`furigana`/`allZh` 从此持久化到 localStorage（`chion-settings` 单键），跨会话沿用上次，不再每次打开书重置。
- **打包后 file:// 字体路径债**：同 Sudachi 词典债（会话 5/6/8/11 记）。dev 下 `@font-face { src: url('file://<path>') }` 加载 `<userData>/fonts/` 已验通；打包后若严格 CSP/webSecurity 拦截 file:// 需自定义 protocol 或 data URL，届时改 `fonts.ts` 的 `renderFontFaces`。本会话未碰打包。
- **字体 family 冲突**：`FontMeta.family` 默认取文件名去扩展。两个不同文件同名（如都叫 `MyFont.ttf` 但一个 ttf 一个 otf）会 id 冲突（都去扩展成 `MyFont`）→ 后导入覆盖前者落盘 + listFonts 去重。低频，未做去重编号（YAGNI，`ponytail:` 未标——真遇到再给 family 加序号）。
- **颜色/字体是 UI 偏好走 localStorage**；唯字体文件（大）落主进程磁盘 `<userData>/fonts/`。删书不清字体（字体全局共用，非书内容）。
- **明暗切换**：切 `.dark` class 挂 `document.documentElement`（App 开机 applySettings + setSetting('theme') 实时切），持久化 localStorage。index.css `.dark` 已定义全套变量。
- **t 键归属仍在 reader-view**（会话 7/9.1 记的债未变）：settings 未接管快捷键自定义（本会话聚焦视觉旋钮 + 字体，快捷键留后续）。`keybindings.ts` 结构仍在 interaction，未强夺。
- **ai-translation 会话**：字号/颜色变量已 var 化，但**未碰 t 键译文逻辑**（双语按 t 只走内置译文的铁律未动）；纯日语 AI 译文的字号复用 `--reader-zh-size`。
- **单一真值**：settings store 是唯一真值，reader/AIPanel 直读（reader 读 mode/furigana/allZh，AIPanel 通过 useAiProfiles 读档案），无镜像。切勿在消费方再复制一份 settings state。

### 会话 11.1 — 重访已读章词框消失 + 词框改淡色可调（弃黑边）

**背景**：会话 11 修好分词后，用户报两个后续问题：① 目录跳几章再跳回来，词框没了；跳到没打开过的章又有，回来又没。② 词框是刺眼黑边，想要淡色框、颜色+透明度可调。只碰 `reader-view`（useReader/reader-logic/reader.css/Reader.tsx）+ `scripts/reader-selftest.mjs`。未改契约。

**问题①根因（headless TOC 跳章实证）**：`useReader` 换章时 `setTokens(new Map())` 清空 tokens 视图，随后 `tokenizeRange` 对**已缓存**的段执行 `if(c.peek(...)) continue` —— **跳过但从不 `setTokens` 回填**。首次访问该章未缓存→分词→setTokens→有框；重访时命中缓存→continue→视图仍空→降级纯文本→**框消失**。没打开过的章没缓存所以有框，正是用户描述。**修**：cache 命中的段收集进 `cachedHits`，循环后**批量 `setTokens` 回填**（一次 setState，`===` 比对避免无谓重渲）。实证：章A(idx12)=215框→跳章B(idx13)=181框→**跳回A=215框**（修前跳回=0）。

**问题②（词框样式可调）**：`.reader-token` 弃 `border: 1px solid var(--border)` 黑边，改 `color-mix(in srgb, var(--token-bg-color) calc(var(--token-bg-opacity)*100%), transparent)` 淡色底 + 同色半淡边框（透明度×50%）。`reader-logic.ts` 加 `clampOpacity`([0,1]，NaN兜底0.18) + `sanitizeHexColor`(#rgb/#rrggbb 校验，脏值兜底默认色 `#6b8cae`)。`Reader.tsx` `useTokenBg` hook（颜色+透明度 state + localStorage `reader-token-bg-color`/`reader-token-bg-opacity`）；`.reader-root` inline `--token-bg-color`/`--token-bg-opacity`；工具栏词距滑块右边加「词框」`<input type=color>` 拾色器 + 透明度滑块。实证：`bg=srgb(.../0.18) border=srgb(.../0.09)`，无黑边。

**契约变动**：无。**自测**：`test:reader` 扩⑨透明度夹取+颜色兜底。`typecheck`+`build`+`test:reader` 全绿；分词回填 + 样式靠 dev headless（TOC 跳章词框计数 + computed style）实证。

**留下的坑**：词框颜色/透明度存 localStorage（渲染层 UI 偏好，同词距/面板宽度）。默认色 `#6b8cae` 淡蓝、透明度 0.18。

### 会话 11 — 分词失效根因修复（StrictMode 双挂载杀 worker）+ 诊断可见 + 词框间距滑块

**背景**：用户报阅读界面日文完全无分词（连成整句、无词框、无注音），F12 叫不出无法自查。前几轮没抓到是因为总纲层跑不了 GUI。本会话在 dev + devtools 下逐层探针定位。只碰 `src/worker`、`src/renderer/src/modules/reader-view`、`src/main/index.ts`（dev 开 devtools + console 转发）、`App.tsx`（仅诊断临时改，已还原）、`scripts/reader-selftest.mjs`（+词距断言）。未改契约（仍 v4）。

**真实报错 / 根因（headless 逐层探针实证，非猜测）**：
- 症状链：`TokenizerClient` 构造了、分词请求 postMessage 发出去了（reqId 0/1/2），但 worker **零响应**——无 diag、无 `onerror`、无 dict-error。worker 脚本 fetch 200（Vite 正常服务、MIME `text/javascript` 正确），但 worker **模块体第一行都没执行**。
- **根因**：`useReader` 在 **render 阶段**用 `if(!clientRef.current) clientRef.current = new TokenizerClient()` 建 worker，却在 effect cleanup 里 `dispose()`（`worker.terminate()`）。React **StrictMode（dev）双挂载**：mount→**unmount(cleanup terminate 掉 worker)**→remount。remount 时 `clientRef.current` **仍指向已 terminate 的死 worker**（ref 跨 StrictMode 重挂不重置），`if(!clientRef.current)` 判非空不重建 → 之后所有 `tokenize()` 全 postMessage 进**死 worker**，静默丢弃：无 token、无报错。
- **为何前几轮没抓到**：`test:tokenizer`（纯 Node，无 React/StrictMode）永远绿；只有真·React dev 才触发。这正是"总纲层跑不了 GUI 漏过"的病根。词典有效、渲染代码正确、worker 逻辑正确——错的只是 worker 生命周期管理。

**修复（对症，最小）**：`useReader` 把 worker 的**创建挪进 mount effect**，cleanup 里 `dispose()` **且 `clientRef.current = null`**。StrictMode remount 时 ref 已清空 → 重建一个**活** worker。`tokenizeRange` 的 `clientRef.current!` 改为空值守卫（effect 未跑完时跳过，rangeChanged/冷启动会再触发）。**实测**：修后 worker 模块体执行、sudachi 动态核心加载、`fetch /sudachi/system.dic` 200、**词典字节 217116143（完整 217MB 未截断）**、`createTokenizer` 成功（~950ms）；tokens 回流有内容（reqId0=5 词、reqId1=45、reqId2=23，带 surface(读音)）；**DOM 实证 278 个 `.reader-token` 词框（border=solid 可见框）+ 73 个注音 `<rt>`**。核心验收（肉眼确认分词真的出现）达成。

**改动 1 — 诊断可见（保留为正式能力，非临时）**：
- `main/index.ts`：dev（`ELECTRON_RENDERER_URL` 存在）下 `openDevTools({mode:'detach'})` 自动开控制台；`console-message` 事件把含 `[tokenizer]` 的渲染层日志转发到主进程 stdout（Electron 版本间签名兼容）。
- `tokenizer.worker.ts`：`diag()` 把词典加载生命周期（开始 fetch / status / 字节数 / createTokenizer 成功）经 `console.log` **且 postMessage** 上报（Worker console 不进主 stdout，故 postMessage 让客户端转发）；加载失败经 `dict-error` postMessage 上报根因。
- `tokenizer-client.ts`：新增 `onDictError` 回调 + `worker.onerror` 兜底（**Worker 加载/运行错误也上报横幅**——否则失败静默最难查）；转发 diag/dict-error。
- `useReader` + `Reader.tsx`：`dictError` 状态 → 顶部红色横幅"分词词典加载失败：<原因>"（供无法开 F12 的场景看根因）。

**改动 3 — 词框间距可调**：
- `reader-logic.ts`（纯逻辑）：`clampTokenGap(em)` 夹进 [0,0.5]em，脏值(NaN)兜底默认 0.02em；导出 `TOKEN_GAP_DEFAULT/MIN/MAX`。
- `reader.css`：`.reader-token` 的 `margin` 改 `var(--token-gap, 0.02em)` 驱动。
- `Reader.tsx`：`useTokenGap` hook（state + localStorage `reader-token-gap` 持久化）；`.reader-root` inline `--token-gap`；工具栏**中文开关右边**加 ui-kit `Slider`（词距，min0/max0.5/step0.01，实时改变量）。

**契约变动**：无（仍 v4）。worker 与 client 间新增的 `diag`/`dict-error` 是**内部消息**（非契约 2 的 TokenizeReq/Res/Token，未改跨层类型定义）。

**自测（铁律 4）**：`test:reader` 扩 ⑧ 词框间距夹取（界内/钳0/钳0.5/NaN兜底/非数兜底）。`typecheck`+`build`+`test:reader/tokenizer/storage/epub/interaction/library/library-integ/progress/ai`+`smoke` **全绿无回归**。分词修复靠 dev headless 实证（worker 生命周期日志 + DOM 词框计数）。

**留下的坑 / 下游须知**：
- **诊断日志保留为正式功能**：dev 自动开 devtools、`[tokenizer]` stdout 转发、词典加载生命周期日志、dict-error 横幅、`worker.onerror` 横幅——都是低成本高价值的可观察性，留着（不污染生产：devtools 仅 dev 开；diag console.log 生产无 devtools 也无害）。
- **StrictMode 生命周期教训**：**任何在 render 里建、effect cleanup 里销毁的一次性资源（worker/socket/observer），必须在 effect 里建 + cleanup 清 ref**，否则 StrictMode 双挂载留下死引用。别用 render 阶段的 `if(!ref.current) ref.current=new X()` 模式管可销毁资源。
- **生产词典路径债仍开放**（会话 5/6 交办）：worker 默认 `fetch('/sudachi/system.dic')` dev 正常，打包 file:// 需 `configure(dictUrl)`。本会话未碰（`TokenizerClient.configure` 口仍在）。
- 词框间距存 `localStorage`（渲染层 UI 偏好，同面板宽度），不跨设备不进书库。

### 会话 10 — ai-analysis 模块（流式 AI 分析会话 + 多档案 + 按逻辑日自动存档）

**做完**：MVP 全交付。renderer 直连 DeepSeek（OpenAI 兼容 SSE，不经 IPC）；AI 档案 + 对话存档跨进程持久化走 CR-3 新增的 4 通道。只碰约定文件（`ai-store/*`+`ai-analysis/*` 新建、`preload`、`main`(3 行)、`Reader.tsx`(1 行区域)、`package.json`(+test:ai)、`scripts/`(+ai-selftest)）。

- **主进程 `src/main/modules/ai-store/`**（新建，仿 `storage/progress.ts` 可注入模式）：
  - `logical-day.ts`（**纯逻辑**）：`logicalDay(ts)` = `ts-3h` 取本地 `YYYY-MM-DD`（CONTEXT「逻辑日」）；`appendRound(days, round)` 纯合并（同逻辑日追加、跨日新建，不改入参）——抽这里让 test:ai 脱 electron-store 测存档合并。
  - `index.ts`：`openAiStore(cwd?)` 两个 electron-store（`ai-profiles`/`chat-archive`，`cwd` 可注入自测）；`getProfiles/saveProfiles`（整体覆盖写）、`appendChatArchive`（读 days→appendRound→写回，按逻辑日合并同日）、`listChatArchive`。`registerAiStoreIpc()` 挂 CR-3 的 4 个 `ipcMain.handle`。导出 CR-3 类型（`AiProfile`/`AiProfilesState`/`ChatRound`/`ChatArchiveDay`）供 preload 借。
  - `main/index.ts`：`whenReady` 加 `registerAiStoreIpc(openAiStore())` 一行（+ import）。
- **preload**：续挂 4 个 invoke（`getAiProfiles`/`saveAiProfiles`/`appendChatArchive`/`listChatArchive`），类型 `import type` 自 `../main/modules/ai-store`，随 `ChionApi` 自动上 `window.chion`（env.d.ts 未动）。
- **渲染 `src/renderer/src/modules/ai-analysis/`**（新建）：
  - `ai-client.ts`（**纯核心 + fetch**）：`parseSSE(buffer, chunk)` 纯函数——OpenAI 兼容 SSE 按行解析、`[DONE]` 置 done、跨 chunk 半行留 buffer 下次拼回、只取 `choices[0].delta.content`；`streamChat(profile, messages, {onDelta, signal})` fetch `baseURL/chat/completions`（`stream:true`）+ `AbortController` 取消，非 2xx/无 body → throw。
  - `session-logic.ts`（**纯 reducer**）：`{status:'idle'|'streaming'|'done'|'error', messages, error}` + 动作 `startRound/appendDelta/finish/fail/cancel/reset`，全不可变，delta 写最后一条 assistant。抽出便于脱 React 测状态迁移（自测点 ③）。
  - `useAISession.ts`（**单一真值**，CONTEXT「AI 分析会话」）：`useReducer` 持状态 + `messagesRef` 读最新历史（多轮上下文）+ `abortRef`。`send(text, profile)` 组装 `[system?, ...history, user]` → `streamChat` onDelta dispatch → 到 done dispatch finish **且 `window.chion.appendChatArchive` 写档**（取消也存已收部分）；`cancel()` abort；`reset()` 清空。**视图直读 state，无 streamContent/streamStatus 镜像**（CONTEXT 歧义教训）。
  - `useAiProfiles.ts`：挂载读 `getAiProfiles`，空则**种 DeepSeek 默认档案**（`baseURL=https://api.deepseek.com`、`model=deepseek-chat`、`apiKey=''`、日文分析 systemPrompt）并写回。`setActive/addProfile/updateProfile/deleteProfile` 每次整体 `saveAiProfiles` 覆盖写。**删不到空**（≤1 时忽略删除，保证 `activeProfile` 恒存在，send 不用判空）。
  - `AIPanel.tsx`：档案标签（切 activeId）+ ⚙ 配置 Dialog（复用 ui-kit `Dialog`/`Button`，编辑 name/baseURL/apiKey/model/systemPrompt/temperature + 增删档案——**支持完全自定义 API 与提示词**）+ 消息列表（直读 `session.messages`）+ streaming/error 状态条（取消按钮）+ 底部**复用 interaction `StagedInputBox`**（`onSend={(t)=>send(t, activeProfile)}`）。全走主题 class（`var(--*)`/`bg-secondary` 等），未写死色（`ai-analysis.css`）。
- **接线 `Reader.tsx`**：仅第 230 行区域 `<StagedInputBox />` → `<AIPanel />`（AIPanel 内部渲 StagedInputBox）；import 从 interaction 换 ai-analysis。`.reader-panel` 已是 flex 列 + `min-height:0`，`.ai-panel height:100%` 填满，消息区 `flex:1` 滚动、输入区常驻底部。

**装了哪些依赖**：无（纯 renderer fetch + React 内置 + ui-kit 现成 Dialog/Button + electron-store）。

**自测（铁律 4）**：`npm run test:ai` —— 纯逻辑无网络（transpile `logical-day.ts`/`ai-client.ts`/`session-logic.ts`，type-only import 擦除）：① 逻辑日 03:00 跨界（02:59/00:30 归前一天、03:00/23:00 归当天）② SSE 解析（单帧/多帧/`[DONE]`/跨 chunk 半行拼回）③ 会话状态迁移+messages 累积（idle→streaming→done、delta 累积、多轮增长、cancel 保留部分、fail 带信息、reset 清空、reducer 不改入参）④ 存档同日合并/跨日分开/凌晨归前一日。全绿。`typecheck`+`build` 绿；前批 storage/tokenizer/epub/reader/interaction/progress/library/library-integ/smoke **九自测无回归**。流式 fetch/React/IPC/electron-store 落档靠 typecheck+build+dev 手验（需网络/DOM/Electron）。

**契约变动**：**CR-3（按任务卡总纲层预批准落地）**——契约 4 新增 `getAiProfiles`/`saveAiProfiles`/`appendChatArchive`/`listChatArchive` 4 个 IPC + 类型 `AiProfile`/`AiProfilesState`/`ChatRound`/`ChatArchiveDay`。**仅新增，不改既有签名/字段；契约 1/2/3 未动。** 未动总纲第 4 节、未改 CR-3 状态（留总纲层实测后注入推 v4）。

**留下的坑 / 下游须知**：
- **ai-translation 会话复用**：从 `../ai-analysis` 直接 `import { streamChat, parseSSE, type ChatMessage }`（barrel 已导出）。译文是单句、不进聊天框、不多轮（CONTEXT 铁律：译文 ≠ AI 分析会话）——故**别复用 `useAISession`**（那是多轮会话），只借 `streamChat` 的连接 + SSE 能力：拿 `useAiProfiles` 的 `activeProfile` 复用连接配置（baseURL/apiKey/model），但用**独立翻译提示词**（非 profile.systemPrompt）。译文非流式展示也可，一次性收完 delta 拼串即可。纯日语书按 `t` → `streamChat(profile, [{role:'system',译文提示词},{role:'user',日文段}], {onDelta})` → 收完调 storage `saveAiTranslation(segId, zh)` 落库（`zh_source='ai'`）。**双语书永不走 AI**（总纲第 5 节铁律，reader-view 的 t 键 handler 已只展开内置 zh_text）。
- **存档 UI 第二批挂点**：`window.chion.listChatArchive()` 已可用（返 `ChatArchiveDay[]`，按逻辑日、同日 rounds 累积）。第二批做翻阅/搜索/按天删除时：list 已就绪；**按天删除需 CR-4**（当前 CR-3 只给了 append+list，没 delete）——第二批会话提 CR。**存档不回灌实时框**（CONTEXT 铁律：开机 `useAISession` 初始 `messages=[]`，实时框永远空）；翻阅是独立只读视图，别往会话里灌历史。
- **apiKey 明文**：按决策明文存 electron-store（`ai-profiles` store 的 `state.profiles[].apiKey`）。配置 Dialog 里用 `type=password` 只是遮显示，落盘仍明文。settings/安全会话若要加密另议。
- **多档案共用同一 messages**（CONTEXT）：切档案只换下次 `send` 的配置（`activeProfile`），不清空/不切换会话历史——`useAISession` 与 `useAiProfiles` 是两个独立 hook，AIPanel 组合。切档案中途发送，用新档案配置续同一会话。
- **SSE 错误处理**：`parseSSE` 保持纯净只取 content；错误全靠 `streamChat` 的 `res.ok` 判（非 2xx throw 带 status+body 前 200 字）→ `useAISession` 落 error 态显示。若某些 OpenAI 兼容服务把错误塞进 200 的 data 帧（非标准），当前会被当空 delta 跳过、表现为"无输出即 done"——真遇到再按服务实测加解析（YAGNI 未做）。
- **取消语义**：`cancel()` abort fetch，`useAISession` catch 到 `signal.aborted` → dispatch cancel（保留已收部分、落 done）**且把这半截也写存档**。若不想存半截，改 `useAISession` catch 分支（当前选择存，因为用户可能就想留下已生成部分）。
- **CSP/跨域**：renderer 直连外部 API（DeepSeek）需 Electron 允许跨域 fetch。dev 下 webSecurity 默认放行；若打包后开严格 CSP 导致 fetch 被拦，需在 main 的 BrowserWindow 或 session 放行 AI 域名（本会话 dev 未遇，打包会话留意）。

### 会话 9.1 — reader-view 补丁（t 键悬停段 + 面板可拖拽调宽）

**背景**：会话 9 阅读重构后用户实测两个问题（空格问题已由重新导入解决，无需改代码）。只碰 `src/renderer/src/modules/reader-view`（+ `scripts/reader-selftest.mjs` 扩自测）。未改契约（仍待 v3 注入）、未碰其他模块。

**改动 1 — t 键改用鼠标悬停段**：原 `Reader.tsx` t 键读 `focusedIdxRef.current`（视口顶段），按 t 出的是章标题中文而非鼠标所在句。改为悬停即命中：
- `SegmentView.tsx`：`.reader-seg` 加 `onMouseEnter`/`onMouseLeave`，回调把 `seg.seq`（离开传 `null`）上报 Reader。image 段不渲 `.reader-seg`，天然不触发（合理）。
- `Reader.tsx`：加 `hoveredSeqRef`，SegmentView `onHover` 写它；t 键 handler 改读 `hoveredSeqRef.current`。**空悬停（null）按 t 不响应**（用户明确要求，防误触）。
- **进度上报仍用视口顶段**（`onRangeChanged` 的 `focusedIdxRef`），未动。

**改动 2 — 左右面板可拖拽调宽**：原 `reader.css` 左栏 `15rem`、右栏 `22rem` 固定。改为 state 驱动 + 拖拽：
- `Reader.tsx` 加 `usePanelWidth` hook：宽度存 React state，两栏内侧各插一根 `.reader-resizer`（5px 细长可点区，hover 变 `col-resize` 光标 + 高亮）。`onPointerDown` 起 `window` 级 `pointermove`/`pointerup` 监听实时改宽，`pointerup` 存 `localStorage`（`reader-toc-width`/`reader-panel-width`），下次打开恢复并夹取。
- 边界（任务书）：左栏 10–28rem（160–448px）、右栏 14–40rem（224–640px），`clampWidth` 防拖没/拖爆。
- 宽度改走 inline style（`.reader-toc`/`.reader-panel` 删死 width），flex 布局 Virtuoso 随中栏宽自适应重排。

**抽的纯逻辑**（`reader-logic.ts`，无 DOM/electron）：`toggleHoveredZh(open, hoveredSeq)`（null 原样返回、命中翻转、不改入参）+ `clampWidth(px,min,max)`。

**自测（铁律 4）**：扩 `npm run test:reader`——新增 ⑥ t 键悬停切译文（命中/收起/并存/空悬停不响应/不可变入参）+ ⑦ 面板宽度夹取（界内/钳 min/钳 max）。全绿。`typecheck`+`build` 绿；`smoke`+`test:storage`/`tokenizer`/`epub`/`interaction`/`library`/`library-integ`/`progress` 全绿无回归。拖拽 pointer 交互 + Virtuoso 宽变重排靠 dev 手验（需 DOM）。

**契约变动**：无。

**留下的坑 / 下游须知**：
- **t 键归属仍在 reader-view**（会话 7 记的债未变）：settings 会话若接管可自定义快捷键，改读 interaction `keybindings`。悬停真值 `hoveredSeqRef` 是 reader 内部 ref，不外露。
- **拖拽手柄用 `window` 级 pointer 监听**（非 setPointerCapture）：拖动中若组件卸载，`pointerup` 仍会 removeListener（闭包内），无泄漏。极端情形（拖动中切书重挂）未见问题，dev 手验为准。
- 面板宽度存 `localStorage`（渲染层），非 electron-store——纯 UI 偏好，不跨设备、不进书内容库，与进度分离。

### 会话 9 — 阅读体验重构（进行中）· 跨 epub-import + storage + reader-view

**用户报告的 7 个问题（总纲层已定位根因，见下）**：
1. 双语书打开白屏（纯日语正常）；删除重导后首开白屏、重开正常。
2. "没有分词"——双语白屏没渲染；纯日语其实在分词但 token 无常驻框（`.reader-token` 只 hover 有底）看不出。
3. **格式混乱真凶**：`parse.ts` 的 `plainText()` 删 ruby 标签后，夹在汉字间的缩进空格未清 → `骨色の魔法` 存成 `"骨色の 魔 法"`。所有带作者注音的汉字词都被污染。
4. 无目录。5. AI 面板在底部（应右侧可收起）。6. 全书无限滚动（应按章）。7. 需统一注音（弃作者 ruby，用 Sudachi）。

**根因定位（总纲层查库确认）**：
- 白屏：`Reader.tsx` Virtuoso `initialTopMostItemIndex` + 首屏空数组 + 双语书头 3 段是 image（冷缓存异步加载高度突变）→ 锚定算错 → 渲 0 节点。重开图片已缓存故正常。纯日语头段是文字故不白屏。
- 格式：见问题 3。数据已存坏，需重导（用户本就在删+重导，可接受）。
- 数据现状：book3 双语 3251 段/29 章（**仅 12 章有标题，17 章空**）；`chapters` 表无每章起始 seq（按章跳转需补 → CR-2）。

**用户拍板的决策**：
1. 目录**全列 29 章**，空标题显示"插图/第N节"占位。
2. 注音**可关，默认开**。
3. 进度恢复到**上次章内的大概滚动位置**（不必精确）。
4. 右侧面板这批**只做可收起容器 + 把 StagedInputBox 挪进去**；真正 AI 流式对话等 `ai-analysis` 会话。
5. 一个会话统一做（A 方案），总纲层把关。

**范围（三块，契约走 CR-2）**：
- **epub-import**：修 `plainText` —— 删标签后清除夹在 CJK/假名间的空白，保留拉丁词间空格（`Paradise Coldplay` 不动）。
- **storage**：加 `listChapters(bookId)`（CR-2，已预批准）返回 `{id,ordinal,title,startSeq,endSeq}`。
- **reader-view 大改**：按章加载（根治白屏，改 `scrollToIndex`）+ 左侧目录可收起 + 右侧面板可收起(含暂存框) + token 常驻框 + 注音统一(弃 seg.ruby 用 Sudachi)+可关 + 章末/顶部上下章 + 章内滚动进度。

**状态**：任务卡已下发，等会话 9 执行。契约将由 v2 → v3（CR-2 落地后总纲层注入）。

### 会话 8 — library 模块（书架 / 打开书 / 阅读进度 / 导入 / 删书）

**做完**：按总纲第 6 节 library 职责 + 契约 4（含 CR-1 扩展）落地。地基第一阶段收官。碰的文件：`src/renderer/src/modules/library/*`（新建全部）、`App.tsx`（路由接线）、storage `db.ts`/`progress.ts`/`index.ts`（CR-1 扩展）、`main/index.ts`（CR-1 编排 + 文件选择器）、`preload/index.ts`（挂新通道）、reader-view `Reader.tsx`/`useReader.ts`（加**可选** props 接进度，向后兼容）、`package.json`（+4 script）、`scripts/`（+4 自测）。
- **书架**（`Library.tsx`）：`listBooks` 渲染网格（占位封面 + 标题 + 类型徽章），空态引导导入。用 ui-kit `Button`/`Dialog` + 主题 class（`bg-background`/`text-muted-foreground`/渐变用 `from-primary/15` 等），**未写死颜色**（会话 3 约定）。点书 → `onOpen` 交 App 路由。
- **导入流程**（`import-flow.ts` 纯状态机 + `ImportDialog.tsx` + `useLibrary.ts`）：点「导入」→ `pickEpubFile`（主进程 `dialog.showOpenDialog` 选 epub）→ **让用户手选「双语/纯日语」**（决策 6，绝不自动判）→ `importBook(path, mode)` → 成功刷书架。导入中 loading 态；失败（会话 4 说损坏 epub reject）catch 落 error 态提示。状态机是纯 reducer（`idle→choosing→importing→done/error` + 取消/非法转移防御），可脱 React/electron 自测。
- **打开书 + 进度往返**（`ReaderScreen.tsx`）：打开时 `getProgress(bookId)` → `initialSeq` 传 Reader，Virtuoso `initialTopMostItemIndex` 直接跳位（进度未取回前不渲 Reader，避免从 0 起闪动）。阅读中顶段 seq 变化 **防抖 800ms** `saveProgress`（避免滚动高频 IPC）。
- **删书**（`BookCard.tsx` 确认框 + `deleteBook` IPC）：清三处（会话 2/4 下游须知）——storage db 两库（segments/chapters/books，事务）+ electron-store 进度（新增 `deleteProgress`）+ `<userData>/books/<bookId>/` 图片目录（main 侧 `rmSync` 编排）。
- **App 路由**：`App.tsx` 从写死 `<Reader bookId={1}/>` 改成 `openBook` state 切书架 ↔ `ReaderScreen`；选书进阅读器、`onBack` 回书架。

**契约变动**：**CR-1（已在「契约变更请求」区提出并按任务书授权落地）**——契约 4 新增 `listBooks()`/`deleteBook(bookId)`/`pickEpubFile()` 三个 IPC。**仅新增，不改既有签名/字段；契约 1（Segment）未动**。`listBooks` 返回 `BookMeta`（books 表行 `{id,title,kind,created_at}`）。**待总纲层把这三个补进总纲第 4 节并推 v2**。

**装了哪些依赖**：无（纯用 ui-kit 现成组件 + React 内置 + electron dialog）。

**自测（铁律 4）**：4 个，均不依赖其他模块。
- `npm run test:library` —— 导入状态机纯逻辑（transpile `import-flow.ts`，无 DOM/electron）：9 组断言覆盖选文件→选 mode（决策 6）→importing→done/error、取消、error 重选、非法转移防御。
- `npm run test:library-integ` —— 对真 SQLite（electron-node，匹配 better-sqlite3 ABI）验 `listBooks`（含排序 `created_at DESC, id DESC`）+ `deleteBook`（清 segments/chapters/books）闭环。
- `npm run test:progress` —— transpile 真 `progress.ts`（electron-store 纯 JS，普通 node 跑）验 `saveProgress`→`getProgress` 跳位 / 更新 / 多书独立 / `deleteProgress` 清除。
- `typecheck`+`build` 绿；前批 `test:storage`/`test:epub`/`test:reader`/`smoke` 无回归。UI（书架渲染/对话框/文件选择器/滚动跳位）靠 typecheck+build+dev 手验（需 DOM/Electron）。

**留下的坑 / 下游须知**：
- **占位封面**：epub-import 暂未抽书封面（只存 title/kind），书架用主题渐变 + 书名首字水印代替。若 epub-import 后续抽真封面（cover 图落盘 + books 表加 `cover_ref`，需走契约变更），`BookCard.tsx` 的 coverChar 区块换 `<img>` 即可。
- **进度接线跨了 reader-view**：给 `Reader`/`useReader` 加了**可选** props（`initialSeq=0`/`onProgress?`/`onBack?`，默认值保持会话 6 原行为不变）。`useReader` 首屏改为「一次性取到覆盖 initialSeq 的整页边界」以保证 Virtuoso 跳位时目标 index 已在数组内（seq 全局连续，index===seq）。**未动 reader-view 的分词/译文/虚拟化核心逻辑**。settings 会话若接管快捷键仍按会话 7 说明处理（本会话未碰 `t` 归属）。
- **listBooks 排序**：`created_at DESC, id DESC`（同毫秒批量导入按 id 兜底，最新在前）。
- **生产词典路径债（会话 5/6 交办）仍开放**：本会话未处理打包后 Sudachi `file://` 失效（`configure(dictUrl)`）。dev 下书架→打开→分词已可验。**留给打包/settings 会话**——这是地基阶段唯一遗留债。
- **删书 IPC 是 main 编排**（非纯 storage）：因要删图片目录（`app.getPath` + `rmSync`），放 `main/index.ts` 的 `registerLibraryIpc`，storage `db.deleteBook` 只管 SQLite 两库、`progress.deleteProgress` 只管进度。删书**不可撤销**，UI 有二次确认框。
- **纯日语书（mode='jp'）导入路径**首次真书验证仍未做（手头只有双语书，会话 4 交办）：导入 UI 已能选「纯日语」并传 `mode='jp'`，但未用真纯日语 epub 跑过全程。ai-translation 会话首次用纯日语书时留意。

### 会话 7 — interaction 模块（点词/选择/快捷键 → 剪贴板 + 暂存）

**做完**：按契约 3、总纲第 5 节交互模型落地。新建 `src/renderer/src/modules/interaction`；只在 `Reader.tsx`+`reader.css` 做必要接线（未改 reader-view 内部虚拟化/分词/译文逻辑），`package.json` 加一个 script、`scripts/` 加自测。未改契约（仍 v1）。
- `selection.ts`（**纯核心**，契约 3 落地）：`wordItem`（原形空/异常兜底表层形）、`segmentItem`、`accumulate`（shift 同类型累加，非 shift/换类型覆盖——覆盖语义）、`toSelection`（单击点词带 `dictionaryForm` 原形；多选/段只表层，seqs 去重保序）、`selectionText`（点词优先原形喂 GoldenDict，多选/段用表层）。
- `staged-store.ts`（**暂存输入**单一真值，CONTEXT.md 概念）：模块级 store + `useSyncExternalStore` 订阅。`stageSelection` 落覆盖语义 + **草稿保护**（`origin==='user'` 且非空则只更 selection 元数据、不覆盖文本）；`setUserText`（手打→user，空串回落 auto）；`clearStaged`（发送/清空归零）。
- `clipboard.ts`：`writeClipboard` 走渲染层 `navigator.clipboard`，失焦/权限异常落 `execCommand` 退路。**所有选择都写剪贴板，不受草稿保护限制**（草稿保护只管 AI 输入框）。
- `keybindings.ts`：可配置快捷键结构（`defaultKeybindings` 含 `t`/`ctrl+enter`/`escape`）+ `matchAction`。**先留结构**供后续 settings 会话持久化/覆盖。
- `useInteraction.ts`（接线 hook）：全局 shift 态跟踪（token onClick 不带事件，靠 keydown/keyup 还原 shift+左键）；`onTokenClick` 接 JapaneseText 现成接口；`onSegmentContextMenu` 从 `.reader-seg[data-seq]` 反查 seq，`preventDefault` 抑制系统右键菜单。收尾统一：造 Selection → 写剪贴板 且 填暂存。
- `StagedInputBox.tsx`：占位 AI 输入框，订阅 store 显示暂存 / 手打；`Ctrl/Cmd+Enter` 或「发送」按钮触发 `onSend`（留给 ai-analysis 会话），发送后清空。

**接线点**：`Reader.tsx` 用 `segments.find(s=>s.seq===seq)?.jp_text` 供右键取整段原文（DOM token 含 ruby 读音，故从数据取原文）；`SegmentView` 已有 `onTokenClick` 透传口，直接接上；列表容器包一层 `.reader-list-wrap`（flex，min-height:0 保 Virtuoso 高度）挂 `onContextMenu`；底部挂 `<StagedInputBox />`。

**装了哪些依赖**：无（纯渲染层 + React 内置 `useSyncExternalStore`）。

**自测（铁律 4）**：`npm run test:interaction` —— 纯逻辑（transpile `selection.ts`/`staged-store.ts`，type-only import 擦除，无 DOM/electron）。10 项断言：点词原形/空原形兜底表层、shift 多选拼表层不转原形、非 shift 覆盖不叠加、选段拼换行去重、换类型不混选、选择自动填、新选择覆盖旧 auto、有草稿不覆盖文本但 selection 更新、清空后可再填、空草稿不保护。全绿。`typecheck`+`build` 绿；`test:reader`+`smoke` 无回归。剪贴板/DOM/React 部分靠 typecheck+build+dev 手验（需 DOM/Electron）。

**契约变动**：无。契约仍 v1。（`selection.ts` 是契约 3 原样落地，字段未改。）

**留下的坑 / 下游须知**：
- **ai-analysis 会话挂点**：`StagedInputBox` 的 `onSend?(text)` 现在只清空——真正流式一轮接这里。要拿结构化选择（区分 word/segment、seqs、原形）用 `getStaged().selection`（契约 3 Selection）。暂存 store 是单一真值，直接 `subscribeStaged`/`getStaged` 读，别再镜像（CONTEXT.md 已标歧义教训）。
- **快捷键 `t` 归属**：`toggleTranslation`(t 键) 目前仍由 reader-view 的 `Reader.tsx` 内部 handler 拥有（作用于聚焦段译文，会话 6 实现）。本模块 `keybindings.ts` 提供统一可配置真值但**未强夺** reader 的 t 监听。settings 会话若要真·可自定义，需让 reader 改读 `keybindings`（跨模块，走协调，本会话未动 reader 内部逻辑）。
- **shift 态用全局跟踪而非事件**：token `onClick` 契约（会话 6 定的 `onTokenClick(seq,idx,token)`）不带 MouseEvent，故 shift+左键靠 window keydown/keyup 还原。极端情形（窗口失焦时松开 shift）可能漏掉 keyup——影响轻微（下次点击非 shift 即覆盖重置）。若要更稳可给 `onTokenClick` 加事件参数（改会话 6 接口，需协调，YAGNI 未做）。
- **右键选段取原文**：从 `segments` 数据取 `jp_text`（含原始 ruby 标记的裸文本），不从 DOM textContent 取（DOM 含 Sudachi 振假名读音会污染）。Reader 用 `segments.find` 线性查——段数组最大约一本书量级，右键低频，未做索引（YAGNI）。
- **剪贴板退路**：`navigator.clipboard` 在 Electron 渲染层正常可用；退路 `execCommand('copy')` 是废弃 API 但仍工作，纯防御。dev 未见落退路。

### 会话 6 — reader-view 模块（react-virtuoso + 视口分词 + ruby + 中文展开）

**做完**：按契约 1、2 落地虚拟化阅读器。只碰 `src/renderer/src/modules/reader-view`（+ `App.tsx` 接线、`env.d.ts` 加 `window.chion` 类型、`package.json` 加两个 script、`scripts/` 加自测/播种）。未改契约（仍 v1）。
- `tokenizer-client.ts`：包 tokenizer Worker（会话 5 路径 `new URL('../../../../worker/tokenizer.worker.ts', import.meta.url)`）。**correlation-id 机制**：契约 2 响应只带 `seq`，无法区分「同 seq 不同 mode / 重发」，故对 worker 用单调自增 reqId 当 seq 发出、本地 reqId→(seq,mode) 还原（不动契约）。按 (seq,mode) 缓存 + 去重（同 key 飞行中的请求搭同一趟）。`configure(dictUrl)` 留生产词典覆盖口。`peek()` 同步取缓存供渲染快路径。
- `useReader.ts`：数据核心。**分页取段**（`getSegments(bookId, from, from+199)` 闭区间，PAGE=200），段数组只增长、DOM 由 Virtuoso 只挂视口内。`tokenizeRange(start,end)` 对视口内 + 预取余量（PREFETCH=30）的 pair/heading 段请求分词，回来 setState 触发重渲。切 A/B/C 清 tokens 视图重算（词典常驻，快）。
- `JapaneseText.tsx`：分词到达渲染成一串**可点 token**（`data-seq`/`data-idx` 留 interaction 会话锚点，`onTokenClick` 留接口未接剪贴板）；含汉字 token 用读音（片假名→平假名）作 `<ruby>` 振假名；未到达降级纯文本（不阻塞阅读）。
- `ruby.ts`：`kataToHira` / `hasKanji` / `furiganaFor`（含汉字且读音≠表层才注）。
- `SegmentView.tsx`：按 type 分发 pair/heading/image。image 走 `getImagePath(image_ref)` + `file://` 前缀喂 `<img>`。中文行内正下方 `.reader-zh` 淡入（CSS keyframes）。语义色/字体全走主题 class（`font-reading-jp`、`var(--*)`），不写死颜色。
- `Reader.tsx`：Virtuoso 不定高虚拟化，`rangeChanged`→分词+预取、`endReached`→取下一页。`t` 键切**当前聚焦段**（rangeChanged 的 startIndex）译文——双语用内置 `zh_text`；**AI 译文那条留给 ai-translation 会话**（当前 `zh_source==='ai'` 复用同展开逻辑，只是本会话不触发翻译）。工具条：A/B/C 切换 + 全书中文开关。

**装了哪些依赖**（`--save-exact`）：`react-virtuoso@4.14.0`。

**生产词典路径债（会话 5 交办）**：`TokenizerClient.configure(dictUrl)` 已备好覆盖口，`useReader` 里留 TODO。dev 下 worker 默认 `/sudachi/system.dic`（Vite 服务 public）即可，**打包后 file:// 失效时** library/ai 会话或本模块后续按 electron 实测调 `configure`。本会话 dev 已验通（sudachi-wasm333 被 Vite 优化加载）。

**自测（铁律 4）**：`npm run test:reader` —— 纯逻辑验 `ruby.ts`（片假名→平假名 / 汉字检测 / 振假名决策，无 DOM/electron 依赖）。全绿。Virtuoso 渲染/分词管道靠 `typecheck`+`build`+`dev` 手验（需 DOM/Worker）。
- **`npm run seed:book`**（dev 便利，非交付）：把仓库根真实 epub 导入**生产 userData 库**使 bookId=1 存在，供手动验滚动/分词/中文展开/图片。已跑：**29 章 / 3251 段 + 18 图落盘**。library 会话做完导入 UI 后此脚本可弃。
- `typecheck`/`build`/`smoke` 全绿，`dev` 启动无 renderer 崩溃（三进程就绪、worker 加载）。

**契约变动**：无。契约仍 v1。

**留下的坑 / 下游须知**：
- **interaction 会话挂点**：每个 token 是 `<span class="reader-token" data-seq data-idx>`，`JapaneseText` 的 `onTokenClick(seq, idx, token)` 是现成接口——接剪贴板/暂存从这里进。段级选择用 `.reader-seg[data-seq]`。**本会话未做任何剪贴板/选择**（按分工）。
- **ai-translation 会话挂点**：纯日语书按 `t` 时 `seg.zh_text` 为空、`zh_source=null` ——当前只展开已有 zh_text，翻译触发逻辑留给你：在 `Reader.tsx` 的 `t` 键 handler（或 SegmentView showZh 时）发起 `saveAiTranslation` 前的 AI 调用，回来后 setState 重渲。展开动画/位置已就绪。
- **振假名来源**：当前用 Sudachi token 读音（覆盖全部汉字词、随 A/B/C 一致），**未用书自带 `seg.ruby`**（作者精选注音）。若要严格复刻作者注音需做 token↔seg.ruby 区间对齐（`ruby.ts` 标了升级路径，YAGNI 未做）。
- **图片 `file://`**：dev 下 Electron webSecurity 默认允许 `file://` 加载本地图；若后续开启严格 CSP/webSecurity 导致图裂，改用自定义 protocol 或 `getImagePath` 返 data URL（本会话按 dev 实测用 `file://` 前缀，已验路径解析对）。
- **renderer 主 chunk 650KB**（+virtuoso），worker chunk 2.36MB（含 Sudachi WASM base64）。仍单 chunk 警告，分包留待 library/settings 会话统一处理。
- **App.tsx 现直挂 `<Reader bookId={1} />`**：library 会话接管时改成书架/选书路由，Reader 只需传入选中的 bookId。

### 会话 5 — tokenizer 模块（Sudachi WASM + A/B/C + 视口分词）

**做完**：把会话 1 的 echo stub 换成真 Sudachi 分词。只碰 `src/worker`（+ `scripts/` 加自测/下载脚本、`package.json` 加两个 script、`.gitignore`/`README` 收尾）。未动 reader-view 渲染，未改契约。
- `src/worker/sudachi.ts`（**纯核心**，无 DOM/Worker 依赖，worker 与自测共用）：`createTokenizer(dictBytes)` → `{ tokenize(text, mode) }`。包装 `SudachiStateless`，`initialize_from_bytes` 一次加载词典常驻，A/B/C 每次调用传入（切模式零成本、无需重载 —— 正合视口即时重算）。形态素→契约 Token 映射：`surface`→`surface`、`dictionary_form`→`dictionaryForm`（原形）、`reading_form`→`reading`（片假名读音）、`poses[]` 去 `*` 逗号连接→`pos`。原形空时兜底表层形（总纲第 5 节点词兜底）。
- `src/worker/tokenizer.worker.ts`（**外壳**）：懒加载词典（首个请求触发 `fetch(dictUrl)`，默认 `/sudachi/system.dic`，可被 `{type:'config',dictUrl}` 消息覆盖）；加载期间到达的请求排在同一 loading Promise 后，就绪按序回；分词失败回空 tokens（reader-view 降级纯文本，不阻塞阅读）。全程在此后台线程，主/渲染线程永不跑 Sudachi（总纲第 4、7 节）。
- `scripts/fetch-sudachi-dict.mjs`（`npm run setup:dict`）：下载**官方 SudachiDict core**（~200MB）到 `src/renderer/public/sudachi/system.dic`，dev 由 Vite 从 `/` 服务。已存在够大则跳过。用内置 `tar` 解 zip（零依赖）。

**装了哪些依赖**（`--save-exact`）：`sudachi-wasm333@1.0.4`（sudachi.rs 的 WASM 版，唯一暴露 `dictionary_form` 原形字段的可用 WASM 包）。其内联 base64 WASM，import 即自 `initSync`，Node/Worker 皆可直接用。

**关键决策 / 大坑（下游必读）**：
- **绝不用 `sudachi-wasm333` 自带的 `resources/system.dic`**：实测那是**残缺词典** —— 无 C-unit 切分数据，A/B/C 三模式产出完全相同（選挙管理委員会 C 模式不合并），且误分词（外国人参政権→外国/人参/政権）。**必须**用官方 SudachiDict（`setup:dict` 下的 `system_core.dic`）。换官方词典后 A/B/C 模式差异、原形、读音全部正确（自测覆盖）。
- **词典 ~200MB 不入 git**（已加 `.gitignore`：`src/renderer/public/sudachi/`）。装机多一步：`npm run setup:dict`。
- **生产环境词典 URL**：worker 默认 `fetch('/sudachi/system.dic')`，dev 下 Vite 服务 public 即可。**打包后**（Electron `file://`）此绝对路径可能失效 —— 届时 reader-view/library 会话在起 worker 后先发 `{type:'config',dictUrl}` 覆盖为正确路径（自定义 protocol 或 IPC 解析）。worker 已留此覆盖口。
- **Vite 打包 worker 的告警**（无害）：`new URL('sudachi_bg.wasm', import.meta.url) doesn't exist at build time` —— 该路径在 `__wbg_init` 死代码里，WASM 实际走模块底部 base64 自初始化，从不执行此分支。可忽略。worker chunk 已验证能独立打包（2.29MB）。
- **每次 `npm run build` 会把 200MB 词典从 public 拷进 `out/renderer/sudachi/`**（Vite public 默认行为），构建变慢属正常。

**下游（reader-view）怎么用**：`new Worker(new URL('../../../worker/tokenizer.worker.ts', import.meta.url), { type: 'module' })`（`worker-smoke.ts` 已示范路径）。按视口发 `{seq,text,mode}`，收 `{seq,tokens}`。预取下一屏/下一章 = 提前多发几条 req（worker 顺序处理，无需特殊接口）。切 A/B/C = 直接用新 mode 重发视口内各段（词典已常驻，重算快）。

**自测（铁律 4）**：`npm run test:tokenizer` —— 用纯核心 + 真实 public 词典，断言：①「読んでいる」→ 読ん(原形読む/读音ヨン)、本(ホン) ②「住んでいます」→ 住ん(原形住む) ③ 選挙管理委員会 A 拆(選挙/管理/委員/会) vs C 合(整词)，证明模式生效 ④ 四字段齐全 ⑤ 空文本兜底。全绿。Node 24 直跑 `.ts`（类型擦除），纯 Node 即可（WASM 走 base64，无需 electron ABI）。`typecheck`/`build`/`smoke` 全绿（smoke 已更新为验证 worker 通道+降级契约，不再是 echo stub）。

**契约变动**：无。契约仍 v1。（`contract.ts` 未动；Token 四字段原样落地。）

### 会话 4 — epub-import 模块

**做完**：按契约 1、4 落地 EPUB 解压/解析/双语配对/图片落盘/入库，实现契约 4 的 `importBook(path, mode)`。只碰 `src/main/modules/epub-import`（外加 preload/main/index.ts 接缝 + package.json 加自测脚本）。未动 storage 内部、未改契约。
- `zip.ts`：**手写最小 ZIP 读取器**（只用 stdlib `zlib`，零新依赖，沿用 storage 的克制）。回扫 EOCD→读中央目录→按本地头解 stored(0)/deflate(8)。不支持 zip64/加密（EPUB 规范不用，`ponytail:` 标了升级路径）。
- `parse.ts`：XHTML→线性 block→段，**严格照总纲第 3 节**。判日文：① `opacity<1` 优先；② 无 opacity 时含假名即判日文。空段（只有 `<br>`/空白）丢弃。双语路径：日文段 + 其后第一个非空段配对；孤立非日文段**降级为日文正文段**（绝不隐藏日文）。ruby 按 `<rb>/<rt>` 位置配对，无 `<rb>` 兜底取去 rt 文本为 base。纯正则，不引 HTML parser（calibre 产出良构，`ponytail:` 标了嵌套升级路径）。
- `import.ts`：编排 `importBook(path, mode, deps)`。读 `container.xml`→`opf`（manifest+spine 定章序与书名）→逐文档 `parseDoc`→分配全局连续 `seq`（总纲问题 8）→图片落盘→`insertBook/insertChapter/insertSegments`（台账会话 2 下游须知）。**deps 注入**（`{ db, booksRoot }`），不 import electron → 自测可脱 electron 跑逻辑。章标题取本章首个 heading 段日文。
- `index.ts`：`registerImportIpc(db)` 挂契约 4 剩下两通道 `epub:importBook`、`epub:getImagePath`（接 electron 的 `app.getPath`）。
- 接缝：`main/index.ts` 在 `whenReady` 里 `registerImportIpc(storage.db)`；`preload/index.ts` 挂 `importBook`/`getImagePath` 两个 invoke 包装。

**装机**：未新增任何依赖（zip 手写、解析纯正则）。better-sqlite3 沿用会话 1 装好的 Electron ABI 产物。

**自测（铁律 4）**：`npm run test:epub` —— 用仓库根真实 `jp-zh.Yg.楽園ノイズ.epub` 跑全程导入（transpile TS→临时 .mjs，走 electron 内置 node 匹配 better-sqlite3 ABI，同 storage 套路）。断言：**29 章 / 3251 段**；seq 从 0 连续；三型齐全；已知句「これがきっと楽園というもの…」正确配「…乐园吧」且 `zh_source='builtin'`；ruby「荒→あ」往返；**每个 pair 段 jp_text 非空（日文未误藏）**；含假名段 >10；**图片落盘 18 张**且 `image_ref` 指向的文件真实存在。总纲层四项 `typecheck`/`build`/`smoke`/`test:storage` 全绿，未回归。

**契约变动**：无。契约仍 v1。

**留下的坑 / 下游须知**：
- **图片落盘目录规则（总纲第 8 节本会话定）**：`<userData>/books/<bookId>/images/<basename>`。`segments.image_ref` 存**相对 booksRoot 的 posix 路径** `"<bookId>/images/<basename>"`。`getImagePath(imageRef)` = `join(booksRoot, imageRef)` 反解为绝对路径。**library 会话删书**时除清 storage 两处，还要删 `<userData>/books/<bookId>/` 整个目录。
- **reader-view 用图片**：`<img>` 的 src 走 `window.chion.getImagePath(seg.image_ref)`（返绝对路径；生产可能要 `file://` 前缀，reader 会话按 electron 实测定）。
- **章标题启发式**：heading 判定靠 `<hN>` 或 class 含 head/title/chapter/`font-1em2`（本书章标题在 `start-1em`/`font-1em2` div）。**best-effort，非契约保证**——别的书若无这些 class，章标题会落空、标题段降级为 pair，但日文绝不丢。reader 会话若要更强的目录，另立 toc 解析（本会话未做，YAGNI）。
- **纯日语路径（mode='jp'）**已实现但未用真书验证（手头只有双语书）：不配对，每非空文本段即一段日文，`zh_text` 空、`zh_source=null`，按 `t` 走 AI 译文（总纲第 5 节）。ai-translation 会话据此落库。
- **mode 由用户手传**（决策 6）：`importBook(path, 'bilingual'|'jp')`。library 会话的导入 UI 要让用户选，别自动判类型。
- IPC 用 `path` 字符串——library 会话的文件选择器（`dialog.showOpenDialog`）拿到路径后传入即可；错误（损坏 epub）会 throw，Promise reject，UI 需 catch 提示。

### 会话 2 — storage 模块

**做完**：按契约 1、4 落地 SQLite 存储 + 阅读进度 + 数据相关 IPC。只碰 `src/main/modules/storage`（外加 preload/main 的接缝挂载）。
- `db.ts`：`books`/`chapters`/`segments` 三表，`segments` 严守契约 1 字段（`ruby` 存 JSON 文本，读回反序列化为结构化数组），`(book_id, seq)` 建索引。API：`getSegments(bookId, seqFrom, seqTo)`（**闭区间**）、`saveAiTranslation(segId, zh)`（落库并标 `zh_source='ai'`）、写入用 `insertBook/insertChapter/insertSegments`（`insertSegments` 走事务）。**只依赖 better-sqlite3，不 import electron** —— 让自测能独立跑。
- `progress.ts`：`saveProgress`/`getProgress` 走 electron-store（决策 3：进度是应用状态，不入 SQLite）。`cwd` 可注入，生产用默认 userData 目录。
- `index.ts`：`createStorage()` 生产装配（库落 `userData/chion.db`）+ `registerStorageIpc()` 注册 `storage:getSegments`/`saveAiTranslation`/`saveProgress`/`getProgress` 四个 `ipcMain.handle`。`main/index.ts` 在 `whenReady` 里调一次。
- preload：`window.chion` 挂上四个 invoke 包装（类型从 `../main/modules/storage` 借 `Segment`/`Progress`）。

**装机**：照台账「留下的坑」两步走 —— 依赖已在会话 1 装好（`better_sqlite3.node` 就位），本会话未新增任何运行时依赖。

**自测（铁律 4）**：`npm run test:storage` —— 建库→写 4 段假数据（覆盖 pair/heading/image 三型 + ruby 往返 + zh_source 三态）→按区间 `[1,2]` 读回→断言一致→`saveAiTranslation` 落库校验。用 electron 内置 node 跑（`ELECTRON_RUN_AS_NODE=1`，经 `scripts/run-storage-selftest.mjs` 拉起，免装 cross-env），匹配 better-sqlite3 的 Electron ABI。`npm run typecheck`/`build`/`smoke` 全绿。

**契约变动**：无。契约仍 v1。（`db.ts` 的 `Segment` 类型是契约 1 原样落地，字段未改。）

**留下的坑 / 下游须知**：
- **epub-import 入库入口**：从 `./modules/storage` 导入 `insertBook(title, kind)` / `insertChapter(bookId, seq, title)` / `insertSegments(segs: SegmentInput[])`。`SegmentInput` = 契约 1 去掉 `id`；`ruby` 传结构化数组（内部自动 JSON 序列化）；空段不要入库（总纲第 3 节）。`books.kind` ∈ `'bilingual'|'jp'`。
- **契约 4 尚缺 `importBook` / `getImagePath`**：preload 只挂了 storage 的四通道，这两个留给 epub-import / library 会话在 `index.ts`（registerStorageIpc 旁）与 preload 续挂。
- **getSegments 是闭区间** `[seqFrom, seqTo]` —— reader-view 取视口时按此约定算边界。
- 图片落盘的具体目录规则（总纲第 8 节）本会话未定，`image_ref` 只存相对路径字符串，由 epub-import 会话定规则、library/reader 会话经 `getImagePath` 解析为绝对路径。
- 进度存在 electron-store 的 `reading-progress` 存储（`progress` 键，按 bookId 索引），与书内容库分离；删书时两处都要清（library 会话注意）。

### 会话 3 — ui-kit（设计 token + shadcn 原语 + 日文字体栈）

**做完**：立起全应用视觉底座。只碰 `modules/ui-kit` 与 `components/ui`，未动业务界面/契约。
- **设计 token**（`src/renderer/src/index.css`）：暖中性纸感底 + 靛蓝主色，全 oklch，亮/暗双主题。含完整 shadcn 语义色（background/card/popover/primary/secondary/muted/accent/destructive/border/input/ring），圆角基准 `--radius: 0.625rem`（派生 sm/md/lg/xl），`@theme inline` 全量映射到 Tailwind v4 utilities。`@layer base` 设默认边框色+字体+抗锯齿。
- **字体栈**：`--font-sans`（Inter + 系统日文回退）、`--font-mono`、**`--font-reading-jp`**（日文阅读正文：Noto Serif JP → 游明朝/Yu Mincho → Hiragino Mincho → MS Mincho → serif）。用 `font-reading-jp` utility 挂到阅读正文。已核对编译进产物 CSS。
- **shadcn 组件**（new-york 风，`components/ui/`）：`button`(6 变体×4 尺寸)、`dialog`、`tabs`、`switch`、`slider`。手写落地（shadcn CLI 对 Tailwind v4 CSS-first 不稳），已按 v4 focus-ring/data-state 规范。
- **自测页**（`modules/ui-kit/Showcase.tsx`）：把 5 组件 + 日文字体样本铺一屏，右上角开关实时切暗色。`App.tsx` 已挂 Showcase，`npm run dev` 直接可见、可验主题。

**装了哪些依赖**（`--save-exact`）：`@radix-ui/react-{dialog,tabs,switch,slider,slot}`、`tw-animate-css`（替代脚手架移除的 tailwindcss-animate，`@import 'tw-animate-css'` 供 dialog 动画）。

**契约变动**：无。契约仍 v1。

**留下的坑 / 下游须知**：
- **下游怎么用主题**：语义色走 Tailwind class（`bg-background`/`text-muted-foreground`/`border` 等），别写死颜色。日文阅读正文加 `className="font-reading-jp"`（reader-view 会话用）。暗色 = 在根节点挂 `.dark` class（Showcase 已示范）。
- **默认全站是亮色**（无 `.dark`）。全局暗色切换的持久化归 settings/library 会话，本模块只提供 `.dark` 变体。
- **需要更多组件时**：照现有文件风格手写进 `components/ui/`，或 `shadcn add` 后按 v4 手工核对（CLI 可能生成 v3 语法）。当前只装地基必用 5 个（YAGNI）。
- renderer 主 chunk 777KB（+Radix，仍 SSR 单 chunk 警告）；分包留待 reader-view 引 virtuoso 后统一处理，本模块不动。

### 会话 1 — 项目脚手架初始化

**做完**：按总纲第 2 节技术栈搭好可启动空壳 + 三层目录骨架 + 装好依赖。
- 三入口（总纲第 4 节）：`electron-vite` 串 main/preload/renderer。空窗可弹（`npm run dev` 验证过，5 个 electron 进程 + dev server 5173）。
- worker 层定为 **renderer 侧 Web Worker**（非 Node worker_threads）：`src/worker/tokenizer.worker.ts` 只做 echo stub，`src/renderer/src/lib/worker-smoke.ts` 发一条 req 验证通道；契约 2 类型抽到 `src/worker/contract.ts` 作跨层共享真值。
- Tailwind v4（`@tailwindcss/vite`，CSS-first，无 tailwind.config.js）+ shadcn/ui（`components.json` + `cn()` + 主题 token）。**未装任何业务组件**。
- 模块占位目录（总纲第 6 节）：main 侧 storage/epub-import；renderer 侧 ui-kit/reader-view/interaction/library/ai-analysis/ai-translation；各带 README 标明归属会话。
- 自测（铁律 4）：`npm run smoke` 加载真实 worker stub、断言 echo 契约（seq 保留、tokens=[]）。另 `npm run build` + `npm run typecheck` 作烟测，全绿。

**装了哪些依赖**：
- 运行时：`electron`(33)、`react`/`react-dom`(19)、`better-sqlite3`(11)、`electron-store`(10)。
- 构建：`electron-vite`(3)、`vite`(6)、`@vitejs/plugin-react`、`typescript`(5)、`@electron/rebuild`、`@types/*`。
- 样式：`tailwindcss`(4)、`@tailwindcss/vite`、`class-variance-authority`、`clsx`、`tailwind-merge`、`lucide-react`。
- 移除：`tailwindcss-animate`（v3 JS 插件，Tailwind v4 无法 `@import`；无组件用它，YAGNI。ui-kit 会话需要动画时装 `tw-animate-css`）。

**怎么启动**：`npm install --ignore-scripts` → `npm run setup` → `npm run dev`。详见 README「首次安装」。

**契约变动**：无。契约仍 v1。（`src/worker/contract.ts` 是契约 2 的原样落地，未改字段。）

**留下的坑 / 下游须知**：
- **better-sqlite3 装机两步走**：直接 `npm install` 会失败——Node 24 头文件带 `clang:1`，编 Node ABI 要 ClangCL 工具链（本机未装 ClangCL，但有 VS2022 BuildTools + Python）。方案：`npm install --ignore-scripts` 跳过 Node 侧编译，再 `npm run setup` 只编到 Electron ABI（已验证成功，`better_sqlite3.node` 就位）。换 Electron 版本后须重跑 `npm run rebuild`。storage 会话首次拉代码照此装机。
- `postinstall` 自动 rebuild **已移除**（会在 electron 二进制就位前触发 Node 侧编译而失败），改为手动 `npm run setup`。
- preload 只留空 `contextBridge` 桥，契约 4 的 IPC 未实现——storage/epub-import/library 会话在此挂。
- renderer 主 chunk 556KB（含 React），暂不管;真正变大在 reader-view 引入 virtuoso 后再看分包。
- `npm audit` 报 6 个 high（多来自 electron-rebuild 依赖链的旧 glob/tar），不影响构建，留待后续统一处理。

### [待填] 会话 0 — 项目初始化 / 总纲建立
- 做完：`V3_MASTER_PLAN.md`、`CONTEXT.md` 对齐、本台账建立。
- 契约变动：建立 v1。
- 留下的坑：脚手架尚未初始化；各模块规格待各自会话细化（总纲第 8 节）。
- 下游须知：从「建议开工顺序」第 1 批开始领模块。

---

## 契约变更请求（未批准的挂这里）

> 子会话若需改契约，在此追加一条，**不要动总纲第 4 节**，等总纲层批准后统一更新。

### CR-1（会话 8 library 提）— 契约 4 扩展：书架查询 + 删书 + 文件选择器

**背景**：契约 4 现只有按 bookId 取段（`getSegments`），无「列出所有书」——书架无法渲染。删书要清三处（db 两库 + electron-store 进度 + 图片目录，会话 2/4 下游须知），也无 API。导入要文件选择器（`dialog.showOpenDialog` 在主进程）。均为契约 4 的**新增**（不改既有签名/字段），向后兼容。

**请求新增（契约 4 IPC）**：
```ts
// 书架查询（storage）
listBooks(): Promise<BookMeta[]>            // BookMeta = { id, title, kind, created_at }
// 删书（storage db 两库 + 进度 + 图片目录一并清，main 编排）
deleteBook(bookId: number): Promise<void>
// 文件选择器（main，dialog.showOpenDialog 选 epub，取消返 null）
pickEpubFile(): Promise<string | null>
```
`BookMeta` 是 `books` 表行（已存在字段，非契约 1 Segment 扩展）。`listBooks`/`deleteBook` 落在 storage `db.ts`；删书的图片目录 `<userData>/books/<bookId>/`（会话 4 规则）由 main 编排删除；进度清除加 `progress.deleteProgress(bookId)`。`pickEpubFile` 落在 `main/index.ts`（composition root，不侵入 epub-import 模块）。

**状态**：✅ **已批准并归档**（总纲层）。三个 IPC 已注入总纲第 4 节契约 4，契约版本推进至 **v2**。集成验证：`typecheck`+`build`+ library 三自测 + 前批六自测**全绿无回归**。**契约 1/2/3 未动**。

### CR-2（会话 9 reader-view 重构 提，总纲层预批准）— 契约 4 扩展：列章节（含起始 seq）

**背景**：按章加载 + 左侧目录跳转，需要每章的起始 seq。现 `chapters` 表存了 `{id, seq(章序), title}` 但无「该章首段的全局 seq」。reader-view 无法按章取段、目录无法跳章。契约 4 **新增**一个只读查询，向后兼容，不改既有。

**请求新增（契约 4 IPC）**：
```ts
// 列出一本书的章节（含每章起止段 seq，供目录跳转 + 按章加载）
listChapters(bookId: number): Promise<ChapterMeta[]>
// ChapterMeta = { id, ordinal, title, startSeq, endSeq }
//   ordinal  = 章在书内的顺序（chapters.seq）
//   startSeq = 该章首段的全局 seq（MIN(segments.seq) WHERE chapter_id）
//   endSeq   = 该章末段的全局 seq（MAX）
//   title    = 空标题章由渲染层显示占位（决策：全列 29 章，空标题显示"插图/第N节"）
```
落在 storage `db.ts`（一句 GROUP BY 聚合 segments 求每章 min/max seq），preload 挂 `listChapters` invoke。**契约 1/2/3 未动**。

**状态**：✅ **已批准并归档**（总纲层）。`listChapters` 已落地（`db.ts` GROUP BY 聚合 + preload invoke），`ChapterMeta{id,ordinal,title,startSeq,endSeq}` 原样落地，已注入总纲第 4 节，契约推进至 **v3**。实测：book5 返回 28 章、startSeq 0→3250 单调递增。**契约 1/2/3 未动**。

### CR-3（会话 10 ai-analysis 提，总纲层预批准）— 契约 4 扩展：AI 档案 + 对话存档持久化

**背景**：ai-analysis 的流式请求由 **renderer 直连 DeepSeek**（OpenAI 兼容 SSE），**不经 IPC**。但 CONTEXT.md 定的 **AI 档案**（baseURL/apiKey/model/systemPrompt…）与 **对话存档**（`chatArchive`，按逻辑日）须存 electron-store（主进程），故 renderer 需跨进程读写。契约 4 **新增**只读/写通道，向后兼容，不改既有签名/字段。**契约 1/2/3 不动。**

**请求新增（契约 4 IPC）**：
```ts
// AI 档案（含 apiKey，明文存 electron-store，决策已定）
getAiProfiles(): Promise<AiProfilesState>            // { profiles: AiProfile[], activeId: string }
saveAiProfiles(state: AiProfilesState): Promise<void> // 整体覆盖写（档案增删改切都走这条）
// 对话存档（按逻辑日 03:00 分界，同日追加合并；MVP 只需 append + list）
appendChatArchive(round: ChatRound): Promise<void>   // 每轮 done 时追加，主进程按逻辑日合并
listChatArchive(): Promise<ChatArchiveDay[]>         // 翻阅用（MVP 可先只挂、UI 第二批）
```
类型（ai-analysis 会话定，随 CR-3 落地）：
```ts
type AiProfile = { id, name, baseURL, apiKey, model, systemPrompt, temperature? }
type AiProfilesState = { profiles: AiProfile[], activeId: string }
type ChatRound = { userText: string, assistantText: string, ts: number }  // ts=该轮 done 的时间戳
type ChatArchiveDay = { day: string /*YYYY-MM-DD 逻辑日*/, rounds: ChatRound[] }
```
落地：新建 `src/main/modules/ai-store`（仿 storage/progress.ts 的 `open(cwd?)` 可注入模式，两个 electron-store：`ai-profiles`、`chat-archive`）+ `logical-day.ts`（纯逻辑，`时间戳-3h` 取本地日期）。preload 挂 4 个 invoke，main 在 whenReady 注册。**存档写入不回灌实时框（CONTEXT 铁律：开机实时框永远为空）。**

**状态**：✅ **已批准并归档**（总纲层）。4 个 IPC + 类型原样落地（`ai-store/index.ts` + preload），已注入总纲第 4 节，契约推进至 **v4**。**实测（真实 electron-store 往返，非只看绿灯）**：档案含 apiKey 明文落 `ai-profiles.json`；存档 3 轮同逻辑日合并成 1 天；凌晨 01:00 时间戳归前一逻辑日（03:00 分界生效）；两个 store 文件真实落盘。`test:ai` + 前批九自测 + typecheck + build 全绿无回归。**契约 1/2/3 未动**。

### CR-4（会话 12 settings 提，总纲层预批准）— 契约 4 扩展：自定义字体导入/落盘

**背景**：settings 模块让用户"怎么自由怎么来"，含**导入自己的字体文件**（.ttf/.otf/.woff2）复用。日文字体常 5–15MB，localStorage 装不下（~5MB 上限），必须落磁盘走主进程。契约 4 **新增**字体管理三通道，向后兼容，不改既有签名/字段。**契约 1/2/3 不动。** 视觉旋钮 + 字号/颜色/间距/字重/系统字体名 全走 localStorage（渲染层，不入契约）；**只有"导入文件落盘"这件事需要 IPC。**

**请求新增（契约 4 IPC）**：
```ts
// 选文件 + 拷贝到 <userData>/fonts/，返回落盘后的字体元数据（取消返 null）
importFont(): Promise<FontMeta | null>
// 列出已导入字体（settings 字体族下拉用）
listFonts(): Promise<FontMeta[]>
// 删除已导入字体（清 <userData>/fonts/<file>）
deleteFont(id: string): Promise<void>
// FontMeta = { id, family, fileName, path }
//   id       = 稳定唯一标识（如落盘文件名去扩展）
//   family   = 注册给 CSS @font-face 的字体族名（默认取文件名，可与 id 同源）
//   fileName = 原始文件名（展示用）
//   path     = 落盘绝对路径（渲染层 @font-face src 用 file:// 前缀）
```
落地：新建 `src/main/modules/font-store`（`dialog.showOpenDialog` 选字体文件 + 拷到 `<userData>/fonts/`，仿 epub-import 图片落盘规则 + storage 可注入 cwd 模式）。preload 挂 3 个 invoke。渲染层 settings 用 `FontFace`/`@font-face { src: url('file://<path>') }` 注册后，日文正文/中文译文字体槽下拉即可选。**打包后 file:// 字体路径**同 Sudachi 词典债，dev 先验通。

**状态**：✅ **已批准并归档**（总纲层）。3 个 IPC + `FontMeta` 原样落地（`font-store/index.ts` + preload），已注入总纲第 4 节，契约推进至 **v5**。**实测（真实文件落盘，非只看绿灯）**：真实 7640 字节 TTF 经 `addFontFile` 拷到 `<userData>/fonts/`（`existsSync`+`statSync` 校验字节数）→ `listFonts` 返 1 条 family 正确 → `deleteFont` 清盘 `existsSync=false`。`fonts.ts` 的 `@font-face` 注入对 family/path 剔 `" ' \` 防 CSS 注入。`test:settings`+typecheck+build 在真实模块上绿，前批十自测无回归。**GUI 未验部分**（同"总纲层跑不了 GUI"限制）：dialog 选择器、`@font-face` 活体渲染、设置 Dialog 视觉、CSS 变量实时重排阅读界面——子会话称 dev 手验，总纲层记为 GUI-未验。**契约 1/2/3 未动**。

### CR-6（会话 22 settings/integration 提，总纲层批准）— 契约 4 扩展：查词软件联动

**背景**：剪贴板查词仍需用户手动启动外部软件。设置页需要持久化一个软件路径，并由主进程安全选择、验证和打开；渲染层不能直接访问文件系统或执行程序。契约 4 只新增受控 IPC，不改变既有接口。

**请求与落地（契约 4 IPC）**：
```ts
type IntegrationSettings = {
  autoLaunchDictionaryApp: boolean
  dictionaryAppPath: string
}
getIntegrationSettings(): Promise<IntegrationSettings>
saveIntegrationSettings(settings: IntegrationSettings): Promise<void>
pickDictionaryApp(): Promise<string | null>
launchDictionaryApp(path: string): Promise<string>
getDictionaryLaunchError(): Promise<string>
```

主进程只接受存在的 `.exe/.lnk` 绝对文件路径，并将原路径交给 `shell.openPath`；不解析命令字符串。每次应用启动只尝试一次，失败不会阻止主窗口创建，最近错误持久化供设置页提示。`IntegrationSettings` 存 `integration-settings.json`，默认关闭且路径为空。

**状态**：✅ **已批准并归档**（总纲层）。已注入总纲第 4 节，契约推进至 **v7**；契约 1/2/3 未动。`test:integration` 覆盖默认、路径校验、安全 opener、设置与错误的 electron-store 往返。
