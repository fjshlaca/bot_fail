const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const express = require('express');

// --- CẤU HÌNH WEB SERVER TREO RENDER ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot Discord Giveaway đang hoạt động!'));
app.listen(PORT, () => console.log(`Web Server running on port ${PORT}`));

// --- KHỞI TẠO BOT ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ]
});

// --- CẤU HÌNH BONUS ENTRIES ---
const ROLE_ENTRIES = {
  '1393150909327999006': 1,
  '1393151668144574474': 2,
  '1393151139972644905': 3,
  '1393170229072367758': 4
};

const PREFIX = 'z.';
const EMOJI_GA = '🎁';

// GIF Trang trí
const GA_GIF = 'https://media.discordapp.net/attachments/1537507318793511027/1549465230583529694/F81E1C5C-C35C-47FF-82F1-4D98F0CF34A3.gif?ex=6aeabc32&is=6ae96ab2&hm=228e9a79e8aade80790a8c105ad5cc3af8ff0d81bb2be9fd174bd9111365f22e&=&width=1280&height=193';
const BONUS_GIF = 'https://www.discordpfp.gg/images/banner/eyes/eyes-banner-surreal--surreal.webp?d=animated-card&v=3';

// --- HỆ THỐNG LƯU TRỮ CUSTOM CONFIG CHO TỪNG SERVER ---
const serverCustomConfigs = new Map();

function getServerConfig(guildId) {
  if (!serverCustomConfigs.has(guildId)) {
    serverCustomConfigs.set(guildId, {
      enabled: false,
      categories: {
        "Đang diễn ra": { message: null, embed: { title: null, description: null, color: 0xFF69B4, author: null, footer: null } },
        "Đã kết thúc, có winner": { message: null, embed: { title: null, description: null, color: 0xFF69B4 } },
        "Đã kết thúc, không có winner": { message: null, embed: { title: null, description: null, color: 0xED4245 } },
        "Công bố kết quả": { message: null, embed: { title: null, description: null, color: 0xFF69B4 } },
        "Reroll người thắng": { message: null, embed: { title: null, description: null, color: 0xFF69B4 } }
      }
    });
  }
  return serverCustomConfigs.get(guildId);
}

function parseCustomDuration(str) {
  if (!str) return null;
  const regex = /(\d+)\s*([sphd])/gi;
  let match;
  let totalMs = 0;
  let found = false;

  while ((match = regex.exec(str)) !== null) {
    found = true;
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    if (unit === 's') totalMs += value * 1000;
    else if (unit === 'p') totalMs += value * 60 * 1000;
    else if (unit === 'h') totalMs += value * 60 * 60 * 1000;
    else if (unit === 'd') totalMs += value * 24 * 60 * 60 * 1000;
  }

  return found && totalMs > 0 ? totalMs : null;
}

function formatTimeLeft(msLeft) {
  if (msLeft <= 0) return '0S';
  const seconds = Math.floor((msLeft / 1000) % 60);
  const minutes = Math.floor((msLeft / (1000 * 60)) % 60);
  const hours = Math.floor((msLeft / (1000 * 60 * 60)) % 24);
  const days = Math.floor(msLeft / (1000 * 60 * 60 * 24));

  let res = '';
  if (days > 0) res += `${days} ngày `;
  if (hours > 0) res += `${hours} giờ `;
  if (minutes > 0) res += `${minutes} phút `;
  res += `${seconds} giây`;
  return res.trim();
}

client.once('ready', () => {
  console.log(`[VER 3.3 LIVE] Đã đăng nhập: ${client.user.tag}`);
});

