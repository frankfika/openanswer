# OpenAnswer 使用指南

本文档提供了 OpenAnswer 智能解题助手的详细使用说明，帮助您充分利用本工具提高学习效率。

## 目录

- [基本使用](#基本使用)
- [功能详解](#功能详解)
- [配置选项](#配置选项)
- [常见问题](#常见问题)
- [使用技巧](#使用技巧)

## 基本使用

### 启动应用

1. 确保已安装并配置好 OpenAnswer（参见 [README.md](../README.md) 中的安装说明）
2. 启动服务器：`npm start`
3. 在浏览器中访问：`http://localhost:3000`

### 屏幕捕获

1. 在应用界面中，点击屏幕捕获区域
2. 在弹出的窗口中，选择要共享的窗口或标签页（通常是显示题目的窗口）
3. 点击"共享"按钮开始捕获

### 识别与解答

1. 系统会自动识别屏幕上的文字内容
2. 识别结果会显示在右侧的"识别问题"区域
3. 系统会自动调用大语言模型生成答案
4. 答案会显示在右侧的"智能回答"区域

## 功能详解

### OCR 文字识别

OpenAnswer 支持两种 OCR 识别方式：

1. **本地识别（默认）**
   - 使用 Tesseract.js 在浏览器中进行识别
   - 无需额外配置，但识别速度和准确率可能受限
   - 适合简单文本和英文内容

2. **百度云 OCR**
   - 使用百度智能云 OCR API 进行识别
   - 需要配置百度云 API 密钥
   - 识别速度快，准确率高，支持复杂中文文本
   - 适合各类复杂文本内容

### 大语言模型

OpenAnswer 支持多种大语言模型：

1. **SiliconFlow（默认）**
   - 支持多种模型，包括 InternLM、Qwen、Baichuan 等
   - 中英双语能力强
   - 需要配置 SiliconFlow API 密钥

2. **DeepSeek**
   - 支持 deepseek-chat 和 deepseek-reasoner 模型
   - 推理能力强
   - 需要配置 DeepSeek API 密钥

### 文本相似度检测

系统会自动检测屏幕内容的变化，只有当内容发生显著变化时才会重新处理，避免重复处理相同的问题。

## 配置选项

详细配置选项请参考 [.env.example](../.env.example) 文件，主要配置项包括：

### LLM 配置

```
# 可选值: 'siliconflow' | 'deepseek'
LLM_MODEL=siliconflow

# SiliconFlow 配置
SILICONFLOW_API_KEY=your_api_key
SILICONFLOW_API_ENDPOINT=https://api.siliconflow.cn/v1/chat/completions
SILICONFLOW_MODEL=internlm/internlm2_5-20b-chat

# DeepSeek 配置
DEEPSEEK_API_KEY=your_api_key
DEEPSEEK_API_ENDPOINT=https://api.deepseek.com/v1/chat/completions
DEEPSEEK_MODEL=deepseek-reasoner
```

### OCR 配置

```
# 可选值: 'local' | 'baidu'
OCR_METHOD=local

# 百度 OCR 配置
BAIDU_OCR_APP_ID=your_app_id
BAIDU_API_KEY=your_api_key
BAIDU_SECRET_KEY=your_secret_key
```

### 系统配置

```
# OCR 识别间隔（毫秒）
OCR_INTERVAL=5000
# 图像压缩质量 (0-1)
IMAGE_QUALITY=0.8
# 最大图像尺寸（像素）
MAX_IMAGE_SIZE=1600
```

## 常见问题

### 无法启动应用

- 确保已安装所有依赖：`npm install`
- 检查端口是否被占用，可以在 `.env` 文件中修改 `PORT` 配置
- 检查日志输出，查找具体错误信息

### 屏幕捕获不工作

- 确保使用支持屏幕捕获的现代浏览器（Chrome、Edge、Firefox 等）
- 确保已授予浏览器屏幕捕获权限
- 尝试刷新页面并重新选择共享窗口

### OCR 识别不准确

- 对于复杂文本，建议配置并使用百度云 OCR
- 确保屏幕上的文字清晰可见，避免模糊或过小的文字
- 调整 `IMAGE_QUALITY` 和 `MAX_IMAGE_SIZE` 参数提高图像质量

### API 调用失败

- 检查 API 密钥是否正确配置
- 确保网络连接正常
- 查看浏览器控制台或服务器日志获取详细错误信息

## 使用技巧

1. **选择合适的窗口**：尽量选择只包含题目的窗口或标签页，避免干扰内容

2. **调整识别间隔**：根据需要调整 `OCR_INTERVAL` 参数，较短的间隔可以更快捕获变化，但会增加系统负载

3. **使用合适的模型**：
   - 对于中文题目，推荐使用 SiliconFlow 的 InternLM 或 Baichuan 模型
   - 对于需要推理的复杂问题，推荐使用 DeepSeek 的 reasoner 模型

4. **优化图像质量**：
   - 增大 `IMAGE_QUALITY` 参数（最大为 1.0）可提高图像质量
   - 增大 `MAX_IMAGE_SIZE` 参数可提高分辨率，但会增加处理时间

5. **调试模式**：设置 `DEBUG=true` 可以查看更详细的日志信息，有助于排查问题

---

如有任何问题或建议，请通过 GitHub Issues 联系我们。 