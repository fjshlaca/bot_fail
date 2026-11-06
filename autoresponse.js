const fs = require('fs');
const path = require('path');
const config = require('./config');
const { EmbedBuilder } = require('discord.js');

const dbPath = path.join(__dirname, 'responses.json');

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
    if (message.author.bot || !message.guild || !message.member) return;

    if (message.content.toLowerCase().startsWith(config.PREFIX)) {
      const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
      const command = args.shift().toLowerCase();
      
      const contentAfterCmd = message.content.slice(config.PREFIX.length + command.length).trim();

      // =============== LỆNH THÊM: zres <từ_khóa> _ <phản_hồi> (Hỗ trợ đính kèm ảnh) ===============
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

        // Bắt lấy link ảnh nếu người dùng có đính kèm file ảnh vào tin nhắn gõ lệnh
        let imageUrl = null;
        if (message.attachments.size > 0) {
          const attachment = message.attachments.first();
          // Kiểm tra xem có phải định dạng ảnh không
          if (attachment.contentType && attachment.contentType.startsWith('image')) {
            imageUrl = attachment.url;
          }
        }

        if (!responseText && !imageUrl) {
           return message.reply('❌ Phải có ít nhất nội dung chữ hoặc một bức ảnh đính kèm để làm phản hồi!');
        }

        // Lưu vào database dưới dạng object gồm text và imageUrl
        autoResponses[trigger] = {
          text: responseText || '',
          image: imageUrl || null
        };
        saveDB(); 
        
        return message.reply(`✅ Đã lưu Auto Response cho từ khóa: **"${trigger}"** ${imageUrl ? '(Có đính kèm ảnh)' : ''}`);
      }

      // LỆNH XÓA: zdelres <từ_khóa>
      if (command === 'delres') {
        if (!isGAAdmin(message.member)) {
          return message.reply('❌ Bạn không có quyền xóa Auto Response!');
        }
        
        const trigger = contentAfterCmd.toLowerCase();
        if (!trigger) return message.reply('❌ Cú pháp sai! VD: `zdelres đã`');

        if (autoResponses[trigger]) {
          delete autoResponses[trigger];
          saveDB();
          return message.reply(`✅ Đã xóa tự động trả lời cho từ khóa: **"${trigger}"**`);
        } else {
          return message.reply(`❌ Không tìm thấy từ khóa **"${trigger}"** trong danh sách.`);
        }
      }

      // LỆNH DANH SÁCH: zlistres
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
          // Tương thích ngược với dữ liệu cũ dạng string
          let text = typeof item === 'object' ? item.text : item;
          let hasImg = typeof item === 'object' && item.image ? ' 🖼️ [Có ảnh]' : '';
          
          if (text.length > 40) text = text.substring(0, 37) + '...';
          description += `**${index + 1}.** \`${trg}\` ➔ ${text || '(Chỉ có ảnh)'}${hasImg}\n`;
        });

        listEmbed.setDescription(description);
        return message.reply({ embeds: [listEmbed] });
      }
    }

    // =============== CƠ CHẾ AUTO REP ĐẦU CÂU (HỖ TRỢ CẢ TEXT VÀ ẢNH) ===============
    if (!message.content.toLowerCase().startsWith(config.PREFIX)) {
      const triggers = Object.keys(autoResponses).sort((a, b) => b.length - a.length);
      
      for (const trigger of triggers) {
        const escapedTrigger = trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`^${escapedTrigger}(?=[.,!?\\s]|$)`, 'i');
        
        if (regex.test(message.content)) {
          const resData = autoResponses[trigger];
          
          // Xử lý dữ liệu tương thích (nếu là dạng object mới hoặc string cũ)
          let contentToSend = {};
          let textContent = typeof resData === 'object' ? resData.text : resData;
          let imgContent = typeof resData === 'object' ? resData.image : null;

          if (textContent) contentToSend.content = textContent;
          if (imgContent) contentToSend.files = [imgContent];

          if (Object.keys(contentToSend).length > 0) {
            message.channel.send(contentToSend).catch(() => {});
          }
          break;
        }
      }
    }
  });
};