// --- XỬ LÝ NÚT BẤM, MENU VÀ MODAL TƯƠNG TÁC ---
client.on('interactionCreate', async (interaction) => {
  try {
    if (!interaction.guild) return;
    const config = getServerConfig(interaction.guild.id);

    // 1. Nút Bật/Tắt Custom Message
    if (interaction.isButton() && interaction.customId === 'toggle_custom') {
      config.enabled = !config.enabled;
      const stateStr = config.enabled ? 'BẬT' : 'TẮT';
      
      const embed = EmbedBuilder.from(interaction.message.embeds[0])
        .setDescription(`Bạn đang thực hiện custom message cho các giveaway.\nServer hiện đang **${stateStr}** custom message.\n\nHãy chọn phần tin nhắn giveaway bạn muốn chỉnh sửa, hoặc bật/tắt custom message cho giveaway ở dưới:`);
      
      return await interaction.update({ embeds: [embed] });
    }

    // 2. Chọn loại tin nhắn giveaway (Select Menu chính)
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_category') {
      const selectedCategory = interaction.values[0];
      interaction.client.tempCategory = interaction.client.tempCategory || {};
      interaction.client.tempCategory[interaction.user.id] = selectedCategory;

      const embed = new EmbedBuilder()
        .setTitle('Chỉnh sửa tin nhắn Giveaway')
        .setDescription(`Bạn đang thực hiện chỉnh sửa phần **${selectedCategory}** của tin nhắn Giveaway.`)
        .setColor(0x5865F2);

      const rowSelect = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('select_action')
          .setPlaceholder('Chọn cài đặt cần chỉnh sửa...')
          .addOptions([
            { label: 'Chỉnh sửa Nội dung Message', value: 'Chỉnh sửa Nội dung Message', description: 'Custom nội dung tin nhắn' },
            { label: 'Chỉnh sửa Embed', value: 'Chỉnh sửa Embed', description: 'Custom nội dung embed' },
            { label: 'Đặt lại Message', value: 'Đặt lại Message', description: 'Reset nội dung tin nhắn về mặc định' },
            { label: 'Đặt lại Embed', value: 'Đặt lại Embed', description: 'Reset embed về mặc định' }
          ])
      );

      const rowBack = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('back_to_main').setLabel('Quay lại').setStyle(ButtonStyle.Primary)
      );

      return await interaction.update({ embeds: [embed], components: [rowSelect, rowBack] });
    }

    // 3. Quay lại Menu chính
    if (interaction.isButton() && interaction.customId === 'back_to_main') {
      const stateStr = config.enabled ? 'BẬT' : 'TẮT';
      const embed = new EmbedBuilder()
        .setTitle('Chỉnh sửa tin nhắn Giveaway')
        .setDescription(`Bạn đang thực hiện custom message cho các giveaway.\nServer hiện đang **${stateStr}** custom message.\n\nHãy chọn phần tin nhắn giveaway bạn muốn chỉnh sửa, hoặc bật/tắt custom message cho giveaway ở dưới:`)
        .setColor(0x5865F2);

      const rowBtn = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('toggle_custom').setLabel('Bật/Tắt Custom Message').setStyle(ButtonStyle.Primary)
      );

      const rowMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('select_category')
          .setPlaceholder('Chọn loại tin nhắn giveaway cần sửa')
          .addOptions([
            { label: 'Đang diễn ra', value: 'Đang diễn ra', description: 'Tin nhắn giveaway khi giveaway đang diễn ra', emoji: '⏰' },
            { label: 'Đã kết thúc, có winner', value: 'Đã kết thúc, có winner', description: 'Tin nhắn giveaway khi giveaway kết thúc', emoji: '🏁' },
            { label: 'Đã kết thúc, không có winner', value: 'Đã kết thúc, không có winner', description: 'Tin nhắn giveaway khi không có người chiến thắng', emoji: '📬' },
            { label: 'Công bố kết quả', value: 'Công bố kết quả', description: 'Tin nhắn phản hồi công bố người chiến thắng', emoji: '🍇' },
            { label: 'Reroll người thắng', value: 'Reroll người thắng', description: 'Tin nhắn phản hồi khi reroll người chiến thắng', emoji: '🔄' }
          ])
      );

      return await interaction.update({ embeds: [embed], components: [rowBtn, rowMenu] });
    }

    // 4. Chọn hành động sửa Message hoặc Embed
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_action') {
      const action = interaction.values[0];
      const category = interaction.client.tempCategory?.[interaction.user.id] || 'Đang diễn ra';

      if (action === 'Chỉnh sửa Nội dung Message') {
        const modal = new ModalBuilder().setCustomId('modal_edit_msg').setTitle('Nội dung');
        const input = new TextInputBuilder()
          .setCustomId('msg_content')
          .setLabel('Nội dung của tin nhắn giveaway')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(config.categories[category].message || '🎉 **NEW GIVEAWAY** 🎉');
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return await interaction.showModal(modal);
      } 
      else if (action === 'Chỉnh sửa Embed') {
        const embed = new EmbedBuilder()
          .setTitle(`Chỉnh sửa Embed (${category})`)
          .setDescription('Chọn thành phần Embed bên dưới để thay đổi tùy ý:')
          .setColor(0x5865F2);

        const row1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('edit_author').setLabel('Đầu Embed').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('edit_title_content').setLabel('Tiêu đề & Nội dung').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('edit_footer').setLabel('Chân Embed').setStyle(ButtonStyle.Success)
        );
        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('edit_color').setLabel('Màu').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('back_to_action').setLabel('Quay lại').setStyle(ButtonStyle.Primary)
        );

        return await interaction.update({ embeds: [embed], components: [row1, row2] });
      }
      else if (action.startsWith('Đặt lại')) {
        config.categories[category] = { message: null, embed: { title: null, description: null, color: 0xFF69B4, author: null, footer: null } };
        return await interaction.reply({ content: `✅ Đã reset cài đặt phần **${category}** về mặc định!`, ephemeral: true });
      }
    }

    // 5. Quay lại Menu Hành Động
    if (interaction.isButton() && interaction.customId === 'back_to_action') {
      const category = interaction.client.tempCategory?.[interaction.user.id] || 'Đang diễn ra';
      const embed = new EmbedBuilder()
        .setTitle('Chỉnh sửa tin nhắn Giveaway')
        .setDescription(`Bạn đang thực hiện chỉnh sửa phần **${category}** của tin nhắn Giveaway.`)
        .setColor(0x5865F2);

      const rowSelect = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('select_action')
          .setPlaceholder('Chọn cài đặt cần chỉnh sửa...')
          .addOptions([
            { label: 'Chỉnh sửa Nội dung Message', value: 'Chỉnh sửa Nội dung Message', description: 'Custom nội dung tin nhắn' },
            { label: 'Chỉnh sửa Embed', value: 'Chỉnh sửa Embed', description: 'Custom nội dung embed' },
            { label: 'Đặt lại Message', value: 'Đặt lại Message', description: 'Reset nội dung tin nhắn về mặc định' },
            { label: 'Đặt lại Embed', value: 'Đặt lại Embed', description: 'Reset embed về mặc định' }
          ])
      );
      const rowBack = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('back_to_main').setLabel('Quay lại').setStyle(ButtonStyle.Primary)
      );
      return await interaction.update({ embeds: [embed], components: [rowSelect, rowBack] });
    }

    // 6. Mở Modal nhập liệu cho Embed
    if (interaction.isButton() && ['edit_author', 'edit_title_content', 'edit_footer', 'edit_color'].includes(interaction.customId)) {
      const modal = new ModalBuilder();
      const category = interaction.client.tempCategory?.[interaction.user.id] || 'Đang diễn ra';

      if (interaction.customId === 'edit_author') {
        modal.setCustomId('modal_author').setTitle('Nhập Tác giả');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('author_val').setLabel('Tác giả').setStyle(TextInputStyle.Short).setRequired(false)));
      } else if (interaction.customId === 'edit_title_content') {
        modal.setCustomId('modal_title_content').setTitle('Thông tin chung');
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title_val').setLabel('Tiêu đề').setStyle(TextInputStyle.Short).setRequired(false)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('desc_val').setLabel('Nội dung').setStyle(TextInputStyle.Paragraph).setRequired(false))
        );
      } else if (interaction.customId === 'edit_footer') {
        modal.setCustomId('modal_footer').setTitle('Chân trang Embed');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('footer_val').setLabel('Văn bản chân trang').setStyle(TextInputStyle.Short).setRequired(false)));
      } else if (interaction.customId === 'edit_color') {
        modal.setCustomId('modal_color').setTitle('Màu sắc');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('color_val').setLabel('Màu Hex (VD: #FF69B4)').setStyle(TextInputStyle.Short).setRequired(true).setValue('#FF69B4')));
      }
      return await interaction.showModal(modal);
    }

    // 7. Nhận dữ liệu Modal Submit và lưu vào bộ nhớ server
    if (interaction.isModalSubmit()) {
      const category = interaction.client.tempCategory?.[interaction.user.id] || 'Đang diễn ra';
      
      if (interaction.customId === 'modal_edit_msg') {
        config.categories[category].message = interaction.fields.getTextInputValue('msg_content');
        return await interaction.reply({ content: `✅ Đã lưu nội dung message cho **${category}** thành công!`, ephemeral: true });
      } else if (interaction.customId === 'modal_author') {
        config.categories[category].embed.author = interaction.fields.getTextInputValue('author_val');
        return await interaction.reply({ content: `✅ Đã lưu tác giả cho **${category}** thành công!`, ephemeral: true });
      } else if (interaction.customId === 'modal_title_content') {
        const t = interaction.fields.getTextInputValue('title_val');
        const d = interaction.fields.getTextInputValue('desc_val');
        config.categories[category].embed.title = t || null;
        config.categories[category].embed.description = d || null;
        return await interaction.reply({ content: `✅ Đã lưu tiêu đề & nội dung embed cho **${category}** thành công!`, ephemeral: true });
      } else if (interaction.customId === 'modal_footer') {
        config.categories[category].embed.footer = interaction.fields.getTextInputValue('footer_val');
        return await interaction.reply({ content: `✅ Đã lưu chân embed cho **${category}** thành công!`, ephemeral: true });
      } else if (interaction.customId === 'modal_color') {
        const hex = interaction.fields.getTextInputValue('color_val').replace('#', '');
        const colorInt = parseInt(hex, 16);
        if (!isNaN(colorInt)) {
          config.categories[category].embed.color = colorInt;
          return await interaction.reply({ content: `✅ Đã lưu màu sắc Hex thành công!`, ephemeral: true });
        } else {
          return await interaction.reply({ content: `❌ Mã màu Hex không hợp lệ!`, ephemeral: true });
        }
      }
    }
  } catch (err) {
    console.error("Lỗi xử lý Interaction:", err);
  }
});

