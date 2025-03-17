# OpenAnswer 故障排除指南

本文档提供了 OpenAnswer 使用过程中可能遇到的常见问题及其解决方案。

## 目录

- [安装和启动问题](#安装和启动问题)
- [屏幕捕获问题](#屏幕捕获问题)
- [OCR 识别问题](#ocr-识别问题)
- [LLM 调用问题](#llm-调用问题)
- [性能问题](#性能问题)
- [浏览器兼容性问题](#浏览器兼容性问题)
- [日志和调试](#日志和调试)

## 安装和启动问题

### 依赖安装失败

**问题**: 运行 `npm install` 时出现错误。

**解决方案**:

1. 确保 Node.js 和 npm 版本符合要求：
   ```bash
   node -v  # 应为 v14.0.0 或更高
   npm -v   # 应为 v6.0.0 或更高
   ```

2. 清除 npm 缓存后重试：
   ```bash
   npm cache clean --force
   npm install
   ```

3. 如果特定包安装失败，尝试单独安装：
   ```bash
   npm install <问题包名>
   ```

### 应用无法启动

**问题**: 运行 `npm start` 时出现错误。

**解决方案**:

1. 检查端口占用：
   ```bash
   # 在 Linux/Mac 上
   lsof -i :3000
   # 在 Windows 上
   netstat -ano | findstr :3000
   ```
   如果端口被占用，可以在 `.env` 文件中修改 `PORT` 配置。

2. 检查环境变量配置：
   确保 `.env` 文件存在且格式正确。

3. 检查日志输出，查找具体错误信息：
   ```bash
   DEBUG=true npm start
   ```

## 屏幕捕获问题

### 无法获取屏幕共享权限

**问题**: 点击屏幕捕获区域后，没有弹出共享窗口或权限请求。

**解决方案**:

1. 确保使用支持的浏览器：Chrome 88+, Firefox 87+, Edge 88+ 或 Safari 14+。

2. 确保通过 HTTPS 或 localhost 访问应用，因为屏幕捕获 API 需要安全上下文。

3. 检查浏览器权限设置：
   - Chrome: 设置 > 隐私设置和安全性 > 网站设置 > 权限 > 屏幕捕获
   - Firefox: 设置 > 隐私与安全 > 权限 > 摄像头和麦克风

4. 尝试重新加载页面并重新授权。

### 屏幕捕获黑屏

**问题**: 屏幕共享成功，但显示黑屏。

**解决方案**:

1. 确保选择了正确的窗口或标签页进行共享。

2. 某些应用（如受 DRM 保护的内容）可能无法被捕获，尝试共享其他窗口。

3. 检查浏览器是否有最新的安全更新。

4. 在某些操作系统上，可能需要调整系统设置允许屏幕录制。

## OCR 识别问题

### 本地 OCR 识别不准确

**问题**: 使用 Tesseract.js 进行本地识别时，文字识别不准确或完全错误。

**解决方案**:

1. 确保屏幕上的文字清晰可见，避免模糊或过小的文字。

2. 调整图像质量参数：
   ```
   # 在 .env 文件中
   IMAGE_QUALITY=0.9  # 增大图像质量 (0-1)
   MAX_IMAGE_SIZE=2000  # 增大图像尺寸
   ```

3. 对于复杂文本（特别是中文），建议配置并使用百度云 OCR：
   ```
   # 在 .env 文件中
   OCR_METHOD=baidu
   BAIDU_OCR_APP_ID=your_app_id
   BAIDU_OCR_API_KEY=your_api_key
   BAIDU_OCR_SECRET_KEY=your_secret_key
   ```

### 百度 OCR 配置错误

**问题**: 配置百度 OCR 后出现 "百度OCR配置不完整" 错误。

**解决方案**:

1. 确保已正确配置所有必要的百度 OCR 参数：
   ```
   BAIDU_OCR_APP_ID=your_app_id
   BAIDU_OCR_API_KEY=your_api_key
   BAIDU_OCR_SECRET_KEY=your_secret_key
   ```

2. 验证百度智能云 API 密钥是否有效，可以通过百度智能云控制台测试。

3. 如果不需要使用百度 OCR，请确保将 OCR 方法设置为 "local"：
   ```
   OCR_METHOD=local
   ```

### Tesseract 加载失败

**问题**: 控制台显示 "Tesseract is not loaded" 错误。

**解决方案**:

1. 检查网络连接，因为 Tesseract.js 需要从 CDN 加载资源。

2. 如果在企业环境中，可能需要配置允许访问 Tesseract.js CDN。

3. 尝试刷新页面，或者清除浏览器缓存后重试。

4. 系统已实现 Tesseract 加载失败时的回退机制，会使用模拟识别，但识别结果可能不准确。

## LLM 调用问题

### API 密钥无效

**问题**: 调用 LLM API 时出现 "API key not valid" 错误。

**解决方案**:

1. 检查环境变量中的 API 密钥是否正确配置：
   ```
   # SiliconFlow
   SILICONFLOW_API_KEY=your_api_key
   
   # 或 DeepSeek
   DEEPSEEK_API_KEY=your_api_key
   ```

2. 确认 API 密钥是否已激活，可以通过相应的 API 控制台验证。

3. 检查 API 密钥是否有足够的配额或余额。

### API 调用超时

**问题**: LLM API 调用长时间无响应或超时。

**解决方案**:

1. 检查网络连接是否稳定。

2. 确认 API 端点是否正确：
   ```
   # SiliconFlow
   SILICONFLOW_API_ENDPOINT=https://api.siliconflow.cn/v1/chat/completions
   
   # 或 DeepSeek
   DEEPSEEK_API_ENDPOINT=https://api.deepseek.com/v1/chat/completions
   ```

3. 尝试减小问题文本的长度，或者分段处理。

4. 如果问题持续存在，可以尝试切换到另一个 LLM 提供商：
   ```
   # 在 .env 文件中
   LLM_MODEL=deepseek  # 从 siliconflow 切换到 deepseek
   ```

## 性能问题

### 应用响应缓慢

**问题**: 应用界面响应缓慢，操作延迟明显。

**解决方案**:

1. 调整 OCR 识别间隔，减少资源占用：
   ```
   # 在 .env 文件中
   OCR_INTERVAL=10000  # 增大间隔到 10 秒
   ```

2. 降低图像质量和尺寸，减少处理负担：
   ```
   IMAGE_QUALITY=0.7
   MAX_IMAGE_SIZE=1200
   ```

3. 关闭调试模式：
   ```
   DEBUG=false
   ```

4. 确保系统资源充足，特别是在低配置设备上运行时。

### 内存占用过高

**问题**: 浏览器内存占用持续增加，最终导致崩溃。

**解决方案**:

1. 定期刷新页面，释放内存。

2. 减小捕获的屏幕区域大小。

3. 检查是否有内存泄漏，可以使用浏览器开发者工具的性能和内存分析功能。

## 浏览器兼容性问题

### 特定浏览器不工作

**问题**: 应用在某些浏览器中无法正常工作。

**解决方案**:

1. 确保使用支持的浏览器版本：
   - Chrome 88+
   - Firefox 87+
   - Edge 88+
   - Safari 14+

2. 对于旧版浏览器，建议升级到最新版本。

3. 某些功能（如屏幕捕获）在移动浏览器中可能不受支持，建议使用桌面浏览器。

## 日志和调试

### 启用调试模式

要获取更详细的日志信息，可以启用调试模式：

```
# 在 .env 文件中
DEBUG=true
```

重启应用后，控制台将显示更详细的日志信息，有助于排查问题。

### 检查浏览器控制台

大多数错误和警告会在浏览器控制台中显示。按 F12 或右键点击页面并选择"检查"打开开发者工具，然后切换到"控制台"标签查看错误信息。

### 服务器日志

如果使用 PM2 管理应用，可以查看日志：

```bash
pm2 logs openanswer
```

或者直接查看输出：

```bash
npm start > app.log 2>&1
```

---

如果您遇到的问题未在本文档中列出，或者提供的解决方案无法解决您的问题，请通过 GitHub Issues 联系我们，提供详细的问题描述和环境信息，我们将尽快为您提供帮助。 