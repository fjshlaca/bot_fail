const { EmbedBuilder } = require('discord.js');
const config = require('./config');

// Bộ nhớ lưu lịch sử thống kê theo từng server (guildId -> Map các mốc ngày)
// Cấu trúc ngày: "YYYY-MM-DD" -> { total, joined, left }
const serverStats = new Map();

// Hàm lấy định dạng ngày theo giờ Việt Nam (GMT+7)
function getVietnamDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }); // Format YYYY-MM-DD
}

module.exports = (client) => {
  client.serverStats = serverStats;

  // 1. Tự động quét và cập nhật mốc 00:00 hàng ngày hoặc ghi nhận join/leave
  client.on('guildMemberAdd', (member) => {
    const guildId = member.guild.id;
    if (!serverStats.has(guildId)) serverStats.set(guildId, new Map());
    const gStats = serverStats.get(guildId);
    const today = getVietnamDate(0);
    
    if (!gStats.has(today)) gStats.set(today, { joined: 0, left: 0, total: member.guild.memberCount });
    gStats.get(today).joined++;
    gStats.get(today).total = member.guild.memberCount;
  });

  client.on('guildMemberRemove', (member) => {
    const guildId = member.guild.id;
    if (!serverStats.has(guildId)) serverStats.set(guildId, new Map());
    const gStats = serverStats.get(guildId);
    const today = getVietnamDate(0);
    
    if (!gStats.has(today)) gStats.set(today, { joined: 0, left: 0, total: member.guild.memberCount });
    gStats.get(today).left++;
    gStats.get(today).total = member.guild.memberCount;
  });

  // 2. Lệnh xem thống kê: zstats (mặc định 1 ngày) hoặc zstats <3 | 7 | 30>
  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.toLowerCase().startsWith(config.PREFIX)) return;
    const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'stats' || command === 'thongke') {
      const days = parseInt(args[0]) || 1; // Mặc định là 1 ngày nếu không nhập số phía sau
      if (![1, 3, 7, 30].includes(days)) {
        return message.reply('❌ **Cú pháp hợp lệ:** `zstats`, `zstats 3`, `zstats 7` hoặc `zstats 30`');
      }

      const guildId = message.guild.id;
      const gStats = serverStats.get(guildId) || new Map();
      
      let totalJoined = 0;
      let totalLeft = 0;
      const currentTotal = message.guild.memberCount;

      // Cộng dồn số liệu trong số ngày yêu cầu
      for (let i = 0; i < days; i++) {
        const dateKey = getVietnamDate(i);
        const dayData = gStats.get(dateKey);
        if (dayData) {
          totalJoined += dayData.joined;
          totalLeft += dayData.left;
        }
      }

      const statsEmbed = new EmbedBuilder()
        .setTitle(`📊 Thống Kê Biến Động Thành Viên (${days === 1 ? 'Hôm Nay' : `${days} Ngày Qua`})`)
        .setDescription(
          `• **Tổng số thành viên hiện tại:** \`${currentTotal} mem\`\n` +
          `• **Số mem gia nhập :** \`+${totalJoined} mem\`\n` +
          `• **Số mem rời đi :** \`-${totalLeft} mem\`\n` +
          `• **Biến động thực tế:** \`${totalJoined - totalLeft >= 0 ? '+' : ''}${totalJoined - totalLeft} mem\``
        )
        .setColor(0xC7A9C9)
        .setFooter({ text: `Cập nhật theo mốc giờ Việt Nam (GMT+7)` });

      return message.channel.send({ embeds: [statsEmbed] });
    }
  });
};
