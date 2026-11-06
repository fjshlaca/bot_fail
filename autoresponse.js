const fs = require('fs');
const path = require('path');
const config = require('./config');

const dbPath = path.join(__dirname, 'responses.json');

// Hàm kiểm tra quyền Admin hoặc 3 role được cấp phép (giống bên giveaway)
function isGAAdmin(member) {
  if (!member) return false;
  return member.id === config.BOT_ADMIN_ID || member.roles.cache.some(r => config.ALLOWED_ROLE_IDS.includes(r.id));
}

module.exports = (client) => {
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
    // Bỏ qua tin nhắn của bot
    if (message.author.bot || !message.guild || !message.member) return;

    // =============== XỬ LÝ LỆNH THÊM / XÓA RESPONE ===============
    if (message.content.toLowerCase().startsWith(config.PREFIX)) {
      const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
      const command = args.shift().toLowerCase();
      
      const contentAfterCmd = message.content.slice(config.PREFIX.length + command.length).trim();

      // LỆNH THÊM: zres <từ của tôi> _ <từ respone>
      if (command === 'res') {
        // Áp dụng quyền của 3 role + Admin
        if (!isGAAdmin(message.member)) {
          return message.reply('❌ Bạn không có quyền cài Auto Response!');
        }
        
        if (!contentAfterCmd.includes('_')) {
          return message.reply('❌ Cú pháp sai! Phải có dấu `_` để ngăn cách.\nVD: `zres em cá _ Cậu chủ <@ID> đến rồi nè`');
        }

        const parts = contentAfterCmd.split('_');
        const trigger = parts.shift().trim().toLowerCase(); // Lưu khóa ở dạng chữ thường
        const responseText = parts.join('_').trim(); 
        
        if (!trigger || !responseText) {
           return message.reply('❌ Từ khóa hoặc câu trả lời không được để trống!');
        }

        autoResponses[trigger] = responseText;
        saveDB(); 
        
        return message.reply(`✅ Đã lưu! Khi ai đó gõ bắt đầu bằng **"${trigger}"** (không phân biệt hoa/thường), bot sẽ tự động rep.`);
      }

      // LỆNH XÓA: zdelres <từ của tôi>
      if (command === 'delres') {
        if (!isGAAdmin(message.member)) {
          return message.reply('❌ Bạn không có quyền xóa Auto Response!');
        }
        
        const trigger = contentAfterCmd.toLowerCase();
        if (!trigger) return message.reply('❌ Cú pháp sai! VD: `zdelres em cá`');

        if (autoResponses[trigger]) {
          delete autoResponses[trigger];
          saveDB();
          return message.reply(`✅ Đã xóa tự động trả lời cho từ khóa: **"${trigger}"**`);
        } else {
          return message.reply(`❌ Không tìm thấy từ khóa **"${trigger}"** trong danh sách.`);
        }
      }
    }

    // =============== CƠ CHẾ AUTO REP ĐẦU CÂU (AI CŨNG XÀI ĐƯỢC) ===============
    // Bỏ qua nếu là lệnh của bot
    if (!message.content.toLowerCase().startsWith(config.PREFIX)) {
      
      // Sắp xếp khóa dài lên trước để không bị dẫm chân
      const triggers = Object.keys(autoResponses).sort((a, b) => b.length - a.length);
      
      for (const trigger of triggers) {
        const escapedTrigger = trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Regex giải thích:
        // ^: Đầu câu
        // (?=[.,!?\s]|$): Theo sau là dấu cách, dấu câu hoặc hết câu
        // i: Không phân biệt chữ hoa, chữ thường (Em cá, eM cá, EM CÁ đều dính)
        const regex = new RegExp(`^${escapedTrigger}(?=[.,!?\\s]|$)`, 'i');
        
        if (regex.test(message.content)) {
          // Dùng channel.send để gửi thẳng, KHÔNG reply tin nhắn người chat
          message.channel.send(autoResponses[trigger]).catch(() => {});
          break; // Tìm thấy phát là nhả rep và dừng, không kiểm tra các từ khác
        }
      }
    }
  });
};
