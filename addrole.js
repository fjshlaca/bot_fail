const { EmbedBuilder } = require('discord.js');
const config = require('./config');

const roleShortcuts = new Map();

function isGAAdmin(member) {
  if (!member) return false;
  return member.id === config.BOT_ADMIN_ID || member.roles.cache.some(r => config.ALLOWED_ROLE_IDS.includes(r.id));
}

module.exports = (client) => {
  client.roleShortcuts = roleShortcuts;

  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.toLowerCase().startsWith(config.PREFIX)) return;
    const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'luu') {
      if (!isGAAdmin(message.member)) return message.reply('❌ **Bạn không có quyền sử dụng lệnh này!**');
      
      const roleMention = message.mentions.roles.first();
      const keyword = args[1]?.toLowerCase();

      if (!roleMention || !keyword) {
        return message.reply('❌ **Cú pháp hợp lệ:** `zluu <@&id_role> <từ_khóa_lối_tắt>`\n*Ví dụ:* `zluu @VIP vip`');
      }

      const guildId = message.guild.id;
      if (!roleShortcuts.has(guildId)) roleShortcuts.set(guildId, new Map());
      
      roleShortcuts.get(guildId).set(keyword, roleMention.id);

      const embed = new EmbedBuilder()
        .setTitle('📌 Đã Lưu Lối Tắt Role')
        .setDescription(`• **Role:** <@&${roleMention.id}>\n• **Từ khóa lối tắt:** \`${keyword}\`\n\nTừ nay có thể dùng \`zadd @user ${keyword}\` để cấp nhanh!`)
        .setColor(0xC7A9C9);

      return message.channel.send({ embeds: [embed] });
    }

    if (command === 'add') {
      if (!isGAAdmin(message.member)) return message.reply('❌ **Bạn không có quyền sử dụng lệnh này!**');

      let targetMember = message.mentions.members.first();
      let keywordIndex = 1;

      if (!targetMember && message.reference && message.reference.messageId) {
        try {
          const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
          targetMember = await message.guild.members.fetch(repliedMsg.author.id);
          keywordIndex = 0;
        } catch (err) {}
      }

      const keyword = args[keywordIndex]?.toLowerCase();

      if (!targetMember || !keyword) {
        return message.reply('❌ **Cú pháp hợp lệ:** `zadd <@user> <từ_khóa>` hoặc **Reply** tin nhắn kèm `zadd <từ_khóa>`');
      }

      const guildId = message.guild.id;
      const gShortcuts = roleShortcuts.get(guildId);

      if (!gShortcuts || !gShortcuts.has(keyword)) {
        return message.reply(`❌ Không tìm thấy lối tắt nào với từ khóa \`${keyword}\`! Hãy dùng \`zluu\` để tạo trước.`);
      }

      const roleId = gShortcuts.get(keyword);
      const roleToAssign = message.guild.roles.cache.get(roleId);

      if (!roleToAssign) {
        return message.reply('❌ Role này không còn tồn tại trong server!');
      }

      try {
        await targetMember.roles.add(roleToAssign);
        const successEmbed = new EmbedBuilder()
          .setTitle('✨ Cấp Role Thành Công')
          .setDescription(`• **Thành viên:** <@${targetMember.id}>\n• **Đã cấp Role:** <@&${roleId}>`)
          .setColor(0x2ECC71);

        return message.channel.send({ embeds: [successEmbed] });
      } catch (err) {
        return message.reply('❌ Lỗi: Bot không đủ quyền để cấp role này!');
      }
    }
  });
};
