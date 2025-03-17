import { LLMServiceFactory } from './services/llm.js';
import { OCRServiceFactory } from './services/ocr.js';

// 核心接口定义
class ILogger {
    log(level, message, ...args) { throw new Error('Not implemented'); }
    error(message, ...args) { throw new Error('Not implemented'); }
    warn(message, ...args) { throw new Error('Not implemented'); }
    info(message, ...args) { throw new Error('Not implemented'); }
    debug(message, ...args) { throw new Error('Not implemented'); }
}

class IConfigManager {
    get(key) { throw new Error('Not implemented'); }
    validate() { throw new Error('Not implemented'); }
    getLLMConfig() { throw new Error('Not implemented'); }
    getOCRConfig() { throw new Error('Not implemented'); }
}

class IUIManager {
    updateStatus(status, isError) { throw new Error('Not implemented'); }
    updateQuestion(question) { throw new Error('Not implemented'); }
    updateAnswer(answer, isError) { throw new Error('Not implemented'); }
    showProgress() { throw new Error('Not implemented'); }
    hideProgress() { throw new Error('Not implemented'); }
}

// 具体实现
class ConsoleLogger extends ILogger {
    constructor(debug = false) {
        super();
        this.debug = debug;
    }

    log(level, message, ...args) {
        if (level === 'debug' && !this.debug) return;
        console.log(`[${level.toUpperCase()}] ${message}`, ...args);
    }

    error(message, ...args) { this.log('error', message, ...args); }
    warn(message, ...args) { this.log('warn', message, ...args); }
    info(message, ...args) { this.log('info', message, ...args); }
    debug(message, ...args) { this.log('debug', message, ...args); }
}

