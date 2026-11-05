const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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

      // Ưu tiên lấy Avatar Server và Banner Server (nếu có)
      const serverAvatar = targetMember.displayAvatarURL({ dynamic: true, size: 1024 });
      const serverBanner = targetMember.bannerURL({ dynamic: true, size: 1024 }) || targetUser.bannerURL({ dynamic: true, size: 1024 });

      const embed = new EmbedBuilder()
        .setTitle(`🖼️ Hồ Sơ Server: ${targetUser.tag}`)
        .setImage(serverAvatar)
        .setDescription(`• **ID:** \`${targetUser.id}\`\n• **Chế độ:** \`Server (Cục bộ)\``)
        .setColor(0xC7A9C9);

      // 3 nút tương tác: [Server (Primary/Disabled)] [Banner Server] [Global]
      const btn1 = new ButtonBuilder().setCustomId(`prof_server_${targetUser.id}`).setLabel('Server').setStyle(ButtonStyle.Primary).setDisabled(true);
      const btn2 = new ButtonBuilder().setCustomId(`prof_sbanner_${targetUser.id}`).setLabel('Banner (Server)').setStyle(ButtonStyle.Secondary).setDisabled(!serverBanner);
      const btn3 = new ButtonBuilder().setCustomId(`prof_global_${targetUser.id}`).setLabel('Global').setStyle(ButtonStyle.Success);

      const row = new ActionRowBuilder().addComponents(btn1, btn2, btn3);
      return message.channel.send({ embeds: [embed], components: [row] });
    }
  });

  // Xử lý chuyển đổi qua lại giữa Server <-> Global Avatar & Banner
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('prof_')) return;

    const [action, type, userId] = interaction.customId.split('_');
    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ Không tìm thấy thành viên trong server!', ephemeral: true });

    const user = member.user;
    const sAvatar = member.displayAvatarURL({ dynamic: true, size: 1024 });
    const sBanner = member.bannerURL({ dynamic: true, size: 1024 }) || user.bannerURL({ dynamic: true, size: 1024 });
    const gAvatar = user.displayAvatarURL({ dynamic: true, size: 1024 });
    const gBanner = user.bannerURL({ dynamic: true, size: 1024 });

    const embed = new EmbedBuilder().setTitle(`🖼️ Hồ Sơ: ${user.tag}`).setColor(0xC7A9C9);

    let b1, b2, b3;

    if (type === 'server') {
      embed.setImage(sAvatar).setDescription(`• **ID:** \`${userId}\`\n• **Chế độ:** \`Server (Avatar)\``);
      b1 = new ButtonBuilder().setCustomId(`prof_server_${userId}`).setLabel('Server').setStyle(ButtonStyle.Primary).setDisabled(true);
      b2 = new ButtonBuilder().setCustomId(`prof_sbanner_${userId}`).setLabel('Banner (Server)').setStyle(ButtonStyle.Secondary).setDisabled(!sBanner);
      b3 = new ButtonBuilder().setCustomId(`prof_global_${userId}`).setLabel('Global').setStyle(ButtonStyle.Success);
    } else if (type === 'sbanner') {
      embed.setImage(sBanner || sAvatar).setDescription(`• **ID:** \`${userId}\`\n• **Chế độ:** \`Server (Banner)\``);
      b1 = new ButtonBuilder().setCustomId(`prof_server_${userId}`).setLabel('Server').setStyle(ButtonStyle.Secondary);
      b2 = new ButtonBuilder().setCustomId(`prof_sbanner_${userId}`).setLabel('Banner (Server)').setStyle(ButtonStyle.Primary).setDisabled(true);
      b3 = new ButtonBuilder().setCustomId(`prof_global_${userId}`).setLabel('Global').setStyle(ButtonStyle.Success);
    } else if (type === 'global') {
      embed.setImage(gAvatar).setDescription(`• **ID:** \`${userId}\`\n• **Chế độ:** \`Global (Avatar cá nhân)\``);
      b1 = new ButtonBuilder().setCustomId(`prof_gavatar_${userId}`).setLabel('Global Avatar').setStyle(ButtonStyle.Primary).setDisabled(true);
      b2 = new ButtonBuilder().setCustomId(`prof_gbanner_${userId}`).setLabel('Banner (Global)').setStyle(ButtonStyle.Secondary).setDisabled(!gBanner);
      b3 = new ButtonBuilder().setCustomId(`prof_server_${userId}`).setLabel('Server').setStyle(ButtonStyle.Success);
    } else if (type === 'gavatar') {
      embed.setImage(gAvatar).setDescription(`• **ID:** \`${userId}\`\n• **Chế độ:** \`Global (Avatar cá nhân)\``);
      b1 = new ButtonBuilder().setCustomId(`prof_gavatar_${userId}`).setLabel('Global Avatar').setStyle(ButtonStyle.Primary).setDisabled(true);
      b2 = new ButtonBuilder().setCustomId(`prof_gbanner_${userId}`).setLabel('Banner (Global)').setStyle(ButtonStyle.Secondary).setDisabled(!gBanner);
      b3 = new ButtonBuilder().setCustomId(`prof_server_${userId}`).setLabel('Server').setStyle(ButtonStyle.Success);
    } else if (type === 'gbanner') {
      embed.setImage(gBanner || gAvatar).setDescription(`• **ID:** \`${userId}\`\n• **Chế độ:** \`Global (Banner cá nhân)\``);
      b1 = new ButtonBuilder().setCustomId(`prof_gavatar_${userId}`).setLabel('Global Avatar').setStyle(ButtonStyle.Secondary);
      b2 = new ButtonBuilder().setCustomId(`prof_gbanner_${userId}`).setLabel('Banner (Global)').setStyle(ButtonStyle.Primary).setDisabled(true);
      b3 = new ButtonBuilder().setCustomId(`prof_server_${userId}`).setLabel('Server').setStyle(ButtonStyle.Success);
    }

    const row = new ActionRowBuilder().addComponents(b1, b2, b3);
    return interaction.update({ embeds: [embed], components: [row] });
  });
};
