// 获取 DOM 元素
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const answerContent = document.getElementById('answer-content');
const statusContent = document.getElementById('status-content');
const questionContent = document.getElementById('question-content');

// 状态变量
let lastRecognizedText = '';
let lastProcessTime = 0;
let isProcessing = false;
let currentAnswer = '';
let frameCount = 0;
let currentQuestion = '';

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
    
    // 更新问题
    try {
        questionContent.textContent = question;
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

// 压缩图片
function compressImage(base64Image) {
    return new Promise((resolve) => {
        console.log('🔄 开始压缩图片...');
        console.time('图片压缩');
        const img = new Image();
        img.onload = () => {
            const tempCanvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const maxSize = 800;

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
            tempCtx.drawImage(img, 0, 0, width, height);
            const result = tempCanvas.toDataURL('image/jpeg', 0.6);
            console.timeEnd('图片压缩');
            console.log(`✅ 图片压缩完成: ${Math.round(result.length / 1024)}KB`);
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

// 调用百度 OCR API
async function recognizeText(base64Image) {
    // 获取OCR方法设置
    const ocrMethod = window.API_CONFIG.ocrMethod || 'local';
    
    if (ocrMethod === 'local') {
        return await recognizeTextLocal(base64Image);
    } else {
        return await recognizeTextBaidu(base64Image);
    }
}

// 使用本地 Tesseract.js 进行 OCR
async function recognizeTextLocal(base64Image) {
    try {
        console.log('🔍 开始本地OCR处理...');
        console.time('本地OCR处理');
        
        const compressedImage = await compressImage(base64Image);
        
        // 添加超时控制
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('本地OCR请求超时')), 15000); // 15秒超时
        });
        
        const recognizePromise = Tesseract.recognize(
            compressedImage,
            'chi_sim+eng',
            {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        updateStatus(`正在进行本地OCR识别: ${Math.floor(m.progress * 100)}%`);
                    }
                }
            }
        );
        
        const result = await Promise.race([recognizePromise, timeoutPromise]);
        console.timeEnd('本地OCR处理');
        
        if (!result.data || !result.data.text) {
            console.log('⚠️ 未检测到文字');
            return '';
        }
        
        const text = result.data.text.trim();
        console.log('✅ 本地OCR完成:', text);
        return text;
    } catch (err) {
        console.error('❌ 本地OCR错误:', err);
        console.timeEnd('本地OCR处理');
        throw err;
    }
}

// 使用百度 OCR API
async function recognizeTextBaidu(base64Image) {
    try {
        console.log('🔍 开始百度OCR处理...');
        console.time('百度OCR处理');
        
        const compressedImage = await compressImage(base64Image);
        const imageData = compressedImage.replace(/^data:image\/(png|jpg|jpeg);base64,/, '');
        
        console.log('📤 发送百度OCR请求...');
        console.time('百度OCR API请求');

        // 添加超时控制
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('百度OCR请求超时')), 10000); // 10秒超时
        });

        const fetchPromise = fetch('https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=' + window.API_CONFIG.baidu.accessToken, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: 'image=' + encodeURIComponent(imageData)
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

// 调用 DeepSeek API
async function callDeepSeekAPI(text) {
    if (!window.API_CONFIG?.deepseek?.apiKey) {
        throw new Error('API 配置未找到或不完整');
    }

    try {
        console.log('调用 DeepSeek API...', {
            text: text.substring(0, 100) + (text.length > 100 ? '...' : '')
        });
        
        const endpoint = 'https://api.deepseek.com/v1/chat/completions';
        console.log('发送请求到:', endpoint);
        
        // 优化提示词，让回答更简洁
        const systemPrompt = "你是一个帮助回答问题的助手。请仔细阅读问题并给出准确、简洁的答案。避免不必要的解释和冗长的回复。直接回答问题的核心内容。";
        
        const requestBody = {
            model: "deepseek-chat",
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
        
        console.log('请求体:', JSON.stringify({
            ...requestBody,
            messages: requestBody.messages.map(m => ({
                ...m,
                content: m.content.length > 50 ? m.content.substring(0, 50) + '...' : m.content
            }))
        }, null, 2));
        
        // 只尝试一次，减少重复调用
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000); // 25秒超时
        
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.API_CONFIG.deepseek.apiKey}`,
                    'Accept': 'application/json'
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            }).finally(() => clearTimeout(timeoutId));
            
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
            console.log('✅ DeepSeek响应成功:', answer.substring(0, 100) + (answer.length > 100 ? '...' : ''));
            return answer;
        } catch (err) {
            console.error('❌ DeepSeek API请求失败:', err);
            throw err;
        }
    } catch (err) {
        console.error('❌ DeepSeek API错误:', err);
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

    // 增加处理间隔到4秒，减少频繁处理
    if (currentTime - lastProcessTime < 4000) {
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
            recognizedText = recognizedText
                .replace(/\s+/g, ' ')
                .replace(/\n+/g, '\n')
                .trim();
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
            
            // 每20次检查强制更新一次，减少不必要的API调用
            const shouldForceUpdate = window.forceUpdateCounter >= 20;
            
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
                    updateStatus('🤖 正在获取回答...');
                    console.time('AI回答');
                    
                    // 添加30秒超时
                    const answer = await Promise.race([
                        callDeepSeekAPI(recognizedText),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('获取回答超时(30秒)')), 30000)
                        )
                    ]);
                    
                    console.timeEnd('AI回答');
                    
                    if (answer) {
                        console.log('收到回答:', answer);
                        
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
                } catch (err) {
                    console.error('❌ AI回答错误:', err);
                    updateStatus(`❌ 获取回答失败: ${err.message}`, true);
                    updateAnswer('获取回答时出错，请稍后再试', true);
                    // 不重置文本，避免重复调用API
                    // lastRecognizedText = '';
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
        
        updateStatus('⚙️ 正在初始化...');
        
        if (!window.API_CONFIG?.deepseek?.apiKey) {
            console.log('⏳ 等待DeepSeek API配置加载...');
            await new Promise((resolve) => {
                const checkConfig = () => {
                    if (window.API_CONFIG?.deepseek?.apiKey) {
                        resolve();
                    } else {
                        setTimeout(checkConfig, 100);
                    }
                };
                checkConfig();
            });
        }
        
        // 记录当前使用的OCR方法
        console.log(`当前OCR方法: ${window.API_CONFIG.ocrMethod || 'local'}`);
        
        // 检查百度OCR API是否可用
        if (window.API_CONFIG.ocrMethod === 'baidu' && !window.API_CONFIG?.baidu?.accessToken) {
            console.warn('⚠️ 已选择百度OCR但API未配置，将自动降级到本地OCR');
            window.API_CONFIG.ocrMethod = 'local';
        }

        console.log('✅ API配置已加载');
        updateStatus('🎥 请选择要共享的窗口...');
        await startCapture();
    } catch (err) {
        console.error('❌ 初始化错误:', err);
        updateStatus('❌ 初始化失败: ' + err.message, true);
    }
}

// 启动应用
init(); 