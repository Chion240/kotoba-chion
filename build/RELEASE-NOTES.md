# Kotoba Chion 3.0.0

Kotoba Chion 是面向日语学习者的 Windows EPUB 阅读器，集成日语分词、假名注音、
词典联动、AI 分析、按需翻译和可选的本地语音朗读。

## 安装版

运行 `Kotoba-Chion-Setup-3.0.0-x64.exe`，按向导选择安装目录。安装不需要管理员权限，
并可创建桌面和开始菜单快捷方式。

## 免安装版

完整解压 `Kotoba-Chion-Portable-3.0.0-x64.zip` 后运行 `Kotoba Chion.exe`。请勿直接在
压缩包预览窗口内启动。免安装版与安装版共用 `%APPDATA%\kotoba-chion` 中的书库和设置。

## Windows SmartScreen 提示

本版本未购买代码签名证书。首次运行时 Windows 可能显示“Windows 已保护你的电脑”：

1. 确认下载来源以及 `SHA256SUMS.txt` 中的 SHA-256 校验值。
2. 点击“更多信息”。
3. 核对应用名称为 `Kotoba Chion`，然后点击“仍要运行”。

不要为来源不明或校验值不一致的文件绕过此提示。

## 数据与可选服务

- 卸载应用不会删除 `%APPDATA%\kotoba-chion` 中的书库和设置。
- AI 功能需要用户自行配置兼容服务及 API Key。
- GPT-SoVITS 语音服务和外部查词软件均为可选组件，不包含在发行包内。
- 应用不包含任何 EPUB 样书。

许可条款见 `EULA.txt`，第三方组件许可见 `THIRD_PARTY_NOTICES.txt`。
