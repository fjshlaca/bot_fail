const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');
const ms = require('ms');

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
const EMOJI_GA = '🌙'; // Emoji tham gia (Trăng khuyết như trong hình)

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
  if (command === 'ga') {
    const winnerCount = parseInt(args[0]);
    const durationInput = args[1];
    const prize = args.slice(2).join(' ');

    if (!winnerCount || isNaN(winnerCount) || winnerCount < 1) {
      return message.reply('❌ Vui lòng nhập số lượng giải hợp lệ! Ví dụ: `z.ga 1 24h 1tr OwO có REG`');
    }
    if (!durationInput || !ms(durationInput)) {
      return message.reply('❌ Vui lòng nhập thời gian hợp lệ (VD: 30s, 10m, 24h, 7d)!');
    }
    if (!prize) {
      return message.reply('❌ Vui lòng nhập nội dung giveaway!');
    }

    // Xóa tin nhắn lệnh của người gửi để kênh gọn gàng
    await message.delete().catch(() => {});

    const durationMs = ms(durationInput);
    const endTime = Date.now() + durationMs;

    // Hàm tạo Embed giống giao diện trong hình
    const buildEmbed = (msRemaining) => {
      return new EmbedBuilder()
        .setTitle('🎉 GIVEAWAY ĐÃ BẮT ĐẦU')
        .setDescription(
          `### **${prize}**\n\n` +
          `• Nhấn vào ${EMOJI_GA} để tham gia\n` +
          `• Được tổ chức bởi <@${message.author.id}>\n` +
          `• Thời gian còn lại **${formatTimeLeft(msRemaining)}**`
        )
        .setColor(0x57F287) // Màu xanh lá bên mép trái
        .setFooter({
          text: `${winnerCount} giải | Quay thưởng lúc`,
          iconURL: message.author.displayAvatarURL()
        })
        .setTimestamp(endTime);
    };

    const gaMessage = await message.channel.send({ embeds: [buildEmbed(durationMs)] });
    await gaMessage.react(EMOJI_GA);

    // Cập nhật đếm ngược mỗi 5 giây
    const interval = setInterval(async () => {
      const remaining = endTime - Date.now();
      if (remaining <= 0) {
        clearInterval(interval);
      } else {
        await gaMessage.edit({ embeds: [buildEmbed(remaining)] }).catch(() => clearInterval(interval));
      }
    }, 5000);

    // Đặt bộ đếm kết thúc Giveaway
    setTimeout(async () => {
      clearInterval(interval);

      // Lấy lại tin nhắn mới nhất để đọc reaction
      const fetchedMsg = await message.channel.messages.fetch(gaMessage.id).catch(() => null);
      if (!fetchedMsg) return;

      const reaction = fetchedMsg.reactions.cache.get(EMOJI_GA);
      let users = reaction ? await reaction.users.fetch() : new Map();
      const validUsers = users.filter(u => !u.bot);

      if (validUsers.size === 0) {
        const endEmbed = EmbedBuilder.from(fetchedMsg.embeds[0])
          .setTitle('🎉 GIVEAWAY ĐÃ KẾT THÚC')
          .setDescription(`### **${prize}**\n\nKhông có ai tham gia giveaway này.`)
          .setColor(0xED4245);
        return fetchedMsg.edit({ embeds: [endEmbed] });
      }

      // Tạo bể quay thưởng hỗ trợ cộng Entry theo Role
      const pool = [];
      for (const [userId] of validUsers) {
        let baseEntries = 1;
        try {
          const member = await message.guild.members.fetch(userId);
          for (const [roleId, extra] of Object.entries(ROLE_ENTRIES)) {
            if (member.roles.cache.has(roleId)) baseEntries += extra;
          }
        } catch (e) {}

        for (let i = 0; i < baseEntries; i++) {
          pool.push(userId);
        }
      }

      // Bốc thăm người trúng thưởng (loại trừ trùng lặp nếu số người trúng > 1)
      const winners = [];
      const actualWinnerCount = Math.min(winnerCount, validUsers.size);

      while (winners.length < actualWinnerCount && pool.length > 0) {
        const randomIndex = Math.floor(Math.random() * pool.length);
        const selectedId = pool[randomIndex];
        if (!winners.includes(selectedId)) {
          winners.push(selectedId);
        }
        // Xóa tất cả vé của người đã trúng để không bị trúng 2 lần
        for (let i = pool.length - 1; i >= 0; i--) {
          if (pool[i] === selectedId) pool.splice(i, 1);
        }
      }

      const winnerMentions = winners.map(id => `<@${id}>`).join(', ');

      const endEmbed = EmbedBuilder.from(fetchedMsg.embeds[0])
        .setTitle('🎉 GIVEAWAY ĐÃ KẾT THÚC')
        .setDescription(
          `### **${prize}**\n\n` +
          `• **Người trúng thưởng:** ${winnerMentions}\n` +
          `• Được tổ chức bởi <@${message.author.id}>`
        )
        .setColor(0x2B2D31);

      await fetchedMsg.edit({ embeds: [endEmbed] });
      message.channel.send(`🎉 Chúc mừng ${winnerMentions} đã trúng thưởng giveaway: **${prize}**!`);
    }, durationMs);
  }
});

client.login(process.env.DISCORD_TOKEN);
