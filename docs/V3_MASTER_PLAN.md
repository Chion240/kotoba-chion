# Chion RUAD V3 — 总纲（Master Plan）

> 本文是 V3 开发的**绝对基准**。所有会话以此为准；与 `CONTEXT.md` 冲突时，
> 冲突处已按本文修正。`HANDOFF_V3.md` 是历史教训参考，凡与本文不符以本文为准。
>
> **角色分工**：本文统领全局，定义模块边界与契约。每个后续会话只负责**一个模块**，
> 只需读「本文 + 自己模块节 + 依赖的契约」，不必读其他模块实现——这是省 token 的关键。
>
> **交接台账**：跨会话状态记在 `SESSION_LOG.md`。本文是不变的宪法，台账是流动的状态。

---

## 0. 会话铁律（强制流程，人人照做）

1. **开工第一件事**：读本文（`V3_MASTER_PLAN.md`）+ `SESSION_LOG.md`。确认自己负责哪个模块、依赖哪些契约、上游做到哪了。
2. **只碰自己的模块**：看到别的模块有问题，写进台账报告，**不要动手**改隔壁——防合并冲突与上下文丢失。
3. **契约冻结**：想改第 4 节的任何契约（加字段/改类型），**禁止自行修改**。到 `SESSION_LOG.md` 的「契约变更请求」区提出，等总纲层批准后统一更新，再通知受影响模块。
4. **交付必带自测**：每个模块交付一个**不依赖其他模块**的最小自测（能独立跑、断言核心逻辑）。
5. **收工最后一件事**：在 `SESSION_LOG.md` 追加一条会话记录（做完什么/契约有无变动/留下的坑/下游须知），并更新「模块集成状态」表。

---

## 1. 这个应用是什么

日中双语 / 纯日语 **EPUB 阅读器**，面向"边读边学"。现代化 UI，阅读流畅是第一要务。

三条核心动作：
1. **点词 → 写剪贴板**（原形），联动外部 GoldenDict。
2. **选中文本 → 暂存到 AI 输入**，手动发送才进流式 AI 分析。
3. **朗读**（TTS，后续阶段）。

双语书：一段日文一段中文，导入时就配对入库；按 `t` 显示内置译文。
纯日语书：按 `t` 走 **AI 译文**（临时翻译并落库）。

---

## 2. 已锁定的技术决策（不可擅动）

| # | 决策 | 选择 |
|---|------|------|
| 1 | 技术栈 | Electron + React + TypeScript + Vite |
| 2 | 分词引擎 | Sudachi(WASM)，A/B/C 三模式**用户自由切换**，切换即时重算视口 |
| 3 | 书内容持久化 | SQLite（better-sqlite3，主进程）；应用状态用 electron-store |
| 4 | 分词时机 | **视口即时分词**（Worker），token 不入库；后台预取下一屏/下一章 |
| 5 | 长列表渲染 | react-virtuoso（不定高虚拟化） |
| 6 | 导入类型判定 | **完全手动**：导入时用户选「双语 / 纯日语」，两条独立解析路径 |
| 7 | 存储原子单元 | 统一 `segments` 表 + `type` 字段（pair/heading/image） |
| 8 | 显示方向 | 横排（竖排留作后续"阅读模式") |
| 9 | 双语呈现 | 中文**行内正下方**淡入展开 |
| 10 | UI 栈 | Tailwind CSS + shadcn/ui（组件入仓）+ 日文阅读字体栈 |
| 11 | 模块切分 | 按功能纵切 + 契约先行 |

---

## 3. 双语配对安全（照抄 HANDOFF_V3.md 第 2 节，最高优先级）

- 日文原文段带 `style="opacity:0.4;"`，常含 `<ruby>`；中文译文是裸 `<p>`；1:1 交替，中间夹 `<p><br></p>` 空段。
- **判断规则**：① 优先用 `opacity < 1` 认定日文原文；② 无 opacity 标记时，**含假名即判日文**，纯汉字无假名才判中文；③ 配对 = 一个日文段 + 其后第一个非空段；④ 空段丢弃（用 CSS margin 造间距，不存无意义行）。
- **绝不用"假名比例"猜语言**。安全方向永远是**宁可多显示中文，绝不隐藏日文**。
- parser 遇到无法识别的标记 → **降级为日文正文段显示**，绝不隐藏。
- 用户已保证：日中书一定是「一段日文一段中文」，双语 parser 据此窄而稳。

---

## 4. 架构：三层 + 契约

- **主进程 (Node)**：SQLite 读写、EPUB 解压/解析/配对入库、文件系统（图片落盘、书库目录）、electron-store（应用状态）。
- **Worker（后台线程）**：Sudachi 分词(A/B/C)、视口分词、预取。**绝不放主/渲染线程**。
- **渲染进程 (React)**：react-virtuoso 阅读器、点词/选择交互、ruby、中文展开、书架、设置。

