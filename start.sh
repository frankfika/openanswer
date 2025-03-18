#!/bin/bash

# OpenAnswer 一键启动脚本
# 适用于 macOS 和 Linux 系统

# 显示彩色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
# 切换到脚本所在目录
cd "$SCRIPT_DIR"

# 显示欢迎信息
echo -e "${GREEN}=======================================${NC}"
echo -e "${GREEN}    欢迎使用 OpenAnswer 智能解题助手    ${NC}"
echo -e "${GREEN}=======================================${NC}"
echo ""

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo -e "${RED}错误: 未检测到 Node.js${NC}"
    echo -e "${YELLOW}请先安装 Node.js (v14.0.0 或更高版本)${NC}"
    echo "访问 https://nodejs.org/zh-cn/ 下载并安装"
    echo ""
    echo "按任意键退出..."
    read -n 1
    exit 1
fi

# 检查 Node.js 版本
NODE_VERSION=$(node -v | cut -d 'v' -f 2)
NODE_MAJOR_VERSION=$(echo $NODE_VERSION | cut -d '.' -f 1)
if [ $NODE_MAJOR_VERSION -lt 14 ]; then
    echo -e "${RED}错误: Node.js 版本过低${NC}"
    echo -e "${YELLOW}当前版本: $NODE_VERSION, 需要 v14.0.0 或更高版本${NC}"
    echo "访问 https://nodejs.org/zh-cn/ 下载并安装新版本"
    echo ""
    echo "按任意键退出..."
    read -n 1
    exit 1
fi

# 检查是否存在 .env 文件
if [ ! -f .env ]; then
    echo -e "${YELLOW}未检测到 .env 文件，将从模板创建...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}已创建 .env 文件${NC}"
    else
        echo -e "${RED}错误: 未找到 .env.example 模板文件${NC}"
        echo "请确保您在正确的目录中运行此脚本"
        echo "当前目录: $(pwd)"
        echo ""
        echo "按任意键退出..."
        read -n 1
        exit 1
    fi
fi

# 检查依赖是否安装
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}正在安装依赖，这可能需要几分钟时间...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}依赖安装失败${NC}"
        echo "请检查网络连接或手动运行 npm install"
        echo ""
        echo "按任意键退出..."
        read -n 1
        exit 1
    fi
    echo -e "${GREEN}依赖安装完成${NC}"
fi

# 检查端口是否被占用
PORT=$(grep "PORT=" .env | cut -d '=' -f 2)
if [ -z "$PORT" ]; then
    PORT=3000
fi

if command -v lsof &> /dev/null; then
    PORT_CHECK=$(lsof -i :$PORT | grep LISTEN)
    if [ ! -z "$PORT_CHECK" ]; then
        echo -e "${RED}警告: 端口 $PORT 已被占用${NC}"
        echo "请修改 .env 文件中的 PORT 配置或关闭占用该端口的程序"
        echo ""
        echo "按任意键退出..."
        read -n 1
        exit 1
    fi
fi

# 启动应用
echo -e "${GREEN}正在启动 OpenAnswer...${NC}"
echo -e "${YELLOW}应用将在浏览器中打开，请稍候...${NC}"
echo ""

# 启动服务器
npm start &
SERVER_PID=$!

# 等待服务器启动
sleep 3

# 打开浏览器
if command -v open &> /dev/null; then
    # macOS
    open http://localhost:$PORT
elif command -v xdg-open &> /dev/null; then
    # Linux
    xdg-open http://localhost:$PORT
elif command -v gnome-open &> /dev/null; then
    # Linux (GNOME)
    gnome-open http://localhost:$PORT
else
    echo -e "${YELLOW}请手动在浏览器中打开: http://localhost:$PORT${NC}"
fi

echo -e "${GREEN}OpenAnswer 已启动!${NC}"
echo -e "${YELLOW}访问地址: http://localhost:$PORT${NC}"
echo -e "${YELLOW}按 Ctrl+C 停止服务${NC}"

# 等待用户按 Ctrl+C
wait $SERVER_PID 