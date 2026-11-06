const fs = require('fs');
const path = require('path');
const config = require('./config');
const { EmbedBuilder } = require('discord.js');

const dbPath = path.join(__dirname, 'responses.json');

function isGAAdmin(member) {
  if (!member) return false;
  const adminIds = Array.isArray(config.BOT_ADMIN_ID) ? config.BOT_ADMIN_ID : [config.BOT_ADMIN_ID];
  if (adminIds.includes(member.id)) return true;
  if (config.ALLOWED_ROLE_IDS && member.roles.cache.some(r => config.ALLOWED_ROLE_IDS.includes(r.id))) return true;
  return false;
}

module.exports = (client) => {
  let dbData = {}; // Cấu trúc lưu theo từng Server: { guildId: { trigger: { text, image } } }
  
  if (fs.existsSync(dbPath)) {
    try {
      dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch (e) {
      console.error("Lỗi đọc file responses.json:", e);
    }
  } else {
    fs.writeFileSync(dbPath, JSON.stringify({}, null, 2), 'utf8');
  }

  function saveDB() {
    fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2), 'utf8');
  }

  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild || !message.member) return;

    const guildId = message.guild.id;
    if (!dbData[guildId]) {
      dbData[guildId] = {};
    }
    const autoResponses = dbData[guildId];

    if (message.content.toLowerCase().startsWith(config.PREFIX)) {
      const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
      const command = args.shift().toLowerCase();
      const contentAfterCmd = message.content.slice(config.PREFIX.length + command.length).trim();

      // =============== LỆNH THÊM: zres (Riêng cho từng server) ===============
      if (command === 'res') {
        if (!isGAAdmin(message.member)) {
          return message.reply('❌ Bạn không có quyền cài Auto Response!');
        }
        
        if (!contentAfterCmd.includes('_')) {
          return message.reply('❌ Cú pháp sai! Phải có dấu `_` để ngăn cách.\nVD: `zres đã _ Chúc mừng nhé`');
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
        
        return message.reply(`✅ Đã lưu Auto Response cho từ khóa: **"${trigger}"** tại server này! ${imageUrl ? '(Có đính kèm ảnh)' : ''}`);
      }

      // LỆNH XÓA: zdelres (Theo từng server)
      if (command === 'delres') {
        if (!isGAAdmin(message.member)) {
          return message.reply('❌ Bạn không có quyền xóa Auto Response!');
        }
        
        const trigger = contentAfterCmd.toLowerCase();
        if (!trigger) return message.reply('❌ Cú pháp sai! VD: `zdelres đã`');

        if (autoResponses[trigger]) {
          delete autoResponses[trigger];
          saveDB();
          return message.reply(`✅ Đã xóa tự động trả lời cho từ khóa: **"${trigger}"** tại server này!`);
        } else {
          return message.reply(`❌ Không tìm thấy từ khóa **"${trigger}"** trong danh sách của server này.`);
        }
      }

      // LỆNH DANH SÁCH: zlistres (Theo từng server)
      if (command === 'listres') {
        if (!isGAAdmin(message.member)) {
          return message.reply('❌ Bạn không có quyền xem danh sách Auto Response!');
        }
        const triggers = Object.keys(autoResponses);
        if (triggers.length === 0) {
          return message.reply('📭 Hiện tại chưa có từ khóa Auto Response nào được thiết lập ở server này.');
        }

        const listEmbed = new EmbedBuilder()
          .setTitle('📜 Danh sách Auto Response (Server này)')
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

    // =============== CƠ CHẾ AUTO REP: KHỚP CHÍNH XÁC 100% (EXACT MATCH) ===============
    if (!message.content.toLowerCase().startsWith(config.PREFIX)) {
      const userMsg = message.content.trim().toLowerCase();
      
      // Chỉ phản hồi khi nội dung tin nhắn KHỚP CHÍNH XÁC TUYỆT ĐỐI với từ khóa trong server này
      if (autoResponses[userMsg]) {
        const resData = autoResponses[userMsg];
        
        let contentToSend = {};
        let textContent = typeof resData === 'object' ? resData.text : resData;
        let imgContent = typeof resData === 'object' ? resData.image : null;

        if (textContent) contentToSend.content = textContent;
        if (imgContent) contentToSend.files = [imgContent];

        if (Object.keys(contentToSend).length > 0) {
          message.channel.send(contentToSend).catch(() => {});
        }
      }
    }
  });
};
