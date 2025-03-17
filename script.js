// Configuration Manager
class ConfigManager {
    constructor() {
        this.config = window.API_CONFIG || {};
    }

    get llmConfig() {
        const model = this.config.llmModel || 'deepseek';
        return {
            model,
            endpoint: this.config.endpoint,
            hasValidConfig: this.config.hasKey && this.config.endpoint,
            modelName: this._getDisplayModelName(model),
            specificModel: model === 'siliconflow' ? this.config.siliconflowModel : 'deepseek-chat'
        };
    }

    get ocrConfig() {
        const method = this.config.ocrMethod || 'local';
        return {
            method,
            hasValidConfig: method === 'local' || (method === 'baidu' && this.config.baidu?.accessToken),
            displayName: method === 'local' ? '本地识别' : '百度云识别'
        };
    }

    _getDisplayModelName(model) {
        if (model === 'siliconflow' && this.config.siliconflowModel) {
            const modelParts = this.config.siliconflowModel.split('/');
            return `SiliconFlow: ${modelParts[modelParts.length - 1]}`;
        }
        return model === 'siliconflow' ? 'SiliconFlow' : 'DeepSeek';
    }

    validateConfigurations() {
        const { llmConfig, ocrConfig } = this;
        
        if (!llmConfig.hasValidConfig) {
            throw new Error(`${llmConfig.model === 'siliconflow' ? 'SiliconFlow' : 'DeepSeek'} API配置未完成`);
        }
        
        if (!ocrConfig.hasValidConfig && ocrConfig.method === 'baidu') {
            console.warn('百度OCR未正确配置，将回退到本地OCR');
            this.config.ocrMethod = 'local';
        }
        
        return true;
    }
}

// Create global config manager instance
const configManager = new ConfigManager();

// OCR Service
class OCRService {
    constructor(configManager) {
        this.configManager = configManager;
    }

    async recognize(base64Image) {
        console.log(`🔍 开始${this.configManager.ocrConfig.displayName}处理...`);
        console.time('OCR处理');

        try {
            const compressedImage = await this._compressImage(base64Image);
            
            const result = await this._performRecognition(compressedImage);
            
            if (!result) {
                console.log('⚠️ 未检测到文字');
                return '';
            }

            const processedText = this._processText(result);
            console.log('✅ OCR完成:', processedText);
            return processedText;
        } catch (error) {
            console.error(`❌ ${this.configManager.ocrConfig.displayName}错误:`, error);
            throw error;
        } finally {
            console.timeEnd('OCR处理');
        }
    }

    async _performRecognition(compressedImage) {
        const { method } = this.configManager.ocrConfig;
        
        if (method === 'baidu') {
            return this._recognizeBaidu(compressedImage);
        }
        return this._recognizeLocal(compressedImage);
    }

