const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('./config');

module.exports = (client) => {
  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.toLowerCase().startsWith(config.PREFIX)) return;
    const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'avt' || command === 'check') {
      let targetUser = message.mentions.users.first();

      if (!targetUser && message.reference && message.reference.messageId) {
        try {
          const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
          targetUser = repliedMsg.author;
        } catch (err) {}
      }

      if (!targetUser) targetUser = message.author;

      try {
        targetUser = await targetUser.fetch();
      } catch (e) {}

      const avatarUrl = targetUser.displayAvatarURL({ dynamic: true, size: 1024 });
      const bannerUrl = targetUser.bannerURL({ dynamic: true, size: 1024 });

      const embed = new EmbedBuilder()
        .setTitle(`🖼️ Hồ Sơ: ${targetUser.tag}`)
        .setImage(avatarUrl)
        .setDescription(`• **ID:** \`${targetUser.id}\`\n• **Đang xem:** \`Avatar\``)
        .setColor(0xC7A9C9);

      const avtButton = new ButtonBuilder()
        .setCustomId(`avt_${targetUser.id}`)
        .setLabel('Avatar')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true);

      const bannerButton = new ButtonBuilder()
        .setCustomId(`banner_${targetUser.id}`)
        .setLabel('Banner')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!bannerUrl);

      const row = new ActionRowBuilder().addComponents(avtButton, bannerButton);

      return message.channel.send({ embeds: [embed], components: [row] });
    }
  });

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('avt_') && !interaction.customId.startsWith('banner_')) return;

    const [type, userId] = interaction.customId.split('_');
    const targetUser = await client.users.fetch(userId).catch(() => null);
    if (!targetUser) return interaction.reply({ content: '❌ Không tìm thấy thông tin người dùng!', ephemeral: true });

    const avatarUrl = targetUser.displayAvatarURL({ dynamic: true, size: 1024 });
    const bannerUrl = targetUser.bannerURL({ dynamic: true, size: 1024 });

    const embed = new EmbedBuilder()
      .setTitle(`🖼️ Hồ Sơ: ${targetUser.tag}`)
      .setColor(0xC7A9C9);

    const avtBtn = new ButtonBuilder().setCustomId(`avt_${userId}`).setLabel('Avatar');
    const bannerBtn = new ButtonBuilder().setCustomId(`banner_${userId}`).setLabel('Banner').setDisabled(!bannerUrl);

    if (type === 'avt') {
      embed.setImage(avatarUrl).setDescription(`• **ID:** \`${userId}\`\n• **Đang xem:** \`Avatar\``);
      avtBtn.setStyle(ButtonStyle.Primary).setDisabled(true);
      bannerBtn.setStyle(ButtonStyle.Secondary);
    } else {
      embed.setImage(bannerUrl || avatarUrl).setDescription(`• **ID:** \`${userId}\`\n• **Đang xem:** \`Banner\` ${!bannerUrl ? '(Người dùng không có banner)' : ''}`);
      avtBtn.setStyle(ButtonStyle.Secondary);
      bannerBtn.setStyle(ButtonStyle.Primary).setDisabled(false);
    }

    const row = new ActionRowBuilder().addComponents(avtBtn, bannerBtn);
    return interaction.update({ embeds: [embed], components: [row] });
  });
};
