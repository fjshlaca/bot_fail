const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');

// --- CẤU HÌNH WEB SERVER ĐỂ TREO RENDER ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot Discord Giveaway đang hoạt động!'));
app.listen(PORT, () => console.log(`Web Server đang chạy trên port ${PORT}`));

// --- KHỞI TẠO BOT ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers
  ]
});

// Cấu hình Role tăng Entry (Thay ID thật của server vào đây)
const ROLE_ENTRIES = {
  '123456789012345678': 1, // Role VIP: +1 entry (Tổng = 2)
  '987654321098765432': 2  // Role SVIP: +2 entries (Tổng = 3)
};

const PREFIX = 'z.';
const EMOJI_GA = '🌙'; // Emoji tham gia giveaway

// --- HÀM TÍNH THỜI GIAN THEO KÝ TỰ S, P, H, D ---
function parseCustomDuration(str) {
  if (!str) return null;
  // Đọc số và đơn vị (vd: 10s, 15p, 24h, 3d hoặc kết hợp như 1h30p)
  const regex = /(\d+)\s*([sphd])/gi;
  let match;
  let totalMs = 0;
  let found = false;

  while ((match = regex.exec(str)) !== null) {
    found = true;
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    if (unit === 's') totalMs += value * 1000;
    else if (unit === 'p') totalMs += value * 60 * 1000;
    else if (unit === 'h') totalMs += value * 60 * 60 * 1000;
    else if (unit === 'd') totalMs += value * 24 * 60 * 60 * 1000;
  }

  return found && totalMs > 0 ? totalMs : null;
}

// Hàm đổi miligiây thành chuỗi hiển thị XH XM XS
function formatTimeLeft(msLeft) {
  if (msLeft <= 0) return '0S';
  const seconds = Math.floor((msLeft / 1000) % 60);
  const minutes = Math.floor((msLeft / (1000 * 60)) % 60);
  const hours = Math.floor((msLeft / (1000 * 60 * 60)) % 24);
  const days = Math.floor(msLeft / (1000 * 60 * 60 * 24));

  let res = '';
  if (days > 0) res += `${days}D `;
  if (hours > 0) res += `${hours}H `;
  if (minutes > 0) res += `${minutes}M `;
  res += `${seconds}S`;
  return res.trim();
}

client.once('ready', () => {
  console.log(`Đã đăng nhập thành công dưới tên: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // Cú pháp lệnh: z.ga <số_giải> <thời_gian> <nội_dung...>
  // Ví dụ: z.ga 1 24h 1tr OwO có REG
  // Hoặc:  z.ga 1 30p 1tr OwO có REG
  // Hoặc:  z.ga 1 45s 1tr OwO có REG
  if (command === 'ga') {
    const winnerCount = parseInt(args[0]);
    const durationInput = args[1];
    const prize = args.slice(2).join(' ');

    if (!winnerCount || isNaN(winnerCount) || winnerCount < 1) {
      return message.reply('❌ Vui lòng nhập số lượng giải hợp lệ! Ví dụ: `z.ga 1 24h 1tr OwO có REG`');
    }

    const durationMs = parseCustomDuration(durationInput);
    if (!durationMs) {
      return message.reply('❌ Thời gian không hợp lệ! Dùng: `s` (giây), `p` (phút), `h` (giờ), `d` (ngày). Ví dụ: `45s`, `30p`, `24h`, `2d`.');
    }

    if (!prize) {
      return message.reply('❌ Vui lòng nhập nội dung giveaway!');
    }

    // Xóa tin nhắn lệnh của người gửi để kênh gọn gàng
    await message.delete().catch(() => {});

    const endTime = Date.now() + durationMs;

    // Build Embed hiển thị
    const buildEmbed = (msRemaining) => {
      return new EmbedBuilder()
        .setTitle('🎉 GIVEAWAY ĐÃ BẮT ĐẦU')
        .setDescription(
          `### **${prize}**\n\n` +
          `• Nhấn vào ${EMOJI_GA} để tham gia\n` +
          `• Được tổ chức bởi <@${message.author.id}>\n` +
          `• Thời gian còn lại **${formatTimeLeft(msRemaining)}**`
        )