    async _recognizeLocal(image) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 25000);

            const results = await Promise.all([
                this._recognizeWithParams(image, {
                    tessedit_pageseg_mode: '6',
                    tessedit_ocr_engine_mode: '2',
                    preserve_interword_spaces: '1'
                }, controller.signal),
                this._recognizeWithParams(image, {
                    tessedit_pageseg_mode: '3',
                    tessedit_ocr_engine_mode: '2',
                    preserve_interword_spaces: '0',
                    textord_heavy_nr: '1'
                }, controller.signal)
            ]).finally(() => clearTimeout(timeoutId));

            return this._mergeResults(results);
        } catch (error) {
            if (error.name === 'AbortError') {
                return this._handleLocalTimeout(image);
            }
            throw error;
        }
    }

    async _recognizeBaidu(image) {
        const imageData = image.replace(/^data:image\/(png|jpg|jpeg);base64,/, '');
        const accessToken = this.configManager.config.baidu.accessToken;

        const response = await fetch(`https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic?access_token=${accessToken}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: `image=${encodeURIComponent(imageData)}&language_type=CHN_ENG&detect_direction=true&paragraph=true&probability=true`
        });

        if (!response.ok) {
            throw new Error(`百度OCR API请求失败: ${response.status}`);
        }

        const data = await response.json();
        if (data.error_code) {
            throw new Error(`百度OCR错误: ${data.error_msg} (${data.error_code})`);
        }

        return data.words_result?.map(item => item.words).join('\n') || '';
    }

    async _recognizeWithParams(image, params, signal) {
        try {
            const result = await Tesseract.recognize(
                image,
                'chi_sim+eng',
                {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            updateStatus(`OCR识别: ${Math.floor(m.progress * 100)}%`);
                        }
                    },
                    ...params
                }
            );

            if (signal?.aborted) {
                throw new DOMException('Aborted', 'AbortError');
            }

            return result.data.text.trim();
        } catch (error) {
            console.error('OCR识别尝试失败:', error);
            return '';
        }
    }

    async _handleLocalTimeout(image) {
        updateStatus('OCR处理超时，尝试简化处理...');
        const result = await Tesseract.recognize(
            image,
            'chi_sim+eng',
            {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        updateStatus(`简化OCR识别: ${Math.floor(m.progress * 100)}%`);
                    }
                },
                tessedit_pageseg_mode: '6',
                tessedit_ocr_engine_mode: '2'
            }
        );
        return result.data?.text?.trim() || '';
    }

    _mergeResults(results) {
        const validResults = results.filter(text => text?.length > 0);
        return validResults.length > 0 ? 
            validResults.reduce((a, b) => a.length > b.length ? a : b) : '';
    }

    _processText(text) {
        if (!text) return text;
        
        text = text.replace(/\s+/g, ' ').replace(/\n+/g, '\n').trim();
        text = this._removeNoise(text);
        text = this._fixCommonErrors(text);
        text = this._extractMainContent(text);
        
        return text;
    }

    _removeNoise(text) {
        return text
            .replace(/[^\u4e00-\u9fa5a-zA-Z0-9.,?!;:'"()\[\]{}<>\/\\\s\-_+=@#$%^&*|~`]/g, '')
            .replace(/([.,?!;:'"()\[\]{}<>\/\\\-_+=@#$%^&*|~`])\1+/g, '$1');
    }

    _fixCommonErrors(text) {
        const corrections = {
            '曰': '日', '己': '已', '末': '未', '象': '像', '專': '专',
            '車': '车', '傳': '传', '東': '东', '馬': '马', '個': '个'
            // ... 其他错误修正
        };
        
        return Object.entries(corrections).reduce(
            (text, [error, correction]) => text.replace(new RegExp(error, 'g'), correction),
            text
        );
    }

    _extractMainContent(text) {
        const questionPatterns = [
            /[?？]/,
            /^(what|how|why|when|where|which|who|whose|whom|是什么|如何|为什么|什么时候|在哪里|哪一个|谁|谁的|请问|解释|计算|求|证明|分析|比较|评价|讨论|列举|概述|总结)/i
        ];

        if (questionPatterns.some(pattern => pattern.test(text))) {
            const sentences = text.split(/[.。!！?？]/g).filter(s => s.trim());
            const questionSentences = sentences.filter(s => /[?？]/.test(s));
            
            return questionSentences.length > 0 ? 
                questionSentences.join(' ').trim() : 
                sentences[sentences.length - 1]?.trim() || text;
        }

        return text;
    }

    async _compressImage(base64Image) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxSize = 1600;
                let { width, height } = img;

                if (width > height && width > maxSize) {
                    height = Math.floor((height * maxSize) / width);
                    width = maxSize;
                } else if (height > maxSize) {
                    width = Math.floor((width * maxSize) / height);
                    height = maxSize;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                resolve(canvas.toDataURL('image/jpeg', 0.95));
            };
            img.src = base64Image;
        });
    }
}

// Create global OCR service instance
const ocrService = new OCRService(configManager);

// LLM Service
class LLMService {
    constructor(configManager) {
        this.configManager = configManager;
        this.questionCache = new Map();
    }

    async getAnswer(text) {
        const { llmConfig } = this.configManager;
        
        // 检查缓存
        if (this.questionCache.has(text)) {
            console.log('🔄 使用缓存的回答');
            return this.questionCache.get(text);
        }

        try {
            updateStatus(`🤖 正在使用 ${llmConfig.modelName} 生成回答...`);
            
            const systemPrompt = "你是专业解题助手。请注意：输入文本可能包含OCR识别错误、乱码或无关文字，请智能识别核心问题并忽略干扰内容。回答格式必须是：【答案】选项/结果 + 简短解释。不要犹豫，必须给出明确答案。如果是选择题，直接给出正确选项；如果是问答题，给出简洁明确的答案。不要说'我认为'或'可能'等模糊表达。英文问题用英文回答，格式为：【Answer】option/result + brief explanation。";
            
            const requestBody = {
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: text }
                ]
            };

            const response = await this._makeRequest(requestBody);
            const answer = response.choices[0].message.content;

            // 缓存答案
            this.questionCache.set(text, answer);

