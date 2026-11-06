const config = require('./config');
const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.toLowerCase().startsWith(config.PREFIX)) return;
    
    const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'fend') {
      if (!message.member.permissions.has('Administrator')) {
          return message.reply('❌ Bạn không có quyền để end GA!');
      }

      // Ưu tiên lấy ID từ tin nhắn được Reply, nếu không thì lấy từ nội dung gõ theo sau
      let msgId = args[0];
      if (message.reference && message.reference.messageId) {
        msgId = message.reference.messageId;
      }

      if (!msgId) return message.reply('❌ Hãy **Reply ** tin nhắn GA và gõ lệnh, hoặc nhập ID tin nhắn!');

      try {
        const gaMessage = await message.channel.messages.fetch(msgId);
        if (!gaMessage) return message.reply('❌ Không tìm thấy tin nhắn này trong kênh!');

        // 1. SỬA CHỮ TRONG TIN NHẮN CŨ THÀNH "ĐÃ KẾT THÚC"
        if (gaMessage.embeds.length > 0) {
          const oldEmbed = gaMessage.embeds[0];
          const newEmbed = EmbedBuilder.from(oldEmbed);

          // Đổi dòng thời gian thành Đã kết thúc
          if (newEmbed.data.description) {
            let newDesc = newEmbed.data.description
              .replace(/Còn lại:.*$/m, 'Trạng thái: **Đã kết thúc **')
              .replace(/Thời gian khai tiệc còn lại:.*$/m, 'Trạng thái: **Đã kết thúc **');
            
            newEmbed.setDescription(newDesc);
          }
          
          await gaMessage.edit({ embeds: [newEmbed] });
        }

        // 2. BỐC THĂM NGƯỜI TRÚNG THƯỞNG
        const reaction = gaMessage.reactions.cache.first();
        if (!reaction) return message.reply(' Đã sửa Embed thành Đã kết thúc .');

        const users = await reaction.users.fetch();
        const validUsers = users.filter(u => !u.bot);
        
        if (validUsers.size > 0) {
          const winner = validUsers.random();
          await message.channel.send(`˚₊‧⊹ <:emoji_13:1567468392544337972> Rượu vang được nâng lên, xin chúc mừng @ đã trở thành chủ nhân của món quà …. ⊹‧₊˚`);
        } else {
          await message.channel.send('GA này không có người chơi hợp lệ nào tham gia!');
        }

        return message.react('✅');

      } catch (err) {
        console.error("Lỗi khi ép end GA:", err);
        return message.reply('❌ Lỗi! .');
      }
    }
  });
};
