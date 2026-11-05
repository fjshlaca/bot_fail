const { EmbedBuilder } = require('discord.js');
const config = require('./config');

function canUseClaim(member) {
  if (!member) return false;
  if (member.id === config.BOT_ADMIN_ID) return true;
  if (member.roles.cache.some(r => config.ALLOWED_ROLE_IDS.includes(r.id))) return true;
  if (config.CLAIM_ALLOWED_ROLES && member.roles.cache.some(r => config.CLAIM_ALLOWED_ROLES.includes(r.id))) return true;
  return false;
}

module.exports = (client) => {
  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.toLowerCase().startsWith(config.PREFIX || 'z')) return;
    const args = message.content.slice((config.PREFIX || 'z').length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'claim') {
      if (!canUseClaim(message.member)) {
        return message.reply('❌ **Bạn không có quyền sử dụng lệnh `zclaim` này!**');
      }

      let targetUser = message.mentions.users.first();
      if (!targetUser && message.reference && message.reference.messageId) {
        try {
          const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
          targetUser = repliedMsg.author;
        } catch (err) {}
      }

      if (!targetUser) {
        return message.reply('❌ **Cú pháp:** `zclaim <@user>` hoặc **Reply** tin nhắn người cần kiểm tra!');
      }

      const waitMsg = await message.channel.send(`🔍 Đang quét lịch sử trúng GA trong **24 giờ qua** của <@${targetUser.id}>...`);

      try {
        const messages = await message.channel.messages.fetch({ limit: 100 });
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        
        const winDetails = [];

        messages.forEach(msg => {
          // Chỉ quét tin nhắn trong vòng 24h qua
          if (msg.createdTimestamp < oneDayAgo) return;

          const content = msg.content + (msg.embeds[0] ? (msg.embeds[0].description + ' ' + msg.embeds[0].title) : '');
          
          if (content.includes(targetUser.id)) {
            if (content.includes('Kỷ Vật Ký Ức') || content.includes('thắng lớn') || content.includes('Ánh Trăng Tinh Tú') || content.includes('Rượu vang được nâng lên') || content.toLowerCase().includes('chúc mừng')) {
              
              // Trích xuất tên phần thưởng nếu có trong nội dung
              let prizeName = 'Phần thưởng Giveaway';
              if (content.includes('36k')) prizeName = '36k';
              else if (content.includes('200k')) prizeName = '200k';
              else if (content.includes('300')) prizeName = '300 Ánh Trăng Tinh Tú';
              else if (content.includes('100k')) prizeName = '100k';

              winDetails.push({
                botName: msg.author.username,
                prize: prizeName,
                jumpUrl: msg.url,
                time: `<t:${Math.floor(msg.createdTimestamp / 1000)}:R>`
              });
            }
          }
        });

        const embed = new EmbedBuilder()
          .setTitle(`🎁 Thống Kê Claim Giveaway (24 Giờ Qua)`)
          .setDescription(
            `• **Thành viên:** <@${targetUser.id}>\n` +
            `• **Tổng số giải trúng:** \`${winDetails.length} giải\`\n\n` +
            (winDetails.length > 0 
              ? winDetails.map((w, index) => `**${index + 1}.** Quà: **${w.prize}** — Từ bot **${w.botName}** (${w.time}) — [Xem tin gốc](${w.jumpUrl})`).join('\n')
              : `*Không tìm thấy lịch sử trúng GA nào trong 24h qua của thành viên này.*`)
          )
          .setColor(0xC7A9C9)
          .setFooter({ text: `Yêu cầu bởi ${message.member.displayName}` });

        await waitMsg.edit({ content: null, embeds: [embed] });
      } catch (err) {
        await waitMsg.edit('❌ Đã xảy ra lỗi khi quét dữ liệu Giveaway!');
      }
    }
  });
};