            return answer;
        } catch (error) {
            console.error('❌ LLM API错误:', error);
            throw error;
        }
    }

    async _makeRequest(requestBody) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
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

// Create global LLM service instance
const llmService = new LLMService(configManager);

// 获取 DOM 元素
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const answerContent = document.getElementById('answer-content');
const statusContent = document.getElementById('status-content');
const questionContent = document.getElementById('question-content');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');

// 状态变量
let lastRecognizedText = '';
let lastProcessTime = 0;
let isProcessing = false;
let currentAnswer = '';
let frameCount = 0;
let currentQuestion = '';

// 添加问题缓存，避免重复请求
const questionCache = new Map();

// 更新状态显示
function updateStatus(status, isError = false) {
    console.log(`[状态更新] ${status}`);
    
    // 确保 DOM 元素存在
    if (!statusContent) {
        console.error('找不到 status-content 元素');
        // 尝试重新获取元素
        const newStatusContent = document.getElementById('status-content');
        if (newStatusContent) {
            console.log('重新获取到 status-content 元素');
            statusContent = newStatusContent;
        } else {
            console.error('无法找到 status-content 元素');
            return;
        }
    }
    
    // 更新状态
    try {
        statusContent.textContent = status;
    } catch (e) {
        console.error('更新状态失败:', e);
    }
    
    if (isError) {
        statusContent.style.color = 'red';
    } else {
        statusContent.style.color = '#333';
    }
    
    // 处理进度条显示
    if (status.includes('OCR识别:') || status.includes('简化OCR识别:')) {
        showProgressBar();
        const match = status.match(/(\d+)%/);
        if (match && match[1]) {
            updateProgressBar(parseInt(match[1]));
        }
    } else if (status.includes('正在进行') || status.includes('正在预处理') || status.includes('正在获取')) {
        showProgressBar();
        // 不确定进度时显示动画
        updateProgressBar(-1);
    } else {
        hideProgressBar();
    }
}

// 显示进度条
function showProgressBar() {
    if (progressContainer) {
        progressContainer.style.display = 'block';
    }
}

// 隐藏进度条
function hideProgressBar() {
    if (progressContainer) {
        progressContainer.style.display = 'none';
        // 重置进度
        if (progressBar) {
            progressBar.style.width = '0%';
            progressBar.classList.remove('indeterminate');
        }
    }
}

// 更新进度条
function updateProgressBar(percent) {
    if (!progressBar) return;
    
    if (percent < 0) {
        // 不确定进度时显示动画
        progressBar.style.width = '100%';
        progressBar.classList.add('indeterminate');
    } else {
        // 确定进度时显示百分比
        progressBar.classList.remove('indeterminate');
        progressBar.style.width = `${percent}%`;
    }
}

// 更新问题显示
function updateQuestion(question) {
    console.log(`[问题更新] ${question.substring(0, 50)}${question.length > 50 ? '...' : ''}`);
    currentQuestion = question;
    
    // 确保 DOM 元素存在
    if (!questionContent) {
        console.error('找不到 question-content 元素');
        // 尝试重新获取元素
        const newQuestionContent = document.getElementById('question-content');
        if (newQuestionContent) {
            console.log('重新获取到 question-content 元素');
            questionContent = newQuestionContent;
        } else {
            console.error('无法找到 question-content 元素');
            return;
        }
    }
    
    // 更新问题，确保中文正确显示
    try {
        // 使用textContent而不是innerHTML，避免XSS风险
        questionContent.textContent = question;
        
        // 设置字体和编码，确保中文正确显示
        questionContent.style.fontFamily = "'PingFang SC', 'Microsoft YaHei', 'Hiragino Sans GB', 'Heiti SC', sans-serif";
        
        // 添加高亮效果
        setTimeout(() => {
            questionContent.classList.add('highlight');
            setTimeout(() => {
                questionContent.classList.remove('highlight');
            }, 500);
        }, 100);
    } catch (e) {
        console.error('更新问题失败:', e);
    }
}

// 清空问题
function clearQuestion() {
    console.log('清空问题');
    currentQuestion = '';
    if (questionContent) {
        questionContent.textContent = '';
    }
}

