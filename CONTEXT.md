# Chion RUAD — 领域上下文

> 词汇表。实现决策见 `docs/V3_MASTER_PLAN.md`（总纲，绝对基准）。

日中双语 / 纯日语 EPUB 阅读器 + 语言学习桌面应用。核心动作：点词写剪贴板联动 GoldenDict；选中文本暂存后交 AI 流式分析；按 `t` 看译文。

## 语言

### AI 分析

**AI 分析会话 (AI Analysis Session)**：
一次流式 AI 分析的完整生命周期与其可观察状态 `{ status, messages, error }` 加动作 `send/cancel/reset`。由 `useAISession` 拥有，单一真值。多轮累积——`messages` 是 `[user, assistant]…` 数组，流式内容写入最后一条 assistant；所有 AI 档案共用同一 `messages`（切档案只换下次发送的配置）。
_避免_：AI chat、stream state、streamContent（这些是实现碎片，不是概念）。

**AI 档案 (AI Profile)**：
一套 AI 服务配置（baseURL、apiKey、model、systemPrompt 等）。多档案以标签切换，`activeProfile` 供给当前会话。
_避免_：AI config、AI tab、账号。

**对话存档 (Chat Archive)**：
按"逻辑日"（03:00 分界，凌晨归前一天）持久化到 electron-store (`chatArchive`) 的对话。一天一条，同日追加合并；每轮 AI 回答到达 done 时自动写入。可翻阅、搜索、按天删除，但**不回灌实时聊天框**——开机实时框永远为空。
_避免_：消息记录、conversation、按档案分片的备份。

**逻辑日 (Logical Day)**：
`时间戳 - 3 小时` 后取本地日期（YYYY-MM-DD）。晚 23:00–次日 02:59 都归到起始那天。见 `logical-day.ts`。

### 阅读

**段 (Segment)**：
存储与渲染的原子单元，按 `seq` 线性排列。有三型：`pair`（正文对）、`heading`（标题对）、`image`（插图）。日文段承载分词/注音/交互，中文作为附属译文。空段（`<br>` 间隔）不入库。
_避免_：段落、节点、行（这些混指 DOM 与数据）。

**译文 (Translation)**：
一段日文对应的中文，与 **AI 分析会话** 是**平行且独立**的概念——译文目的单一（就要一句中文），不进聊天框、不多轮。两个来源：**内置译文**（双语书自带，`zh_source='builtin'`）与 **AI 译文**（纯日语书临时翻译，`zh_source='ai'`，落库复用）。按 `t` 显示，日文段正下方淡入。
_铁律_：**双语书按 `t` 只用内置译文，绝不走 AI**；AI 译文设置项在双语书里不生效。
_避免_：把 AI 译文和 **AI 分析会话** 混为一谈。

**暂存输入 (Staged Input)**：
选择（点词/选段/shift 多选）的产物，填入 AI 输入框但**未发送**。新选择覆盖旧暂存（绝不叠加）；框里有用户手打内容时不覆盖（草稿保护）。只有按「发送」才成为 **AI 分析会话** 的一轮。同时写剪贴板。
_避免_：把"选中"等同于"已提交给 AI"。

**查词软件联动 (Dictionary App Integration)**：
可选的桌面集成设置。用户指定一个 `.exe` 或 `.lnk`；启用后，阅读器每次启动只通过 Electron `shell.openPath` 尝试打开一次，不解析命令参数、不枚举或结束外部进程。失败只留作设置页提示，不阻止阅读器启动。

### 朗读 (TTS)

**声音档案 (Voice Profile)**：
一套 TTS 引擎配置，**对标 AI 档案**。本地 `{engine:'sovits', baseURL:'http://127.0.0.1:9880', refAudioPath, promptText, promptLang:'ja', textLang:'ja', speedFactor}`；云端 `{engine:'openai', baseURL, apiKey, model, voice}`（Phase 3）。多档案 `{profiles[], activeId}`，标签切换，`activeProfile` 供给当前播放。首次种一个洛琪希本地默认档案。
_避免_：TTS config、语音设置、音色。

**朗读单元 (Utterance)**：
送合成的最小文本 = 词/句/段之一。词=点的 token 表层；句=点的词所在句（Sudachi token 定位 offset + 切句）；段=整段原文。送合成前必过 `normalizeForTts` 规整。
_避免_：TTS 文本、朗读片段。

**播放会话 (Playback Session)**：
连续播放运行态 `{ enabled, status, reading, currentSeq, rate }`。**必须模块级 store 单一真值**（会话 13 教训：挂组件本地态会被条件渲染销毁）。`enabled`=朗读模式开关（ON 时点词/点段与原交互**同时**触发朗读，用户明确要「同时触发」；左键读词、右键读段，与复制范围一致）；`status`=idle/loading/playing/error；`reading`=连读运行中；`currentSeq`=当前朗读段（驱动高亮/自动滚屏居中）；单单元点击即播抢占语义（新播放停旧的）。连续朗读按 `。！？!?` 和换行切成**句子朗读单元**，保留句末标点，逗号和英文句点不切；按句推进并预取后面 3 句，章尾自动翻章，用 **epoch** 作废旧循环。一个段内只有第一句更新 `currentSeq`、高亮、滚屏、剪贴板和 AI 暂存，后续句子只连续播放，避免重复跳动。声音档案由模块级共享 store 提供，参考音频、提示文本、语速、地址或活动档案变化会立即清掉旧预取，下一句使用新配置；已经播放的当前句自然结束。播放倍速功能已删除（会话 17 续3，体验差）；变速只能改档案级 `VoiceProfile.speedFactor`。
_避免_：播放器状态、audio state。

**文本规整 (TTS Text Normalization)**：
纯函数 `normalizeForTts(text)`，送合成前把朗读文本清成朗读友好的纯文本（去括号符号保内容、全角→半角、去 emoji、去 ruby 残留/URL/控制字符、压缩空白）。**在 `tts-client.synthesize()` 入口第一行调用**——词/句/段所有路径都经 synthesize，清理只写这一处（单点根治）。**跟译文提示词无关**：这是「要朗读的日文原文」的规整层，不是翻译。
_避免_：在各调用方各清一遍。

## 关系

- **AI 分析会话** 由一个 **AI 档案** 供给配置；切换 **AI 档案** 换会话上下文。
- **AI 分析会话** 到达终态（done）时写一条 **对话存档**（按逻辑日追加）。
- **选择** → **暂存输入** → 手动发送 → **AI 分析会话** 一轮。
- **AI 译文** 复用 **AI 档案** 的连接配置，但用独立的翻译提示词。
- 一个日文 **段** 关联 0..1 条 **译文**（内置或 AI）。

## 示例对话

> **开发者：** "面板收起再展开，会话内容还在吗？"
> **领域专家：** "在——**AI 分析会话** 挂在 App 层，面板只是它的视图；收起不销毁会话。"

## 已标记的歧义

- 旧代码把会话状态镜像成 `streamContent/streamStatus/streamError`（AIPanel）+ 500ms 节流上抛（AIStreamContainer）——已解决：**AI 分析会话** 是唯一真值，视图直接读它，无镜像。
- **译文** vs **AI 分析会话**：曾易混。已解决——译文是独立概念（单句、不进聊天框），双语书永不走 AI，纯日语书才用 AI 译文。
