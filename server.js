const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const fetch = require('node-fetch');

// 强制重新加载环境变量
dotenv.config({ override: true });

// 在加载配置之前确保环境变量已经加载
console.log('Loading environment variables...');
console.log('LLM_MODEL:', process.env.LLM_MODEL);
console.log('OCR_METHOD:', process.env.OCR_METHOD);
console.log('SILICONFLOW_MODEL:', process.env.SILICONFLOW_MODEL);

// 加载配置
const config = require('./config');

const app = express();
const port = process.env.PORT || 3000;

// 存储百度 access token
let baiduAccessToken = null;
let tokenExpireTime = 0;

// 获取百度 access token
async function getBaiduAccessToken() {
    try {
        if (!process.env.BAIDU_API_KEY || !process.env.BAIDU_SECRET_KEY) {
            throw new Error('百度OCR API密钥未配置');
        }
        
        const response = await fetch(`https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${process.env.BAIDU_API_KEY}&client_secret=${process.env.BAIDU_SECRET_KEY}`);
        
        if (!response.ok) {
            throw new Error(`获取百度 token 失败: ${response.status}`);
        }

        const data = await response.json();
        baiduAccessToken = data.access_token;
        // token 有效期通常为30天，我们设置为29天以确保安全
        tokenExpireTime = Date.now() + 29 * 24 * 60 * 60 * 1000;
        console.log('百度 access token 已更新');
        return baiduAccessToken;
    } catch (error) {
        console.error('获取百度 access token 错误:', error);
        throw error;
    }
}

// 检查并更新 token
async function ensureValidToken() {
    if (!baiduAccessToken || Date.now() >= tokenExpireTime) {
        await getBaiduAccessToken();
    }
    return baiduAccessToken;
}

// 提供静态文件
app.use(express.static(path.join(__dirname)));

// 添加调试中间件
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// 添加解析JSON请求体的中间件
app.use(express.json());

// 提供配置接口
app.get('/config', (req, res) => {
  // 创建前端期望的配置格式
  const configResponse = {
    // 使用大写键名，与前端期望的格式一致
    LLM_MODEL: process.env.LLM_MODEL || 'siliconflow',
    OCR_METHOD: 'local', // 强制使用本地OCR
    OCR_INTERVAL: parseInt(process.env.OCR_INTERVAL || '5000'),
    IMAGE_QUALITY: parseFloat(process.env.IMAGE_QUALITY || '0.8'),
    MAX_IMAGE_SIZE: parseInt(process.env.MAX_IMAGE_SIZE || '1600'),
    DEBUG: process.env.DEBUG === 'true',
    
    // API密钥和端点
    SILICONFLOW_API_KEY: process.env.SILICONFLOW_API_KEY,
    SILICONFLOW_API_ENDPOINT: process.env.SILICONFLOW_API_ENDPOINT || 'https://api.siliconflow.cn/v1/chat/completions',
    SILICONFLOW_MODEL: process.env.SILICONFLOW_MODEL || 'internlm/internlm2_5-20b-chat',
    
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    DEEPSEEK_API_ENDPOINT: process.env.DEEPSEEK_API_ENDPOINT || 'https://api.deepseek.com/v1/chat/completions',
    DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL || 'deepseek-reasoner',
    
    // 百度OCR配置
    BAIDU_OCR_APP_ID: process.env.BAIDU_OCR_APP_ID || '',
    BAIDU_OCR_API_KEY: process.env.BAIDU_API_KEY || '',
    BAIDU_OCR_SECRET_KEY: process.env.BAIDU_SECRET_KEY || '',
    FORCE_VALIDATE_BAIDU: false,
    
    // 兼容旧版配置，提供小写键名
    llmModel: process.env.LLM_MODEL || 'siliconflow',
    apiEndpoint: process.env.LLM_MODEL === 'siliconflow' 
      ? process.env.SILICONFLOW_API_ENDPOINT 
      : process.env.DEEPSEEK_API_ENDPOINT,
    hasKey: process.env.LLM_MODEL === 'siliconflow'
      ? !!process.env.SILICONFLOW_API_KEY
      : !!process.env.DEEPSEEK_API_KEY,
    ocrMethod: 'local',
    siliconflowModel: process.env.SILICONFLOW_MODEL || 'internlm/internlm2_5-20b-chat'
  };
  
  console.log('Config requested. Current config:', {
    LLM_MODEL: configResponse.LLM_MODEL,
    OCR_METHOD: configResponse.OCR_METHOD,
    SILICONFLOW_API_KEY: configResponse.SILICONFLOW_API_KEY ? '已设置' : '未设置',
    DEEPSEEK_API_KEY: configResponse.DEEPSEEK_API_KEY ? '已设置' : '未设置'
  });
  
  res.json(configResponse);
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.post('/chat', async (req, res) => {
  const { messages } = req.body;
  
  if (!config.apiKey) {
    return res.status(400).json({ error: 'API key not configured' });
  }

  try {
    const startTime = Date.now();
    console.log(`Sending request to ${config.apiEndpoint} with model: ${config.llmModel === 'siliconflow' ? config.siliconflowModel : 'deepseek-chat'}`);
    
    // 添加超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20秒超时
    
    try {
      const response = await fetch(config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.llmModel === 'siliconflow' ? config.siliconflowModel : 'deepseek-chat',
          messages: messages,
          temperature: 0.5,  // 降低温度，使回答更确定
          max_tokens: 800    // 限制生成的token数量
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const endTime = Date.now();
      console.log(`API response received in ${endTime - startTime}ms`);
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error(`API error: ${response.status} ${response.statusText}`, errorData);
        return res.status(response.status).json({ 
          error: `API error: ${response.status} ${response.statusText}`,
          details: errorData
        });
      }
      
      const data = await response.json();
      console.log(`Total request completed in ${Date.now() - startTime}ms`);
      res.json(data);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('API request timed out after 20 seconds');
        return res.status(504).json({ error: 'API request timed out' });
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('Error in /chat endpoint:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log('Environment variables loaded:', {
        LLM_MODEL: process.env.LLM_MODEL || 'siliconflow',
        SILICONFLOW_API_ENDPOINT: process.env.SILICONFLOW_API_ENDPOINT ? '已设置' : '未设置',
        DEEPSEEK_API_ENDPOINT: process.env.DEEPSEEK_API_ENDPOINT ? '已设置' : '未设置',
        SILICONFLOW_API_KEY: process.env.SILICONFLOW_API_KEY ? '已设置' : '未设置',
        DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY ? '已设置' : '未设置',
        OCR_METHOD: process.env.OCR_METHOD || 'local',
        SILICONFLOW_MODEL: process.env.SILICONFLOW_MODEL || 'internlm/internlm2_5-20b-chat'
    });
}); 