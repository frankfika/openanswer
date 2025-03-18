@echo off
title OpenAnswer 智能解题助手

:: 切换到脚本所在目录
cd /d "%~dp0"

:: 设置颜色
set GREEN=[92m
set YELLOW=[93m
set RED=[91m
set NC=[0m

:: 显示欢迎信息
echo %GREEN%=======================================%NC%
echo %GREEN%    欢迎使用 OpenAnswer 智能解题助手    %NC%
echo %GREEN%=======================================%NC%
echo.

:: 检查 Node.js 是否安装
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo %RED%错误: 未检测到 Node.js%NC%
    echo %YELLOW%请先安装 Node.js (v14.0.0 或更高版本)%NC%
    echo 访问 https://nodejs.org/zh-cn/ 下载并安装
    echo.
    echo 按任意键退出...
    pause >nul
    exit /b 1
)

:: 检查 Node.js 版本
for /f "tokens=1,2,3 delims=." %%a in ('node -v') do (
    set NODE_MAJOR=%%a
)
set NODE_MAJOR=%NODE_MAJOR:~1%
if %NODE_MAJOR% LSS 14 (
    echo %RED%错误: Node.js 版本过低%NC%
    echo %YELLOW%当前版本: %NODE_MAJOR%, 需要 v14.0.0 或更高版本%NC%
    echo 访问 https://nodejs.org/zh-cn/ 下载并安装新版本
    echo.
    echo 按任意键退出...
    pause >nul
    exit /b 1
)

:: 检查是否存在 .env 文件
if not exist .env (
    echo %YELLOW%未检测到 .env 文件，将从模板创建...%NC%
    if exist .env.example (
        copy .env.example .env >nul
        echo %GREEN%已创建 .env 文件%NC%
    ) else (
        echo %RED%错误: 未找到 .env.example 模板文件%NC%
        echo 请确保您在正确的目录中运行此脚本
        echo 当前目录: %cd%
        echo.
        echo 按任意键退出...
        pause >nul
        exit /b 1
    )
)

:: 检查依赖是否安装
if not exist node_modules (
    echo %YELLOW%正在安装依赖，这可能需要几分钟时间...%NC%
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo %RED%依赖安装失败%NC%
        echo 请检查网络连接或手动运行 npm install
        echo.
        echo 按任意键退出...
        pause >nul
        exit /b 1
    )
    echo %GREEN%依赖安装完成%NC%
)

:: 检查端口是否被占用
set PORT=3000
for /f "tokens=1,2 delims==" %%a in (.env) do (
    if "%%a"=="PORT" set PORT=%%b
)

netstat -ano | findstr ":%PORT% " | findstr "LISTENING" >nul
if %ERRORLEVEL% equ 0 (
    echo %RED%警告: 端口 %PORT% 已被占用%NC%
    echo 请修改 .env 文件中的 PORT 配置或关闭占用该端口的程序
    echo.
    echo 按任意键退出...
    pause >nul
    exit /b 1
)

:: 启动应用
echo %GREEN%正在启动 OpenAnswer...%NC%
echo %YELLOW%应用将在浏览器中打开，请稍候...%NC%
echo.

:: 启动服务器并等待几秒
start /B cmd /c "npm start"

:: 等待服务器启动
timeout /t 3 >nul

:: 打开浏览器
start http://localhost:%PORT%

echo %GREEN%OpenAnswer 已启动!%NC%
echo %YELLOW%访问地址: http://localhost:%PORT%%NC%
echo %YELLOW%关闭此窗口将停止服务%NC%
echo.

:: 保持窗口打开
pause >nul 