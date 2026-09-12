# TTS 语音朗读 + 字体 bug — 交接文档

> 写给下一个接手的会话。读完这份 + `V3_MASTER_PLAN.md` + `CONTEXT.md` + `SESSION_LOG.md` + `PROJECT_HANDOFF.md` 应能全盘接管。
> 含三件事：**① Phase 0 已完成（SoVITS API 起服务 + 启动 bat + curl 验证，已实测通过）**；**② TTS 模块 Phase 1-3 完整方案（未动 app 代码）**；**③ 未解决的字体字重 bug**。
> 生成于会话 17（build mode）。契约当前 **v5**。

---

## 一、用户需求（原话优先）

日语 EPUB 阅读器的语音朗读，原用 GPT-SoVITS。核心决策：

1. **放弃"逐句情感识别"**。用户原话：句子间连接加感情识别"非常奇怪"。根因是"逐句情感+逐句独立合成拼接"粒度错了，非参数问题。
2. **要更"拟人"**。
3. **声音档案像 AI 档案一样多档案可切换**（"像 AI 多档案"），模型和参考音频可选、可自定义。
4. **四级朗读粒度**：词/句/段/连续。原话"当我打开阅读模式，可以选择朗读全文和播放句子、单词"。
   - 词级：跟句/段**同一引擎**（用户选，推荐）。
   - 句级切分：**Sudachi 辅助切句**（用户选）。
5. **部署：本地打底 + 云端可选**（两套都要，用户切换）。
6. **先起 SoVITS API 服务 + 集成启动 bat + curl 验证** —— 已完成，见第二节。

---

## 二、Phase 0 已完成（已实测，下一个会话可直接信）

### 交付形态（会话 18 移植改造后）
- 语音服务不再靠 SoVITS 目录里单独的 bat；改由仓库根 `启动全部.bat` 顶部 `SOVITS_DIR` 变量配置，
  直接调 `<SOVITS_DIR>\runtime\python.exe api_v2.py -a 127.0.0.1 -p 9880`（实测无需改 PATH，DLL 从 runtime 目录加载）。
- 参考音频路径不写死在代码里（每机不同）：默认档案 `refAudioPath` 留空，用户在「设置→声音」自选。

### 实测结果（go/no-go：PASSED）
- `POST http://127.0.0.1:9880/tts` 返回**真实 148KB wav**（RIFF/WAVE，32kHz），耗时 **4.9s**（模型预热后）。
- 首次启动加载模型 ~60s；预热后端口 ~10s 起。
- 参考音频用 SoVITS 整合包 `slicer_opt/` 里任一 wav（文件名=transcript，直接当 prompt_text）。
  路径按各自安装目录填，不再硬编码。

### 已验证的环境事实
- **GPU**：NVIDIA RTX 3070 Ti Laptop 8GB，CUDA 可用（`tts_infer.yaml` custom 块 `device:cuda, is_half:true`）。
- **`api_v2.py` HTTP 接口**：
  - `POST /tts` → 成功返回 wav 字节(200)；失败返回 json(400)。
  - `GET/POST /set_gpt_weights?weights_path=...` 切 GPT 模型。
  - `GET/POST /set_sovits_weights?weights_path=...` 切 SoVITS 模型。
  - `GET/POST /control?command=restart|exit`。
  - 参数：`-a` 地址(默认127.0.0.1)、`-p` 端口(默认9880)、`-c` 配置(默认 `GPT_SoVITS/configs/tts_infer.yaml`)。
- **`POST /tts` 请求体**（client 照此组装）：
  ```json
  {
    "text": "要合成文本",              // required
    "text_lang": "ja",              // required
    "ref_audio_path": "服务端可达的参考音频绝对路径", // required（SoVITS 自己读盘）
    "prompt_text": "参考音频对应文本",   // optional
    "prompt_lang": "ja",            // required
    "text_split_method": "cut5",
    "batch_size": 1, "speed_factor": 1.0,
    "streaming_mode": false, "media_type": "wav"
  }
  ```
