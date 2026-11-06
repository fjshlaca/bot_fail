const config = require('./config');

module.exports = (client) => {
  client.on('messageCreate', async (message) => {
    // Bỏ qua tin nhắn của bot hoặc không bắt đầu bằng prefix (z)
    if (message.author.bot || !message.content.toLowerCase().startsWith(config.PREFIX)) return;
    
    const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // LỆNH ÉP END GA (zfend)
    if (command === 'fend') {
      // Bắt buộc phải là Admin server mới được xài lệnh này
      if (!message.member.permissions.has('Administrator')) {
          return message.reply('❌ Bạn không có quyền Administrator để ép end GA!');
      }

      const msgId = args[0];
      if (!msgId) return message.reply('❌ Nhập ID tin nhắn GA bị kẹt vào đây! (VD: `zfend 123456789`)');

      try {
        // Tìm tin nhắn GA trong kênh hiện tại
        const gaMessage = await message.channel.messages.fetch(msgId);
        if (!gaMessage) return message.reply('❌ Không tìm thấy tin nhắn này trong kênh!');

        // Lấy danh sách icon reaction (những người đã tham gia)
        const reaction = gaMessage.reactions.cache.first();
        if (!reaction) return message.reply('❌ GA này chưa có ai thả icon tham gia cả!');

        // Tải danh sách user
        const users = await reaction.users.fetch();
        
        // Lọc bỏ bot, chỉ lấy người thật
        const validUsers = users.filter(u => !u.bot);
        if (validUsers.size === 0) return message.reply('❌ Không có người chơi hợp lệ nào tham gia GA này.');

        // Bốc thăm random 1 người
        const winner = validUsers.random();

        // Gửi tin nhắn chúc mừng
        await message.channel.send(`🎉 Chúc mừng ${winner} đã trúng giải từ GA bị kẹt! (Đã ép kết thúc bằng quyền Admin)`);
        
        return message.reply('✅ Đã ép end GA thành công! Ông có thể xóa cái tin nhắn GA kẹt thời gian kia đi cho đỡ ngứa mắt.');

      } catch (err) {
        console.error("Lỗi khi ép end GA:", err);
        return message.reply('❌ Lỗi mất rồi! Chắc ông lấy sai ID tin nhắn hoặc gõ lệnh không ở cùng kênh với cái GA bị kẹt.');
      }
    }
  });
};
