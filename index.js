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
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ]
});

// Cấu hình Role tăng Entry
const ROLE_ENTRIES = {
  '123456789012345678': 1, 
  '987654321098765432': 2  
};

const PREFIX = 'z.';
const EMOJI_GA = '🌙';

// --- HÀM TÍNH THỜI GIAN THEO KÝ TỰ S, P, H, D ---
function parseCustomDuration(str) {
  if (!str) return null;
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

// Hàm đổi miligiây thành chuỗi hiển thị
function formatTimeLeft(msLeft) {
  if (msLeft <= 0) return '0S';
  const seconds = Math.floor((msLeft / 1000) % 60);
  const minutes = Math.floor((msLeft / (1000 * 60)) % 60);
  const hours = Math.floor((msLeft / (1000 * 60 * 60)) % 24);
  const days = Math.floor(msLeft / (1000 * 60 * 60 * 24));

  let res = '';
  if (days > 0) res += `${days} ngày `;
  if (hours > 0) res += `${hours} giờ `;
  if (minutes > 0) res += `${minutes} phút `;
  res += `${seconds} giây`;
  return res.trim();
}

client.once('ready', () => {
  console.log(`Đã đăng nhập thành công dưới tên: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'ga') {
    const winnerCount = parseInt(args[0]);
    const durationInput = args[1];

    if (!winnerCount || isNaN(winnerCount) || winnerCount < 1) {
      return message.reply('❌ Số lượng giải không hợp lệ! Cú pháp: `z.ga <số_giải> <thời_gian> [số_lượng_tạo] <nội_dung>`');
    }

    const durationMs = parseCustomDuration(durationInput);
    if (!durationMs) {
      return message.reply('❌ Thời gian không hợp lệ! Dùng: `s`, `p`, `h`, `d`. Ví dụ: `30s`, `15p`, `24h`.');
    }

    let giveawayCount = 1;
    let prizeStartIndex = 2;

    const potentialCount = parseInt(args[2]);
    if (!isNaN(potentialCount) && potentialCount > 0) {
      giveawayCount = potentialCount;
      prizeStartIndex = 3;
    }

    const prize = args.slice(prizeStartIndex).join(' ');
    if (!prize) {
      return message.reply('❌ Vui lòng nhập nội dung giveaway!');
    }

    await message.delete().catch(() => {});

    for (let i = 0; i < giveawayCount; i++) {
      const endTime = Date.now() + durationMs;

      const buildEmbed = (msRemaining) => {
        return new EmbedBuilder()
          .setAuthor({ 
            name: '🎁 HỆ THỐNG GIVEAWAY', 
            iconURL: message.guild.iconURL({ dynamic: true }) 
          })
          .setTitle(`🎉 ${prize}`)
          .setDescription(
            `> Hãy nhấn vào biểu tượng **${EMOJI_GA}** bên dưới để tham gia ngay!\n\n` +
            `• 👑 **Người tổ chức:** <@${message.author.id}>\n` +
            `• 🏆 **Số suất trúng:** \`${winnerCount} giải\`\n` +
            `• ⏳ **Thời gian còn lại:** \`${formatTimeLeft(msRemaining)}\``
          )
          .setColor(0xFF69B4) // <--- ĐÃ ĐỔI THANH VIỀN BÊN TRÁI THÀNH MÀU HỒNG (HOT PINK)
          .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
          .setFooter({
            text: `⏰ Kết thúc lúc`,
            iconURL: client.user.displayAvatarURL()
          })
          .setTimestamp(endTime);
      };

      const gaMessage = await message.channel.send({ embeds: [buildEmbed(durationMs)] });
      await gaMessage.react(EMOJI_GA);

      const interval = setInterval(async () => {
        const remaining = endTime - Date.now();
        if (remaining <= 0) {
          clearInterval(interval);
        } else {
          await gaMessage.edit({ embeds: [buildEmbed(remaining)] }).catch(() => clearInterval(interval));
        }
      }, 5000);

      setTimeout(async () => {
        clearInterval(interval);

        const fetchedMsg = await message.channel.messages.fetch(gaMessage.id).catch(() => null);
        if (!fetchedMsg) return;

        const reaction = fetchedMsg.reactions.cache.get(EMOJI_GA);
        let users = reaction ? await reaction.users.fetch() : new Map();
        const validUsers = users.filter(u => !u.bot);

        if (validUsers.size === 0) {
          const endEmbed = EmbedBuilder.from(fetchedMsg.embeds[0])
            .setTitle(`❌ [ĐÃ KẾT THÚC] ${prize}`)
            .setDescription(`> Không có ai tham gia giveaway này nên không tìm được người trúng thưởng!`)
            .setColor(0xED4245);
          return fetchedMsg.edit({ embeds: [endEmbed] });
        }

        const pool = [];
        for (const [userId] of validUsers) {
          let baseEntries = 1;
          try {
            const member = await message.guild.members.fetch(userId);
            for (const [roleId, extra] of Object.entries(ROLE_ENTRIES)) {
              if (member.roles.cache.has(roleId)) baseEntries += extra;
            }
          } catch (e) {}

          for (let k = 0; k < baseEntries; k++) {
            pool.push(userId);
          }
        }

        const winners = [];
        const actualWinnerCount = Math.min(winnerCount, validUsers.size);

        while (winners.length < actualWinnerCount && pool.length > 0) {
          const randomIndex = Math.floor(Math.random() * pool.length);
          const selectedId = pool[randomIndex];
          if (!winners.includes(selectedId)) {
            winners.push(selectedId);
          }
          for (let k = pool.length - 1; k >= 0; k--) {
            if (pool[k] === selectedId) pool.splice(k, 1);
          }
        }

        const winnerMentions = winners.map(id => `<@${id}>`).join(', ');

        const endEmbed = EmbedBuilder.from(fetchedMsg.embeds[0])
          .setTitle(`🏆 [ĐÃ KẾT THÚC] ${prize}`)
          .setDescription(
            `> Giveaway đã khép lại thành công!\n\n` +
            `• 👑 **Người tổ chức:** <@${message.author.id}>\n` +
            `• 🎉 **Người chiến thắng:** ${winnerMentions}`
          )
          .setColor(0xFF69B4); // Khi kết thúc vẫn
