# OpenAnswer API 文档

本文档详细说明了 OpenAnswer 系统提供的 API 接口，包括请求方法、参数和响应格式，供开发者集成和扩展使用。

## 基础信息

- **基础 URL**: `http://localhost:3000` (默认)
- **响应格式**: JSON
- **认证方式**: 无 (本地服务)

## API 端点

### 1. 获取系统配置

获取当前系统配置信息，包括 LLM 模型、OCR 方法等配置项。

- **URL**: `/config`
- **方法**: `GET`
- **参数**: 无

**响应示例**:

```json
{
  "LLM_MODEL": "siliconflow",
  "OCR_METHOD": "local",
  "OCR_INTERVAL": 5000,
  "IMAGE_QUALITY": 0.8,
  "MAX_IMAGE_SIZE": 1600,
  "SILICONFLOW_API_KEY": "sk-********",
  "SILICONFLOW_API_ENDPOINT": "https://api.siliconflow.cn/v1/chat/completions",
  "SILICONFLOW_MODEL": "internlm/internlm2_5-20b-chat",
  "DEEPSEEK_API_KEY": "sk-********",
  "DEEPSEEK_API_ENDPOINT": "https://api.deepseek.com/v1/chat/completions",
  "DEEPSEEK_MODEL": "deepseek-reasoner",
  "BAIDU_OCR_APP_ID": "********",
  "BAIDU_OCR_API_KEY": "********",
  "BAIDU_OCR_SECRET_KEY": "********",
  "llm_model": "siliconflow",
  "ocr_method": "local",
  "ocr_interval": 5000,
  "image_quality": 0.8,
  "max_image_size": 1600
}
```

**响应字段说明**:

| 字段名 | 类型 | 描述 |
|--------|------|------|
| LLM_MODEL | String | 当前使用的大语言模型 |
| OCR_METHOD | String | 当前使用的 OCR 方法 |
| OCR_INTERVAL | Number | OCR 识别间隔 (毫秒) |
| IMAGE_QUALITY | Number | 图像压缩质量 (0-1) |
| MAX_IMAGE_SIZE | Number | 最大图像尺寸 (像素) |
| SILICONFLOW_API_KEY | String | SiliconFlow API 密钥 (部分隐藏) |
| SILICONFLOW_API_ENDPOINT | String | SiliconFlow API 端点 |
| SILICONFLOW_MODEL | String | SiliconFlow 使用的模型 |
| DEEPSEEK_API_KEY | String | DeepSeek API 密钥 (部分隐藏) |
| DEEPSEEK_API_ENDPOINT | String | DeepSeek API 端点 |
| DEEPSEEK_MODEL | String | DeepSeek 使用的模型 |
| BAIDU_OCR_APP_ID | String | 百度 OCR 应用 ID (部分隐藏) |
| BAIDU_OCR_API_KEY | String | 百度 OCR API 密钥 (部分隐藏) |
| BAIDU_OCR_SECRET_KEY | String | 百度 OCR 密钥 (部分隐藏) |

**注意**: 响应中同时包含大写和小写的配置项名称，以保持向后兼容性。

### 2. 调用大语言模型

通过大语言模型处理问题并生成回答。

- **URL**: `/api/llm`
- **方法**: `POST`
- **Content-Type**: `application/json`
- **请求体**:

```json
{
  "question": "计算 2+3 的结果是多少？",
  "model": "siliconflow"  // 可选，默认使用系统配置的模型
}
```

**请求参数**:

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| question | String | 是 | 需要处理的问题文本 |
| model | String | 否 | 指定使用的模型，可选值: "siliconflow", "deepseek" |

**响应示例**:

```json
{
  "answer": "2+3 的结果是 5。",
  "model": "siliconflow",
  "modelName": "internlm/internlm2_5-20b-chat",
  "time": 1.25  // 处理时间 (秒)
}
```

**响应字段说明**:

| 字段名 | 类型 | 描述 |
|--------|------|------|
| answer | String | 模型生成的回答 |
| model | String | 使用的模型类型 |
| modelName | String | 具体的模型名称 |
| time | Number | 处理时间 (秒) |

**错误响应示例**:

```json
{
  "error": "Invalid question format",
  "message": "Question cannot be empty"
}
```

### 3. 百度 OCR 识别

使用百度云 OCR API 识别图像中的文字。

- **URL**: `/api/ocr/baidu`
- **方法**: `POST`
- **Content-Type**: `application/json`
- **请求体**:

```json
{
  "image": "base64编码的图像数据"
}
```

**请求参数**:

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| image | String | 是 | Base64 编码的图像数据 |

**响应示例**:

```json
{
  "text": "识别出的文本内容",
  "time": 0.85  // 处理时间 (秒)
}
```

**响应字段说明**:

| 字段名 | 类型 | 描述 |
|--------|------|------|
| text | String | 识别出的文本内容 |
| time | Number | 处理时间 (秒) |

**错误响应示例**:

```json
{
  "error": "Baidu OCR Error",
  "message": "Invalid API key or insufficient permissions"
}
```

## 错误码

| 错误码 | 描述 |
|--------|------|
| 400 | 请求参数错误 |
| 401 | 认证失败 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

## 使用示例

### 使用 JavaScript Fetch API 调用 LLM 接口

```javascript
async function callLLM(question) {
  try {
    const response = await fetch('http://localhost:3000/api/llm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: question
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Answer:', data.answer);
    return data;
  } catch (error) {
    console.error('Error calling LLM API:', error);
    throw error;
  }
}

// 使用示例
callLLM('什么是相对论？')
  .then(data => {
    // 处理响应数据
    document.getElementById('answer').textContent = data.answer;
  })
  .catch(error => {
    // 处理错误
    console.error('Failed to get answer:', error);
  });
```

### 使用 Node.js 获取系统配置

```javascript
const fetch = require('node-fetch');

async function getConfig() {
  try {
    const response = await fetch('http://localhost:3000/config');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const config = await response.json();
    console.log('System configuration:', config);
    return config;
  } catch (error) {
    console.error('Error fetching config:', error);
    throw error;
  }
}

// 使用示例
getConfig()
  .then(config => {
    // 处理配置数据
    console.log(`Current LLM model: ${config.LLM_MODEL}`);
    console.log(`Current OCR method: ${config.OCR_METHOD}`);
  })
  .catch(error => {
    // 处理错误
    console.error('Failed to get config:', error);
  });
```

## 注意事项

1. 所有 API 调用都是本地服务，不需要认证
2. 图像数据应该使用 Base64 编码，并且去掉前缀 (如 `data:image/jpeg;base64,`)
3. 大型图像可能导致处理时间延长，建议在发送前压缩图像
4. API 响应中的敏感信息 (如 API 密钥) 会被部分隐藏

---

如有任何问题或建议，请通过 GitHub Issues 联系我们。 