// 文本处理工具类
class TextProcessor {
    constructor() {
        this.questions = [];
        this.currentQuestion = null;
        this.answers = [];
    }

    // 处理OCR文本
    processOCRText(text) {
        // 清理文本
        text = this.cleanText(text);
        
        // 提取问题
        const questions = this.extractQuestions(text);
        if (questions.length > 0) {
            this.questions = questions;
            this.currentQuestion = questions[0];
        }
        
        // 提取答案
        const answers = this.extractAnswers(text);
        if (answers.length > 0) {
            this.answers = answers;
        }
        
        return {
            questions: this.questions,
            currentQuestion: this.currentQuestion,
            answers: this.answers
        };
    }

    // 清理文本
    cleanText(text) {
        return text
            .replace(/\s+/g, ' ')  // 合并多个空格
            .replace(/[^\S\r\n]+/g, ' ')  // 合并多个空白字符
            .trim();
    }

    // 提取问题
    extractQuestions(text) {
        const questions = [];
        const questionPatterns = [
            /(\d+\.\s*[^。？]+[。？])/g,  // 匹配数字编号的问题
            /([^。？]+[。？])/g  // 匹配任何以句号或问号结尾的句子
        ];

        for (const pattern of questionPatterns) {
            const matches = text.match(pattern);
            if (matches) {
                questions.push(...matches.map(q => q.trim()));
            }
        }

        return [...new Set(questions)];  // 去重
    }

    // 提取答案
    extractAnswers(text) {
        const answers = [];
        const answerPatterns = [
            /答[：:]\s*([^。]+[。])/g,  // 匹配"答："开头的答案
            /答案[：:]\s*([^。]+[。])/g  // 匹配"答案："开头的答案
        ];

        for (const pattern of answerPatterns) {
            const matches = text.match(pattern);
            if (matches) {
                answers.push(...matches.map(a => a.trim()));
            }
        }

        return [...new Set(answers)];  // 去重
    }

    // 获取当前问题
    getCurrentQuestion() {
        return this.currentQuestion;
    }

    // 获取所有问题
    getQuestions() {
        return this.questions;
    }

    // 获取所有答案
    getAnswers() {
        return this.answers;
    }

    // 重置状态
    reset() {
        this.questions = [];
        this.currentQuestion = null;
        this.answers = [];
    }
    
    // 文本相似度比较
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

// 导出模块
export default TextProcessor; 