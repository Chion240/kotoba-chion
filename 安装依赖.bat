@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   Chion 阅读器 - 首次安装
echo   （只需运行一次；换设备或删过 node_modules 才需重跑）
echo ============================================
echo.
echo [1/3] 安装依赖（跳过原生编译）...
call npm install --ignore-scripts
if errorlevel 1 goto fail
echo.
echo [2/3] 编译原生模块到 Electron...
call npm run setup
if errorlevel 1 goto fail
echo.
echo [3/3] 下载 Sudachi 词典（约 200MB，首次较慢）...
call npm run setup:dict
if errorlevel 1 goto fail
echo.
echo 安装完成！现在可以双击「启动.bat」开始使用。
pause >nul
exit /b 0
:fail
echo.
echo 安装出错，请把上面的报错信息截图反馈。
pause >nul
exit /b 1