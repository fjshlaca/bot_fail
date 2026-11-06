const config = require('./config');
const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.toLowerCase().startsWith(config.PREFIX)) return;
    
    const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // =============== LỆNH ÉP KẾT THÚC (zfend) ===============
    if (command === 'fend') {
      if (!message.member.permissions.has('Administrator')) {
          return message.reply('❌ Bạn không có quyền Administrator để end GA!');
      }

      let msgId = args[0];
      if (message.reference && message.reference.messageId) {
        msgId = message.reference.messageId;
      }
      if (!msgId) return message.reply('❌ Hãy **Reply** tin nhắn GA bị kẹt và gõ lệnh, hoặc nhập ID tin nhắn!');

      try {
        const gaMessage = await message.channel.messages.fetch(msgId);
        if (!gaMessage) return message.reply('❌ Không tìm thấy tin nhắn này trong kênh!');

        let prizeName = "phần quà bí mật";
        let winnerCount = 1;

        // 1. SỬA EMBED VÀ LẤY LẠI THÔNG TIN PHẦN QUÀ
        if (gaMessage.embeds.length > 0) {
          const oldEmbed = gaMessage.embeds[0];
          const newEmbed = EmbedBuilder.from(oldEmbed);
          const desc = oldEmbed.description || '';

          // Cố gắng "móc" lại tên phần quà từ Embed cũ
          const prizeMatch = desc.match(/\*\*Phần quà:\*\* (.*?)(?=\n|$)/);
          if (prizeMatch) prizeName = prizeMatch[1].trim();

          // Sửa dòng "Còn lại:" thành "Tiệc đã kết thúc" giống hệt giveaway.js
          if (newEmbed.data.description) {
            let newDesc = newEmbed.data.description.replace(/(<:emoji_13:1567468392544337972> \*\*Còn lại:\*\*|Còn lại:|<:emoji_13:1567468392544337972> \*\*Thời gian khai tiệc còn lại:\*\*).*$/m, '<:emoji_13:1567468392544337972> **Còn lại:** Tiệc đã kết thúc');
            newEmbed.setDescription(newDesc);
          }
          await gaMessage.edit({ embeds: [newEmbed] });
        }

        // 2. TÌM REACTION VÀ BỐC THĂM
        const reaction = gaMessage.reactions.cache.find(r => r.emoji.id === '1567468310419742810') || gaMessage.reactions.cache.first();
        
        let participants = [];
        if (reaction) {
          const users = await reaction.users.fetch();
          participants = users.filter(u => !u.bot).map(u => u.id);
        }

        if (participants.length === 0) {
          return message.channel.send('˚₊‧⊹ <:emoji_13:1567468392544337972> Dạ tiệc kết thúc, món quà vẫn còn nằm lại trên bàn tiệc…. ⊹‧₊˚');
        }

        // Bốc ngẫu nhiên
        const winners = [];
        const pool = [...participants];
        for (let i = 0; i < Math.min(winnerCount, pool.length); i++) {
          const randomIndex = Math.floor(Math.random() * pool.length);
          winners.push(pool.splice(randomIndex, 1)[0]);
        }
        const winnerMentions = winners.map(id => `<@${id}>`).join(', ');

        // Công bố chuẩn văn phong
        await message.channel.send(`˚₊‧⊹ <:emoji_13:1567468392544337972> Rượu vang được nâng lên, xin chúc mừng ${winnerMentions} đã trở thành chủ nhân của món quà __**${prizeName}**__ ⊹‧₊˚`);
        return message.react('✅').catch(()=>{});

      } catch (err) {
        console.error("Lỗi zfend:", err);
        return message.reply('❌ Lỗi mất rồi! Tin nhắn có thể đã bị xóa.');
      }
    }


    // =============== LỆNH ÉP REROLL (zreroll hoặc zgarr) ===============
    if (command === 'reroll' || command === 'garr') {
      if (!message.member.permissions.has('Administrator')) {
          return message.reply('❌ Bạn không có quyền Administrator để ép reroll!');
      }

      let msgId = args[0];
      if (message.reference && message.reference.messageId) {
        msgId = message.reference.messageId;
      }
      if (!msgId) return message.reply('❌ Hãy **Reply** vào tin nhắn GA bị kẹt để bốc lại!');

      try {
        const gaMessage = await message.channel.messages.fetch(msgId);
        
        // Lấy danh sách react
        const reaction = gaMessage.reactions.cache.find(r => r.emoji.id === '1567468310419742810') || gaMessage.reactions.cache.first();
        if (!reaction) return message.reply('❌ GA này không có ai tham gia để bốc lại cả!');

        const users = await reaction.users.fetch();
        const validParticipants = users.filter(u => !u.bot).map(u => u.id);

        if (validParticipants.length === 0) {
          return message.reply('❌ Không có người chơi hợp lệ nào để reroll.');
        }

        // Reroll ngẫu nhiên 1 người
        const randomIndex = Math.floor(Math.random() * validParticipants.length);
        const winnerId = validParticipants[randomIndex];

        // Công bố chuẩn văn phong reroll
        await message.channel.send(`˚₊‧⊹ <:emoji_11:1567468310419742810> Hương vị thay đổi, xin chúc mừng <@${winnerId}> trở thành chủ nhân mới của món quà…⊹‧₊˚`);
        return message.react('✅').catch(()=>{});
        
      } catch (err) {
        console.error("Lỗi reroll:", err);
        return message.reply('❌ Lỗi Reroll');
      }
    }
  });
};
