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

// 压缩图片并进行预处理，提高OCR识别率
function compressImage(base64Image) {
    return new Promise((resolve) => {
        console.log('🔄 开始图像预处理...');
        console.time('图像预处理');
        const img = new Image();
        img.onload = () => {
            const tempCanvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const maxSize = 1600; // 进一步增加最大尺寸，提高清晰度

            if (width > height && width > maxSize) {
                height = Math.floor((height * maxSize) / width);
                width = maxSize;
            } else if (height > maxSize) {
                width = Math.floor((width * maxSize) / height);
                height = maxSize;
            }

            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempCtx = tempCanvas.getContext('2d');
            
            // 绘制原始图像
            tempCtx.drawImage(img, 0, 0, width, height);
            
            // 获取图像数据
            const imageData = tempCtx.getImageData(0, 0, width, height);
            const data = imageData.data;
            
            // 图像增强处理 - 自适应二值化
            const grayscale = new Uint8Array(width * height);
            
            // 1. 转换为灰度
            for (let i = 0, j = 0; i < data.length; i += 4, j++) {
                grayscale[j] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            }
            
            // 2. 计算局部区域平均值 (使用简化的自适应阈值)
            const blockSize = 25; // 局部区域大小
            const C = 10; // 常数调整值
            
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = y * width + x;
                    
                    // 计算局部区域
                    let startX = Math.max(0, x - Math.floor(blockSize/2));
                    let endX = Math.min(width - 1, x + Math.floor(blockSize/2));
                    let startY = Math.max(0, y - Math.floor(blockSize/2));
                    let endY = Math.min(height - 1, y + Math.floor(blockSize/2));
                    
                    // 计算局部平均值
                    let sum = 0;
                    let count = 0;
                    
                    // 简化计算 - 只采样部分点
                    for (let sy = startY; sy <= endY; sy += 3) {
                        for (let sx = startX; sx <= endX; sx += 3) {
                            sum += grayscale[sy * width + sx];
                            count++;
                        }
                    }
                    
                    const avgValue = sum / count;
                    
                    // 应用自适应阈值
                    const pixelValue = grayscale[idx];
                    const threshold = avgValue - C;
                    
                    // 设置像素值
                    const pixelIdx = idx * 4;
                    const binaryValue = pixelValue < threshold ? 0 : 255;
                    
                    data[pixelIdx] = binaryValue;     // R
                    data[pixelIdx + 1] = binaryValue; // G
                    data[pixelIdx + 2] = binaryValue; // B
                    // Alpha保持不变
                }
            }
            
            // 3. 锐化处理
            const sharpenData = new Uint8ClampedArray(data);
            const kernel = [
                0, -1, 0,
                -1, 5, -1,
                0, -1, 0
            ];
            
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    for (let c = 0; c < 3; c++) {
                        let sum = 0;
                        for (let ky = -1; ky <= 1; ky++) {
                            for (let kx = -1; kx <= 1; kx++) {
                                const idx = ((y + ky) * width + (x + kx)) * 4 + c;
                                sum += data[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
                            }
                        }
                        sharpenData[(y * width + x) * 4 + c] = Math.min(255, Math.max(0, sum));
                    }
                }
            }
            
            // 将处理后的图像数据放回canvas
            const processedImageData = new ImageData(sharpenData, width, height);
            tempCtx.putImageData(processedImageData, 0, 0);
            
            // 转换为base64
            const result = tempCanvas.toDataURL('image/jpeg', 0.95); // 提高质量
            console.timeEnd('图像预处理');
            console.log(`✅ 图像预处理完成: ${Math.round(result.length / 1024)}KB`);
            resolve(result);
        };
        img.src = base64Image;
    });
}

