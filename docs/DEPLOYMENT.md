# OpenAnswer 部署指南

本文档提供了在不同环境中部署 OpenAnswer 的详细说明，包括本地开发环境、生产环境和 Docker 容器化部署。

## 目录

- [系统要求](#系统要求)
- [本地开发环境部署](#本地开发环境部署)
- [生产环境部署](#生产环境部署)
- [Docker 容器化部署](#docker-容器化部署)
- [Nginx 配置](#nginx-配置)
- [环境变量配置](#环境变量配置)
- [常见问题](#常见问题)

## 系统要求

### 硬件要求

- **CPU**: 双核处理器或更高
- **内存**: 最低 2GB RAM，推荐 4GB 或更高
- **存储**: 最低 1GB 可用空间

### 软件要求

- **Node.js**: v14.0.0 或更高版本
- **npm**: v6.0.0 或更高版本
- **现代浏览器**: Chrome 88+, Firefox 87+, Edge 88+ 或 Safari 14+

## 本地开发环境部署

### 1. 克隆代码库

```bash
git clone https://github.com/yourusername/openanswer.git
cd openanswer
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

使用文本编辑器打开 `.env` 文件，根据需要修改配置项。

### 4. 启动开发服务器

```bash
npm run dev
```

服务器将在 http://localhost:3000 启动。

## 生产环境部署

### 1. 克隆代码库

```bash
git clone https://github.com/yourusername/openanswer.git
cd openanswer
```

### 2. 安装依赖

```bash
npm install --production
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

使用文本编辑器打开 `.env` 文件，根据需要修改配置项。在生产环境中，请确保：

- 设置 `NODE_ENV=production`
- 配置适当的 API 密钥
- 根据需要调整性能参数

### 4. 启动生产服务器

#### 使用 Node.js 直接启动

```bash
npm start
```

#### 使用 PM2 进程管理器（推荐）

首先安装 PM2：

```bash
npm install -g pm2
```

然后启动应用：

```bash
pm2 start server.js --name "openanswer"
```

配置开机自启：

```bash
pm2 startup
pm2 save
```

### 5. 验证部署

访问 http://your-server-ip:3000 确认应用正常运行。

## Docker 容器化部署

### 1. 构建 Docker 镜像

在项目根目录下创建 `Dockerfile`：

```dockerfile
FROM node:14-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
```

构建镜像：

```bash
docker build -t openanswer .
```

### 2. 运行 Docker 容器

```bash
docker run -d -p 3000:3000 --name openanswer \
  -e LLM_MODEL=siliconflow \
  -e OCR_METHOD=local \
  -e SILICONFLOW_API_KEY=your_api_key \
  -e SILICONFLOW_API_ENDPOINT=https://api.siliconflow.cn/v1/chat/completions \
  -e SILICONFLOW_MODEL=internlm/internlm2_5-20b-chat \
  openanswer
```

### 3. 使用 Docker Compose

创建 `docker-compose.yml` 文件：

```yaml
version: '3'

services:
  openanswer:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - LLM_MODEL=siliconflow
      - OCR_METHOD=local
      - SILICONFLOW_API_KEY=your_api_key
      - SILICONFLOW_API_ENDPOINT=https://api.siliconflow.cn/v1/chat/completions
      - SILICONFLOW_MODEL=internlm/internlm2_5-20b-chat
    restart: always
```

启动服务：

```bash
docker-compose up -d
```

## Nginx 配置

如果您想使用 Nginx 作为反向代理，可以使用以下配置：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

保存为 `/etc/nginx/sites-available/openanswer` 并启用：

```bash
sudo ln -s /etc/nginx/sites-available/openanswer /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 环境变量配置

详细的环境变量配置请参考 [.env.example](../.env.example) 文件。以下是一些关键配置项：

### 基础配置

```
# 服务器端口
PORT=3000
# 环境模式
NODE_ENV=production
# 调试模式
DEBUG=false
```

### LLM 配置

```
# 大语言模型选择
LLM_MODEL=siliconflow
# SiliconFlow 配置
SILICONFLOW_API_KEY=your_api_key
SILICONFLOW_API_ENDPOINT=https://api.siliconflow.cn/v1/chat/completions
SILICONFLOW_MODEL=internlm/internlm2_5-20b-chat
```

### OCR 配置

```
# OCR 方法选择
OCR_METHOD=local
# 百度 OCR 配置 (如果使用百度 OCR)
BAIDU_OCR_APP_ID=your_app_id
BAIDU_OCR_API_KEY=your_api_key
BAIDU_OCR_SECRET_KEY=your_secret_key
```

## 常见问题

### 1. 应用无法启动

**问题**: 应用启动时报错 `Error: Cannot find module 'xxx'`

**解决方案**: 确保已正确安装所有依赖：

```bash
rm -rf node_modules
npm install
```

### 2. 屏幕捕获不工作

**问题**: 无法获取屏幕共享权限

**解决方案**: 确保使用 HTTPS 或 localhost 访问应用，因为屏幕捕获 API 需要安全上下文。

### 3. API 调用失败

**问题**: 调用 LLM API 时出现 "API key not valid" 错误

**解决方案**: 检查环境变量中的 API 密钥是否正确配置，并确保 API 端点可访问。

### 4. Docker 容器无法访问

**问题**: 无法通过浏览器访问 Docker 容器中的应用

**解决方案**: 确保端口映射正确，并检查防火墙设置：

```bash
docker ps  # 检查容器是否正在运行
sudo ufw allow 3000  # 如果使用 UFW 防火墙
```

---

如有任何部署问题或建议，请通过 GitHub Issues 联系我们。