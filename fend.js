const config = require('./config');
const { EmbedBuilder } = require('discord.js');

function isGAAdmin(member) {
  if (!member) return false;
  const adminIds = Array.isArray(config.BOT_ADMIN_ID) ? config.BOT_ADMIN_ID : [config.BOT_ADMIN_ID];
  if (adminIds.includes(member.id)) return true;
  if (config.ALLOWED_ROLE_IDS && member.roles.cache.some(r => config.ALLOWED_ROLE_IDS.includes(r.id))) return true;
  return false;
}

module.exports = (client) => {
  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.toLowerCase().startsWith(config.PREFIX)) return;
    
    const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // =============== LỆNH ÉP KẾT THÚC (zfend) ===============
    if (command === 'fend') {
      if (!isGAAdmin(message.member)) {
          return message.reply('❌ Bạn không có quyền để end GA!');
      }

      let msgId = args[0];
      if (message.reference && message.reference.messageId) {
        msgId = message.reference.messageId;
      }
      if (!msgId) return message.reply('❌ Hãy **Reply** tin nhắn GA bị kẹt và gõ lệnh, hoặc nhập ID tin nhắn!');

      try {
        const gaMessage = await message.channel.messages.fetch(msgId).catch(() => null);
        if (!gaMessage) return message.reply('❌ Không tìm thấy tin nhắn này trong kênh!');

        await gaMessage.fetch();

        let prizeName = "phần quà bí mật";
        let winnerCount = 1;

        if (gaMessage.embeds.length > 0) {
          const oldEmbed = gaMessage.embeds[0];
          const newEmbed = EmbedBuilder.from(oldEmbed);
          const desc = oldEmbed.description || '';

          const prizeMatch = desc.match(/\*\*Phần quà:\*\* (.*?)(?=\n|$)/);
          if (prizeMatch) prizeName = prizeMatch[1].trim();

          if (newEmbed.data.description) {
            let newDesc = newEmbed.data.description.replace(/(<:emoji_13:1567468392544337972> \*\*Còn lại:\*\*|Còn lại:|<:emoji_13:1567468392544337972> \*\*Thời gian khai tiệc còn lại:\*\*).*$/m, '<:emoji_13:1567468392544337972> **Còn lại:** Tiệc đã kết thúc');
            newEmbed.setDescription(newDesc);
          }
          await gaMessage.edit({ embeds: [newEmbed] });
        }

        let participants = [];
        for (const [key, reaction] of gaMessage.reactions.cache) {
          const users = await reaction.users.fetch().catch(() => null);
          if (users) {
            const humanUsers = users.filter(u => !u.bot).map(u => u.id);
            participants = [...new Set([...participants, ...humanUsers])];
          }
        }

        if (participants.length === 0) {
          return message.channel.send('˚₊‧⊹ <:emoji_13:1567468392544337972> Dạ tiệc kết thúc, món quà vẫn còn nằm lại trên bàn tiệc…. ⊹‧₊˚');
        }

        const winners = [];
        const pool = [...participants];
        for (let i = 0; i < Math.min(winnerCount, pool.length); i++) {
          const randomIndex = Math.floor(Math.random() * pool.length);
          winners.push(pool.splice(randomIndex, 1)[0]);
        }
        const winnerMentions = winners.map(id => `<@${id}>`).join(', ');

        await message.channel.send(`˚₊‧⊹ <:emoji_13:1567468392544337972> Rượu vang được nâng lên, xin chúc mừng ${winnerMentions} đã trở thành chủ nhân của món quà __**${prizeName}**__ ⊹‧₊˚`);
        return message.react('✅').catch(()=>{});

      } catch (err) {
        console.error("Lỗi zfend:", err);
        return message.reply('❌ Lỗi! Tin nhắn có thể đã bị xóa.');
      }
    }

    // =============== LỆNH ÉP REROLL (zreroll hoặc zgarr) ===============
    if (command === 'reroll' || command === 'garr') {
      if (!isGAAdmin(message.member)) {
          return message.reply('❌ Bạn không có quyền để reroll!');
      }

      let msgId = args[0];
      if (message.reference && message.reference.messageId) {
        msgId = message.reference.messageId;
      }
      if (!msgId) return message.reply('❌ **Reply** vào tin nhắn GA bị kẹt để bốc lại!');

      try {
        const gaMessage = await message.channel.messages.fetch(msgId).catch(() => null);
        if (!gaMessage) return message.reply('❌ Không tìm thấy tin nhắn!');
        await gaMessage.fetch();

        let participants = [];
        for (const [key, reaction] of gaMessage.reactions.cache) {
          const users = await reaction.users.fetch().catch(() => null);
          if (users) {
            const humanUsers = users.filter(u => !u.bot).map(u => u.id);
            participants = [...new Set([...participants, ...humanUsers])];
          }
        }

        if (participants.length === 0) {
          return message.reply('❌ Không có ngươi nào hợp lệ nào để reroll.');
        }

        const randomIndex = Math.floor(Math.random() * participants.length);
        const winnerId = participants[randomIndex];

        await message.channel.send(`˚₊‧⊹ <:emoji_11:1567468310419742810> Hương vị thay đổi, xin chúc mừng <@$ {winnerId}> trở thành chủ nhân mới của món quà…⊹‧₊˚`.replace(/\$ /, ''));
        return message.react('✅').catch(()=>{});
        
      } catch (err) {
        console.error("Lỗi reroll:", err);
        return message.reply('❌ Lỗi Reroll!');
      }
    }
  });
};
