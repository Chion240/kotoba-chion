# 任务卡 · 快捷键自定义 + 修复图片显示（交给独立会话）

> 零上下文可接手。先读 `V3_MASTER_PLAN.md`（宪法）+ `CONTEXT.md`（领域语言）+ `SESSION_LOG.md`（状态/CR 流程）。
> 两个独立任务，可一个会话一起做。**契约无变更**（仍 v6）。均不动地基核心，只碰下列约定文件。
> 生成于会话 18（plan 阶段已完成全部诊断 + 用户决策，直接照做即可）。

---

## 任务 A：修复图片显示（data URL 方案，用户已定）

### 诊断（已实测确认，可直接信）
- 图片**已正确落盘**：`<userData>/books/<bookId>/images/00001.jpeg`（参考书 `jp-zh.Yg.楽園ノイズ.epub` 导入后 18 张全在 `chion-ruad\books\5\images\`）。解析 + 落盘链路**无 bug**。
- epub 内图片是 `<p class="calibre"><img src="../images/00002.jpeg"/></p>`，`parse.ts extractBlocks` 能抓到（img 在 `<p>` 内）。
- **bug 纯在显示层** `src/renderer/src/modules/reader-view/SegmentView.tsx`（约 102-114 行 `ImageSegment`）：
  ```ts
  window.chion.getImagePath(imageRef).then((abs) => {
    if (alive) setSrc(abs.startsWith('file://') ? abs : `file://${abs}`)
  })
  ```
  `getImagePath` 返回 Windows 绝对路径 `C:\Users\...\00001.jpeg`，拼成 `file://C:\Users\...`。**两个错**：① Windows 需 `file:///C:/...`（三斜杠+正斜杠），`file://C:\` 把 `C:` 当主机名 → 失败；② dev 渲染层是 `http://localhost` 源，Chromium 默认 `webSecurity` **禁止 http 源加载 `file://`**——就算修好格式 dev 也加载不出。这是看不到图的真因。

### 改法（data URL，~6 行，2 文件）
1. **`src/main/modules/epub-import/index.ts`** —— `epub:getImagePath` handler 现在返绝对路径（`join(booksRoot, imageRef)`）。改成**读文件转 data URL**：
   - `readFileSync(join(booksRoot, imageRef))` → 按扩展名定 MIME（`.jpeg/.jpg`→`image/jpeg`、`.png`→`image/png`、`.gif`→`image/gif`、`.webp`→`image/webp`，兜底 `image/jpeg`）→ 返 `` `data:${mime};base64,${buf.toString('base64')}` ``。
   - 读盘失败（文件缺失）返 `''`，渲染层据空串保持 placeholder。
   - 需要 `import { readFileSync } from 'node:fs'` + `join`（已有）。
2. **`src/renderer/src/modules/reader-view/SegmentView.tsx`** —— `ImageSegment` 删掉 `file://` 拼接逻辑，直接 `setSrc(dataUrl)`（空串则不 set，保持 placeholder）。注释同步更新（原注释说"加 file:// 前缀"已过时）。

### 顺带
消掉打包会话「图片 file:// 债」一项（data URL 生产环境同样通）。在 SESSION_LOG 下游须知记一笔：打包 file:// 三债变两债（词典 + 字体，图片已解决）。

### 自测
`getImagePath` 走真实 electron（IPC）不易纯 Node 测；**靠 dev 手验**：`启动全部.bat` 或 `npm run dev` → 打开 book5（楽園ノイズ）→ 翻到有插图的章 → 图片正常显示。若已有 `test:epub` 覆盖解析/落盘，不动它（本改动只碰返回值格式，不碰解析）。

---

## 任务 B：快捷键自定义（3 个：切译文 / 上一章 / 下一章）

### 现状
`interaction/keybindings.ts` 是**死代码**——定义了 `Action`/`matchAction`/`defaultKeybindings`/`eventCombo` 但没接到任何地方。当前实际快捷键全硬编码：
- `t`（切译文）：`Reader.tsx` 约 218-234 行 window keydown，硬编码 `e.key !== 't'`。
- 上/下章：**只有工具栏按钮 ‹ ›，无键盘快捷键**。
- AI 发送：`StagedInputBox.tsx` 约 25-30 行硬编码 `Enter + ctrl/meta`——**本任务不碰**（用户没选，保持硬编码，避免 UI 出现改了不生效的项）。

### 用户决策
- 可自定义的仅 **3 个**：`toggleTranslation`（默认 `t`）、`prevChapter`（默认 `arrowleft`）、`nextChapter`（默认 `arrowright`）。
- 翻章默认用左右箭头（左右箭头不滚动竖向列表，相对安全）。

### 改法
1. **`src/renderer/src/modules/interaction/keybindings.ts`**：
   - `Action` 改为 `'toggleTranslation' | 'prevChapter' | 'nextChapter'`（**去掉** `sendStaged`/`clearStaged`——没接线，不放进 UI 免得误导）。
   - `defaultKeybindings = { toggleTranslation:'t', prevChapter:'arrowleft', nextChapter:'arrowright' }`。
   - `eventCombo`/`matchAction` 已有，保留；**导出 `eventCombo`**（录制 UI 要用）。注意箭头键 `e.key` 是 `'ArrowLeft'`/`'ArrowRight'`，`eventCombo` 已 `.toLowerCase()` → `'arrowleft'`，默认值对齐小写。
