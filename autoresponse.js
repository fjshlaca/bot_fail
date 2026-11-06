const fs = require('fs');
const path = require('path');
const config = require('./config');

// Đường dẫn file lưu trữ dữ liệu trả lời tự động
const dbPath = path.join(__dirname, 'responses.json');

module.exports = (client) => {
  // Đọc dữ liệu từ file, nếu chưa có thì tự động tạo object rỗng
  let autoResponses = {};
  if (fs.existsSync(dbPath)) {
    try {
      autoResponses = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch (e) {
      console.error("Lỗi đọc file responses.json:", e);
    }
  } else {
    fs.writeFileSync(dbPath, JSON.stringify({}), 'utf8');
  }

  function saveDB() {
    fs.writeFileSync(dbPath, JSON.stringify(autoResponses, null, 2), 'utf8');
  }

  client.on('messageCreate', async (message) => {
    // Bỏ qua tin nhắn của bot hoặc trong tin nhắn riêng (DM)
    if (message.author.bot || !message.guild || !message.member) return;

    // =============== XỬ LÝ LỆNH THÊM / XÓA RESPONE ===============
    if (message.content.toLowerCase().startsWith(config.PREFIX)) {
      const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
      const command = args.shift().toLowerCase();

      // LỆNH THÊM: zres <từ_khóa> <câu_trả_lời>
      if (command === 'res') {
        if (!message.member.permissions.has('Administrator')) {
          return message.reply('❌ Chỉ Admin mới được cài Auto Response!');
        }
        if (args.length < 2) {
          return message.reply('❌ Cú pháp sai! VD: `zres ê j` hoặc `zres Đức cậu chủ cute <@ID> đến nè`');
        }

        const trigger = args[0].toLowerCase();
        const responseText = args.slice(1).join(' '); // Gộp toàn bộ đoạn đằng sau làm câu rep

        autoResponses[trigger] = responseText;
        saveDB(); // Lưu vào file
        
        return message.reply(`✅ Đã lưu! Khi ai đó chat bắt đầu bằng chữ **${trigger}**, bot sẽ trả lời ngay lập tức.`);
      }

      // LỆNH XÓA: zdelres <từ_khóa>
      if (command === 'delres') {
        if (!message.member.permissions.has('Administrator')) {
          return message.reply('❌ Chỉ Admin mới được xóa Auto Response!');
        }
        
        const trigger = args[0]?.toLowerCase();
        if (!trigger) return message.reply('❌ Cú pháp sai! VD: `zdelres ê`');

        if (autoResponses[trigger]) {
          delete autoResponses[trigger];
          saveDB();
          return message.reply(`✅ Đã xóa tự động trả lời cho chữ: **${trigger}**`);
        } else {
          return message.reply(`❌ Không tìm thấy chữ **${trigger}** trong danh sách.`);
        }
      }
    }

    // =============== CƠ CHẾ AUTO REP TỐC ĐỘ BÀN THỜ ===============
    // Chỉ kích hoạt nếu câu chat bình thường (không phải lệnh bot)
    if (!message.content.toLowerCase().startsWith(config.PREFIX)) {
      
      // Tách chữ đầu tiên của câu chat ra, cắt bỏ các dấu câu (, . ! ?) nếu người dùng lỡ tay gõ liền
      const firstWordRaw = message.content.split(/\s+/)[0].toLowerCase();
      const firstWord = firstWordRaw.replace(/[.,!?]+$/, '');

      // Soi chữ đầu tiên vào DB, nếu có thì nhả câu trả lời ngay lập tức
      if (autoResponses[firstWord]) {
        // Gửi thẳng câu rep đã lưu (Discord tự hiểu các tag <@id> bên trong nội dung)
        message.channel.send(autoResponses[firstWord]).catch(() => {});
      }
    }
  });
};
