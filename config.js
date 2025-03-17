require('dotenv').config();

const config = {
    llmModel: process.env.LLM_MODEL || 'deepseek',
    apiEndpoint: process.env.LLM_MODEL === 'siliconflow' 
        ? process.env.SILICONFLOW_API_ENDPOINT 
        : process.env.DEEPSEEK_API_ENDPOINT,
    apiKey: process.env.LLM_MODEL === 'siliconflow'
        ? process.env.SILICONFLOW_API_KEY
        : process.env.DEEPSEEK_API_KEY,
    siliconflowModel: process.env.SILICONFLOW_MODEL
};

module.exports = config; 