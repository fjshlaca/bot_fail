const { EmbedBuilder } = require('discord.js');
const config = require('./config');

function isMainAdmin(member) {
  if (!member) return false;
  if (member.id === config.BOT_ADMIN_ID) return true;
  return member.roles.cache.some(r => config.ALLOWED_ROLE_IDS.includes(r.id));
}

module.exports = (client) => {
  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.toLowerCase().startsWith(config.PREFIX || 'z')) return;
    
    const args = message.content.slice((config.PREFIX || 'z').length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'help') {
      // Lệnh zhelp yêu cầu phải là 3 role quản trị mới được dùng
      if (!isMainAdmin(message.member)) {
        return message.reply('❌ **Bạn không có quyền sử dụng bảng trợ giúp này!**');
      }

      const helpEmbed = new EmbedBuilder()
        .setTitle('📜 Bảng Trợ Giúp Hệ Thống Bot')
        .setDescription('Dưới đây là các danh mục tính năng của bot quản lý:')
        .addFields(
          {
            name: '<:emoji_25:1567934683520438292> 1. Quản Trị & Kiểm Moderation',
            value: '• `zclear <số_lượng>`: Xóa tin nhắn nhanh chóng.\n• `zmute / zunmute`: Xử lý thành viên vi phạm quy định server.'
          },
          {
            name: '<:emoji_26:1567934702881603765> 2. Hệ Thống Giveaway (GA)',
            value: '• `zga [@Role] <số_người> <thời gian> <quà>`: Tạo tiệc GA.\n• `zend`: Kết thúc Giveaway sớm.\n• `zgarr` / `reroll`: Chọn lại người trúng giải mới.'
          },
          {
            name: '<:emoji_26:1567934716718354524> 3. Lối Tắt Role (Shortcuts)',
            value: '• `zluu <@Role> <từ_khóa>`: Lưu từ khóa tắt cấp role.\n• `zadd <@user> <từ_khóa>`: Cấp nhanh role bằng từ khóa đã lưu.'
          },
          {
            name: '<:emoji_28:1567934739329847436> 4. Tiện Ích & Hồ Sơ (Profile)',
            value: '• `zavt` hoặc `zcheck [@user]`: Xem Avatar & Banner (hỗ trợ chuyển đổi Server / Global mượt mà).'
          },
          {
            name: '<:emoji_29:1567954120575287347> 5. Thống Kê & Claim Giveaway',
            value: '• `zclaim <@user>`: Quét lịch sử trúng GA trong 24h qua kèm hiển thị chi tiết phần thưởng.'
          }
        )
        .setColor(0xC7A9C9)
        .setFooter({ text: `Yêu cầu bởi ${message.member.displayName}` });

      return message.channel.send({ embeds: [helpEmbed] });
    }
  });
};