// 捕获屏幕并开始处理
async function startCapture() {
    try {
        updateStatus('🎥 请选择要共享的窗口...');
        const stream = await navigator.mediaDevices.getDisplayMedia({ 
            video: {
                cursor: "always"
            },
            audio: false
        });
        
        video.srcObject = stream;
        
        video.onloadedmetadata = () => {
            console.log('📺 视频流已就绪，开始处理...');
            video.play().then(() => {
                console.log('▶️ 视频开始播放');
                updateStatus('🔄 开始处理视频流...');
                processFrame(performance.now());
            }).catch(err => {
                console.error('❌ 视频播放失败:', err);
                updateStatus('视频播放失败，请刷新页面重试', true);
            });
        };

        stream.getVideoTracks()[0].onended = () => {
            console.log('⏹️ 屏幕共享已停止');
            video.srcObject = null;
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

// 选择并执行OCR方法
async function recognizeText(base64Image) {
    // 获取OCR方法设置
    const ocrMethod = window.API_CONFIG?.ocrMethod || 'local';
    
    console.log(`使用OCR方法: ${ocrMethod}`);
    
    try {
        if (ocrMethod === 'baidu') {
            // 检查百度OCR配置
            if (!window.API_CONFIG?.baidu?.accessToken) {
                if (window.API_CONFIG?.baidu?.error) {
                    throw new Error(`百度OCR配置错误: ${window.API_CONFIG.baidu.error}`);
                } else {
                    throw new Error('百度OCR未正确配置，将回退到本地OCR');
                }
            }
            return await recognizeTextBaidu(base64Image);
        } else {
            // 默认使用本地OCR
            return await recognizeTextLocal(base64Image);
        }
    } catch (error) {
        console.error(`OCR方法 ${ocrMethod} 失败:`, error);
        
        // 如果百度OCR失败，尝试回退到本地OCR
        if (ocrMethod === 'baidu') {
            console.log('尝试回退到本地OCR...');
            updateStatus('百度OCR失败，尝试使用本地OCR...');
            return await recognizeTextLocal(base64Image);
        }
        
        throw error;
    }
}

// 使用本地 Tesseract.js 进行 OCR
async function recognizeTextLocal(base64Image) {
    try {
        console.log('🔍 开始本地OCR处理...');
        console.time('本地OCR处理');
        
        updateStatus('正在预处理图像...');
        const compressedImage = await compressImage(base64Image);
        
        updateStatus('正在进行本地OCR识别...');
        
        // 多次OCR尝试，使用不同的预处理参数
        try {
            // 添加超时控制
            const controller = new AbortController();
            const signal = controller.signal;
            const timeoutId = setTimeout(() => controller.abort(), 25000); // 25秒超时
            
            // 创建带信号的Promise
            const results = await Promise.all([
                // 尝试1: 标准参数
                recognizeWithParams(compressedImage, {
                    tessedit_pageseg_mode: '6', // 假设单个统一的文本块
                    tessedit_ocr_engine_mode: '2', // 使用LSTM引擎
                    preserve_interword_spaces: '1'
                }, signal),
                
                // 尝试2: 优化中文参数
                recognizeWithParams(compressedImage, {
                    tessedit_pageseg_mode: '3', // 列模式
                    tessedit_ocr_engine_mode: '2',
                    preserve_interword_spaces: '0',
                    textord_heavy_nr: '1'
                }, signal)
            ]).finally(() => clearTimeout(timeoutId));
            
            // 合并结果
            const mergedText = mergeOcrResults(results);
            console.timeEnd('本地OCR处理');
            
            if (!mergedText) {
                console.log('⚠️ 未检测到文字');
                return '';
            }
            
            // 后处理识别文本
            const processedText = postProcessChineseText(mergedText);
            
            console.log('✅ 本地OCR完成:', processedText);
            return processedText;
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('OCR处理超时');
                updateStatus('OCR处理超时，尝试简化处理...');
                
                // 超时后的简化处理 - 只尝试一次识别，使用更简单的参数
                try {
                    const simpleResult = await Tesseract.recognize(
                        compressedImage,
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
                    
                    if (!simpleResult.data || !simpleResult.data.text) {
                        return '';
                    }
                    
                    const processedText = postProcessChineseText(simpleResult.data.text.trim());
                    console.log('✅ 简化OCR完成:', processedText);
                    return processedText;
                } catch (fallbackError) {
                    console.error('简化OCR也失败:', fallbackError);
                    return '';
                }
            } else {
                throw error;
            }
        }
    } catch (err) {
        console.error('❌ 本地OCR错误:', err);
        console.timeEnd('本地OCR处理');
        throw err;
    }
}

// 使用指定参数进行OCR识别
async function recognizeWithParams(image, params, signal) {
    try {
        const result = await Tesseract.recognize(
            image,
            'chi_sim+eng',
            {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        updateStatus(`正在进行本地OCR识别: ${Math.floor(m.progress * 100)}%`);
                    }
                },
                ...params,
                tessjs_create_pdf: '0',
                tessjs_create_hocr: '0',
                tessjs_create_tsv: '0',
                tessjs_create_box: '0',
                tessjs_create_unlv: '0',
                tessjs_create_osd: '0'
            }
        );
        
        // 检查是否已中止
        if (signal && signal.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }
        
        return result.data.text.trim();
    } catch (error) {
        console.error('OCR识别尝试失败:', error);
        return '';
    }
}

// 合并多个OCR结果
function mergeOcrResults(results) {
    // 过滤掉空结果
    const validResults = results.filter(text => text && text.length > 0);
    
    if (validResults.length === 0) {
        return '';
    }
    
    if (validResults.length === 1) {
        return validResults[0];
    }
    
    // 选择最长的结果作为基础
    let bestResult = '';
    let maxLength = 0;
    
    for (const text of validResults) {
        if (text.length > maxLength) {
            maxLength = text.length;
            bestResult = text;
        }
    }
    
    console.log('合并OCR结果:', validResults);
    
    return bestResult;
}

// 中文文本后处理函数
function postProcessChineseText(text) {
    if (!text) return text;
    
    console.log('开始中文文本后处理...');
    
    // 1. 移除多余的空格和换行
    text = text.replace(/\s+/g, ' ').replace(/\n+/g, '\n').trim();
    
    // 2. 修复常见OCR错误
    const commonErrors = {
        '曰': '日', '己': '已', '末': '未', '象': '像', '專': '专',
        '車': '车', '傳': '传', '東': '东', '馬': '马', '個': '个',
        '來': '来', '這': '这', '們': '们', '後': '后', '時': '时',
        '從': '从', '會': '会', '對': '对', '長': '长', '開': '开',
        '問': '问', '題': '题', '號': '号', '説': '说', '話': '话',
        '國': '国', '園': '园', '圖': '图', '書': '书', '壹': '一',
        '貳': '二', '參': '三', '肆': '四', '伍': '五', '陸': '六',
        '柒': '七', '捌': '八', '玖': '九', '拾': '十', '佰': '百',
        '仟': '千', '萬': '万', '億': '亿', '為': '为', '與': '与',
        '產': '产', '務': '务', '學': '学', '實': '实', '發': '发',
        '電': '电', '網': '网', '經': '经', '點': '点', '麼': '么',
        '請': '请', '認': '认', '關': '关', '幾': '几', '樣': '样',
        '當': '当', '讓': '让', '應': '应', '裏': '里', '麗': '丽',
        '無': '无', '處': '处', '體': '体', '還': '还', '兒': '儿',
        '婦': '妇', '見': '见', '觀': '观', '現': '现', '實': '实',
        '過': '过', '內': '内', '幫': '帮', '係': '系', '樂': '乐',
        '極': '极', '權': '权', '壓': '压', '紅': '红', '綠': '绿',
        '藍': '蓝', '紫': '紫', '數': '数', '線': '线', '練': '练',
        '終': '终', '結': '结', '構': '构', '達': '达', '歲': '岁',
        '務': '务', '員': '员', '財': '财', '萌': '萌', '頭': '头',
        '項': '项', '強': '强', '難': '难', '風': '风', '響': '响',
        '響': '响', '響': '响', '響': '响', '響': '响', '響': '响'
    };
    
    // 应用常见错误修复
    for (const [error, correction] of Object.entries(commonErrors)) {
        text = text.replace(new RegExp(error, 'g'), correction);
    }
    
    // 3. 修复标点符号
    text = text
        .replace(/，/g, ',')
        .replace(/。/g, '.')
        .replace(/：/g, ':')
        .replace(/；/g, ';')
        .replace(/！/g, '!')
        .replace(/？/g, '?')
        .replace(/（/g, '(')
        .replace(/）/g, ')')
        .replace(/【/g, '[')
        .replace(/】/g, ']')
        .replace(/《/g, '<')
        .replace(/》/g, '>')
        .replace(/"/g, '"')
        .replace(/"/g, '"')
        .replace(/'/g, '\'')
        .replace(/'/g, '\'');
    
    // 4. 修复数字和字母混淆
    text = text
        .replace(/[oO０]/g, '0')
        .replace(/[lI１]/g, '1')
        .replace(/[zZ２]/g, '2')
        .replace(/３/g, '3')
        .replace(/４/g, '4')
        .replace(/５/g, '5')
        .replace(/６/g, '6')
        .replace(/７/g, '7')
        .replace(/８/g, '8')
        .replace(/９/g, '9');
    
    // 5. 移除非打印字符和特殊符号
    text = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9.,?!;:'"()\[\]{}<>\/\\\s\-_+=@#$%^&*|~`]/g, '');
    
    console.log('中文文本后处理完成');
    return text;
}

// 使用百度 OCR API
async function recognizeTextBaidu(base64Image) {
    try {
        console.log('🔍 开始百度OCR处理...');
        console.time('百度OCR处理');
        
        updateStatus('正在压缩图像...');
        const compressedImage = await compressImage(base64Image);
        const imageData = compressedImage.replace(/^data:image\/(png|jpg|jpeg);base64,/, '');
        
        updateStatus('正在发送百度OCR请求...');
        console.log('📤 发送百度OCR请求...');
        console.time('百度OCR API请求');

        // 添加超时控制
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('百度OCR请求超时')), 10000); // 10秒超时
        });

        // 使用通用文字识别（高精度版）API
        const fetchPromise = fetch('https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic?access_token=' + window.API_CONFIG.baidu.accessToken, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: 'image=' + encodeURIComponent(imageData) + '&language_type=CHN_ENG&detect_direction=true&paragraph=true&probability=true'
        });

        const response = await Promise.race([fetchPromise, timeoutPromise]);
        console.timeEnd('百度OCR API请求');

        if (!response.ok) {
            const errorText = await response.text();
            console.error('百度OCR API错误响应:', errorText);
            throw new Error(`百度OCR API 请求失败: ${response.status}, ${errorText}`);
        }

        const data = await response.json();
        if (data.error_code) {
            console.error('百度OCR API返回错误:', data);
            throw new Error(`百度 OCR 错误: ${data.error_msg} (错误码: ${data.error_code})`);
        }

        if (!data.words_result || data.words_result.length === 0) {
            console.log('⚠️ 未检测到文字');
            console.timeEnd('百度OCR处理');
            return '';
        }

        // 使用段落模式组织文本
        const result = data.words_result.map(item => item.words).join('\n');
        console.log('✅ 百度OCR完成:', result);
        console.timeEnd('百度OCR处理');
        return result;
    } catch (err) {
        console.error('❌ 百度OCR错误:', err);
        console.timeEnd('百度OCR处理');
        throw err;
    }
}

