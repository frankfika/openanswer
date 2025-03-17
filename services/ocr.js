// 基础 OCR 服务类
class BaseOCRService {
    constructor(config) {
        if (new.target === BaseOCRService) {
            throw new Error('BaseOCRService 不能直接实例化');
        }
        this.config = config;
    }

    async recognize(base64Image) {
        console.log(`🔍 开始${this.getDisplayName()}处理...`);
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
            console.error(`❌ ${this.getDisplayName()}错误:`, error);
            throw error;
        } finally {
            console.timeEnd('OCR处理');
        }
    }

    getDisplayName() {
        return '文字识别';
    }

    async _compressImage(base64Image) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxSize = this.config.MAX_IMAGE_SIZE || 1600;
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
                
                resolve(canvas.toDataURL('image/jpeg', this.config.IMAGE_QUALITY || 0.95));
            };
            img.src = base64Image;
        });
    }

    async _performRecognition(image) {
        throw new Error('_performRecognition 方法必须由子类实现');
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
}

// 本地 OCR 服务
class LocalOCRService extends BaseOCRService {
    getDisplayName() {
        return '本地识别';
    }

    async _performRecognition(image) {
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
                return this._handleTimeout(image);
            }
            throw error;
        }
    }

    async _recognizeWithParams(image, params, signal) {
        try {
            const result = await Tesseract.recognize(
                image,
                'chi_sim+eng',
                {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            this._updateProgress(Math.floor(m.progress * 100));
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

    async _handleTimeout(image) {
        this._updateStatus('OCR处理超时，尝试简化处理...');
        const result = await Tesseract.recognize(
            image,
            'chi_sim+eng',
            {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        this._updateProgress(Math.floor(m.progress * 100));
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

    _updateProgress(percent) {
        window.updateStatus(`OCR识别: ${percent}%`);
    }

    _updateStatus(status) {
        window.updateStatus(status);
    }
}

// 百度 OCR 服务
class BaiduOCRService extends BaseOCRService {
    getDisplayName() {
        return '百度云识别';
    }

    async _performRecognition(image) {
        const imageData = image.replace(/^data:image\/(png|jpg|jpeg);base64,/, '');
        const accessToken = await this._getAccessToken();

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

    async _getAccessToken() {
        const { BAIDU_OCR_API_KEY, BAIDU_OCR_SECRET_KEY } = this.config;
        const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${BAIDU_OCR_API_KEY}&client_secret=${BAIDU_OCR_SECRET_KEY}`;
        
        const response = await fetch(url, { method: 'POST' });
        if (!response.ok) {
            throw new Error('获取百度OCR访问令牌失败');
        }
        
        const data = await response.json();
        return data.access_token;
    }
}

// OCR 服务工厂
class OCRServiceFactory {
    static create(config) {
        const { OCR_METHOD } = config;
        
        switch (OCR_METHOD.toLowerCase()) {
            case 'local':
                return new LocalOCRService(config);
            case 'baidu':
                return new BaiduOCRService(config);
            default:
                throw new Error(`不支持的 OCR 方法: ${OCR_METHOD}`);
        }
    }
}

export { OCRServiceFactory }; 