# interaction 模块（renderer 侧）

负责会话：interaction（第 3 批，会话 7 已交付）。依赖契约 3。
职责：点词/选择/快捷键 → 剪贴板（喂 GoldenDict）+ AI 输入暂存。交互模型见总纲第 5 节。

## 公开面（`index.ts`）

- `useInteraction(segTextBySeq)` → `{ onTokenClick, onSegmentContextMenu }`：
  reader-view 的 Reader 挂载。onTokenClick 接 JapaneseText；onSegmentContextMenu 挂列表容器。
- `StagedInputBox({ onSend? })`：占位 AI 输入框，订阅暂存 store。`onSend` 留给
  ai-analysis 会话启动流式一轮（发送后自动清空）。
- 暂存 store：`getStaged / subscribeStaged / stageSelection / setUserText / clearStaged`。
- `Selection`（契约 3 落地）、`defaultKeybindings / matchAction`（可配置快捷键结构）。

## 交互规则（总纲第 5 节）

- 左键单击词 → 原形进剪贴板 + 暂存；原形空/异常兜底表层形。
- shift+左键 = 多选词，用表层形（选什么是什么），不转原形。
- 右键单击段 → 整段原文；shift+右键 = 多选段。
- 覆盖语义：新选择覆盖上次暂存，绝不叠加；shift 累加只在同一手势内。
- 草稿保护：AI 输入框为空才自动填；有用户手打内容时不覆盖文本。

## 自测

`npm run test:interaction` —— 纯逻辑验选择规则 + 覆盖语义 + 草稿保护（无 DOM/electron）。