// 重命名函数以反映它现在支持多个LLM
async function callLLMAPI(text) {
    if (!window.API_CONFIG?.hasKey || !window.API_CONFIG?.endpoint) {
        throw new Error('LLM API 配置未找到或不完整');
    }

    try {
        // 获取模型名称用于显示
        const llmModel = window.API_CONFIG.llmModel || 'deepseek';
        let modelDisplayName = llmModel === 'siliconflow' ? 'SiliconFlow' : 'DeepSeek';
        
        // 如果是SiliconFlow，显示具体的模型名称
        if (llmModel === 'siliconflow' && window.API_CONFIG.siliconflowModel) {
            // 提取更友好的模型名称
            const modelParts = window.API_CONFIG.siliconflowModel.split('/');
            if (modelParts.length > 0) {
                const lastPart = modelParts[modelParts.length - 1];
                modelDisplayName = `${modelDisplayName}: ${lastPart}`;
            }
        }
        
        updateStatus(`🤖 正在使用 ${modelDisplayName} 生成回答...`);
        
        console.log('调用 LLM API...', {
            model: window.API_CONFIG.llmModel,
            text: text.substring(0, 100) + (text.length > 100 ? '...' : '')
        });
        
        const endpoint = window.API_CONFIG.endpoint;
        console.log('发送请求到:', endpoint);
        
        // 优化提示词，让回答更简洁，并确保中文处理正确
        const systemPrompt = "你是专业解题助手。请用中文回答，格式必须是：【答案】选项/结果 + 简短解释。不要犹豫，必须给出明确答案。如果是选择题，直接给出正确选项；如果是问答题，给出简洁明确的答案。不要说'我认为'或'可能'等模糊表达。英文问题用英文回答，格式为：【Answer】option/result + brief explanation。";
        
        // 检查文本是否包含中文
        const containsChinese = /[\u4e00-\u9fa5]/.test(text);
        
        // 根据不同的LLM模型设置不同的请求体
        let model = "deepseek-chat";
        if (window.API_CONFIG.llmModel === 'siliconflow') {
            model = window.API_CONFIG.siliconflowModel || "Pro/deepseek-ai/DeepSeek-R1";
        }
        
        const requestBody = {
            model: model,
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: text
                }
            ],
            temperature: 0.5,  // 降低温度，使回答更确定
            max_tokens: 800,
            stream: false
        };
        
        // 只有DeepSeek模型支持response_format
        if (window.API_CONFIG.llmModel === 'deepseek' && containsChinese) {
            requestBody.response_format = { type: "text" };
        }
        
        console.log('请求体:', JSON.stringify({
            ...requestBody,
            messages: requestBody.messages.map(m => ({
                ...m,
                content: m.content.length > 50 ? m.content.substring(0, 50) + '...' : m.content
            }))
        }, null, 2));
        
        // 只尝试一次，减少重复调用
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20秒超时
        
        try {
            const startTime = Date.now();
            updateStatus(`🔄 正在等待 ${modelDisplayName} 响应...`);
            
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ messages: requestBody.messages }),
                signal: controller.signal
            }).finally(() => clearTimeout(timeoutId));
            
            const endTime = Date.now();
            console.log(`API响应时间: ${endTime - startTime}ms`);
            
            console.log('API响应状态:', response.status);
            const responseText = await response.text();
            
            // 只记录响应的前200个字符，避免日志过长
            console.log('API原始响应:', responseText.length > 200 ? 
                responseText.substring(0, 200) + '...' : responseText);
            
            if (!response.ok) {
                let errorMessage;
                try {
                    const errorData = JSON.parse(responseText);
                    errorMessage = errorData.error?.message || `HTTP错误 ${response.status}`;
                } catch (e) {
                    errorMessage = `HTTP错误 ${response.status}: ${responseText}`;
                }
                throw new Error(errorMessage);
            }
            
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                console.error('JSON解析错误:', e);
                throw new Error('无法解析API响应');
            }
            
            if (!data.choices?.[0]?.message?.content) {
                console.error('无效的API响应格式:', data);
                throw new Error('API响应格式无效');
            }
            
            const answer = data.choices[0].message.content;
            console.log(`✅ ${modelDisplayName} 响应成功:`, answer.substring(0, 100) + (answer.length > 100 ? '...' : ''));
            return answer;
        } catch (err) {
            console.error(`❌ ${modelDisplayName} API请求失败:`, err);
            throw err;
        }
    } catch (err) {
        console.error('❌ LLM API错误:', err);
        throw err;
    }
}

