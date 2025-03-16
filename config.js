require('dotenv').config();

const config = {
    deepseek: {
        apiEndpoint: process.env.DEEPSEEK_API_ENDPOINT,
        apiKey: process.env.DEEPSEEK_API_KEY
    }
};

module.exports = config; 