const express = require('express');
const path = require('path');
require('dotenv').config();  // 确保在这里也加载环境变量
const config = require('./config');
const dotenv = require('dotenv');
const fetch = require('node-fetch');

// 加载环境变量
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// 存储百度 access token
let baiduAccessToken = null;
let tokenExpireTime = 0;

// 获取百度 access token
async function getBaiduAccessToken() {
    try {
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

// 提供配置接口
app.get('/config', async (req, res) => {
    console.log('Config requested. Current config:', {
        hasEndpoint: !!process.env.DEEPSEEK_API_ENDPOINT,
        hasKey: !!process.env.DEEPSEEK_API_KEY,
        endpoint: process.env.DEEPSEEK_API_ENDPOINT
    });

    try {
        // 确保有有效的百度 token
        const accessToken = await ensureValidToken();

        res.json({
            deepseek: {
                apiKey: process.env.DEEPSEEK_API_KEY,
                endpoint: process.env.DEEPSEEK_API_ENDPOINT || 'https://api.deepseek.com/v1/chat/completions'
            },
            baidu: {
                accessToken: accessToken
            }
        });
    } catch (error) {
        console.error('Error in /config endpoint:', error);
        res.status(500).json({
            error: '获取配置失败: ' + error.message
        });
    }
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log('Environment variables loaded:', {
        hasEndpoint: !!process.env.DEEPSEEK_API_ENDPOINT,
        hasKey: !!process.env.DEEPSEEK_API_KEY,
        endpoint: process.env.DEEPSEEK_API_ENDPOINT
    });
}); 