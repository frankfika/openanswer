// 尝试从.env文件加载配置
let envConfig = {};

try {
    // 如果在浏览器环境中，尝试从服务器获取配置
    if (typeof window !== 'undefined') {
        // 浏览器环境下的默认配置
        envConfig = {
            LLM_MODEL: 'siliconflow',
            OCR_METHOD: 'local',
            OCR_INTERVAL: 5000,
            IMAGE_QUALITY: 0.8,
            MAX_IMAGE_SIZE: 1600,
            DEBUG: false,
            SILICONFLOW_API_KEY: 'sk-xslmjbepeyaybceopnrnndvgpicchzmldfsszminyjubkdnk',
            SILICONFLOW_API_ENDPOINT: 'https://api.siliconflow.cn/v1/chat/completions',
            SILICONFLOW_MODEL: 'internlm/internlm2_5-20b-chat',
            DEEPSEEK_API_KEY: 'sk-f8614f81212040d8bba9205c2022eee2',
            DEEPSEEK_API_ENDPOINT: 'https://api.deepseek.com/v1/chat/completions',
            DEEPSEEK_MODEL: 'deepseek-reasoner'
        };
    }
} catch (error) {
    console.error('加载配置失败:', error);
}

// 配置管理器类
export class ConfigManager {
    constructor(config) {
        this.config = config || envConfig;
        this.logger = console;
    }

    get(key) {
        return this.config[key];
    }

    validate() {
        const { LLM_MODEL, OCR_METHOD } = this.config;
        
        if (!LLM_MODEL) {
            throw new Error('LLM_MODEL 未配置');
        }

        if (LLM_MODEL === 'siliconflow' && !this.config.SILICONFLOW_API_KEY) {
            throw new Error('SiliconFlow API Key 未配置');
        }

        if (LLM_MODEL === 'deepseek' && !this.config.DEEPSEEK_API_KEY) {
            throw new Error('DeepSeek API Key 未配置');
        }

        // 只有当OCR方法为百度且实际需要使用百度OCR时才验证百度配置
        if (OCR_METHOD === 'baidu' && 
            this.config.FORCE_VALIDATE_BAIDU &&
            (!this.config.BAIDU_OCR_APP_ID || 
             !this.config.BAIDU_OCR_API_KEY || 
             !this.config.BAIDU_OCR_SECRET_KEY)) {
            throw new Error('百度 OCR 配置不完整');
        }

        return true;
    }

    getLLMConfig() {
        const { LLM_MODEL, SILICONFLOW_API_KEY, SILICONFLOW_API_ENDPOINT, 
                SILICONFLOW_MODEL, DEEPSEEK_API_KEY, DEEPSEEK_API_ENDPOINT,
                DEEPSEEK_MODEL } = this.config;

        if (LLM_MODEL === 'siliconflow') {
            return {
                model: 'siliconflow',
                apiKey: SILICONFLOW_API_KEY,
                endpoint: SILICONFLOW_API_ENDPOINT || 'https://api.siliconflow.cn/v1/chat/completions',
                specificModel: SILICONFLOW_MODEL || 'internlm/internlm2_5-20b-chat'
            };
        } else if (LLM_MODEL === 'deepseek') {
            return {
                model: 'deepseek',
                apiKey: DEEPSEEK_API_KEY,
                endpoint: DEEPSEEK_API_ENDPOINT || 'https://api.deepseek.com/v1/chat/completions',
                specificModel: DEEPSEEK_MODEL || 'deepseek-reasoner'
            };
        } else {
            throw new Error(`不支持的 LLM 模型: ${LLM_MODEL}`);
        }
    }

    getOCRConfig() {
        const { OCR_METHOD, BAIDU_OCR_APP_ID, BAIDU_OCR_API_KEY, 
                BAIDU_OCR_SECRET_KEY, OCR_INTERVAL, IMAGE_QUALITY, MAX_IMAGE_SIZE } = this.config;

        return {
            method: OCR_METHOD || 'local',
            interval: OCR_INTERVAL || 5000,
            imageQuality: IMAGE_QUALITY || 0.8,
            maxImageSize: MAX_IMAGE_SIZE || 1600,
            baidu: OCR_METHOD === 'baidu' ? {
                appId: BAIDU_OCR_APP_ID,
                apiKey: BAIDU_OCR_API_KEY,
                secretKey: BAIDU_OCR_SECRET_KEY
            } : null
        };
    }
}

export default envConfig; 