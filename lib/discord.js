const https = require('https');

function sendDiscordMessage(message) {
    const enabled = process.env.DISCORD_ENABLED || false;
    if (enabled === false) {
        return;
    }

    const data = JSON.stringify({
        "content": message
    });
    const options = {
        hostname: 'discordapp.com',
        port: 443,
        path: `/api/channels/${process.env.DISCORD_CHANNEL_ID}/messages`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length,
            'Authorization': `Bot ${process.env.DISCORD_TOKEN}`
        }
    };

    const req = https.request(options, (res) => {
        res.on('data', (d) => {
            process.stdout.write(d);
        });
    });
    req.on('error', (error) => {
        console.error(`Error sending Discord message: ${error}`);
    });
    req.write(data);
    req.end();
}

module.exports = {
    sendDiscordMessage: sendDiscordMessage,
};