// 处理屏幕帧
async function processFrame(currentTime) {
    frameCount++;
    
    if (!video.videoWidth || !video.videoHeight) {
        console.log('⏳ 等待视频就绪...');
        requestAnimationFrame(processFrame);
        return;
    }

    // 增加处理间隔到5秒，减少频繁处理
    if (currentTime - lastProcessTime < 5000) {
        requestAnimationFrame(processFrame);
        return;
    }

    if (isProcessing || !video.srcObject) {
        requestAnimationFrame(processFrame);
        return;
    }

    isProcessing = true;
    lastProcessTime = currentTime;

    try {
        console.log(`🎞️ 处理第 ${frameCount} 帧`);
        console.time('帧处理');
        
        // 优化画布尺寸，提高OCR准确性
        canvas.width = Math.min(video.videoWidth, 1200); // 增加分辨率
        canvas.height = Math.floor((canvas.width * video.videoHeight) / video.videoWidth);
        
        console.log(`📐 视频尺寸: ${video.videoWidth}x${video.videoHeight}`);
        console.log(`📐 Canvas尺寸: ${canvas.width}x${canvas.height}`);
        
        // 绘制视频帧到画布
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // 提高图像质量
        const base64Image = canvas.toDataURL('image/jpeg', 0.8);
        
        updateStatus('🔍 正在识别文字...');
        let recognizedText;
        try {
            recognizedText = await Promise.race([
                recognizeText(base64Image),
                new Promise((_, reject) => setTimeout(() => reject(new Error('OCR处理超时')), 15000)) // 15秒总超时
            ]);
        } catch (ocrError) {
            console.error('OCR处理失败:', ocrError);
            updateStatus(`❌ OCR处理失败: ${ocrError.message}`, true);
            isProcessing = false;
            requestAnimationFrame(processFrame);
            return;
        }

        // 文本预处理：移除多余空格和换行
        if (recognizedText) {
            // 使用专门的中文文本处理函数
            recognizedText = processChineseText(recognizedText);
        }

        if (recognizedText && recognizedText.length > 10) {
            const similarity = textSimilarity(recognizedText, lastRecognizedText);
            console.log('📊 文本相似度:', similarity.toFixed(3));

            // 降低相似度阈值，减少误判为新问题的情况
            const isNewText = similarity < 0.7 || !lastRecognizedText;
            
            // 强制更新计数器
            if (!window.forceUpdateCounter) {
                window.forceUpdateCounter = 0;
            }
            window.forceUpdateCounter++;
            
            // 每30次检查强制更新一次，减少不必要的API调用
            const shouldForceUpdate = window.forceUpdateCounter >= 30;
            
            if (isNewText || shouldForceUpdate) {
                if (shouldForceUpdate) {
                    console.log('🔄 强制更新文本');
                    window.forceUpdateCounter = 0;
                } else {
                    console.log('📝 检测到新问题');
                }
                
                console.log('旧文本:', lastRecognizedText);
                console.log('新文本:', recognizedText);
                
                // 检测到新问题，清空之前的答案
                if (recognizedText !== lastRecognizedText) {
                    clearAnswer();
                    updateQuestion(recognizedText);
                    updateStatus(`🔍 已识别新问题，正在处理...`);
                    // 短暂延迟，让用户看到识别的问题
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                // 先更新lastRecognizedText，防止重复处理
                const previousText = lastRecognizedText;
                lastRecognizedText = recognizedText;
                
                try {
                    // 检查缓存中是否已有答案
                    if (questionCache.has(recognizedText)) {
                        const cachedAnswer = questionCache.get(recognizedText);
                        console.log('🔄 使用缓存的回答');
                        updateStatus('✅ 已获取回答 (缓存)');
                        updateAnswer(cachedAnswer);
                    } else {
                        updateStatus('🤖 正在获取回答...');
                        console.time('AI回答');
                        
                        // 添加20秒超时
                        const answer = await Promise.race([
                            callLLMAPI(recognizedText),
                            new Promise((_, reject) => 
                                setTimeout(() => reject(new Error('获取回答超时(20秒)')), 20000)
                            )
                        ]);
                        
                        console.timeEnd('AI回答');
                        
                        if (answer) {
                            console.log('收到回答:', answer);
                            
                            // 缓存答案
                            questionCache.set(recognizedText, answer);
                            
                            // 更新状态和答案
                            updateStatus('✅ 已获取回答');
                            updateAnswer(answer);
                            
                            // 双重检查 - 确保答案显示
                            setTimeout(() => {
                                console.log('检查答案是否显示...');
                                const answerElement = document.getElementById('answer-content');
                                if (answerElement) {
                                    if (answerElement.innerHTML !== answer && answerElement.textContent !== answer) {
                                        console.warn('答案未正确显示，尝试再次更新');
                                        answerElement.innerHTML = answer;
                                        console.log('已强制更新答案');
                                    } else {
                                        console.log('答案已正确显示');
                                    }
                                } else {
                                    console.error('找不到 answer-content 元素');
                                }
                            }, 500);
                        } else {
                            throw new Error('收到空回答');
                        }
                    }
                } catch (err) {
                    console.error('❌ AI回答错误:', err);
                    updateStatus(`❌ 获取回答失败: ${err.message}`, true);
                    
                    // 如果是API错误，提供更具体的错误信息
                    if (err.message.includes('API') || err.message.includes('token')) {
                        updateAnswer(`获取回答失败: ${err.message}\n\n请检查API配置是否正确，或者API密钥是否有效。`, true);
                    }
                }
            } else {
                console.log('⏭️ 文本相似，跳过处理');
                updateStatus('✅ 文本未变化，等待新问题...');
            }
        } else {
            if (!recognizedText) {
                updateStatus('⚠️ 未检测到文字，请确保画面中有清晰的文字');
                clearQuestion();
            } else {
                console.log('⚠️ 文本太短，跳过处理');
                updateStatus('⚠️ 检测到的文本太短，请确保有完整的问题');
                updateQuestion(recognizedText + ' (文本太短)');
            }
        }
        
        console.timeEnd('帧处理');
    } catch (err) {
        console.error('❌ 处理帧错误:', err);
        updateStatus('❌ 处理图像时出错: ' + err.message, true);
    }

    isProcessing = false;
    requestAnimationFrame(processFrame);
}

// 处理中文文本，优化识别结果
function processChineseText(text) {
    if (!text) return text;
    
    console.log('开始处理识别文本...');
    console.log('原始文本:', text);
    
    // 1. 基本清理
    text = text
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, '\n')
        .trim();
    
    // 2. 移除非打印字符和特殊符号
    text = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9.,?!;:'"()\[\]{}<>\/\\\s\-_+=@#$%^&*|~`]/g, '');
    
    // 3. 修复常见OCR错误
    text = postProcessChineseText(text);
    
    // 4. 智能分段处理
    text = smartParagraphProcessing(text);
    
    console.log('处理后文本:', text);
    return text;
}