2. **新建 `src/renderer/src/modules/interaction/keybindings-store.ts`**（仿 `staged-store.ts` 模块级 store）：
   - 模块级 `state: Keybindings` + `listeners` + `useSyncExternalStore`。
   - localStorage 单键 `chion-keybindings`（JSON）。
   - `coerceKeybindings(raw)`：脏 JSON/缺字段/非法组合 → 回落默认（逐 action 校验，缺则取默认）。
   - 导出 `getKeybindings` / `setKeybinding(action, combo)` / `useKeybindings()` / `resetKeybindings()` / `subscribe`。
   - `setKeybinding` 落库前可选做重复检测（撞键返 false 不写，UI 提示）——或把检测放 UI 层，二选一。
3. **新建 `src/renderer/src/modules/settings/KeybindingTab.tsx`**：SettingsDialog 第 9 个 Tab「快捷键」。
   - 三行，每行：action 名 + 当前绑定显示 + 「录制」按钮。
   - 点「录制」进入捕获态：下一个 keydown 用 `eventCombo` 归一化 → `setKeybinding` 写入 → 退出捕获态。捕获态时 `preventDefault`/`stopPropagation` 防触发别的。
   - 基础重复检测：新组合已被别的 action 占用 → 提示不写入（或交换，简单起见给提示不写）。
   - 「恢复默认」按钮 → `resetKeybindings()`。
   - 视图直读 `useKeybindings()`。
4. **接线 `src/renderer/src/modules/settings/SettingsDialog.tsx`**：+import `KeybindingTab`、+`<TabsTrigger value="keys">快捷键</TabsTrigger>`、+`<TabsContent value="keys"><KeybindingTab/></TabsContent>`。（settings 引 interaction 的 store，跨模块 import 类型/hook，OK。）
5. **接线 `src/renderer/src/modules/reader-view/Reader.tsx`**：
   - `t` handler（约 218-234）：把 `if (e.key !== 't' || e.metaKey...) return` 改为用 `matchAction(getKeybindings(), e) === 'toggleTranslation'` 判定（不命中就 return）。空 deps 挂一次，`getKeybindings()` 每次事件现读（store 是模块级，直读最新，无陈旧闭包问题）。
   - **新增** window keydown（可并进同一个 effect 或新加）：`matchAction` 命中 `prevChapter` → `changeChapter(chapterIndex-1)`（`hasPrev` 边界）；`nextChapter` → `changeChapter(chapterIndex+1)`（`hasNext` 边界）。注意 `changeChapter`/`chapterIndex` 用 ref 或放进 deps（现有 t handler 是空 deps + ref 模式，照抄：加 `chapterIndexRef`/`changeChapterRef`）。
   - **守卫（重要）**：事件 `e.target` 在 `<textarea>`/`<input>` 内时，翻章 + t **都跳过**（防在 AI 输入框打字时箭头键翻章/t 误触）。判定：`const el = e.target as HTMLElement; if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return`。

### 自测（铁律 4）
`test:interaction` 扩（纯逻辑无 DOM）：
- `coerceKeybindings`：空对象→全默认 / 缺某字段→补默认 / 脏 JSON 值→默认 / 保留合法传入值。
- `eventCombo`：各修饰键组合归一（ctrl/alt/shift/meta 拼接顺序）、箭头键→`arrowleft`/`arrowright`、大小写归一。
- `matchAction`：命中各 action / 未命中返 null / 大小写不敏感。
- keybindings-store 往返：`setKeybinding`→持久化→读回一致、`resetKeybindings`→回默认。（store 若依赖 localStorage，注入/mock 之，仿现有 store 自测套路。）
- 现有 `test:interaction` 里 `matchAction`/`eventCombo` 若已有测试，扩不删。

### 契约
**无变更**（纯 renderer + localStorage）。仍 v6。

---

## 收尾（两任务共同）
1. `npm run typecheck` + `npm run build` + `npm run test:interaction`（B）+ 全部 `test:*` 无回归。
2. **dev 手验**（总纲层跑不了 GUI，务必手验）：
   - A：book5 插图显示。
   - B：设置→快捷键 录制改键；t 切译文；左右箭头翻章；AI 框内打字时箭头/t 不误触。
3. 更新 `SESSION_LOG.md`：会话记录追加一条（做了什么、碰哪些文件、自测结果、下游须知）+ 模块状态表（interaction 加"会话 18 扩快捷键"、reader-view 接线注记）；契约仍 v6 无 CR。
4. 若改动碰共享文件（SettingsDialog/Reader/preload 无需改），保持向后兼容。

## 明确不做
- AI 发送键、清空暂存键保持硬编码（不进 UI）。
- 图片自定义协议方案（已选 data URL）。
- 不碰 sendStaged/clearStaged 的 keybindings（从 Action 移除）。
