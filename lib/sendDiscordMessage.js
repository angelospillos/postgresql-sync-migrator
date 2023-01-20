const Discord = require('discord.js');
let client;

function sendDiscordMessage(message) {
    const enabled = process.env.DISCORD_ENABLED || false;
    if (enabled === false) {
        return;
    }
    if (!client) {
        client = new Discord.Client();
        client.login(process.env.DISCORD_TOKEN);
    }
    client.on('ready', () => {
        const channel = client.channels.cache.get(process.env.DISCORD_CHANNEL_ID);
        channel.send(message);
    });
}

export default sendDiscordMessage;