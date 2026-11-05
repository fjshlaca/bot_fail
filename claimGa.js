const { EmbedBuilder } = require('discord.js');
const config = require('./config');

// Kiểm tra quyền dùng zclaim (Admin hoặc Role được cấp phép riêng cho zclaim)
function canUseClaim(member) {
  if (!member) return false;
  if (member.id === config.BOT_ADMIN_ID) return true;
  if (member.roles.cache.some(r => config.ALLOWED_ROLE_IDS.includes(r.id))) return true;
  if (config.CLAIM_ALLOWED_ROLES && member.roles.cache.some(r => config.CLAIM_ALLOWED_ROLES.includes(r.id))) return true;
  return false;
}

module.exports = (client) => {
  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.toLowerCase().startsWith(config.PREFIX)) return;
    const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'claim') {
      if (!canUseClaim(message.member)) {
        return message.reply('❌ **Bạn không có quyền sử dụng lệnh `zclaim` này!**');
      }

      let targetUser = message.mentions.users.first();
      let targetMember = message.mentions.members.first();

      if (!targetUser && message.reference && message.reference.messageId) {
        try {
          const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
          targetUser = repliedMsg.author;
          targetMember = repliedMsg.member || await message.guild.members.fetch(targetUser.id).catch(() => null);
        } catch (err) {}
      }

      if (!targetUser) {
        return message.reply('❌ **Cú pháp:** `zclaim <@user>` hoặc **Reply** tin nhắn của người cần kiểm tra!');
      }

      const waitMsg = await message.channel.send(`🔍 Đang quét lịch sử trúng Giveaway của <@${targetUser.id}> từ các bot trong kênh...`);

      try {
        const messages = await message.channel.messages.fetch({ limit: 100 });
        
        let totalWins = 0;
        const winDetails = [];

        messages.forEach(msg => {
          if (msg.content.includes(targetUser.id) || (msg.embeds.length > 0 && JSON.stringify(msg.embeds).includes(targetUser.id))) {
            const content = msg.content + (msg.embeds[0] ? JSON.stringify(msg.embeds[0]) : '');
            
            if (content.includes('Kỷ Vật Ký Ức') || content.includes('thắng lớn') || content.includes('Ánh Trăng Tinh Tú') || content.includes('Rượu vang được nâng lên') || content.toLowerCase().includes('chúc mừng')) {
              totalWins++;
              winDetails.push({
                botName: msg.author.username,
                jumpUrl: msg.url,
                time: `<t:${Math.floor(msg.createdTimestamp / 1000)}:R>`
              });
            }
          }
        });

        const embed = new EmbedBuilder()
          .setTitle(`🎁 Thống Kê Claim Giveaway`)
          .setDescription(
            `• **Thành viên kiểm tra:** <@${targetUser.id}>\n` +
            `• **Tổng số giải trúng tìm thấy:** \`${winDetails.length} giải\`\n\n` +
            (winDetails.length > 0 
              ? winDetails.map((w, index) => `**${index + 1}.** Từ bot **${w.botName}** (${w.time}) — [Xem tin nhắn gốc](${w.jumpUrl})`).join('\n')
              : `*Không tìm thấy lịch sử trúng GA nào gần đây của thành viên này trong kênh này.*`)
          )
          .setColor(0xC7A9C9)
          .setFooter({ text: `Yêu cầu bởi ${message.member.displayName}` });

        await waitMsg.edit({ content: null, embeds: [embed] });
      } catch (err) {
        await waitMsg.edit('❌ Đã xảy ra lỗi trong quá trình quét lịch sử Giveaway!');
      }
    }
  });
};