层间只通过下列**四条契约**对话（后续会话只需知道自己层 + 用到的契约）：

```ts
// 契约 1：Segment（storage ↔ reader-view）
type Segment = {
  id: number; book_id: number; chapter_id: number; seq: number;
  type: 'pair' | 'heading' | 'image';
  jp_text: string;           // 日文正文/标题；image 为空
  zh_text: string;           // 译文；纯日语初始为空
  zh_source: 'builtin' | 'ai' | null;  // 译文来源标记
  ruby: Array<{ base: string; rt: string }>;  // 结构化注音
  image_ref: string | null;  // 图片相对路径
};

// 契约 2：分词（reader-view ↔ tokenizer Worker）
type TokenizeReq = { seq: number; text: string; mode: 'A' | 'B' | 'C' };
type Token = { surface: string; dictionaryForm: string; reading: string; pos: string };

// 契约 3：选择事件（interaction → 剪贴板 + AI 输入暂存）
type Selection = {
  kind: 'word' | 'segment';
  surface: string;              // shift 多选词用表层形
  dictionaryForm?: string;      // 仅"单击点词"用原形
  seqs: number[];
};

// 契约 4：IPC（renderer ↔ main）—— v7
// importBook(path, mode) / getSegments(book_id, seqFrom, seqTo)
// saveProgress / getProgress / getImagePath / saveAiTranslation(segId, zh)
// listBooks(): BookMeta[]  —— BookMeta = { id, title, kind, created_at }  [v2, CR-1]
// deleteBook(bookId)       —— 清 db 两库 + 进度 + 图片目录，main 编排      [v2, CR-1]
// pickEpubFile(): string|null —— dialog.showOpenDialog 选 epub，取消返 null [v2, CR-1]
// listChapters(bookId): ChapterMeta[]  —— 列章节含起止段 seq（目录跳转/按章加载） [v3, CR-2]
//   ChapterMeta = { id, ordinal, title, startSeq, endSeq }
//   ordinal=章序(chapters.seq)  startSeq/endSeq=该章首/末段全局 seq  title 空由渲染层占位
// getAiProfiles(): AiProfilesState / saveAiProfiles(state)  —— AI 档案持久化（含 apiKey 明文）[v4, CR-3]
// appendChatArchive(round) / listChatArchive(): ChatArchiveDay[]  —— 对话存档，按逻辑日合并 [v4, CR-3]
//   AiProfile={id,name,baseURL,apiKey,model,systemPrompt,temperature?}  AiProfilesState={profiles[],activeId}
//   ChatRound={userText,assistantText,ts}  ChatArchiveDay={day:YYYY-MM-DD 逻辑日, rounds[]}
//   注：流式请求 renderer 直连 OpenAI 兼容接口(SSE)，不经 IPC；此 4 通道只持久化档案+存档
// importFont(): FontMeta|null / listFonts(): FontMeta[] / deleteFont(id)  —— 自定义字体导入落盘 [v5, CR-4]
//   FontMeta={id,family,fileName,path}  字体文件落 <userData>/fonts/，渲染层 @font-face src:file://<path> 注册
//   注：仅字体文件（大）落主进程磁盘；视觉旋钮/字号/颜色/字体族选择走 localStorage(渲染层)，不入契约
// getVoiceProfiles(): VoiceProfilesState / saveVoiceProfiles(state) / pickAudioFile(): string|null  —— 声音档案持久化 + 参考音频选择器 [v6, CR-5]
//   VoiceProfile={id,name,engine:'sovits'|'openai',baseURL, refAudioPath?,promptText?,promptLang?,textLang?,speedFactor?, apiKey?,model?,voice?}  VoiceProfilesState={profiles[],activeId}
//   注：合成不经 IPC（渲染层直连 localhost:9880 拿 wav，同 ai-client 直连 SSE）；参考音频对本地 SoVITS 是服务端可达路径字符串，只传字符串不上传文件；apiKey 明文存（同 AI）
// getIntegrationSettings() / saveIntegrationSettings(settings) / pickDictionaryApp() / launchDictionaryApp(path) / getDictionaryLaunchError() [v7, CR-6]
//   IntegrationSettings={autoLaunchDictionaryApp:boolean,dictionaryAppPath:string}
//   注：只接受 .exe/.lnk 绝对路径并交 Electron shell.openPath；不执行命令字符串。最近一次自动启动错误只用于设置页提示。
```

