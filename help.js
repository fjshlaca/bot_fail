const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('./config');

module.exports = (client) => {
  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.toLowerCase().startsWith(config.PREFIX)) return;
    const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'help') {
      const helpEmbed = new EmbedBuilder()
        .setTitle('📖 Danh Sách Lệnh — Hệ Thống')
        .setDescription(
          `Prefix của bot là **\`z\`**\n` +
          `Chọn một danh mục từ menu bên dưới để xem chi tiết các lệnh.\n\n` +
          `**Các danh mục:**\n` +
          `• ** Mod **\n` +
          `• ** Giveaway **\n` +
          `• ** Gacha **\n` +
          `• ** Bot Voice **\n` +
          `• ** Thống Kê **`
        )
        .setColor(0xC7A9C9);

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('help_menu')
        .setPlaceholder('📂 Chọn một danh mục để xem lệnh...')
        .addOptions([
          { label: ' Mod ', description: 'Các lệnh clear, mute, ban, phạt tù...', value: 'mod' },
          { label: ' Giveaway ', description: 'Các lệnh tạo ga, kết thúc, reroll...', value: 'ga' },
          { label: ' Gacha ', description: 'Lệnh mở rương báu nhận royal role...', value: 'gacha' },
          { label: ' Bot Voice ', description: 'Lệnh join, joinv, out voice...', value: 'voice' },
          { label: ' Thống Kê ', description: 'Xem biến động thành viên 3, 7, 30 ngày...', value: 'stats' }
        ]);

      const row = new ActionRowBuilder().addComponents(selectMenu);
      return message.channel.send({ embeds: [helpEmbed], components: [row] });
    }
  });

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;

    const homeEmbed = new EmbedBuilder()
      .setTitle('📖 Danh Sách Lệnh — Hệ Thống')
      .setDescription(
        `Prefix của bot là **\`z\`**\n` +
        `Chọn một danh mục từ menu bên dưới để xem chi tiết các lệnh.\n\n` +
        `**Các danh mục:**\n` +
        `• ** Mod **\n` +
        `• ** Giveaway **\n` +
        `• ** Gacha **\n` +
        `• ** Bot Voice **\n` +
        `• ** Thống Kê **`
      )
      .setColor(0xC7A9C9);

    const homeMenu = new StringSelectMenuBuilder()
      .setCustomId('help_menu')
      .setPlaceholder('📂 Chọn một danh mục để xem lệnh...')
      .addOptions([
        { label: ' Mod ', description: 'Các lệnh clear, mute, ban, phạt tù...', value: 'mod' },
        { label: ' Giveaway ', description: 'Các lệnh tạo ga, kết thúc, reroll...', value: 'ga' },
        { label: ' Gacha ', description: 'Lệnh mở rương báu nhận royal role...', value: 'gacha' },
        { label: ' Bot Voice ', description: 'Lệnh join, joinv, out voice...', value: 'voice' },
        { label: ' Thống Kê ', description: 'Xem biến động thành viên 3, 7, 30 ngày...', value: 'stats' }
      ]);
    const homeRow = new ActionRowBuilder().addComponents(homeMenu);

    if (interaction.isStringSelectMenu() && interaction.customId === 'help_menu') {
      const selected = interaction.values[0];
      let detailEmbed = new EmbedBuilder().setColor(0xC7A9C9);

      if (selected === 'mod') {
        detailEmbed.setTitle(' Mod ').setDescription('`zclear <1-100>` — Xóa nhanh tin nhắn\n`zmute <tg> [lý_do]` — Cấm ngôn\n`zunmute` — Gỡ cấm ngôn\n`zban` — Ban thành viên\n`ztu <số_lần>` — Phạt tù\n`ztron` — Vượt ngục\n`zancut` — Ăn cút sám hối');
      } else if (selected === 'ga') {
        detailEmbed.setTitle(' Giveaway ').setDescription('`zga [@Role] <số> <tg> <quà>` — Tạo GA\n`zend` — Kết thúc GA sớm\n`zgarr` — Reroll người trúng');
      } else if (selected === 'gacha') {
        detailEmbed.setTitle(' Gacha ').setDescription('`zrdrole` — Khai mở rương báu nhận Royal Role');
      } else if (selected === 'voice') {
        detailEmbed.setTitle(' Bot Voice ').setDescription('`zjoin` — Gọi bot vào voice (5p tự out)\n`zjoinv` — Cắm chốt vĩnh viễn\n`zout` — Đuổi bot ra');
      } else if (selected === 'stats') {
        detailEmbed.setTitle(' Thống Kê ').setDescription('`zstats 3` — Xem biến động mem trong 3 ngày\n`zstats 7` — Xem biến động mem trong 7 ngày\n`zstats 30` — Xem biến động mem trong 30 ngày');
      }

      const backButton = new ButtonBuilder().setCustomId('help_home').setLabel('Quay về').setStyle(ButtonStyle.Secondary);
      const backRow = new ActionRowBuilder().addComponents(backButton);
      return interaction.update({ embeds: [detailEmbed], components: [backRow] });
    }

    if (interaction.isButton() && interaction.customId === 'help_home') {
      return interaction.update({ embeds: [homeEmbed], components: [homeRow] });
    }
  });
};
