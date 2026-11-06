const fs = require('fs');
const path = require('path');
const config = require('./config');
const { EmbedBuilder } = require('discord.js');

const dbPath = path.join(__dirname, 'responses.json');

// Hàm kiểm tra quyền Admin (Hỗ trợ chuẩn mảng BOT_ADMIN_ID chứa nhiều người)
function isGAAdmin(member) {
  if (!member) return false;
  const adminIds = Array.isArray(config.BOT_ADMIN_ID) ? config.BOT_ADMIN_ID : [config.BOT_ADMIN_ID];
  return adminIds.includes(member.id) || member.roles.cache.some(r => config.ALLOWED_ROLE_IDS.includes(r.id));
}

module.exports = (client) => {
  let autoResponses = {};
  
  // Đọc database
  if (fs.existsSync(dbPath)) {
    try {
      autoResponses = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch (e) {
      console.error("Lỗi đọc file responses.json:", e);
    }
  } else {
    fs.writeFileSync(dbPath, JSON.stringify({}), 'utf8');
  }

  // Hàm lưu database
  function saveDB() {
    fs.writeFileSync(dbPath, JSON.stringify(autoResponses, null, 2), 'utf8');
  }

  client.on('messageCreate', async (message) => {
    // Bỏ qua tin nhắn của bot hoặc DM riêng
    if (message.author.bot || !message.guild || !message.member) return;

    // =============== XỬ LÝ LỆNH TẠO/XÓA/XEM AUTO RESPONSE ===============
    if (message.content.toLowerCase().startsWith(config.PREFIX)) {
      const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
      const command = args.shift().toLowerCase();
      
      const contentAfterCmd = message.content.slice(config.PREFIX.length + command.length).trim();

      // 1. LỆNH THÊM: zres <từ_khóa> _ <phản_hồi> (Hỗ trợ đính kèm ảnh)
      if (command === 'res') {
        if (!isGAAdmin(message.member)) {
          return message.reply('❌ Bạn không có quyền cài Auto Response!');
        }
        
        if (!contentAfterCmd.includes('_')) {
          return message.reply('❌ Cú pháp sai! Phải có dấu `_` để ngăn cách.\nVD: `zres đã _ Chúc mừng nhé` (và nhớ đính kèm ảnh nếu muốn gửi ảnh).');
        }

        const parts = contentAfterCmd.split('_');
        const trigger = parts.shift().trim().toLowerCase();
        let responseText = parts.join('_').trim(); 
        
        if (!trigger) {
           return message.reply('❌ Từ khóa không được để trống!');
        }

        let imageUrl = null;
        if (message.attachments.size > 0) {
          const attachment = message.attachments.first();
          if (attachment.contentType && attachment.contentType.startsWith('image')) {
            imageUrl = attachment.url;
          }
        }

        if (!responseText && !imageUrl) {
           return message.reply('❌ Phải có ít nhất nội dung chữ hoặc một bức ảnh đính kèm để làm phản hồi!');
        }

        autoResponses[trigger] = {
          text: responseText || '',
          image: imageUrl || null
        };
        saveDB(); 
        
        return message.reply(`✅ Đã lưu Auto Response cho từ khóa: **"${trigger}"** ${imageUrl ? '(Có đính kèm ảnh)' : ''}`);
      }

      // 2. LỆNH XÓA: zdelres <từ_khóa>
      if (command === 'delres') {
        if (!isGAAdmin(message.member)) {
          return message.reply('❌ Bạn không có quyền xóa Auto Response!');
        }
        
        const trigger = contentAfterCmd.toLowerCase();
        if (!trigger) return message.reply('❌ Cú pháp sai! VD: `zdelres chó`');

        if (autoResponses[trigger]) {
          delete autoResponses[trigger];
          saveDB();
          return message.reply(`✅ Đã xóa tự động trả lời cho từ khóa: **"${trigger}"**`);
        } else {
          return message.reply(`❌ Không tìm thấy từ khóa **"${trigger}"** trong danh sách.`);
        }
      }

      // 3. LỆNH DANH SÁCH: zlistres
      if (command === 'listres') {
        const triggers = Object.keys(autoResponses);
        if (triggers.length === 0) {
          return message.reply('📭 Hiện tại chưa có từ khóa Auto Response nào được thiết lập.');
        }

        const listEmbed = new EmbedBuilder()
          .setTitle('📜 Danh sách Auto Response')
          .setColor(0xC7A9C9)
          .setTimestamp();

        let description = '';
        triggers.forEach((trg, index) => {
          let item = autoResponses[trg];
          let text = typeof item === 'object' ? item.text : item;
          let hasImg = typeof item === 'object' && item.image ? ' 🖼️ [Có ảnh]' : '';
          
          if (text.length > 40) text = text.substring(0, 37) + '...';
          description += `**${index + 1}.** \`${trg}\` ➔ ${text || '(Chỉ có ảnh)'}${hasImg}\n`;
        });

        listEmbed.setDescription(description);
        return message.reply({ embeds: [listEmbed] });
      }
    }

    // =============== CƠ CHẾ AUTO REP NHẬN DIỆN ĐẦU CÂU ===============
    if (!message.content.toLowerCase().startsWith(config.PREFIX)) {
      // Ưu tiên cụm từ khóa dài trước
      const triggers = Object.keys(autoResponses).sort((a, b) => b.length - a.length);
      
      for (const trigger of triggers) {
        const escapedTrigger = trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Regex bắt từ khóa ở đầu câu, không phân biệt hoa/thường (cờ 'i')
        const regex = new RegExp(`^${escapedTrigger}(?=[.,!?\\s]|$)`, 'i');
        
        if (regex.test(message.content)) {
          const resData = autoResponses[trigger];
          
          let contentToSend = {};
          let textContent = typeof resData === 'object' ? resData.text : resData;
          let imgContent = typeof resData === 'object' ? resData.image : null;

          if (textContent) contentToSend.content = textContent;
          if (imgContent) contentToSend.files = [imgContent];

          if (Object.keys(contentToSend).length > 0) {
            // Gửi thẳng xuống kênh, không reply
            message.channel.send(contentToSend).catch(() => {});
          }
          break; // Chỉ rep 1 từ khóa đầu tiên tìm thấy
        }
      }
    }
  });
};