> **契约版本 v2**（CR-1，会话 8）：契约 4 新增 listBooks/deleteBook/pickEpubFile，仅新增、向后兼容；契约 1/2/3 未动。
> **契约版本 v3**（CR-2，会话 9）：契约 4 新增 listChapters(bookId)，仅新增、向后兼容；契约 1/2/3 未动。
> **契约版本 v4**（CR-3，会话 10）：契约 4 新增 getAiProfiles/saveAiProfiles/appendChatArchive/listChatArchive，仅新增、向后兼容；契约 1/2/3 未动。
> **契约版本 v5**（CR-4，会话 12）：契约 4 新增 importFont/listFonts/deleteFont，仅新增、向后兼容；契约 1/2/3 未动。
> **契约版本 v6**（CR-5，会话 17）：契约 4 新增 getVoiceProfiles/saveVoiceProfiles/pickAudioFile，仅新增、向后兼容；契约 1/2/3 未动。合成不经 IPC（渲染层直连 localhost:9880）。
> **契约版本 v7**（CR-6，会话 22）：契约 4 新增查词软件联动设置、文件选择、安全启动和最近启动错误读取，仅新增、向后兼容；契约 1/2/3 未动。

---

## 5. 交互模型（已锁定）

### 点词（左键单击）
- 写**原形**（`dictionaryForm`）进剪贴板喂 GoldenDict；同时暂存进 AI 输入框。
- 点击粒度 = **当前分词模式**的 token 粒度（跟随 A/B/C）。
- 原形为空/异常（符号、数字、未登录词）→ 兜底写**表层形**。

### 选择 → 暂存（核心：一切选择都是暂存，手动发送才进 AI）
- **左键单击词** → 原形；**右键单击段** → 整段原文。
- **shift+左键** = 多选词，用**表层形（选什么是什么）**，不转原形（防分词错误污染）。
- **shift+右键** = 多选段。
- 所有选择产物：写剪贴板 **且** 填入 AI 输入框（暂存态）。
- **覆盖语义**：新选择覆盖上一次暂存，绝不叠加；shift 累加只在同一次手势内。
- **草稿保护**：AI 输入框为空时才自动填；框里已有**用户手打内容**时，选择不覆盖。
- 只有按「发送」才成为 AI 分析会话的一轮。

### `t` 键（译文显示）
- 作用于**当前聚焦段**，中文在日文段正下方淡入。
- 可自定义快捷键。
- **双语书**：显示**内置译文**（原书 zh_text），**绝不走 AI**。
- **纯日语书**：把该段日文发 **AI 译文**（独立提示词，复用 AI 档案连接），结果落库 `zh_source='ai'`，下次直接读。
- 朗读选中的日文时按 `t` 同样出译文（后续阶段）。
- 另有全局开关"全书中文显示 开/关"。

---

## 6. 模块划分（每个 = 一个会话的领地）

**地基（第一阶段，必须先立起来）：**

| 模块 | 职责 | 依赖契约 |
|------|------|----------|
| `ui-kit` | shadcn 原语 + 设计 token（配色/圆角/间距/字体） | — |
| `storage` | SQLite schema + 段落查询 API + 进度 | 契约 1、4 |
| `epub-import` | 解压/解析/双语配对/图片落盘/入库 | 契约 1、4 |
| `tokenizer` | Worker + Sudachi A/B/C + 视口分词 + 预取 | 契约 2 |
| `reader-view` | react-virtuoso 渲染 + 段落/标题/图片组件 + ruby + 中文展开 | 契约 1、2 |
| `interaction` | 点词/选择/快捷键 → 剪贴板 + 暂存 | 契约 3 |
| `library` | 书架、打开书、阅读进度 UI | 契约 4 |

**后挂（各自独立会话，框架留缝，不动地基）：**

| 模块 | 职责 |
|------|------|
| `ai-analysis` | 选中→流式 AI 分析会话 + 对话存档（见 CONTEXT.md） |
| `ai-translation` | 纯日语按 `t` 的 AI 译文（独立提示词，复用档案连接） |
| `tts` | GPT-SoVITS 本地/在线朗读 + 情感分类选语气 |

---

## 7. 性能红线（v2 的坟墓，v3 不许重蹈）

- 绝不整章一次性分词；只分**视口内**段落，全程在 Worker。
- 绝不一次性渲染整章 DOM；react-virtuoso 只挂载视口内节点。
- 导入只做「解析+配对+落盘」，**不预分词**。
- 主线程/渲染线程永不跑 Sudachi。

---

## 8. 待各模块会话细化（本文不预定，避免过度设计）

- 书库目录结构与图片落盘的具体路径规则（`storage`/`epub-import` 会话定）。
- 日文阅读字体的具体字体族与 fallback（`ui-kit`/`reader-view` 会话定）。
- 预取窗口大小、分词结果是否需内存缓存（`tokenizer` 会话按实测定，默认先不缓存）。