// 智能分段处理
function smartParagraphProcessing(text) {
    // 检测是否为问题文本
    const isQuestion = /[?？]/.test(text) || 
                      /^(what|how|why|when|where|which|who|whose|whom|是什么|如何|为什么|什么时候|在哪里|哪一个|谁|谁的)/i.test(text);
    
    // 如果是问题，尝试提取核心问题
    if (isQuestion) {
        // 按句子分割
        const sentences = text.split(/[.。!！?？]/g).filter(s => s.trim().length > 0);
        
        // 找到包含问号的句子或最后一个句子
        const questionSentences = sentences.filter(s => /[?？]/.test(s));
        if (questionSentences.length > 0) {
            // 如果有问号句子，使用它们
            return questionSentences.join(' ').trim();
        } else if (sentences.length > 0) {
            // 否则使用最后一个句子作为问题
            return sentences[sentences.length - 1].trim();
        }
    }
    
    // 如果不是问题或无法提取，返回原文本
    return text;
}

// 初始化应用
async function init() {
    try {
        // 确保 DOM 元素已正确获取
        if (!answerContent) {
            console.log('重新获取 answer-content 元素');
            const newAnswerContent = document.getElementById('answer-content');
            if (newAnswerContent) {
                answerContent = newAnswerContent;
                console.log('已获取 answer-content 元素');
            } else {
                console.error('无法找到 answer-content 元素');
            }
        }
        
        if (!statusContent) {
            console.log('重新获取 status-content 元素');
            const newStatusContent = document.getElementById('status-content');
            if (newStatusContent) {
                statusContent = newStatusContent;
                console.log('已获取 status-content 元素');
            } else {
                console.error('无法找到 status-content 元素');
            }
        }
        
        if (!questionContent) {
            console.log('重新获取 question-content 元素');
            const newQuestionContent = document.getElementById('question-content');
            if (newQuestionContent) {
                questionContent = newQuestionContent;
                console.log('已获取 question-content 元素');
            } else {
                console.error('无法找到 question-content 元素');
            }
        }
        
        // 更新LLM模型信息
        const llmBadge = document.getElementById('llm-badge');
        if (llmBadge) {
            const llmModel = window.API_CONFIG.llmModel || 'deepseek';
            let modelName = llmModel === 'siliconflow' ? 'SiliconFlow' : 'DeepSeek';
            
            // 如果是SiliconFlow，显示具体的模型名称
            if (llmModel === 'siliconflow' && window.API_CONFIG.siliconflowModel) {
                const modelParts = window.API_CONFIG.siliconflowModel.split('/');
                if (modelParts.length > 0) {
                    const lastPart = modelParts[modelParts.length - 1];
                    modelName = `${modelName}: ${lastPart}`;
                }
            }
            
            llmBadge.textContent = `LLM: ${modelName}`;
            llmBadge.title = `完整模型: ${window.API_CONFIG.siliconflowModel || 'deepseek-chat'}`;
            console.log(`使用LLM模型: ${modelName} (${window.API_CONFIG.siliconflowModel || 'deepseek-chat'})`);
        }
        
        // 更新OCR模式
        const ocrBadge = document.getElementById('ocr-badge');
        if (ocrBadge) {
            const ocrMethod = window.API_CONFIG.ocrMethod || 'local';
            ocrBadge.textContent = `OCR: ${ocrMethod === 'local' ? '本地识别' : '百度云识别'}`;
            console.log(`使用OCR模式: ${ocrMethod === 'local' ? '本地识别' : '百度云识别'}`);
        }
        
        // 检查配置
        const checkConfig = () => {
            // 检查LLM API配置
            if (window.API_CONFIG.llmModel === 'siliconflow') {
                if (!window.API_CONFIG.hasKey || !window.API_CONFIG.hasEndpoint) {
                    updateStatus('❌ SiliconFlow API密钥未配置，请检查.env文件', true);
                    return false;
                }
            } else {
                if (!window.API_CONFIG.hasKey || !window.API_CONFIG.hasEndpoint) {
                    updateStatus('❌ DeepSeek API密钥未配置，请检查.env文件', true);
                    return false;
                }
            }
            
            // 检查OCR配置
            const ocrMethod = window.API_CONFIG.ocrMethod || 'local';
            if (ocrMethod === 'baidu' && !window.API_CONFIG.hasBaiduKey) {
                updateStatus('⚠️ 百度OCR未正确配置，将使用本地OCR', true);
            }
            
            return true;
        };
        
        // 检查配置
        if (!checkConfig()) {
            return;
        }
        
        // 开始捕获
        updateStatus('正在准备捕获屏幕...');
        await startCapture();
        
        // 开始处理帧
        requestAnimationFrame(processFrame);
    } catch (err) {
        console.error('初始化错误:', err);
        updateStatus('❌ 初始化失败: ' + err.message, true);
    }
}

// 如果配置已加载，则初始化应用
if (window.API_CONFIG) {
    init();
} else {
    console.error('API配置未加载');
    updateStatus('❌ API配置未加载，请刷新页面重试', true);
} 