// 更新答案显示
function updateAnswer(answer, isError = false) {
    console.log(`[答案更新] ${answer.substring(0, 50)}${answer.length > 50 ? '...' : ''}`);
    currentAnswer = answer;
    
    // 确保 DOM 元素存在
    if (!answerContent) {
        console.error('找不到 answer-content 元素');
        // 尝试重新获取元素
        const newAnswerContent = document.getElementById('answer-content');
        if (newAnswerContent) {
            console.log('重新获取到 answer-content 元素');
            answerContent = newAnswerContent;
        } else {
            console.error('无法找到 answer-content 元素');
            return;
        }
    }
    
    // 更新答案
    try {
        answerContent.innerHTML = answer;
    } catch (e) {
        console.error('更新答案失败:', e);
        try {
            answerContent.textContent = answer;
        } catch (e2) {
            console.error('textContent 更新也失败:', e2);
        }
    }
    
    if (isError) {
        answerContent.style.color = 'red';
    } else {
        answerContent.style.color = '#333';
    }
}

// 清空答案
function clearAnswer() {
    console.log('清空答案');
    currentAnswer = '';
    if (answerContent) {
        answerContent.innerHTML = '';
    }
}

// 文本相似度检查
function textSimilarity(a, b) {
    if (!a || !b) return 0;
    
    // 清理和标准化文本
    const cleanText = (text) => {
        return text.toLowerCase()
            .replace(/[.,!?，。！？\s]+/g, ' ')
            .trim();
    };
    
    const cleanA = cleanText(a);
    const cleanB = cleanText(b);
    
    // 如果完全相同
    if (cleanA === cleanB) return 1;
    
    // 计算编辑距离（Levenshtein距离）
    function levenshteinDistance(str1, str2) {
        const m = str1.length;
        const n = str2.length;
        
        // 创建距离矩阵
        const dp = Array(m + 1).fill().map(() => Array(n + 1).fill(0));
        
        // 初始化第一行和第一列
        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;
        
        // 填充矩阵
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (str1[i - 1] === str2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1];
                } else {
                    dp[i][j] = Math.min(
                        dp[i - 1][j - 1] + 1, // 替换
                        dp[i - 1][j] + 1,     // 删除
                        dp[i][j - 1] + 1      // 插入
                    );
                }
            }
        }
        
        return dp[m][n];
    }
    
    // 计算相似度
    const maxLength = Math.max(cleanA.length, cleanB.length);
    if (maxLength === 0) return 1; // 两个空字符串视为完全相同
    
    const distance = levenshteinDistance(cleanA, cleanB);
    const editSimilarity = 1 - (distance / maxLength);
    
    // 分词比较
    const wordsA = cleanA.split(' ').filter(w => w.length > 0);
    const wordsB = cleanB.split(' ').filter(w => w.length > 0);
    
    // 计算共同词的数量
    const commonWords = wordsA.filter(word => wordsB.includes(word));
    const wordSimilarity = wordsA.length && wordsB.length ? 
        (2.0 * commonWords.length) / (wordsA.length + wordsB.length) : 0;
    
    // 综合两种相似度，编辑距离权重更高
    const similarity = (editSimilarity * 0.7) + (wordSimilarity * 0.3);
    
    console.log('📊 文本相似度详情:', {
        text1: cleanA,
        text2: cleanB,
        editDistance: distance,
        editSimilarity: editSimilarity.toFixed(3),
        commonWords,
        wordSimilarity: wordSimilarity.toFixed(3),
        finalSimilarity: similarity.toFixed(3)
    });
    
    return similarity;
}

// Application Class
class Application {
    constructor(configManager, ocrService, llmService) {
        this.configManager = configManager;
        this.ocrService = ocrService;
        this.llmService = llmService;
        
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.lastProcessTime = 0;
        this.isProcessing = false;
        this.frameCount = 0;
        this.lastRecognizedText = '';
        
        this.initializeUI();
    }

    initializeUI() {
        const { llmConfig, ocrConfig } = this.configManager;
        
        // 更新LLM模型信息
        const llmBadge = document.getElementById('llm-badge');
        if (llmBadge) {
            llmBadge.textContent = `LLM: ${llmConfig.modelName}`;
            llmBadge.title = `完整模型: ${llmConfig.specificModel}`;
        }
        
        // 更新OCR模式
        const ocrBadge = document.getElementById('ocr-badge');
        if (ocrBadge) {
            ocrBadge.textContent = `OCR: ${ocrConfig.displayName}`;
        }
    }

    async start() {
        try {
            this.configManager.validateConfigurations();
            await this.startCapture();
            requestAnimationFrame(this.processFrame.bind(this));
        } catch (error) {
            console.error('初始化错误:', error);
            updateStatus('❌ 初始化失败: ' + error.message, true);
        }
    }

