@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在启动 Chion 阅读器（开发模式）...
echo 首次启动或换设备请先运行「安装依赖.bat」。
echo.
call npm run dev
echo.
echo 程序已退出。按任意键关闭本窗口。
pause >nul