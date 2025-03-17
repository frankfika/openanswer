export class UIManager {
    constructor(logger) {
        this.logger = logger || console;
        
        // 获取UI元素
        this.elements = {
            video: document.getElementById('video'),
            canvas: document.getElementById('canvas'),
            questionContent: document.getElementById('question-content'),
            answerContent: document.getElementById('answer-content'),
            statusContent: document.getElementById('status-content'),
            progressContainer: document.getElementById('progress-container'),
            progressBar: document.getElementById('progress-bar'),
            llmBadge: document.getElementById('llm-badge'),
            ocrBadge: document.getElementById('ocr-badge'),
            debugInfo: document.getElementById('debug-info')
        };
        
        // 如果找不到video或canvas元素，记录错误并创建它们
        if (!this.elements.video) {
            this.logger.error?.('找不到video元素，将创建一个') || console.error('找不到video元素，将创建一个');
            this._createVideoElement();
        }
        
        if (!this.elements.canvas) {
            this.logger.error?.('找不到canvas元素，将创建一个') || console.error('找不到canvas元素，将创建一个');
            this._createCanvasElement();
        }
        
        this.ctx = this.elements.canvas?.getContext('2d');
    }
    
    // 创建视频元素
    _createVideoElement() {
        const video = document.createElement('video');
        video.id = 'video';
        video.autoplay = true;
        video.muted = true;
        video.playsinline = true;
        video.style.width = '100%';
        video.style.borderRadius = '0.5rem';
        video.style.background = 'var(--bg-secondary)';
        video.style.maxHeight = '70vh';
        video.style.objectFit = 'contain';
        video.style.transform = 'translateY(-30px)'; // 进一步向上移动视频
        
        // 查找视频容器
        const container = document.querySelector('.video-container');
        if (container) {
            const h2 = container.querySelector('h2');
            if (h2) {
                // 减小标题大小
                h2.style.fontSize = '0.9rem';
                h2.style.marginBottom = '0.2rem';
                container.insertBefore(video, h2.nextSibling);
            } else {
                container.appendChild(video);
            }
            
            // 调整容器样式
            container.style.paddingBottom = '0.25rem';
            container.style.paddingTop = '0.5rem';
        } else {
            document.body.appendChild(video);
        }
        
        this.elements.video = video;
    }
    
    // 创建画布元素
    _createCanvasElement() {
        const canvas = document.createElement('canvas');
        canvas.id = 'canvas';
        canvas.style.display = 'none';
        
        document.body.appendChild(canvas);
        this.elements.canvas = canvas;
    }

    init() {
        // 初始化UI元素
        this.elements.questionContent.textContent = '等待识别...';
        this.elements.answerContent.textContent = '等待回答...';
        this.elements.statusContent.textContent = '准备就绪';
    }

    updateQuestion(question) {
        const text = question || '未识别到文字';
        
        if (!this.elements.questionContent) {
            this.logger.error?.('找不到 question-content 元素') || console.error('找不到 question-content 元素');
            return;
        }
        
        this.elements.questionContent.textContent = text;
        this.elements.questionContent.style.fontFamily = "'PingFang SC', 'Microsoft YaHei', 'Hiragino Sans GB', 'Heiti SC', sans-serif";
        
        setTimeout(() => {
            this.elements.questionContent.classList.add('highlight');
            setTimeout(() => {
                this.elements.questionContent.classList.remove('highlight');
            }, 500);
        }, 100);
    }

    updateAnswer(answer, isError = false) {
        if (!this.elements.answerContent) {
            this.logger.error?.('找不到 answer-content 元素') || console.error('找不到 answer-content 元素');
            return;
        }
        
        try {
            this.elements.answerContent.innerHTML = answer || '正在思考...';
        } catch (e) {
            this.logger.error?.('更新答案失败:', e) || console.error('更新答案失败:', e);
            this.elements.answerContent.textContent = answer || '正在思考...';
        }
        
        this.elements.answerContent.style.color = isError ? 'red' : '#333';
    }

    updateStatus(status, isError = false) {
        if (!this.elements.statusContent) {
            this.logger.error?.('找不到 status-content 元素') || console.error('找不到 status-content 元素');
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

    highlightContent() {
        this.elements.questionContent?.classList.add('highlight');
        this.elements.answerContent?.classList.add('highlight');
        
        setTimeout(() => {
            this.elements.questionContent?.classList.remove('highlight');
            this.elements.answerContent?.classList.remove('highlight');
        }, 1000);
    }

    updateConfigBadges(config) {
        // 更新LLM配置
        if (!this.elements.llmBadge || !this.elements.ocrBadge) return;
        
        const llmModel = config.llmModel || 'deepseek';
        let modelName = llmModel === 'siliconflow' ? 'SiliconFlow' : 'DeepSeek';
        
        if (llmModel === 'siliconflow' && config.siliconflowModel) {
            const modelParts = config.siliconflowModel.split('/');
            if (modelParts.length > 0) {
                const lastPart = modelParts[modelParts.length - 1];
                modelName = `${modelName}: ${lastPart}`;
            }
        }
        
        this.elements.llmBadge.querySelector('span').textContent = `LLM: ${modelName}`;
        
        // 更新OCR配置
        const ocrMethod = config.ocrMethod || 'local';
        this.elements.ocrBadge.querySelector('span').textContent = `OCR: ${ocrMethod === 'local' ? '本地识别' : '百度云识别'}`;
    }

    showDebugInfo(message) {
        if (this.elements.debugInfo) {
            this.elements.debugInfo.textContent = message;
            this.elements.debugInfo.style.display = 'block';
        }
    }

    hideDebugInfo() {
        if (this.elements.debugInfo) {
            this.elements.debugInfo.style.display = 'none';
        }
    }
} 