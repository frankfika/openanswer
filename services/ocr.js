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
        throw new Error('子类必须实现_performRecognition方法');
    }

    _processText(text) {
        if (!text) return '';
        
        let result = text;
        // 先去除噪声
        result = this._removeNoise(result);
        // 修复常见OCR错误
        result = this._fixCommonErrors(result);
        // 提取主要内容
        result = this._extractMainContent(result);
        
        return result;
    }

    _removeNoise(text) {
        // 去除多余的空格和换行
        return text.replace(/\s+/g, ' ').trim();
    }

    _fixCommonErrors(text) {
        // 修复常见的OCR错误
        return text
            .replace(/[oO](\d+)/g, (_, p1) => `0${p1}`) // 将o0, O0等错误修复
            .replace(/l(\d+)/g, (_, p1) => `1${p1}`)    // 将l1错误修复
            .replace(/[,，]\s*/g, '，')                  // 标准化中文逗号
            .replace(/[.．。]\s*/g, '。');               // 标准化中文句号
    }
    
    _extractMainContent(text) {
        // 提取主要内容
        // 例如去除页眉页脚等无关内容
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
            const timeoutId = setTimeout(() => controller.abort(), 20000);

            console.log('开始本地OCR识别...');
            
            // 简化为单一任务的OCR识别
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
                    tessedit_ocr_engine_mode: '2',
                    preserve_interword_spaces: '1'
                }
            ).finally(() => clearTimeout(timeoutId));
            
            return result.data.text?.trim() || '';
        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn('本地OCR识别超时');
                return this._handleTimeout(image);
            }
            console.error('本地OCR识别出错:', error);
            throw error;
        }
    }

    async _handleTimeout(image) {
        console.log('OCR处理超时，尝试简化处理...');
        this._updateStatus('OCR处理超时，尝试简化处理...');
        
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
                    tessedit_pageseg_mode: '3',
                    tessedit_ocr_engine_mode: '2'
                }
            );
            
            return result.data?.text?.trim() || '';
        } catch (error) {
            console.error('简化OCR处理失败:', error);
            return '';
        }
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
    constructor(config) {
        super(config);
        this.accessToken = null;
        this.tokenExpireTime = 0;
        
        console.log('创建BaiduOCRService实例，百度API密钥:', {
            BAIDU_API_KEY: this.config.BAIDU_OCR_API_KEY ? '已设置' : '未设置',
            BAIDU_SECRET_KEY: this.config.BAIDU_OCR_SECRET_KEY ? '已设置' : '未设置',
            baidu: this.config.baidu ? {
                apiKey: this.config.baidu.apiKey ? '已设置' : '未设置',
                secretKey: this.config.baidu.secretKey ? '已设置' : '未设置'
            } : '未设置'
        });
    }

    getDisplayName() {
        return '百度云识别';
    }

    async _performRecognition(image) {
        console.log('开始百度OCR识别...');
        if (typeof window.updateStatus === 'function') {
            window.updateStatus('调用百度OCR API...');
        }
        
        try {
            const imageData = image.replace(/^data:image\/(png|jpg|jpeg);base64,/, '');
            
            // 尝试从服务器获取access token
            let accessToken = await this._getOrFetchAccessToken();
            console.log('已获取百度AccessToken');
    
            // 尝试调用百度OCR API
            let response = await this._callBaiduOcrApi(imageData, accessToken);
            
            // 处理响应
            return this._processResponse(response);
        } catch (error) {
            console.error('百度OCR识别失败:', error);
            throw error;
        }
    }
    
    async _callBaiduOcrApi(imageData, accessToken) {
        console.log('调用百度OCR API...');
        
        const response = await fetch(`https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic?access_token=${accessToken}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: `image=${encodeURIComponent(imageData)}&language_type=CHN_ENG&detect_direction=true&paragraph=true&probability=true`
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`百度OCR API请求失败: ${response.status}`, errorText);
            throw new Error(`百度OCR API请求失败: ${response.status} - ${errorText}`);
        }

        return await response.json();
    }
    
    _processResponse(data) {
        if (data.error_code) {
            console.error(`百度OCR错误:`, data);
            throw new Error(`百度OCR错误: ${data.error_msg} (${data.error_code})`);
        }

        const result = data.words_result?.map(item => item.words).join('\n') || '';
        console.log(`百度OCR识别成功，识别到 ${data.words_result?.length || 0} 个文本块`);
        return result;
    }

    async _getOrFetchAccessToken() {
        // 首先检查本地是否有有效的token
        if (this.accessToken && Date.now() < this.tokenExpireTime) {
            console.log('使用缓存的AccessToken');
            return this.accessToken;
        }
        
        try {
            // 尝试从服务器API获取token
            console.log('从服务器获取AccessToken...');
            const response = await fetch('/baidu-token');
            
            if (response.ok) {
                const data = await response.json();
                if (data.access_token) {
                    console.log('从服务器获取AccessToken成功');
                    this.accessToken = data.access_token;
                    // Token有效期通常为30天，设置为29天以确保安全
                    this.tokenExpireTime = Date.now() + 29 * 24 * 60 * 60 * 1000;
                    return this.accessToken;
                }
            }
            
            // 如果服务器无法提供token，则尝试本地获取
            return await this._getAccessToken();
        } catch (error) {
            console.warn('从服务器获取AccessToken失败，尝试本地获取:', error);
            return await this._getAccessToken();
        }
    }

    async _getAccessToken() {
        try {
            // 支持不同格式的配置
            const apiKey = this.config.BAIDU_OCR_API_KEY || this.config.BAIDU_API_KEY || 
                          (this.config.baidu && this.config.baidu.apiKey);
            const secretKey = this.config.BAIDU_OCR_SECRET_KEY || this.config.BAIDU_SECRET_KEY || 
                            (this.config.baidu && this.config.baidu.secretKey);
                            
            if (!apiKey || !secretKey) {
                console.error('未配置百度OCR API密钥', this.config);
                throw new Error('未配置百度OCR API密钥');
            }
                            
            console.log(`获取百度AccessToken, API Key: ${apiKey.substring(0, 4)}...`);
            const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`;
            
            const response = await fetch(url, { method: 'POST' });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`获取百度OCR访问令牌失败: ${response.status}`, errorText);
                throw new Error(`获取百度OCR访问令牌失败: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            console.log('成功获取百度AccessToken');
            
            // 保存token和过期时间
            this.accessToken = data.access_token;
            // Token有效期通常为30天，设置为29天以确保安全
            this.tokenExpireTime = Date.now() + 29 * 24 * 60 * 60 * 1000;
            
            return data.access_token;
        } catch (error) {
            console.error('获取百度AccessToken失败:', error);
            throw error;
        }
    }
}

// 混合 OCR 服务 - 先用本地图像对比，检测到变化再调用百度 OCR
class HybridOCRService extends BaseOCRService {
    constructor(config) {
        super(config);
        this.localService = new LocalOCRService(config);
        this.baiduService = new BaiduOCRService(config);
        this.lastImageData = null;
        this.lastRecognizedText = '';
        
        // 验证配置，确保有API密钥
        const apiKey = config.BAIDU_OCR_API_KEY || config.BAIDU_API_KEY || 
                     (config.baidu && config.baidu.apiKey);
        const secretKey = config.BAIDU_OCR_SECRET_KEY || config.BAIDU_SECRET_KEY || 
                        (config.baidu && config.baidu.secretKey);
        
        console.log('创建HybridOCRService实例，百度API密钥:', {
            apiKey: apiKey ? apiKey.substring(0, 4) + '...' : '未设置',
            secretKey: secretKey ? '已设置' : '未设置'
        });
    }

    getDisplayName() {
        return '混合识别';
    }

    async recognize(base64Image) {
        console.log(`🔍 开始${this.getDisplayName()}处理...`);
        console.time('OCR处理');

        try {
            const compressedImage = await this._compressImage(base64Image);
            
            // 更新状态提示
            if (typeof window.updateStatus === 'function') {
                window.updateStatus('检查图像变化...');
            }
            
            // 检查图像是否发生变化
            try {
                const hasChanged = await this._hasImageChanged(compressedImage);
                
                if (!hasChanged && this.lastRecognizedText) {
                    console.log('📷 图像无明显变化，使用缓存结果');
                    console.timeEnd('OCR处理');
                    if (typeof window.updateStatus === 'function') {
                        window.updateStatus('图像无变化，使用缓存结果');
                    }
                    return this.lastRecognizedText;
                }
            } catch (compareError) {
                console.warn('图像比较过程出错，将继续处理:', compareError);
            }
            
            // 图像发生变化，直接调用百度OCR
            console.log('📡 检测到图像变化，调用百度OCR识别...');
            if (typeof window.updateStatus === 'function') {
                window.updateStatus('图像已变化，调用百度OCR...');
            }
            
            try {
                // 调用百度OCR进行识别
                const result = await this.baiduService._performRecognition(compressedImage);
                
                if (!result) {
                    // 百度OCR失败，尝试本地OCR作为备选
                    console.log('⚠️ 百度OCR未检测到文字，尝试本地OCR...');
                    if (typeof window.updateStatus === 'function') {
                        window.updateStatus('百度OCR失败，尝试本地OCR...');
                    }
                    
                    const localResult = await this.localService._performRecognition(compressedImage);
                    const processedText = this._processText(localResult || '');
                    this.lastRecognizedText = processedText;
                    return processedText;
                }
    
                const processedText = this._processText(result);
                this.lastRecognizedText = processedText;
                console.log('✅ OCR完成:', processedText.substring(0, 50) + (processedText.length > 50 ? '...' : ''));
                return processedText;
            } catch (error) {
                console.error('百度OCR识别失败，尝试本地OCR:', error);
                
                if (typeof window.updateStatus === 'function') {
                    window.updateStatus('百度OCR失败，使用本地OCR...');
                }
                
                // 百度OCR失败，尝试本地OCR
                const localResult = await this.localService._performRecognition(compressedImage);
                const processedText = this._processText(localResult || '');
                this.lastRecognizedText = processedText;
                return processedText;
            }
        } catch (error) {
            console.error(`❌ ${this.getDisplayName()}错误:`, error);
            if (typeof window.updateStatus === 'function') {
                window.updateStatus(`OCR错误: ${error.message}`);
            }
            throw error;
        } finally {
            console.timeEnd('OCR处理');
        }
    }

    async _performRecognition(image) {
        // 实际的识别在recognize方法中处理
        return '';
    }

    async _hasImageChanged(newImageData) {
        try {
            if (!this.lastImageData) {
                // 第一次运行，保存图像并返回true
                this.lastImageData = newImageData;
                console.log('首次运行，记录图像数据');
                return true;
            }
    
            // 计算图像差异
            const difference = await this._calculateImageDifference(this.lastImageData, newImageData);
            console.log(`📊 图像差异度: ${(difference * 100).toFixed(2)}%`);
            
            // 即使没有检测到差异，也定期强制更新（每5次检查至少更新一次）
            if (!this._checkCounter) this._checkCounter = 0;
            this._checkCounter++;
            
            if (this._checkCounter >= 5) {
                this._checkCounter = 0;
                console.log('📸 已到强制更新间隔，主动触发OCR识别');
                // 更新最后的图像数据
                this.lastImageData = newImageData;
                return true;
            }
            
            // 更新最后的图像数据
            this.lastImageData = newImageData;
            
            // 使用标准阈值1%，更稳定的文本检测
            const threshold = 0.01; // 1% 的差异阈值，平衡性能和检测灵敏度
            const hasChanged = difference > threshold;
            
            // 添加更简洁的日志
            console.log(`📊 图像变化检测: 差异=${(difference * 100).toFixed(2)}%, 阈值=${(threshold * 100).toFixed(2)}%, 结果=${hasChanged ? '有变化' : '无变化'}`);
            
            return hasChanged;
        } catch (error) {
            console.error('图像比较失败:', error);
            // 发生错误时，认为图像已更改，以确保能获取新的OCR结果
            return true;
        }
    }

    async _calculateImageDifference(image1, image2) {
        return new Promise((resolve, reject) => {
            try {
                const img1 = new Image();
                const img2 = new Image();
                
                let loadedImages = 0;
                let hasError = false;
                
                const onError = (e) => {
                    console.error('图像加载失败:', e);
                    if (!hasError) {
                        hasError = true;
                        reject(new Error('图像加载失败'));
                    }
                };
                
                const onLoad = () => {
                    loadedImages++;
                    if (loadedImages === 2 && !hasError) {
                        try {
                            // 两张图片都加载完毕
                            const canvas1 = document.createElement('canvas');
                            const canvas2 = document.createElement('canvas');
                            // 降低比较分辨率以提高性能
                            const size = 48;
                            
                            canvas1.width = canvas2.width = size;
                            canvas1.height = canvas2.height = size;
                            
                            const ctx1 = canvas1.getContext('2d');
                            const ctx2 = canvas2.getContext('2d');
                            
                            // 绘制图像
                            ctx1.drawImage(img1, 0, 0, size, size);
                            ctx2.drawImage(img2, 0, 0, size, size);
                            
                            // 获取像素数据
                            const data1 = ctx1.getImageData(0, 0, size, size).data;
                            const data2 = ctx2.getImageData(0, 0, size, size).data;
                            
                            // 计算差异 (简化像素比较，每4个像素采样一次)
                            let diffCount = 0;
                            let totalPixels = size * size;
                            
                            for (let i = 0; i < totalPixels * 4; i += 16) {
                                // 计算RGB通道的差异
                                const diffR = Math.abs(data1[i] - data2[i]);
                                const diffG = Math.abs(data1[i + 1] - data2[i + 1]);
                                const diffB = Math.abs(data1[i + 2] - data2[i + 2]);
                                
                                // 使用标准阈值10进行像素比较
                                if (diffR > 10 || diffG > 10 || diffB > 10) {
                                    diffCount++;
                                }
                            }
                            
                            // 调整差异比例计算
                            const difference = diffCount / (totalPixels / 4);
                            
                            // 简化调试日志
                            if (window.DEBUG) {
                                console.log(`🔍 图像比较: 大小=${size}x${size}, 差异率=${(difference*100).toFixed(2)}%`);
                            }
                            
                            resolve(difference);
                        } catch (err) {
                            console.error('图像处理失败:', err);
                            reject(err);
                        }
                    }
                };
                
                img1.onload = onLoad;
                img2.onload = onLoad;
                img1.onerror = onError;
                img2.onerror = onError;
                
                // 设置一个超时，以防图像加载挂起
                const timeout = setTimeout(() => {
                    if (loadedImages < 2) {
                        reject(new Error('图像加载超时'));
                    }
                }, 3000);
                
                // 清除超时
                const clearTimeoutAndResolve = (value) => {
                    clearTimeout(timeout);
                    resolve(value);
                };
                
                img1.src = image1;
                img2.src = image2;
                
                // 添加安全措施，如果5秒后仍无结果，则假设图像有变化
                setTimeout(() => {
                    if (loadedImages < 2) {
                        clearTimeout(timeout);
                        console.warn('图像比较超时，假设图像已更改');
                        resolve(1.0); // 假设100%不同
                    }
                }, 5000);
            } catch (error) {
                console.error('图像比较过程发生错误:', error);
                reject(error);
            }
        });
    }
}

// OCR 服务工厂
class OCRServiceFactory {
    static create(config) {
        const method = config.method || 'local';
        
        switch (method.toLowerCase()) {
            case 'local':
                return new LocalOCRService(config);
            case 'baidu':
                // 当选择百度OCR时，返回混合OCR服务，先进行本地图像比较
                return new HybridOCRService(config);
            default:
                throw new Error(`不支持的 OCR 方法: ${method}`);
        }
    }
}

// 导出简化版OCR服务
class OCRService {
    constructor(logger) {
        this.service = null;
        this.logger = logger || {
            info: console.log,
            error: console.error,
            warn: console.warn,
            debug: console.log  // 添加兼容性的debug方法
        };
        this.config = null;
        
        // 记录构造时间，方便调试
        this.createTime = new Date().toISOString();
        console.log(`[${this.createTime}] 创建OCRService实例`);
    }
    
    async recognize(base64Image) {
        console.log(`OCRService.recognize被调用，服务状态:`, {
            serviceInitialized: !!this.service,
            config: !!this.config,
            tesseractAvailable: !!window.Tesseract
        });
        
        // 检查Tesseract是否可用
        if (!window.Tesseract) {
            this.logger.warn('Tesseract库未加载，使用模拟OCR');
            return this._mockRecognize(base64Image);
        }
        
        // 延迟初始化服务，确保配置已加载
        try {
            if (!this.service) {
                this._initService();
            }
            
            return await this.service.recognize(base64Image);
        } catch (error) {
            this.logger.error('OCR识别失败，使用模拟OCR:', error);
            return this._mockRecognize(base64Image);
        }
    }
    
    _initService() {
        console.log('初始化OCR服务...');
        
        // 获取配置
        try {
            if (window.app && window.app.config) {
                console.log('从app.config获取OCR配置');
                this.config = window.app.config.getOCRConfig();
                console.log('获取到OCR配置:', this.config);
            } else {
                console.log('无法从app.config获取配置，使用默认配置');
                // 在浏览器环境中使用默认配置
                this.config = {
                    method: 'local',
                    MAX_IMAGE_SIZE: 1600,
                    IMAGE_QUALITY: 0.8
                };
                
                // 尝试从服务器获取配置
                this._fetchConfigFromServer()
                    .then(config => {
                        if (config) {
                            console.log('从服务器获取配置成功:', config);
                            this.config = config;
                            // 重新创建服务
                            try {
                                this.service = OCRServiceFactory.create(this.config);
                                console.log(`使用服务器配置重新创建OCR服务: ${this.service.getDisplayName()}`);
                                this._setupHelperMethods();
                            } catch (error) {
                                console.error('使用服务器配置创建OCR服务失败:', error);
                            }
                        }
                    })
                    .catch(error => {
                        console.error('从服务器获取配置失败:', error);
                    });
            }
            
            // 使用工厂创建合适的OCR服务
            try {
                this.service = OCRServiceFactory.create(this.config);
                console.log(`成功创建OCR服务: ${this.service.getDisplayName()}`);
                
                // 修复_updateProgress和_updateStatus方法
                this._setupHelperMethods();
                
                return true;
            } catch (error) {
                this.logger.error('创建OCR服务失败，使用本地服务:', error);
                this.service = new LocalOCRService(this.config);
                
                // 修复_updateProgress和_updateStatus方法
                this._setupHelperMethods();
                
                return false;
            }
        } catch (error) {
            this.logger.error('初始化OCR服务失败:', error);
            // 创建一个默认的本地服务
            this.service = new LocalOCRService({
                MAX_IMAGE_SIZE: 1600,
                IMAGE_QUALITY: 0.8
            });
            
            // 修复_updateProgress和_updateStatus方法
            this._setupHelperMethods();
            
            return false;
        }
    }
    
    // 从服务器获取配置
    async _fetchConfigFromServer() {
        try {
            const response = await fetch('/config');
            if (!response.ok) {
                throw new Error(`获取配置失败: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('获取服务器配置失败:', error);
            return null;
        }
    }
    
    _setupHelperMethods() {
        // 修复_updateProgress和_updateStatus方法
        this.service._updateProgress = (percent) => {
            if (this.logger && typeof this.logger.info === 'function') {
                this.logger.info(`OCR识别: ${percent}%`);
            } else {
                console.log(`OCR识别: ${percent}%`);
            }
            
            // 如果window.updateStatus存在，调用它
            if (typeof window.updateStatus === 'function') {
                window.updateStatus(`OCR识别: ${percent}%`);
            }
        };
        
        this.service._updateStatus = (status) => {
            if (this.logger && typeof this.logger.info === 'function') {
                this.logger.info(status);
            } else {
                console.log(status);
            }
            
            // 如果window.updateStatus存在，调用它
            if (typeof window.updateStatus === 'function') {
                window.updateStatus(status);
            }
        };
    }
    
    // 模拟OCR识别，用于Tesseract不可用时
    _mockRecognize(base64Image) {
        // 模拟OCR处理延迟
        return new Promise(resolve => {
            if (typeof window.updateStatus === 'function') {
                window.updateStatus('模拟OCR识别中...');
            }
            
            setTimeout(() => {
                // 返回一个示例文本
                resolve('这是一个示例问题。请在屏幕上显示实际需要识别的文字。');
            }, 1000);
        });
    }
}

export { OCRServiceFactory, OCRService }; 