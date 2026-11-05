const { Client, GatewayIntentBits, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const express = require('express');
const config = require('./config');

// --- WEB SERVER CHO RENDER ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot Discord đang hoạt động!'));
app.listen(PORT, () => console.log(`Web Server running on port ${PORT}`));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// Khởi tạo các bộ nhớ dữ liệu toàn cục
client.jailData = new Map();
client.activeGiveaways = new Map();
client.serverVoices = new Map();
client.userGachaProgress = new Map();

// Import các file tính năng nhỏ
require('./moderation')(client);
require('./giveaway')(client);
require('./gacha')(client);
require('./voice')(client);
require('./help')(client);

client.once('ready', () => {
  console.log(`[BOT READY] Đã đăng nhập với tên: ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
