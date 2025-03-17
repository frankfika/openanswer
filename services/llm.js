// 基础 LLM 服务类
class BaseLLMService {
    constructor(config) {
        if (new.target === BaseLLMService) {
            throw new Error('BaseLLMService 不能直接实例化');
        }
        this.config = config;
        this.questionCache = new Map();
    }

    async getAnswer(text) {
        if (this.questionCache.has(text)) {
            console.log('🔄 使用缓存的回答');
            return this.questionCache.get(text);
        }

        try {
            const answer = await this._generateAnswer(text);
            this.questionCache.set(text, answer);
            return answer;
        } catch (error) {
            console.error('❌ LLM API错误:', error);
            throw error;
        }
    }

    _getSystemPrompt() {
        return `你是专业解题助手。请注意：
1. 输入文本可能包含OCR识别错误、乱码或无关文字，请智能识别核心问题并忽略干扰内容
2. 回答格式必须是：【答案】选项/结果 + 简短解释
3. 不要犹豫，必须给出明确答案
4. 如果是选择题，直接给出正确选项
5. 如果是问答题，给出简洁明确的答案
6. 不要说'我认为'或'可能'等模糊表达
7. 英文问题用英文回答，格式为：【Answer】option/result + brief explanation`;
    }

    async _generateAnswer(text) {
        throw new Error('_generateAnswer 方法必须由子类实现');
    }

    async _makeRequest(endpoint, requestBody, apiKey) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API请求失败: ${response.status}, ${errorText}`);
            }

            return await response.json();
        } finally {
            clearTimeout(timeoutId);
        }
    }
}

// SiliconFlow 实现
class SiliconFlowService extends BaseLLMService {
    async _generateAnswer(text) {
        const { SILICONFLOW_API_KEY, SILICONFLOW_API_ENDPOINT, SILICONFLOW_MODEL } = this.config;
        
        const requestBody = {
            model: SILICONFLOW_MODEL,
            messages: [
                { role: "system", content: this._getSystemPrompt() },
                { role: "user", content: text }
            ]
        };

        const response = await this._makeRequest(
            SILICONFLOW_API_ENDPOINT,
            requestBody,
            SILICONFLOW_API_KEY
        );

        return response.choices[0].message.content;
    }
}

// DeepSeek 实现
class DeepSeekService extends BaseLLMService {
    async _generateAnswer(text) {
        const { DEEPSEEK_API_KEY, DEEPSEEK_API_ENDPOINT } = this.config;
        
        const requestBody = {
            model: "deepseek-chat",
            messages: [
                { role: "system", content: this._getSystemPrompt() },
                { role: "user", content: text }
            ]
        };

        const response = await this._makeRequest(
            DEEPSEEK_API_ENDPOINT,
            requestBody,
            DEEPSEEK_API_KEY
        );

        return response.choices[0].message.content;
    }
}

// LLM 服务工厂
class LLMServiceFactory {
    static create(config) {
        const { LLM_MODEL } = config;
        
        switch (LLM_MODEL.toLowerCase()) {
            case 'siliconflow':
                return new SiliconFlowService(config);
            case 'deepseek':
                return new DeepSeekService(config);
            default:
                throw new Error(`不支持的 LLM 模型: ${LLM_MODEL}`);
        }
    }
}

export { LLMServiceFactory }; 