- **内置 Python 运行时**：`GPT-SoVITS-v2pro-20250604\runtime\python.exe`（起 API 无需系统 Python）。
- **洛琪希模型**：`tts_infer.yaml` 的 `custom:` 块已指向洛琪希（v2ProPlus），`api_v2.py` 默认配置启动即自动加载，无需切权重。`t2s_weights_path`=`.../GPT_weights_v2ProPlus/洛琪希.ckpt`(✅存在)、`vits_weights_path`=`.../SoVITS_weights_v2ProPlus/洛琪希.pth`(✅存在)。
- **参考音频位置**：可用 wav 在 `RoxyPro（新版）\slicer_opt\`（约数百个，文件名即 transcript）。用户说的 `参考音频实例` 文件夹**是空的**——别用那个路径。
- **无害警告**：SoVITS 加载 VITS 权重时打印 `_IncompatibleKeys(missing_keys=['enc_q...'])` 是正常的——`enc_q` 是训练用的后验编码器，推理不需要。别当报错。

---

## 三、TTS 模块方案（Phase 1-3，未动 app 代码）

### 核心思路：拟人 = 放弃逐句情感 + 段级合成 + 无缝队列
1. 不再逐句情感 → 没有情感硬切。
2. 连续朗读**按「段」整段合成** → SoVITS 自己处理段内韵律，接缝减一个数量级。
3. **预取 + 无缝队列**：放当前段时后台已合成下一段，首尾相接 + 自然停顿。
4. **全程固定一个参考音频** → 音色不漂移。
> 真人有声书不逐句变情感，只有台词轻微起伏、旁白是稳定声线。逐句情感是错的粒度。

### 领域概念（要进 CONTEXT.md）
- **声音档案 (Voice Profile)**：一套 TTS 引擎配置，**对标 AI 档案**。本地 `{engine:'sovits', baseURL:'http://127.0.0.1:9880', refAudioPath, promptText, promptLang:'ja', textLang:'ja', speedFactor}`；云端 `{engine:'openai', baseURL, apiKey, model, voice}`。多档案 `{profiles[], activeId}`（用户明确要多档案）。
- **朗读单元 (Utterance)**：送合成的最小文本 = 词/句/段之一。
- **播放会话 (Playback Session)**：连续播放运行态（当前单元/队列/播放暂停/粒度）。**必须模块级 store 单一真值**（会话 13 教训：挂组件本地态会被条件渲染销毁）。

### 架构（照抄现有成熟模式）
- **主进程 `main/modules/voice-store/`**（照抄 `ai-store/index.ts`）：electron-store 持久化声音档案（可注入 cwd，仿 ai-store 便于自测）+ `pickAudioFile` 文件选择器。**合成不走 IPC**——渲染层直接 fetch localhost:9880 拿 wav（同 ai-client 直连 SSE）。参考音频对本地 SoVITS 是服务端路径字符串，只传字符串不上传文件。
- **渲染层 `renderer/src/modules/tts/`**：
  - `tts-client.ts`：`synthesize(profile, text)→Promise<ArrayBuffer>`。engine 分派：sovits POST `/tts`；openai POST `/audio/speech`。纯请求组装可自测。
  - `sentence-split.ts`：段内切句，复用 tokenizer worker 输出，按句末标点（。！？「」）切、不切断 token（Sudachi 辅助）。纯逻辑可自测。
  - `tts-text.ts`：**文本规整（TTS text normalization）纯函数 `normalizeForTts(text)`**。送合成前把朗读文本清成朗读友好的纯文本。**必须在 `tts-client.synthesize()` 入口第一行调用**——词/句/段/连续所有路径都经 synthesize，清理只写这一处，别在各调用方各清一遍（单点根治）。纯函数，`test:tts` 逐条断言脏文本→干净输出。**跟 ai-translation 的输出无关**：那是译文提示词层；这是"要朗读的日文原文"的规整层，目的是去掉 TTS 会读错的符号，不是翻译，别混。**已实现（会话 17）规则**：去括号符号保内容(『』「」（）()【】〔〕[]〈〉《》)、去 ruby 残留标签/URL/控制字符(含零宽)/emoji、全角英数→半角、压缩空白去首尾；**日文句末标点 。！？、保留**（SoVITS 断句韵律靠它）。
  - `useVoiceProfiles.ts`：照抄 `useAiProfiles.ts`（CRUD + 种一个洛琪希本地默认档案）。
  - `playback-store.ts`：模块级单一真值 + `useSyncExternalStore`。状态机(idle/playing/paused) + 预取队列 + 无缝衔接。
  - `PlaybackBar.tsx`：播/停/暂停/上一/下一 + 粒度选择器（词/句/段/连续）。
  - settings 加「声音」分区（声音档案 CRUD，照抄 `ProfileTab.tsx`）。

### 契约变更 CR-5（推 v6）
新增 3 通道（仅新增、向后兼容）：`getVoiceProfiles` / `saveVoiceProfiles` / `pickAudioFile`。合成不经 IPC。**走 SESSION_LOG 的 CR 流程。**

### 分阶段
- **Phase 1 ✅ 已完成（会话 17，契约推 v6/CR-5）**：声音档案（多档案）+ voice-store + CR-5 + settings「声音」分区 + tts-client + sentence-split + **tts-text 文本规整（normalizeForTts，synthesize 入口调用）** + **单单元点击即播（词/句/段，朗读模式 ON 时与原交互同时触发）**。纯逻辑闭环 typecheck/build/test:tts 全绿；**真实 SoVITS 出声靠 dev 手验**（见会话 17 下游须知）。
- **Phase 2 ✅ 已完成（会话 17）**：连续朗读全文（▶按钮从屏顶段起）+ 预取无缝衔接（播 N 段时后台合成 N+1）+ 自动翻章（章尾 goToChapter，新 segments 到达续读）+ 当前段高亮（.is-speaking 用 --accent）+ 自动滚屏居中（scrollToIndex align:center）+ t 键翻当前朗读段（一次性，无需悬停；双语内置/纯日语 AI 铁律不变）+ 连读中点击=跳到该段续读。预取窗口 PREFETCH_AHEAD=3（短句/分段细的书救场，SoVITS 串行排队）。**倍速**：会话 17 续3 **彻底删除**（先后试过播放级 `playbackRate`+`preservesPitch`（低速闷）和合成级 `speed_factor`（卡、体验差），均放弃）。变速只能改档案级 `VoiceProfile.speedFactor`（重合成，非实时）。**连读同步**（每到一段 `writeClipboard`+`stageAuto` 到剪贴板/AI框，新段覆盖旧段）。**自动滚屏跟随**（词典笔式，Reader `currentSeq` effect 驱动 `scrollToIndex` 居中平滑，不在 onSegStart 命令式滚）。**连读稳定性修复**（会话 17 续2）：世代令牌 epoch 作废陈旧并发循环、当前段先合成再预取（不再干等）、连读合成 AbortController 可中断。纯逻辑闭环 typecheck/build/test:tts 全绿；**真实连读体验靠 dev 手验**。跨章预取未做（翻章接受一次 loading 间隙，章内无缝）。
- **Phase 3**：云端引擎档案（`engine:'openai'` → POST `/audio/speech`），最大拟人时切。

### 自测（铁律 4）
sentence-split 纯逻辑、**tts-text `normalizeForTts` 逐条规则断言**、tts-client 请求组装（sovits vs openai body 形状）、playback-store reducer（队列前进/预取去重/暂停恢复/切粒度）、voice-store 往返（electron node，照抄 ai-store）。

### 可能遇到的坑
1. **词级合成很短**：SoVITS 对超短文本（单词）韵律可能怪。Phase 1 要实测；必要时词级退化为"读整句里的该词"或灰掉词级开关。
2. **CSP 打包债**：渲染层 fetch localhost:9880 + 云端 TTS 域名，打包后严格 CSP 会拦。归入打包会话（连同已有三处 file:// 债：生产词典 + 字体 @font-face + AI 域名）。
3. **参考音频路径特殊字符**：文件名带日文/【】括号，json/fetch 要正确 UTF-8。`ref_audio_path` 是**服务端可达绝对路径**。
4. **端口占用**：9880 被占则换端口，档案 baseURL 跟着改。
5. **apiKey 明文**：云端档案同 AI，明文存 electron-store（全局一致）。
6. **两进程生命周期**：关 app 不自动关 SoVITS（独立窗口）。当前设计：不杀，用户手动关（简单）。
7. **bat 编码铁律**：CRLF + UTF-8(BOM)，否则闪退。**注意 Write 工具写 bat 不加 BOM、用 LF**——必须用 PowerShell `[System.Text.UTF8Encoding]($true)` + `[char]13+[char]10` 写，本会话已踩过这个坑。

---

## 四、未解决 bug：译文字重「粗细不统一」/ 有些字体字重无效

**现象**：按 `t` 出的中文译文，调"译文字重"旋钮时有些字体没反应、粗细不统一。

**已做（会话 16 已落地）**：`.reader-zh` 支持 `--reader-zh-weight/-color/-opacity` 三 CSS 变量 + settings 三控件；透明度 bug 已修根因（淡入动画 both 填充压过 opacity，keyframe `to` 改引用变量）；字重加了 `font-synthesis: weight style` 缓解。

**为何字重没根治（诚实结论）**：用户导入多是**单字重 .ttf**，文件里只有一个粗细，浏览器无法造中间字重（500/600），只能合成假粗体（正常/加粗二元）。"不统一"是因缺字回退系统字体、两种字体合成力度不同。**故意没在 `@font-face` 声明字重范围**（一声明浏览器以为单文件覆盖全字重、反而停止合成）。

**可探索方向**（未验证）：① 可变字体/多字重字族（根治，但要换字体文件）；② 字体导入 UI 明示"单字重字体不支持平滑字重"（**最省事，推荐先做**）。相关文件：`reader-view/reader.css`（`.reader-zh`）、`settings/settings-logic.ts`（`zhWeight`）、`settings/fonts.ts`（`@font-face` 生成）。**结论：这是字体文件物理天花板，非软件 bug。**

---

## 五、给下一个会话的第一步
1. 读 `V3_MASTER_PLAN.md` + `CONTEXT.md` + `SESSION_LOG.md` + `PROJECT_HANDOFF.md` + 本文。
2. Phase 0 已完成——用户双击 `启动全部.bat` 即可起语音服务 + app。可先让用户确认听到洛琪希声音。
3. 进 **Phase 1**：voice-store + CR-5（走 CR 流程）+ settings「声音」分区 + 单单元点击即播。
4. TTS 是"后挂"模块，独立会话，不动地基核心。
5. 字体字重 bug 可作独立小任务，建议先做"UI 明示限制"。