    async startCapture() {
    try {
        updateStatus('🎥 请选择要共享的窗口...');
        const stream = await navigator.mediaDevices.getDisplayMedia({ 
                video: { cursor: "always" },
            audio: false
        });
        
            this.video.srcObject = stream;
        
            this.video.onloadedmetadata = () => {
            console.log('📺 视频流已就绪，开始处理...');
                this.video.play()
                    .then(() => {
                console.log('▶️ 视频开始播放');
                updateStatus('🔄 开始处理视频流...');
                    })
                    .catch(err => {
                console.error('❌ 视频播放失败:', err);
                updateStatus('视频播放失败，请刷新页面重试', true);
            });
        };

        stream.getVideoTracks()[0].onended = () => {
            console.log('⏹️ 屏幕共享已停止');
                this.video.srcObject = null;
            updateStatus('屏幕共享已停止，请刷新页面重试', true);
        };
    } catch (err) {
        console.error('❌ 访问屏幕失败:', err);
        if (err.name === 'NotAllowedError') {
            updateStatus('未选择共享窗口，请刷新页面重试', true);
        } else {
            updateStatus('无法访问屏幕，请确保已授予权限', true);
        }
    }
}

    async processFrame(currentTime) {
        this.frameCount++;
        
        if (!this.video.videoWidth || !this.video.videoHeight) {
            requestAnimationFrame(this.processFrame.bind(this));
        return;
    }

        if (currentTime - this.lastProcessTime < 5000 || this.isProcessing || !this.video.srcObject) {
            requestAnimationFrame(this.processFrame.bind(this));
        return;
    }

        this.isProcessing = true;
        this.lastProcessTime = currentTime;

        try {
            console.log(`🎞️ 处理第 ${this.frameCount} 帧`);
        console.time('帧处理');
        
            await this.processVideoFrame();
            
            console.timeEnd('帧处理');
        } catch (err) {
            console.error('❌ 处理帧错误:', err);
            updateStatus('❌ 处理图像时出错: ' + err.message, true);
        }

        this.isProcessing = false;
        requestAnimationFrame(this.processFrame.bind(this));
    }

    async processVideoFrame() {
        // 设置画布尺寸
        this.canvas.width = Math.min(this.video.videoWidth, 1200);
        this.canvas.height = Math.floor((this.canvas.width * this.video.videoHeight) / this.video.videoWidth);
        
        // 绘制视频帧
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        const base64Image = this.canvas.toDataURL('image/jpeg', 0.8);
        
        // OCR识别
        updateStatus('🔍 正在识别文字...');
        const recognizedText = await this.ocrService.recognize(base64Image);
        
        if (!recognizedText || recognizedText.length < 10) {
            this.handleShortText(recognizedText);
            return;
        }
        
        // 检查文本相似度
        const similarity = textSimilarity(recognizedText, this.lastRecognizedText);
        const isNewText = similarity < 0.7 || !this.lastRecognizedText;
        
        if (isNewText) {
            await this.handleNewText(recognizedText);
            } else {
                console.log('⏭️ 文本相似，跳过处理');
                updateStatus('✅ 文本未变化，等待新问题...');
            }
    }

    handleShortText(text) {
        if (!text) {
                updateStatus('⚠️ 未检测到文字，请确保画面中有清晰的文字');
                clearQuestion();
            } else {
                console.log('⚠️ 文本太短，跳过处理');
                updateStatus('⚠️ 检测到的文本太短，请确保有完整的问题');
            updateQuestion(text + ' (文本太短)');
        }
    }

    async handleNewText(text) {
        console.log('📝 检测到新问题');
        clearAnswer();
        updateQuestion(text);
        updateStatus('🔍 已识别新问题，正在处理...');
        
        this.lastRecognizedText = text;
        
        try {
            const answer = await this.llmService.getAnswer(text);
            updateStatus('✅ 已获取回答');
            updateAnswer(answer);
        } catch (error) {
            console.error('获取答案失败:', error);
            updateStatus(`❌ 获取回答失败: ${error.message}`, true);
            updateAnswer(`获取回答失败: ${error.message}`, true);
        }
    }
}

// Initialize application
function init() {
    if (!window.API_CONFIG) {
        console.error('API配置未加载');
        updateStatus('❌ API配置未加载，请刷新页面重试', true);
            return;
        }
        
    const app = new Application(configManager, ocrService, llmService);
    app.start();
}

// Start the application when configuration is loaded
if (window.API_CONFIG) {
    init();
} else {
    console.error('API配置未加载');
    updateStatus('❌ API配置未加载，请刷新页面重试', true);
} 