class ConfigManager extends IConfigManager {
    constructor(config) {
        super();
        this.config = config;
        this.logger = new ConsoleLogger(config.DEBUG);
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

        if (OCR_METHOD === 'baidu' && 
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
                endpoint: SILICONFLOW_API_ENDPOINT,
                specificModel: SILICONFLOW_MODEL
            };
        } else if (LLM_MODEL === 'deepseek') {
            return {
                model: 'deepseek',
                apiKey: DEEPSEEK_API_KEY,
                endpoint: DEEPSEEK_API_ENDPOINT,
                specificModel: DEEPSEEK_MODEL || 'deepseek-chat'
            };
        } else {
            throw new Error(`不支持的 LLM 模型: ${LLM_MODEL}`);
        }
    }

    getOCRConfig() {
        const { OCR_METHOD, BAIDU_OCR_APP_ID, BAIDU_OCR_API_KEY, 
                BAIDU_OCR_SECRET_KEY, OCR_INTERVAL, IMAGE_QUALITY, MAX_IMAGE_SIZE } = this.config;

        return {
            method: OCR_METHOD,
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

class UIManager extends IUIManager {
    constructor(logger) {
        super();
        this.logger = logger;
        this.elements = {
            video: document.getElementById('video'),
            canvas: document.getElementById('canvas'),
            answerContent: document.getElementById('answer-content'),
            statusContent: document.getElementById('status-content'),
            questionContent: document.getElementById('question-content'),
            progressContainer: document.getElementById('progress-container'),
            progressBar: document.getElementById('progress-bar')
        };

        this.ctx = this.elements.canvas?.getContext('2d');
    }

    updateStatus(status, isError = false) {
        this.logger.info(`[状态更新] ${status}`);
        
        if (!this.elements.statusContent) {
            this.logger.error('找不到 status-content 元素');
            return;
        }
        
        this.elements.statusContent.textContent = status;
        this.elements.statusContent.style.color = isError ? 'red' : '#333';
        
        if (status.includes('OCR识别:') || status.includes('简化OCR识别:')) {
            this.showProgress();
            const match = status.match(/(\d+)%/);
            if (match && match[1]) {
                this.updateProgress(parseInt(match[1]));
            }
        } else if (status.includes('正在进行') || status.includes('正在预处理') || status.includes('正在获取')) {
            this.showProgress();
            this.updateProgress(-1);
        } else {
            this.hideProgress();
        }
    }

    showProgress() {
        if (this.elements.progressContainer) {
            this.elements.progressContainer.style.display = 'block';
        }
    }

    hideProgress() {
        if (this.elements.progressContainer) {
            this.elements.progressContainer.style.display = 'none';
            if (this.elements.progressBar) {
                this.elements.progressBar.style.width = '0%';
                this.elements.progressBar.classList.remove('indeterminate');
            }
        }
    }

    updateProgress(percent) {
        if (!this.elements.progressBar) return;
        
        if (percent < 0) {
            this.elements.progressBar.style.width = '100%';
            this.elements.progressBar.classList.add('indeterminate');
        } else {
            this.elements.progressBar.classList.remove('indeterminate');
            this.elements.progressBar.style.width = `${percent}%`;
        }
    }

    updateQuestion(question) {
        this.logger.info(`[问题更新] ${question.substring(0, 50)}${question.length > 50 ? '...' : ''}`);
        
        if (!this.elements.questionContent) {
            this.logger.error('找不到 question-content 元素');
            return;
        }
        
        this.elements.questionContent.textContent = question;
        this.elements.questionContent.style.fontFamily = "'PingFang SC', 'Microsoft YaHei', 'Hiragino Sans GB', 'Heiti SC', sans-serif";
        
        setTimeout(() => {
            this.elements.questionContent.classList.add('highlight');
            setTimeout(() => {
                this.elements.questionContent.classList.remove('highlight');
            }, 500);
        }, 100);
    }

    updateAnswer(answer, isError = false) {
        this.logger.info(`[答案更新] ${answer.substring(0, 50)}${answer.length > 50 ? '...' : ''}`);
        
        if (!this.elements.answerContent) {
            this.logger.error('找不到 answer-content 元素');
            return;
        }
        
        try {
            this.elements.answerContent.innerHTML = answer;
        } catch (e) {
            this.logger.error('更新答案失败:', e);
            this.elements.answerContent.textContent = answer;
        }
        
        this.elements.answerContent.style.color = isError ? 'red' : '#333';
    }
}

// 文本处理工具类
class TextProcessor {
    static similarity(a, b) {
        if (!a || !b) return 0;
        
        const cleanText = (text) => {
            return text.toLowerCase()
                .replace(/[.,!?，。！？\s]+/g, ' ')
                .trim();
        };
        
        const cleanA = cleanText(a);
        const cleanB = cleanText(b);
        
        if (cleanA === cleanB) return 1;
        
        const levenshteinDistance = (str1, str2) => {
            const m = str1.length;
            const n = str2.length;
            const dp = Array(m + 1).fill().map(() => Array(n + 1).fill(0));
            
            for (let i = 0; i <= m; i++) dp[i][0] = i;
            for (let j = 0; j <= n; j++) dp[0][j] = j;
            
            for (let i = 1; i <= m; i++) {
                for (let j = 1; j <= n; j++) {
                    if (str1[i - 1] === str2[j - 1]) {
                        dp[i][j] = dp[i - 1][j - 1];
                    } else {
                        dp[i][j] = Math.min(
                            dp[i - 1][j - 1] + 1,
                            dp[i - 1][j] + 1,
                            dp[i][j - 1] + 1
                        );
                    }
                }
            }
            
            return dp[m][n];
        };
        
        const maxLength = Math.max(cleanA.length, cleanB.length);
        if (maxLength === 0) return 1;
        
        const distance = levenshteinDistance(cleanA, cleanB);
        const editSimilarity = 1 - (distance / maxLength);
        
        const wordsA = cleanA.split(' ').filter(w => w.length > 0);
        const wordsB = cleanB.split(' ').filter(w => w.length > 0);
        
        const commonWords = wordsA.filter(word => wordsB.includes(word));
        const wordSimilarity = wordsA.length && wordsB.length ? 
            (2.0 * commonWords.length) / (wordsA.length + wordsB.length) : 0;
        
        const similarity = (editSimilarity * 0.7) + (wordSimilarity * 0.3);
        
        if (window.DEBUG) {
            console.log('📊 文本相似度详情:', {
                text1: cleanA,
                text2: cleanB,
                editDistance: distance,
                editSimilarity: editSimilarity.toFixed(3),
                commonWords,
                wordSimilarity: wordSimilarity.toFixed(3),
                finalSimilarity: similarity.toFixed(3)
            });
        }
        
        return similarity;
    }
}

// 应用核心类
class Application {
    constructor(config) {
        this.logger = new ConsoleLogger(config.DEBUG);
        this.config = new ConfigManager(config);
        this.ui = new UIManager(this.logger);
        
        this.state = {
            lastProcessTime: 0,
            isProcessing: false,
            frameCount: 0,
            lastRecognizedText: ''
        };
        
        // 绑定方法到实例
        this.processFrame = this.processFrame.bind(this);
    }

    async start() {
        try {
            this.config.validate();
            await this.startCapture();
            requestAnimationFrame(this.processFrame);
        } catch (error) {
            this.logger.error('初始化错误:', error);
            this.ui.updateStatus('❌ 初始化失败: ' + error.message, true);
        }
    }

    async startCapture() {
        try {
            this.ui.updateStatus('🎥 请选择要共享的窗口...');
            const stream = await navigator.mediaDevices.getDisplayMedia({ 
                video: { cursor: "always" },
                audio: false
            });
            
            this.ui.elements.video.srcObject = stream;
            
            this.ui.elements.video.onloadedmetadata = () => {
                this.logger.info('📺 视频流已就绪，开始处理...');
                this.ui.elements.video.play()
                    .then(() => {
                        this.logger.info('▶️ 视频开始播放');
                        this.ui.updateStatus('🔄 开始处理视频流...');
                    })
                    .catch(err => {
                        this.logger.error('❌ 视频播放失败:', err);
                        this.ui.updateStatus('视频播放失败，请刷新页面重试', true);
                    });
            };

            stream.getVideoTracks()[0].onended = () => {
                this.logger.info('⏹️ 屏幕共享已停止');
                this.ui.elements.video.srcObject = null;
                this.ui.updateStatus('屏幕共享已停止，请刷新页面重试', true);
            };
        } catch (err) {
            this.logger.error('❌ 访问屏幕失败:', err);
            if (err.name === 'NotAllowedError') {
                this.ui.updateStatus('未选择共享窗口，请刷新页面重试', true);
            } else {
                this.ui.updateStatus('无法访问屏幕，请确保已授予权限', true);
            }
        }
    }

    async processFrame(currentTime) {
        this.state.frameCount++;
        
        if (!this.ui.elements.video.videoWidth || !this.ui.elements.video.videoHeight) {
            requestAnimationFrame(this.processFrame);
            return;
        }

        const interval = this.config.getOCRConfig().interval;
        if (currentTime - this.state.lastProcessTime < interval || 
            this.state.isProcessing || 
            !this.ui.elements.video.srcObject) {
            requestAnimationFrame(this.processFrame);
            return;
        }

        this.state.isProcessing = true;
        this.state.lastProcessTime = currentTime;

        try {
            this.logger.debug(`🎞️ 处理第 ${this.state.frameCount} 帧`);
            console.time('帧处理');
            
            await this.processVideoFrame();
            
            console.timeEnd('帧处理');
        } catch (err) {
            this.logger.error('❌ 处理帧错误:', err);
            this.ui.updateStatus('❌ 处理图像时出错: ' + err.message, true);
        }

        this.state.isProcessing = false;
        requestAnimationFrame(this.processFrame);
    }

    async processVideoFrame() {
        const { maxImageSize, imageQuality } = this.config.getOCRConfig();
        
        this.ui.elements.canvas.width = Math.min(this.ui.elements.video.videoWidth, maxImageSize);
        this.ui.elements.canvas.height = Math.floor(
            (this.ui.elements.canvas.width * this.ui.elements.video.videoHeight) / 
            this.ui.elements.video.videoWidth
        );
        
        this.ui.ctx.drawImage(
            this.ui.elements.video, 
            0, 
            0, 
            this.ui.elements.canvas.width, 
            this.ui.elements.canvas.height
        );
        
        const base64Image = this.ui.elements.canvas.toDataURL('image/jpeg', imageQuality);
        
        this.ui.updateStatus('🔍 正在识别文字...');
        const recognizedText = await this.ocrService.recognize(base64Image);
        
        if (!recognizedText || recognizedText.length < 10) {
            this.handleShortText(recognizedText);
            return;
        }
        
        const similarity = TextProcessor.similarity(recognizedText, this.state.lastRecognizedText);
        const isNewText = similarity < 0.7 || !this.state.lastRecognizedText;
        
        if (isNewText) {
            await this.handleNewText(recognizedText);
        } else {
            this.logger.debug('⏭️ 文本相似，跳过处理');
            this.ui.updateStatus('✅ 文本未变化，等待新问题...');
        }
    }

    handleShortText(text) {
        if (!text) {
            this.ui.updateStatus('⚠️ 未检测到文字，请确保画面中有清晰的文字');
        } else {
            this.logger.warn('⚠️ 文本太短，跳过处理');
            this.ui.updateStatus('⚠️ 检测到的文本太短，请确保有完整的问题');
            this.ui.updateQuestion(text + ' (文本太短)');
        }
    }

    async handleNewText(text) {
        this.logger.info('📝 检测到新问题');
        this.ui.updateQuestion(text);
        this.ui.updateAnswer('');
        this.ui.updateStatus('🔍 已识别新问题，正在处理...');
        
        this.state.lastRecognizedText = text;
        
        try {
            const answer = await this.llmService.getAnswer(text);
            this.ui.updateStatus('✅ 已获取回答');
            this.ui.updateAnswer(answer);
        } catch (error) {
            this.logger.error('获取答案失败:', error);
            this.ui.updateStatus(`❌ 获取回答失败: ${error.message}`, true);
            this.ui.updateAnswer(`获取回答失败: ${error.message}`, true);
        }
    }
}

// 初始化应用
async function init() {
    try {
        const response = await fetch('/config');
        if (!response.ok) {
            throw new Error('配置加载失败');
        }
        const config = await response.json();
        
        const app = new Application(config);
        app.start();
    } catch (error) {
        console.error('Error loading config:', error);
        document.getElementById('status-content').textContent = '错误：无法加载 API 配置';
    }
}

// 当页面加载完成时启动应用
window.addEventListener('load', init); 