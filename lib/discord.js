const https = require('https');
const { createLogger } = require('./logger');
const logger = createLogger();

const axios = require('axios');

const sendDiscordMessage = async (message) => {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    const enabled = process.env.DISCORD_ENABLED || false;

    if (!enabled || !webhookUrl) {
        return;
    }

    try {
        await axios.post(webhookUrl, {
            content: message
        });
    } catch (error) {
        logger.error(`Error sending message to Discord webhook: ${error}`);
    }
};

module.exports = {
    sendDiscordMessage: sendDiscordMessage,
};
