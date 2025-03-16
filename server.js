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

// 提供配置接口
app.get('/config', async (req, res) => {
    // 确定OCR方法
    const ocrMethod = process.env.OCR_METHOD || 'local';
    
    console.log('Config requested. Current config:', {
        hasEndpoint: !!process.env.DEEPSEEK_API_ENDPOINT,
        hasKey: !!process.env.DEEPSEEK_API_KEY,
        endpoint: process.env.DEEPSEEK_API_ENDPOINT,
        hasBaiduKey: !!process.env.BAIDU_API_KEY,
        hasBaiduSecret: !!process.env.BAIDU_SECRET_KEY,
        ocrMethod: ocrMethod
    });

    try {
        // 检查DeepSeek API配置
        if (!process.env.DEEPSEEK_API_KEY) {
            return res.status(400).json({
                error: '未配置DeepSeek API密钥，请在.env文件中设置DEEPSEEK_API_KEY'
            });
        }
        
        let baiduAccessToken = null;
        let baiduError = null;
        
        // 如果使用百度OCR，则获取token
        if (ocrMethod === 'baidu') {
            if (!process.env.BAIDU_API_KEY || !process.env.BAIDU_SECRET_KEY) {
                baiduError = '未配置百度OCR API密钥，但OCR_METHOD设置为baidu。请在.env文件中设置BAIDU_API_KEY和BAIDU_SECRET_KEY，或将OCR_METHOD改为local';
                console.warn(baiduError);
            } else {
                try {
                    baiduAccessToken = await ensureValidToken();
                } catch (error) {
                    baiduError = `无法获取百度访问令牌: ${error.message}`;
                    console.warn(baiduError);
                }
            }
        }

        res.json({
            deepseek: {
                apiKey: process.env.DEEPSEEK_API_KEY,
                endpoint: process.env.DEEPSEEK_API_ENDPOINT || 'https://api.deepseek.com/v1/chat/completions'
            },
            baidu: {
                accessToken: baiduAccessToken,
                error: baiduError
            },
            ocrMethod: ocrMethod
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
        endpoint: process.env.DEEPSEEK_API_ENDPOINT,
        ocrMethod: process.env.OCR_METHOD || 'local'
    });
}); 