// --- LỆNH BOT DẠNG TEXT (z.customize & z.ga) ---
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // 1. LỆNH CUSTOMIZE
  if (command === 'customize') {
    const config = getServerConfig(message.guild.id);
    const stateStr = config.enabled ? 'BẬT' : 'TẮT';

    const embed = new EmbedBuilder()
      .setTitle('Chỉnh sửa tin nhắn Giveaway')
      .setDescription(
        `Bạn đang thực hiện custom message cho các giveaway.\nServer hiện đang **${stateStr}** custom message.\n\n` +
        `Hãy chọn phần tin nhắn giveaway bạn muốn chỉnh sửa, hoặc bật/tắt custom message cho giveaway ở dưới:`
      )
      .setColor(0x5865F2);

    const rowBtn = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('toggle_custom').setLabel('Bật/Tắt Custom Message').setStyle(ButtonStyle.Primary)
    );

    const rowMenu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('select_category')
        .setPlaceholder('Chọn loại tin nhắn giveaway cần sửa')
        .addOptions([
          { label: 'Đang diễn ra', value: 'Đang diễn ra', description: 'Tin nhắn giveaway khi giveaway đang diễn ra', emoji: '⏰' },
          { label: 'Đã kết thúc, có winner', value: 'Đã kết thúc, có winner', description: 'Tin nhắn giveaway khi giveaway kết thúc', emoji: '🏁' },
          { label: 'Đã kết thúc, không có winner', value: 'Đã kết thúc, không có winner', description: 'Tin nhắn giveaway khi không có người chiến thắng', emoji: '📬' },
          { label: 'Công bố kết quả', value: 'Công bố kết quả', description: 'Tin nhắn phản hồi công bố người chiến thắng', emoji: '🍇' },
          { label: 'Reroll người thắng', value: 'Reroll người thắng', description: 'Tin nhắn phản hồi khi reroll người chiến thắng', emoji: '🔄' }
        ])
    );

    return message.reply({ embeds: [embed], components: [rowBtn, rowMenu] });
  }

  // 2. LỆNH GA (GIVEAWAY)
  if (command === 'ga') {
    if (args.length === 0) {
      const helpEmbed = new EmbedBuilder()
        .setAuthor({ name: '📖 HƯỚNG DẪN SỬ DỤNG LỆNH GIVEAWAY', iconURL: client.user.displayAvatarURL() })
        .setTitle('✨ Cách tạo GiveAway')
        .setDescription(
          `> \`z.ga <id_role/none> <số_giải> <thời_gian> [số_lượng_ga] <nội_dung>\`\n\n` +
          `• 🌐 **Mở cho tất cả mọi người:**\n  \`z.ga none 1 30s 1 tỷ\`\n\n` +
          `• 📌 **Tag trực tiếp Role:**\n  \`z.ga @Role 1 12h Nitro\``
        )
        .setColor(0xFF69B4)
        .setFooter({ text: 'Hệ thống Giveaway • Emc4' });

      return message.reply({ embeds: [helpEmbed] });
    }

    let targetRoleId = null;
    let winnerCount = null;
    let durationMs = null;
    let giveawayCount = 1;
    let prize = '';

    let currentIndex = 0;
    const firstArg = args[0];
    const extractedId = firstArg.replace(/\D/g, '');

    if (firstArg.toLowerCase() === 'none') {
      currentIndex = 1;
    } else if (extractedId.length >= 17) {
      targetRoleId = extractedId;
      currentIndex = 1;
    }

    if (args[currentIndex] && !isNaN(parseInt(args[currentIndex]))) {
      winnerCount = parseInt(args[currentIndex]);
      currentIndex++;
    }

    if (args[currentIndex]) {
      durationMs = parseCustomDuration(args[currentIndex]);
      if (durationMs) currentIndex++;
    }

    if (args[currentIndex] && !isNaN(parseInt(args[currentIndex]))) {
      giveawayCount = parseInt(args[currentIndex]);
      currentIndex++;
    }

    prize = args.slice(currentIndex).join(' ');

    if (!winnerCount || winnerCount < 1) {
      return message.reply('❌ **Thiếu số lượng giải!** Vui lòng kiểm tra lại cú pháp.');
    }
    if (!durationMs) {
      return message.reply('❌ **Thời gian không hợp lệ!** Dùng: `s`, `p`, `h`, `d`.');
    }
    if (!prize) {
      return message.reply('❌ **Chưa nhập nội dung giveaway!**');
    }

    await message.delete().catch(() => {});

    let lastCreatedMessage = null;
    const isFlash = durationMs < 3600000;
    const headerTitle = isFlash ? '⚡ FLASH GIVEAWAY' : '🎁 GIVEAWAY';
    
    // --- ĐỌC CẤU HÌNH CUSTOM TỪ SERVER ---
    const serverConfig = getServerConfig(message.guild.id);
    const ongoingConfig = serverConfig.enabled ? serverConfig.categories["Đang diễn ra"] : null;

    for (let i = 0; i < giveawayCount; i++) {
      const endTime = Date.now() + durationMs;
      const roleDisplay = targetRoleId ? `<@&${targetRoleId}>` : 'Everyone';

      const buildEmbed = (msRemaining) => {
        const customEmbed = ongoingConfig?.embed || {};
        
        // Xử lý tiêu đề custom (nếu có placeholder {giveaway_prize})
        let finalTitle = `🎉 ${prize}`;
        if (customEmbed.title) {
          finalTitle = customEmbed.title.replace(/\{giveaway_prize\}/g, prize);
        }

        // Xử lý mô tả custom (nếu có các placeholder)
        let finalDesc = `> Hãy nhấn vào biểu tượng **${EMOJI_GA}** bên dưới để tham gia ngay!\n\n` +
                        `• 👑 **Người tổ chức:** <@${message.author.id}>\n` +
                        `• 🛡️ **Yêu cầu Role:** ${roleDisplay}\n` +
                        `• 🏆 **Số suất trúng:** \`${winnerCount} giải\`\n` +
                        `• ⏳ **Thời gian còn lại:** \`${formatTimeLeft(msRemaining)}\``;
        
        if (customEmbed.description) {
          finalDesc = customEmbed.description
            .replace(/\{giveaway_prize\}/g, prize)
            .replace(/\{giveaway_host\}/g, `<@${message.author.id}>`)
            .replace(/\{giveaway_duration\}/g, formatTimeLeft(durationMs))
            .replace(/\{giveaway_remaining\}/g, formatTimeLeft(msRemaining))
            .replace(/\{giveaway_entrants\}/g, roleDisplay);
        }

        const embed = new EmbedBuilder()
          .setAuthor({ 
            name: customEmbed.author || headerTitle, 
            iconURL: message.guild.iconURL({ dynamic: true }) 
          })
          .setTitle(finalTitle)
          .setDescription(finalDesc)
          .setColor(customEmbed.color !== undefined ? customEmbed.color : 0xFF69B4)
          .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
          .setImage(GA_GIF)
          .setFooter({
            text: customEmbed.footer || `⏰ Kết thúc lúc`,
            iconURL: client.user.displayAvatarURL()
          })
          .setTimestamp(endTime);

        return embed;
      };

      // Xác định nội dung text bên ngoài (Message content) nếu có custom
      const customMsgContent = ongoingConfig?.message;
      const contentPayload = customMsgContent ? { content: customMsgContent, embeds: [buildEmbed(durationMs)] } : { embeds: [buildEmbed(durationMs)] };

      const gaMessage = await message.channel.send(contentPayload);
      await gaMessage.react(EMOJI_GA).catch(() => {});
      lastCreatedMessage = gaMessage;

      const interval = setInterval(async () => {
        const remaining = endTime - Date.now();
        if (remaining <= 0) {
          clearInterval(interval);
        } else {
          const editPayload = customMsgContent ? { content: customMsgContent, embeds: [buildEmbed(remaining)] } : { embeds: [buildEmbed(remaining)] };
          await gaMessage.edit(editPayload).catch(() => clearInterval(interval));
        }
      }, 5000);

      // --- KHI GA KẾT THÚC ---
      setTimeout(async () => {
        clearInterval(interval);

        const fetchedMsg = await message.channel.messages.fetch(gaMessage.id).catch(() => null);
        if (!fetchedMsg) return;

        const reaction = fetchedMsg.reactions.cache.get(EMOJI_GA) || fetchedMsg.reactions.cache.first();
        let users = reaction ? await reaction.users.fetch() : new Map();
        let validUsers = users.filter(u => !u.bot);

        if (targetRoleId) {
          const filteredMap = new Map();
          for (const [userId, userObj] of validUsers) {
            try {
              const member = await message.guild.members.fetch(userId);
              if (member.roles.cache.has(targetRoleId)) {
                filteredMap.set(userId, userObj);
              }
            } catch (e) {}
          }
          validUsers = filteredMap;
        }

        if (validUsers.size === 0) {
          const endEmbed = EmbedBuilder.from(fetchedMsg.embeds[0])
            .setTitle(`❌ [ĐÃ KẾT THÚC] ${prize}`)
            .setDescription(`> Không có người chơi hợp lệ nào tham gia giveaway này!`)
            .setColor(0xED4245);
          const finalEditContent = customMsgContent ? { content: customMsgContent, embeds: [endEmbed] } : { embeds: [endEmbed] };
          return fetchedMsg.edit(finalEditContent);
        }

        const pool = [];
        for (const [userId] of validUsers) {
          let baseEntries = 1;
          try {
            const member = await message.guild.members.fetch(userId);
            if (!isFlash) {
              for (const [roleId, extra] of Object.entries(ROLE_ENTRIES)) {
                if (member.roles.cache.has(roleId)) baseEntries += extra;
              }
            }
          } catch (e) {}

          for (let k = 0; k < baseEntries; k++) {
            pool.push(userId);
          }
        }

        const winners = [];
        const actualWinnerCount = Math.min(winnerCount, validUsers.size);

        while (winners.length < actualWinnerCount && pool.length > 0) {
          const randomIndex = Math.floor(Math.random() * pool.length);
          const selectedId = pool[randomIndex];
          if (!winners.includes(selectedId)) {
            winners.push(selectedId);
          }
          for (let k = pool.length - 1; k >= 0; k--) {
            if (pool[k] === selectedId) pool.splice(k, 1);
          }
        }

        const winnerMentions = winners.map(id => `<@${id}>`).join(', ');

        const endEmbed = EmbedBuilder.from(fetchedMsg.embeds[0])
          .setTitle(`🏆 [ĐÃ KẾT THÚC] ${prize}`)
          .setDescription(
            `> Giveaway đã khép lại thành công!\n\n` +
            `• 👑 **Người tổ chức:** <@${message.author.id}>\n` +
            `• 🎉 **Người chiến thắng:** ${winnerMentions}`
          )
          .setColor(0xFF69B4);

        const finalEditContent = customMsgContent ? { content: customMsgContent, embeds: [endEmbed] } : { embeds: [endEmbed] };
        await fetchedMsg.edit(finalEditContent);

        const winAnnounceEmbed = new EmbedBuilder()
          .setAuthor({ name: '🎉 KẾT QUẢ GIVEAWAY 🎉', iconURL: message.guild.iconURL({ dynamic: true }) })
          .setTitle(`🎁 Phần thưởng: ${prize}`)
          .setDescription(
            `> Chúc mừng cậu chủ ${winnerMentions} đã may mắn bú đẫm giveaway!\n\n` +
            `• 👑 **Người trao quà:** <@${message.author.id}>\n` +
            `• 🏆 **Người trúng giải:** ${winnerMentions}`
          )
          .setColor(0xFF69B4)
          .setTimestamp();

        message.channel.send({ 
          content: `🎉 Chúc mừng ${winnerMentions} đã trúng **${prize}** của <@${message.author.id}>!`, 
          embeds: [winAnnounceEmbed] 
        });
      }, durationMs);
    }

    if (lastCreatedMessage && !isFlash) {
      const noteEmbed = new EmbedBuilder()
        .setTitle('✨ **Bonus Entries**')
        .setDescription(
          '<@&1393150909327999006> +1\n' +
          '<@&1393151668144574474> +2\n' +
          '<@&1393151139972644905> +3\n' +
          '<@&1393170229072367758> +4'
        )
        .setImage(BONUS_GIF)
        .setColor(0xFF69B4);

      await message.channel.send({ embeds: [noteEmbed] });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
