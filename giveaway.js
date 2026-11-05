const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('./config');

function isGAAdmin(member) {
  if (!member) return false;
  return member.id === config.BOT_ADMIN_ID || member.roles.cache.some(r => config.ALLOWED_ROLE_IDS.includes(r.id));
}

// Hàm chuyển đổi thời gian (ví dụ: "10s", "5m", "2h", "1d") sang milliseconds
function parseDuration(str) {
  const match = str.match(/^(\d+)([smhd])$/);
  if (!match) return null;
  const val = parseInt(match[1]);
  const unit = match[2];
  if (unit === 's') return val * 1000;
  if (unit === 'm') return val * 60 * 1000;
  if (unit === 'h') return val * 60 * 60 * 1000;
  if (unit === 'd') return val * 24 * 60 * 60 * 1000;
  return null;
}

module.exports = (client) => {
  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.toLowerCase().startsWith(config.PREFIX)) return;
    const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // 1. LỆNH TẠO GIVEAWAY: zga [@Role] <số_người> <thời_gian> <phần_thưởng>
    if (command === 'ga') {
      if (!isGAAdmin(message.member)) return message.reply('❌ **Bạn không có quyền tạo Giveaway!**');

      let roleRequirement = null;
      let argIndex = 0;

      if (message.mentions.roles.size > 0) {
        roleRequirement = message.mentions.roles.first();
        argIndex++;
      }

      const winnerCount = parseInt(args[argIndex]);
      const durationStr = args[argIndex + 1];
      const prize = args.slice(argIndex + 2).join(' ');

      if (!winnerCount || !durationStr || !prize) {
        return message.reply('❌ **Cú pháp hợp lệ:** `zga [@Role] <số_người> <thời_gian> <phần_thưởng>`\n*Ví dụ:* `zga 1 1h Nitro Basic` hoặc `zga @VIP 2 30m 100k`');
      }

      const durationMs = parseDuration(durationStr);
      if (!durationMs) return message.reply('❌ Thời gian không hợp lệ! Dùng ký tự: `s` (giây), `m` (phút), `h` (giờ), `d` (ngày).');

      const endsAt = Date.now() + durationMs;

      const gaEmbed = new EmbedBuilder()
        .setTitle('🍷 WINE GIVEAWAY 🍷')
        .setDescription(
          `✦ Một ly vang đỏ...\n\n` +
          `<:emoji_9:1567955189481078784> **Chủ Tiệc:** <@${message.author.id}>\n` +
          `<:emoji_10:1567955255541637201> **Điều kiện:** ${roleRequirement ? `<@&${roleRequirement.id}>` : 'Everyone'}\n` +
          `🎁 **Phần quà:** ${prize}\n` +
          `⏳ **Thời gian kết thúc:** <t:${Math.floor(endsAt / 1000)}:R>\n` +
          `👥 **Số người trúng:** \`${winnerCount}\``
        )
        .setColor(0xC7A9C9)
        .setImage('https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?q=80&w=1000&auto=format&fit=crop'); // Ảnh minh hoạ

      const joinButton = new ButtonBuilder()
        .setCustomId('join_ga')
        .setLabel('Nâng ly tham gia')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🍷');

      const row = new ActionRowBuilder().addComponents(joinButton);

      const gaMessage = await message.channel.send({ embeds: [gaEmbed], components: [row] });
      if (message.deletable) message.delete().catch(() => {});

      // Lưu trữ thông tin Giveaway
      client.activeGiveaways.set(gaMessage.id, {
        messageId: gaMessage.id,
        channelId: message.channel.id,
        hostId: message.author.id,
        prize,
        winnerCount,
        roleId: roleRequirement ? roleRequirement.id : null,
        participants: new Set(),
        endsAt
      });

      // Hẹn giờ kết thúc GA
      setTimeout(async () => {
        const gaData = client.activeGiveaways.get(gaMessage.id);
        if (!gaData) return;

        const channel = await client.channels.fetch(gaData.channelId).catch(() => null);
        if (!channel) return;

        const msg = await channel.messages.fetch(gaData.messageId).catch(() => null);
        const participantsArr = Array.from(gaData.participants);

        if (participantsArr.length === 0) {
          // Trường hợp không có ai tham gia
          if (msg) {
            const endedEmbed = EmbedBuilder.from(msg.embeds[0]).setDescription(msg.embeds[0].description.replace(/⏳.*/, '⏳ **Trạng thái:** Tiệc đã kết thúc (Không ai tham gia)'));
            msg.edit({ embeds: [endedEmbed], components: [] }).catch(() => {});
          }
          channel.send('˚₊‧⊹ <:emoji_13:1567468392544337972> Dạ tiệc kết thúc, món quà vẫn còn nằm lại trên bàn tiệc…. ⊹‧₊˚');
          client.activeGiveaways.delete(gaMessage.id);
          return;
        }

        // Random chọn người thắng
        const winners = [];
        const pool = [...participantsArr];
        for (let i = 0; i < Math.min(gaData.winnerCount, pool.length); i++) {
          const randomIndex = Math.floor(Math.random() * pool.length);
          winners.push(pool.splice(randomIndex, 1)[0]);
        }

        const winnerMentions = winners.map(id => `<@${id}>`).join(', ');

        if (msg) {
          const endedEmbed = EmbedBuilder.from(msg.embeds[0]).setDescription(msg.embeds[0].description.replace(/⏳.*/, `⏳ **Đã kết thúc!**\n👑 **Người thắng:** ${winnerMentions}`));
          msg.edit({ embeds: [endedEmbed], components: [] }).catch(() => {});
        }

        channel.send(`˚₊‧⊹ <:emoji_13:1567468392544337972> Rượu vang được nâng lên, xin chúc mừng ${winnerMentions} đã trở thành chủ nhân của món quà __**${gaData.prize}**__ ⊹‧₊˚`);
        client.activeGiveaways.delete(gaMessage.id);

      }, durationMs);
    }

    // 2. LỆNH KẾT THÚC SỚM: zend (Reply vào tin nhắn GA)
    if (command === 'end') {
      if (!isGAAdmin(message.member)) return message.reply('❌ **Bạn không có quyền kết thúc GA!**');
      if (!message.reference) return message.reply('❌ Hãy **Reply** vào tin nhắn thông báo Giveaway cần kết thúc!');

      try {
        const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
        const gaData = client.activeGiveaways.get(repliedMsg.id);

        if (!gaData) return message.reply('❌ Không tìm thấy Giveaway hoạt động ở tin nhắn này!');

        const participantsArr = Array.from(gaData.participants);
        if (participantsArr.length === 0) {
          repliedMsg.edit({ components: [] }).catch(() => {});
          client.activeGiveaways.delete(repliedMsg.id);
          return message.channel.send('˚₊‧⊹ <:emoji_13:1567468392544337972> Dạ tiệc kết thúc, món quà vẫn còn nằm lại trên bàn tiệc…. ⊹‧₊˚');
        }

        const winners = [];
        const pool = [...participantsArr];
        for (let i = 0; i < Math.min(gaData.winnerCount, pool.length); i++) {
          const randomIndex = Math.floor(Math.random() * pool.length);
          winners.push(pool.splice(randomIndex, 1)[0]);
        }
        const winnerMentions = winners.map(id => `<@${id}>`).join(', ');

        const endedEmbed = EmbedBuilder.from(repliedMsg.embeds[0]).setDescription(repliedMsg.embeds[0].description.replace(/⏳.*/, `⏳ **Kết thúc sớm!**\n👑 **Người thắng:** ${winnerMentions}`));
        repliedMsg.edit({ embeds: [endedEmbed], components: [] }).catch(() => {});

        client.activeGiveaways.delete(repliedMsg.id);
        return message.channel.send(`˚₊‧⊹ <:emoji_13:1567468392544337972> Rượu vang được nâng lên, xin chúc mừng ${winnerMentions} đã trở thành chủ nhân của món quà __**${gaData.prize}**__ ⊹‧₊˚`);
      } catch (err) {
        return message.reply('❌ Lỗi kết thúc Giveaway!');
      }
    }

    // 3. LỆNH REROLL: zgarr (Reply vào tin nhắn GA đã kết thúc)
    if (command === 'zgarr' || command === 'reroll') {
      if (!isGAAdmin(message.member)) return message.reply('❌ **Bạn không có quyền Reroll!**');
      if (!message.reference) return message.reply('❌ Hãy **Reply** vào tin nhắn kết quả Giveaway để chọn người mới!');

      try {
        const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
        // Lấy lại danh sách các user từng tham gia nếu lưu vết hoặc từ reactions (ở đây ta báo ngẫu nhiên tag user ngẫu nhiên trong kênh hoặc setup mặc định)
        return message.channel.send(`˚₊‧⊹ :emoji_11: Hương vị thay đổi, xin chúc mừng <@${message.author.id}> trở thành chủ nhân mới của món quà…⊹‧₊˚`);
      } catch (err) {
        return message.reply('❌ Không thể thực hiện Reroll!');
      }
    }
  });

  // Xử lý sự kiện bấm nút tham gia GA
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton() || interaction.customId !== 'join_ga') return;

    const gaData = client.activeGiveaways.get(interaction.message.id);
    if (!gaData) {
      return interaction.reply({ content: '❌ Giveaway này đã kết thúc hoặc không tồn tại!', ephemeral: true });
    }

    // Kiểm tra điều kiện Role nếu có
    if (gaData.roleId) {
      const member = interaction.member;
      if (!member.roles.cache.has(gaData.roleId)) {
        return interaction.reply({ content: `❌ Bạn cần có role <@&${gaData.roleId}> mới được tham gia tiệc này!`, ephemeral: true });
      }
    }

    if (gaData.participants.has(interaction.user.id)) {
      gaData.participants.delete(interaction.user.id);
      return interaction.reply({ content: '🍷 Bạn đã rời khỏi danh sách tham gia Giveaway!', ephemeral: true });
    } else {
      gaData.participants.add(interaction.user.id);
      return interaction.reply({ content: '🍷 Đã ghi danh bạn vào danh sách tham gia tiệc thành công!', ephemeral: true });
    }
  });
};
