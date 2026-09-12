@echo off
chcp 65001 >nul
cd /d "%~dp0"

REM ============================================================
REM  Chion 阅读器 一键启动（可选：同时拉起 GPT-SoVITS 语音服务）
REM ============================================================
REM  要用「朗读」功能：把下面 SOVITS_DIR 改成你自己的 GPT-SoVITS
REM  目录（含 api_v2.py 和 runtime\python.exe 的那个）。
REM  不用朗读、或没装 SoVITS：留空即可，自动跳过、只开阅读器。
REM  例：set "SOVITS_DIR=D:\GPT-SoVITS-v2pro-20250604"
REM ============================================================
REM  发布到其他电脑前不要填写本机路径；需要朗读时改成用户自己的目录。
set "SOVITS_DIR="

echo ========================================
echo   Chion 阅读器 启动中
echo ========================================
echo.

if "%SOVITS_DIR%"=="" goto :skip_sovits
if not exist "%SOVITS_DIR%\api_v2.py" (
  echo [语音] 未在 SOVITS_DIR 找到 api_v2.py，跳过语音服务。
  echo        请检查 启动全部.bat 顶部的 SOVITS_DIR 是否指向正确的 GPT-SoVITS 目录。
  echo.
  goto :skip_sovits
)
if not exist "%SOVITS_DIR%\runtime\python.exe" (
  echo [语音] 未找到 runtime\python.exe（整合包内置 Python），跳过语音服务。
  echo.
  goto :skip_sovits
)
echo [语音] 正在后台启动 GPT-SoVITS（独立窗口，首次加载模型约 1 分钟）...
start "GPT-SoVITS 语音服务" /D "%SOVITS_DIR%" cmd /k "chcp 65001 >nul && runtime\python.exe api_v2.py -a 127.0.0.1 -p 9880"
echo        语音服务窗口已打开；不需要朗读时可直接关闭那个窗口。
echo.
:skip_sovits

echo [阅读器] 正在启动 Chion（开发模式）...
echo          首次启动或换设备请先运行「安装依赖.bat」。
echo.
call npm run dev
echo.
echo 程序已退出。按任意键关闭本窗口。
pause >nul
