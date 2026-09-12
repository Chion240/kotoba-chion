# reader-view 模块（renderer 侧）

负责会话：reader-view（第 3 批）。依赖契约 1、2。
职责：react-virtuoso 渲染 + 段落/标题/图片组件 + ruby + 中文展开。
分词走 worker（Web Worker，契约 2）；通道烟测见 `@/lib/worker-smoke`。
本会话（脚手架）只建目录占位。
