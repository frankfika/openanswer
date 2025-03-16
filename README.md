# OpenAnswer

OpenAnswer 是一个基于屏幕内容的实时问答系统，可以自动识别屏幕上的文字内容并提供智能回答。

## 功能特点

- 实时屏幕内容识别
- 智能文本相似度检测，避免重复处理
- 使用百度 OCR API 进行文字识别
- 使用 DeepSeek API 生成智能回答
- 简洁美观的用户界面

## 技术栈

- 前端：HTML, CSS, JavaScript
- OCR：百度 OCR API
- AI 问答：DeepSeek API
- 服务端：Node.js, Express

## 安装与使用

1. 克隆仓库
```
git clone https://github.com/yourusername/openanswer.git
cd openanswer
```

2. 安装依赖
```
npm install
```

3. 配置环境变量
创建 `.env` 文件，添加以下内容：
```
# DeepSeek API Configuration
DEEPSEEK_API_ENDPOINT=https://api.deepseek.com/v1/chat/completions
DEEPSEEK_API_KEY=your_deepseek_api_key

# 百度 OCR API 配置
BAIDU_API_KEY=your_baidu_api_key
BAIDU_SECRET_KEY=your_baidu_secret_key
```

4. 启动服务
```
npm start
```

5. 打开浏览器访问 `http://localhost:3000`

## 使用说明

1. 打开网页后，选择要共享的窗口
2. 确保共享的窗口中有清晰的文字内容
3. 系统会自动识别文字并提供回答
4. 每 4 秒自动识别一次屏幕内容

## 许可证

MIT 