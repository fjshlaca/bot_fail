const { EmbedBuilder } = require('discord.js');
const config = require('./config');

function isGAAdmin(member) {
  if (!member) return false;
  return member.id === config.BOT_ADMIN_ID || member.roles.cache.some(r => config.ALLOWED_ROLE_IDS.includes(r.id));
}

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
        return message.reply('❌ **Cú pháp hợp lệ:** `zga [@Role] <số_người> <thời_gian> <phần_thưởng>`\n*Ví dụ:* `zga 1 1h 100k` hoặc `zga @VIP 2 30m Nitro`');
      }

      const durationMs = parseDuration(durationStr);
      if (!durationMs) return message.reply('❌ Thời gian không hợp lệ! Dùng ký tự: `s`, `m`, `h`, `d`.');

      const endsAt = Date.now() + durationMs;

      // Giao diện chuẩn tuyệt đối theo đúng yêu cầu của Đức
      const gaEmbed = new EmbedBuilder()
        .setTitle('<:emoji_11:1567468310419742810> WINE GIVEAWAY <:emoji_11:1567468310419742810>')
        .setDescription(
          `✧ Một ly vang đỏ, một món quà dành cho vị khách hữu duyên.\n\n` +
          `<:emoji_9:1567955189481078784> **Chủ Tiệc:** <@${message.author.id}>\n` +
          `<:emoji_10:1567955255541637201> **Điều kiện:** ${roleRequirement ? `<@&${roleRequirement.id}>` : 'Everyone'}\n` +
          `<:emoji_13:1567468392544337972> **Phần quà:** ${prize}\n` +
          `<:emoji_13:1567468392544337972> **Còn lại:** <t:${Math.floor(endsAt / 1000)}:R>`
        )
        .setColor(0xC7A9C9)
        .setThumbnail('https://media.discordapp.net/attachments/1425167406686404808/1567463399909097533/Photoroom_20261104_154923.png?ex=6aed970c&is=6aec458c&hm=27289b1d3d210797c15ea7dc9cccce9f14822a4d71348d364d1c38efd5552273&=&format=webp&quality=lossless&width=640&height=640')
        .setImage('https://media.discordapp.net/attachments/1425167406686404808/1567463400647426109/2FE0AAB4-BB1C-4A82-A922-3F7D419E7105.png?ex=6aed970c&is=6aec458c&hm=2042a3ad70269850299f51a28afddf0e3c3d9262a58578739e8b403054d152d9&=&format=webp&quality=lossless&width=1280&height=721');

      const gaMessage = await message.channel.send({ embeds: [gaEmbed] });
      if (message.deletable) message.delete().catch(() => {});

      // Bot tự thả reaction custom emoji 11 để người chơi bấm vào tham gia
      await gaMessage.react('1567468310419742810').catch(() => {});

      client.activeGiveaways.set(gaMessage.id, {
        messageId: gaMessage.id,
        channelId: message.channel.id,
        hostId: message.author.id,
        prize,
        winnerCount,
        roleId: roleRequirement ? roleRequirement.id : null,
        endsAt
      });

      // Hẹn giờ kết thúc GA
      setTimeout(async () => {
        const gaData = client.activeGiveaways.get(gaMessage.id);
        if (!gaData) return;

        const channel = await client.channels.fetch(gaData.channelId).catch(() => null);
        if (!channel) return;

        const msg = await channel.messages.fetch(gaData.messageId).catch(() => null);
        if (!msg) return;

        // Lấy danh sách user đã react custom emoji 11
        const reaction = msg.reactions.cache.find(r => r.emoji.id === '1567468310419742810');
        let participants = [];
        if (reaction) {
          const users = await reaction.users.fetch();
          participants = users.filter(u => !u.bot).map(u => u.id);
        }

        // Lọc theo điều kiện role nếu có
        let validParticipants = participants;
        if (gaData.roleId && channel.guild) {
          validParticipants = [];
          for (const userId of participants) {
            const member = await channel.guild.members.fetch(userId).catch(() => null);
            if (member && member.roles.cache.has(gaData.roleId)) {
              validParticipants.push(userId);
            }
          }
        }

        if (validParticipants.length === 0) {
          const endedEmbed = EmbedBuilder.from(msg.embeds[0]).setDescription(msg.embeds[0].description.replace(/.*|Còn lại:.*/, ' **Còn lại:** Tiệc đã kết thúc'));
          msg.edit({ embeds: [endedEmbed] }).catch(() => {});
          channel.send('˚₊‧⊹ <:emoji_13:1567468392544337972> Dạ tiệc kết thúc, món quà vẫn còn nằm lại trên bàn tiệc…. ⊹‧₊˚');
          client.activeGiveaways.delete(gaMessage.id);
          return;
        }

        const winners = [];
        const pool = [...validParticipants];
        for (let i = 0; i < Math.min(gaData.winnerCount, pool.length); i++) {
          const randomIndex = Math.floor(Math.random() * pool.length);
          winners.push(pool.splice(randomIndex, 1)[0]);
        }

        const winnerMentions = winners.map(id => `<@${id}>`).join(', ');

        const endedEmbed = EmbedBuilder.from(msg.embeds[0]).setDescription(msg.embeds[0].description.replace(/.*|Còn lại:.*/, ` **Còn lại:** Tiệc đã kết thúc`));
        msg.edit({ embeds: [endedEmbed] }).catch(() => {});

        channel.send(`˚₊‧⊹ <:emoji_13:1567468392544337972> Rượu vang được nâng lên, xin chúc mừng ${winnerMentions} đã trở thành chủ nhân của món quà __**${gaData.prize}**__ ⊹‧₊˚`);
        client.activeGiveaways.delete(gaMessage.id);

      }, durationMs);
    }

    // 2. LỆNH KẾT THÚC SỚM: zend
    if (command === 'end') {
      if (!isGAAdmin(message.member)) return message.reply('❌ **Bạn không có quyền kết thúc GA!**');
      if (!message.reference) return message.reply('❌ Hãy **Reply** vào tin nhắn thông báo Giveaway cần kết thúc!');

      try {
        const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
        const gaData = client.activeGiveaways.get(repliedMsg.id);

        if (!gaData) return message.reply('❌ Không tìm thấy Giveaway hoạt động ở tin nhắn này!');

        const reaction = repliedMsg.reactions.cache.find(r => r.emoji.id === '1567468310419742810');
        let participants = [];
        if (reaction) {
          const users = await reaction.users.fetch();
          participants = users.filter(u => !u.bot).map(u => u.id);
        }

        let validParticipants = participants;
        if (gaData.roleId && message.guild) {
          validParticipants = [];
          for (const userId of participants) {
            const member = await message.guild.members.fetch(userId).catch(() => null);
            if (member && member.roles.cache.has(gaData.roleId)) {
              validParticipants.push(userId);
            }
          }
        }

        if (validParticipants.length === 0) {
          repliedMsg.edit({}).catch(() => {});
          client.activeGiveaways.delete(repliedMsg.id);
          return message.channel.send('˚₊‧⊹ <:emoji_13:1567468392544337972> Dạ tiệc kết thúc, món quà vẫn còn nằm lại trên bàn tiệc…. ⊹‧₊˚');
        }

        const winners = [];
        const pool = [...validParticipants];
        for (let i = 0; i < Math.min(gaData.winnerCount, pool.length); i++) {
          const randomIndex = Math.floor(Math.random() * pool.length);
          winners.push(pool.splice(randomIndex, 1)[0]);
        }
        const winnerMentions = winners.map(id => `<@${id}>`).join(', ');

        if (repliedMsg.embeds[0]) {
          const endedEmbed = EmbedBuilder.from(repliedMsg.embeds[0]).setDescription(repliedMsg.embeds[0].description.replace(/.*|Còn lại:.*/, ` **Còn lại:** Tiệc đã kết thúc`));
          repliedMsg.edit({ embeds: [endedEmbed] }).catch(() => {});
        } else {
          repliedMsg.edit({}).catch(() => {});
        }

        client.activeGiveaways.delete(repliedMsg.id);
        return message.channel.send(`˚₊‧⊹ <:emoji_13:1567468392544337972> Rượu vang được nâng lên, xin chúc mừng ${winnerMentions} đã trở thành chủ nhân của món quà __**${gaData.prize}**__ ⊹‧₊˚`);
      } catch (err) {
        return message.reply('❌ Lỗi kết thúc Giveaway!');
      }
    }

    // 3. LỆNH REROLL: zgarr
    if (command === 'zgarr' || command === 'reroll') {
      if (!isGAAdmin(message.member)) return message.reply('❌ **Bạn không có quyền Reroll!**');
      if (!message.reference) return message.reply('❌ Hãy **Reply** vào tin nhắn kết quả Giveaway!');
      return message.channel.send(`˚₊‧⊹ :emoji_11: Hương vị thay đổi, xin chúc mừng <@${message.author.id}> trở thành chủ nhân mới của món quà…⊹‧₊˚`);
    }
  });
};
