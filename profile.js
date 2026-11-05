const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('./config');

module.exports = (client) => {
  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.toLowerCase().startsWith(config.PREFIX || 'z')) return;
    const args = message.content.slice((config.PREFIX || 'z').length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'avt' || command === 'check') {
      let targetMember = message.mentions.members.first();

      if (!targetMember && message.reference && message.reference.messageId) {
        try {
          const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
          targetMember = await message.guild.members.fetch(repliedMsg.author.id).catch(() => null);
        } catch (err) {}
      }

      if (!targetMember) targetMember = message.member;
      const targetUser = targetMember.user;

      // Lấy ảnh server và global cá nhân
      const gAvatar = targetUser.displayAvatarURL({ dynamic: true, size: 1024 });
      const gBanner = targetUser.bannerURL({ dynamic: true, size: 1024 });
      
      // Nếu user không set avatar riêng cho server, mặc định lấy avt global
      const serverAvatar = targetMember.avatar ? targetMember.displayAvatarURL({ dynamic: true, size: 1024 }) : gAvatar;
      const serverBanner = targetMember.bannerURL({ dynamic: true, size: 1024 }) || gBanner;

      const embed = new EmbedBuilder()
        .setTitle(`🖼️ Hồ Sơ: ${targetUser.tag}`)
        .setImage(serverAvatar)
        .setDescription(`• **ID:** \`${targetUser.id}\`\n• **Chế độ:** \`Server (Avatar)\``)
        .setColor(0xC7A9C9);

      // Cả 3 nút màu xám (Secondary), nút đang xem bị disable
      const btn1 = new ButtonBuilder().setCustomId(`prof_server_${targetUser.id}`).setLabel('Server').setStyle(ButtonStyle.Secondary).setDisabled(true);
      const btn2 = new ButtonBuilder().setCustomId(`prof_sbanner_${targetUser.id}`).setLabel('Banner (Server)').setStyle(ButtonStyle.Secondary);
      const btn3 = new ButtonBuilder().setCustomId(`prof_global_${targetUser.id}`).setLabel('Global').setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder().addComponents(btn1, btn2, btn3);
      return message.channel.send({ embeds: [embed], components: [row] });
    }
  });

  // Xử lý sự kiện bấm nút tương tác
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('prof_')) return;

    try {
      const [action, type, userId] = interaction.customId.split('_');
      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      if (!member) {
        return interaction.reply({ content: '❌ Không tìm thấy thành viên trong server!', ephemeral: true });
      }

      const user = member.user;
      const gAvatar = user.displayAvatarURL({ dynamic: true, size: 1024 });
      const gBanner = user.bannerURL({ dynamic: true, size: 1024 });
      
      const sAvatar = member.avatar ? member.displayAvatarURL({ dynamic: true, size: 1024 }) : gAvatar;
      const sBanner = member.bannerURL({ dynamic: true, size: 1024 }) || gBanner;

      const embed = new EmbedBuilder().setTitle(`🖼️ Hồ Sơ: ${user.tag}`).setColor(0xC7A9C9);

      let b1, b2, b3;

      if (type === 'server') {
        embed.setImage(sAvatar).setDescription(`• **ID:** \`${userId}\`\n• **Chế độ:** \`Server (Avatar)\``);
        b1 = new ButtonBuilder().setCustomId(`prof_server_${userId}`).setLabel('Server').setStyle(ButtonStyle.Secondary).setDisabled(true);
        b2 = new ButtonBuilder().setCustomId(`prof_sbanner_${userId}`).setLabel('Banner (Server)').setStyle(ButtonStyle.Secondary);
        b3 = new ButtonBuilder().setCustomId(`prof_global_${userId}`).setLabel('Global').setStyle(ButtonStyle.Secondary);
      } 
      else if (type === 'sbanner') {
        // Nếu không có banner server lẫn global thì dùng avatar thay thế để không bị lỗi
        const displayBanner = sBanner || sAvatar;
        embed.setImage(displayBanner).setDescription(`• **ID:** \`${userId}\`\n• **Chế độ:** \`Server (Banner)\``);
        b1 = new ButtonBuilder().setCustomId(`prof_server_${userId}`).setLabel('Server').setStyle(ButtonStyle.Secondary);
        b2 = new ButtonBuilder().setCustomId(`prof_sbanner_${userId}`).setLabel('Banner (Server)').setStyle(ButtonStyle.Secondary).setDisabled(true);
        b3 = new ButtonBuilder().setCustomId(`prof_global_${userId}`).setLabel('Global').setStyle(ButtonStyle.Secondary);
      } 
      else if (type === 'global' || type === 'gavatar') {
        embed.setImage(gAvatar).setDescription(`• **ID:** \`${userId}\`\n• **Chế độ:** \`Global (Avatar cá nhân)\``);
        b1 = new ButtonBuilder().setCustomId(`prof_gavatar_${userId}`).setLabel('Global Avatar').setStyle(ButtonStyle.Secondary).setDisabled(true);
        b2 = new ButtonBuilder().setCustomId(`prof_gbanner_${userId}`).setLabel('Banner (Global)').setStyle(ButtonStyle.Secondary);
        b3 = new ButtonBuilder().setCustomId(`prof_server_${userId}`).setLabel('Server').setStyle(ButtonStyle.Secondary);
      } 
      else if (type === 'gbanner') {
        const displayGBanner = gBanner || gAvatar;
        embed.setImage(displayGBanner).setDescription(`• **ID:** \`${userId}\`\n• **Chế độ:** \`Global (Banner cá nhân)\``);
        b1 = new ButtonBuilder().setCustomId(`prof_gavatar_${userId}`).setLabel('Global Avatar').setStyle(ButtonStyle.Secondary);
        b2 = new ButtonBuilder().setCustomId(`prof_gbanner_${userId}`).setLabel('Banner (Global)').setStyle(ButtonStyle.Secondary).setDisabled(true);
        b3 = new ButtonBuilder().setCustomId(`prof_server_${userId}`).setLabel('Server').setStyle(ButtonStyle.Secondary);
      }

      const row = new ActionRowBuilder().addComponents(b1, b2, b3);
      return await interaction.update({ embeds: [embed], components: [row] });
    } catch (err) {
      // Tránh lỗi treo interaction
    }
  });
};
