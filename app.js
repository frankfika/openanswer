import { LLMServiceFactory } from './services/llm.js';
import { OCRServiceFactory } from './services/ocr.js';
import { UIManager } from './ui.js';
import TextProcessor from './text-processor.js';
import { OCRService } from './services/ocr.js';
import { LLMService } from './services/llm.js';
import { ConfigManager } from './config.js';

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

// 应用核心类
class Application {
    constructor(config) {
        console.log('初始化Application...');
        this.logger = new ConsoleLogger(config.DEBUG);
        this.config = new ConfigManager(config);
        this.ui = new UIManager(this.logger);
        this.textProcessor = new TextProcessor();
        
        // 先设置为全局变量，以便服务初始化时能获取配置
        window.app = this;
        
        // 初始化服务
        this.ocrService = new OCRService(this.logger);
        this.llmService = new LLMService(this.logger);
        
        this.state = {
            lastProcessTime: 0,
            isProcessing: false,
            frameCount: 0,
            lastRecognizedText: ''
        };
        
        // 绑定方法到实例
        this.processFrame = this.processFrame.bind(this);
        
        console.log('Application初始化完成');
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
                video: { 
                    cursor: "always",
                    displaySurface: "window" // 优先选择窗口而不是整个屏幕
                },
                audio: false
            });
            
            this.ui.elements.video.srcObject = stream;
            
            // 调整视频元素样式
            this.ui.elements.video.style.maxHeight = '70vh';
            this.ui.elements.video.style.objectFit = 'contain';
            
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
            this.logger.info(`🎞️ 处理第 ${this.state.frameCount} 帧`);
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
        
        try {
            // 添加OCR超时处理
            const recognizePromise = this.ocrService.recognize(base64Image);
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('OCR识别超时')), 10000);
            });
            
            // 使用Promise.race来实现超时处理
            const recognizedText = await Promise.race([recognizePromise, timeoutPromise]);
            
            if (!recognizedText || recognizedText.length < 10) {
                this.handleShortText(recognizedText);
                return;
            }
            
            const similarity = TextProcessor.similarity(recognizedText, this.state.lastRecognizedText);
            console.log(`文本相似度: ${(similarity * 100).toFixed(2)}%, 原文本: "${this.state.lastRecognizedText.substring(0, 20)}...", 新文本: "${recognizedText.substring(0, 20)}..."`);
            
            // 将相似度阈值从0.6降低到0.4，极大提高文本变化敏感度
            const isNewText = similarity < 0.4 || !this.state.lastRecognizedText;
            
            if (isNewText) {
                await this.handleNewText(recognizedText);
            } else {
                this.logger.info('⏭️ 文本相似，跳过处理');
                this.ui.updateStatus('✅ 文本未变化，等待新问题...');
            }
        } catch (error) {
            this.logger.error('OCR识别失败:', error);
            
            // 如果是OCR超时，显示特定消息
            if (error.message === 'OCR识别超时') {
                this.ui.updateStatus('⏱️ OCR识别超时，将在下一帧重试...');
            } else {
                this.ui.updateStatus(`❌ OCR识别失败: ${error.message}`);
            }
            
            // 等待一秒钟后继续处理下一帧
            await new Promise(resolve => setTimeout(resolve, 1000));
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
        // 尝试从服务器获取配置
        let config;
        try {
            const response = await fetch('/config');
            if (response.ok) {
                config = await response.json();
                console.log('从服务器加载配置成功:', config);
            } else {
                throw new Error('无法从服务器获取配置');
            }
        } catch (err) {
            console.warn('无法从服务器获取配置，使用默认配置:', err);
            // 使用硬编码的配置作为备份
            config = {
                LLM_MODEL: process.env.LLM_MODEL || 'siliconflow',
                OCR_METHOD: process.env.OCR_METHOD || 'local',
                OCR_INTERVAL: parseInt(process.env.OCR_INTERVAL || '5000'),
                IMAGE_QUALITY: parseFloat(process.env.IMAGE_QUALITY || '0.8'),
                MAX_IMAGE_SIZE: parseInt(process.env.MAX_IMAGE_SIZE || '1600'),
                DEBUG: process.env.DEBUG === 'true',
                SILICONFLOW_API_KEY: process.env.SILICONFLOW_API_KEY || 'sk-xslmjbepeyaybceopnrnndvgpicchzmldfsszminyjubkdnk',
                SILICONFLOW_API_ENDPOINT: process.env.SILICONFLOW_API_ENDPOINT || 'https://api.siliconflow.cn/v1/chat/completions',
                SILICONFLOW_MODEL: process.env.SILICONFLOW_MODEL || 'internlm/internlm2_5-20b-chat',
                DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || 'sk-f8614f81212040d8bba9205c2022eee2',
                DEEPSEEK_API_ENDPOINT: process.env.DEEPSEEK_API_ENDPOINT || 'https://api.deepseek.com/v1/chat/completions',
                DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL || 'deepseek-reasoner',
                // 百度OCR配置
                BAIDU_API_KEY: process.env.BAIDU_API_KEY || '',
                BAIDU_SECRET_KEY: process.env.BAIDU_SECRET_KEY || '',
                FORCE_VALIDATE_BAIDU: false,
                // 添加空的百度OCR配置，但不强制验证
                BAIDU_OCR_APP_ID: '',
                BAIDU_OCR_API_KEY: '',
                BAIDU_OCR_SECRET_KEY: '',
            };
        }
        
        // 将 updateStatus 函数绑定到全局对象，以便从其他组件访问
        window.updateStatus = function(status) {
            const statusEl = document.getElementById('status-content');
            if (statusEl) {
                statusEl.textContent = status;
            }
        };
        
        // 打印配置信息
        console.log('应用配置:', {
            LLM_MODEL: config.LLM_MODEL,
            OCR_METHOD: config.OCR_METHOD,
            SILICONFLOW_API_KEY: config.SILICONFLOW_API_KEY ? '已设置' : '未设置',
            DEEPSEEK_API_KEY: config.DEEPSEEK_API_KEY ? '已设置' : '未设置'
        });
        
        const app = new Application(config);
        // 将应用实例设置为全局变量，以便其他组件访问
        window.app = app;
        app.start();
    } catch (error) {
        console.error('初始化错误:', error);
        document.getElementById('status-content').textContent = '错误：应用初始化失败 - ' + error.message;
    }
}

// 当页面加载完成时启动应用
window.addEventListener('load', init); 