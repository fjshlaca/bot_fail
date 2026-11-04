const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
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

// --- CẤU HÌNH GACHA RANDOM ROLE (z.rdrole) ---
const REQUIRED_ROLE_ID = '1425167156668141728'; // Role bắt buộc có mới được roll

// 5 Cấp Role (Thứ tự từ thấp Cấp 5 đến cao Cấp 1)
const RANDOM_ROLES_POOL = [
  { id: '1393170229072367758', weight: 55, level: 5, name: 'Cấp 5' }, // Thấp nhất
  { id: '1393151668144574474', weight: 25, level: 4, name: 'Cấp 4' },
  { id: '1393151139972644905', weight: 10, level: 3, name: 'Cấp 3' },
  { id: '1393150909327999006', weight: 5,  level: 2, name: 'Cấp 2' },
  { id: '1393150502157680761', weight: 5,  level: 1, name: 'Cấp 1' }  // Cao nhất
];

// Bộ nhớ lưu số lần tích lũy (Pity Counter) cho từng User ID
// Cấu trúc: { userId: { 5: countC5, 4: countC4, 3: countC3, 2: countC2 } }
const userPityData = new Map();

// Hàm xử lý Quay Gacha có tích hợp Bảo Hiểm (Pity System)
function rollRoleWithPity(userId) {
  if (!userPityData.has(userId)) {
    userPityData.set(userId, { 5: 0, 4: 0, 3: 0, 2: 0 });
  }

  const userPity = userPityData.get(userId);
  let finalRoleObj = null;
  let isPityTriggered = false;

  // 1. Kiểm tra điều kiện Bảo Hiểm từ thấp lên cao (2 lần cấp thấp -> chắc chắn cấp cao hơn)
  if (userPity[5] >= 2) {
    // Đã ra Cấp 5 hai lần -> Chắc chắn nâng lên Cấp 4
    finalRoleObj = RANDOM_ROLES_POOL.find(r => r.level === 4);
    userPity[5] = 0; // Reset đếm C5
    isPityTriggered = true;
  } else if (userPity[4] >= 2) {
    // Đã ra Cấp 4 hai lần -> Chắc chắn nâng lên Cấp 3
    finalRoleObj = RANDOM_ROLES_POOL.find(r => r.level === 3);
    userPity[4] = 0; // Reset đếm C4
    isPityTriggered = true;
  } else if (userPity[3] >= 2) {
    // Đã ra Cấp 3 hai lần -> Chắc chắn nâng lên Cấp 2
    finalRoleObj = RANDOM_ROLES_POOL.find(r => r.level === 2);
    userPity[3] = 0; // Reset đếm C3
    isPityTriggered = true;
  } else if (userPity[2] >= 2) {
    // Đã ra Cấp 2 hai lần -> Chắc chắn nâng lên Cấp 1 (Cao nhất)
    finalRoleObj = RANDOM_ROLES_POOL.find(r => r.level === 1);
    userPity[2] = 0; // Reset đếm C2
    isPityTriggered = true;
  }

  // 2. Nếu không trúng Bảo hiểm -> Quay Random theo Tỷ Lệ bình thường
  if (!finalRoleObj) {
    const rand = Math.random() * 100;
    let cumulative = 0;

    for (const roleObj of RANDOM_ROLES_POOL) {
      cumulative += roleObj.weight;
      if (rand < cumulative) {
        finalRoleObj = roleObj;
        break;
      }
    }
    if (!finalRoleObj) finalRoleObj = RANDOM_ROLES_POOL[0];
  }

  // 3. Cập nhật số lần tích lũy Pity nếu ra các cấp thấp hơn
  if (finalRoleObj.level === 5) userPity[5] += 1;
  else if (finalRoleObj.level === 4) userPity[4] += 1;
  else if (finalRoleObj.level === 3) userPity[3] += 1;
  else if (finalRoleObj.level === 2) userPity[2] += 1;

  return { role: finalRoleObj, isPity: isPityTriggered };
}

const PREFIX = 'z.';
const EMOJI_GA = '🎁';

// GIF Trang trí
const GA_GIF = 'https://media.discordapp.net/attachments/1537507318793511027/1549465230583529694/F81E1C5C-C35C-47FF-82F1-4D98F0CF34A3.gif?ex=6aeabc32&is=6ae96ab2&hm=228e9a79e8aade80790a8c105ad5cc3af8ff0d81bb2be9fd174bd9111365f22e&=&width=1280&height=193';
const BONUS_GIF = 'https://www.discordpfp.gg/images/banner/eyes/eyes-banner-surreal--surreal.webp?d=animated-card&v=3';

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
  console.log(`[VER 4.0 PITY SYSTEM LIVE] Đã đăng nhập: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // --- 1. LỆNH RANDOM ROLE CÓ BẢO HIỂM (z.rdrole) ---
  if (command === 'rdrole') {
    if (!message.member.roles.cache.has(REQUIRED_ROLE_ID)) {
      return message.reply(`❌ **Bạn cần sở hữu Role <@&${REQUIRED_ROLE_ID}> mới có thể tham gia Random Role!**`);
    }

    try {
      // Quay thưởng theo cơ chế Pity
      const rollResult = rollRoleWithPity(message.author.id);
      const selectedRole = rollResult.role;
      const isPity = rollResult.isPity;
      
      // Thêm Role trúng thưởng cho thành viên
      await message.member.roles.add(selectedRole.id).catch((err) => {
        console.error("Lỗi cấp Role:", err);
      });

      const pityNotice = isPity ? '\n🔥 **[KÍCH HOẠT BẢO HIỂM]** Cậu đã tích đủ 2 lần ở cấp thấp hơn nên được nâng bậc thẳng lên role này!' : '';

      const rdEmbed = new EmbedBuilder()
        .setAuthor({ 
          name: '🎲 VÒNG QUAY RANDOM ROLE (PITY SYSTEM)', 
          iconURL: message.author.displayAvatarURL({ dynamic: true }) 
        })
        .setTitle('🎉 Chúc Mừng Bạn Đã Trúng Role!')
        .setDescription(
          `> Người chơi <@${message.author.id}> vừa thực hiện quay thành công!\n\n` +
          `• 🏆 **Role nhận được:** <@&${selectedRole.id}>\n` +
          `• ⚙️ **Trạng thái:** Đã tự động thêm vào hồ sơ.${pityNotice}`
        )
        .setColor(isPity ? 0xE74C3C : 0x9B59B6)
        .setFooter({ text: 'Hệ thống Random Role • Emc4', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

      return message.channel.send({
        content: `🎉 Chúc mừng <@${message.author.id}> đã quay ra Role <@&${selectedRole.id}>!${isPity ? ' *(Nổ Bảo Hiểm)*' : ''}`,
        embeds: [rdEmbed]
      });

    } catch (err) {
      console.error(err);
      return message.reply('❌ Đã xảy ra lỗi trong quá trình Random Role, vui lòng báo Admin kiểm tra quyền của Bot!');
    }
  }

  // --- 2. LỆNH REROLL GIVEAWAY (z.garr) ---
  if (command === 'garr') {
    if (!message.reference || !message.reference.messageId) {
      return message.reply('❌ **Bạn phải reply (phản hồi) vào tin nhắn bài giveaway cần reroll rồi mới gõ `z.garr`!**');
    }

    try {
      const targetMsg = await message.channel.messages.fetch(message.reference.messageId);
      if (!targetMsg) {
        return message.reply('❌ Không tìm thấy tin nhắn giveaway được reply!');
      }

      await message.delete().catch(() => {});

      const reaction = targetMsg.reactions.cache.get(EMOJI_GA) || targetMsg.reactions.cache.first();
      if (!reaction) {
        return message.reply('❌ Không tìm thấy lượt tham gia nào ở bài giveaway này.');
      }

      let users = await reaction.users.fetch();
      let validUsers = users.filter(u => !u.bot);

      if (validUsers.size === 0) {
        return message.reply('❌ Không có người chơi hợp lệ nào khác để reroll!');
      }

      let oldWinnersIds = [];
      const embedDesc = targetMsg.embeds[0]?.description || '';
      const mentionRegex = /<@(\d+)>/g;
      let match;
      while ((match = mentionRegex.exec(embedDesc)) !== null) {
        oldWinnersIds.push(match[1]);
      }

      const availablePool = [];
      for (const [userId] of validUsers) {
        if (!oldWinnersIds.includes(userId)) {
          availablePool.push(userId);
        }
      }

      if (availablePool.length === 0) {
        return message.reply('❌ Không còn người chơi nào khác ngoài những người đã trúng giải trước đó để reroll!');
      }

      const randomIndex = Math.floor(Math.random() * availablePool.length);
      const newWinnerId = availablePool[randomIndex];
      const newWinnerMention = `<@${newWinnerId}>`;

      const oldTitle = targetMsg.embeds[0]?.title || 'Giveaway';
      const prizeName = oldTitle.replace(/^[🏆❌🎉\s\[ĐÃ KẾT THÚC\]]+/g, '');

      const rerollEmbed = new EmbedBuilder()
        .setAuthor({ name: '🔄 REROLL NGƯỜI THẮNG', iconURL: message.guild.iconURL({ dynamic: true }) })
        .setTitle(`🎁 Phần thưởng: ${prizeName}`)
        .setDescription(
          `> Người trúng cũ không hoàn thành yêu cầu, hệ thống đã quay lại!\n\n` +
          `• <a:dans:1393177512242053140> **Người tổ chức:** <@${message.author.id}>\n` +
          `• 🏆 **Người chiến thắng mới:** ${newWinnerMention}`
        )
        .setColor(0x3498DB)
        .setTimestamp();

      return message.channel.send({
        content: `🔄 **REROLL!** Chúc mừng ${newWinnerMention} đã may mắn nhận được **${prizeName}** thay thế!`,
        embeds: [rerollEmbed]
      });

    } catch (err) {
      console.error(err);
      return message.reply('❌ Đã xảy ra lỗi khi thực hiện reroll!');
    }
  }

  // --- 3. LỆNH GA (GIVEAWAY) ---
  if (command === 'ga') {
    if (args.length === 0) {
      const helpEmbed = new EmbedBuilder()
        .setAuthor({ 
          name: '📖 HƯỚNG DẪN SỬ DỤNG LỆNH GIVEAWAY', 
          iconURL: client.user.displayAvatarURL() 
        })
        .setTitle('✨ Cách tạo GiveAway')
        .setDescription(
          `> \`z.ga <id_role/none> <số_giải> <thời_gian> [số_lượng_ga] <nội_dung>\`\n\n` +
          `• 🌐 **Mở cho tất cả mọi người:**\n` +
          `  \`z.ga none 1 30s 1 tỷ\`\n\n` +
          `• 📌 **Tag trực tiếp Role:**\n` +
          `  \`z.ga @Role 1 12h Nitro\``
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

    for (let i = 0; i < giveawayCount; i++) {
      const endTime = Date.now() + durationMs;
      const roleDisplay = targetRoleId ? `<@&${targetRoleId}>` : 'Everyone';

      const buildEmbed = (msRemaining) => {
        return new EmbedBuilder()
          .setAuthor({ 
            name: headerTitle, 
            iconURL: message.guild.iconURL({ dynamic: true }) 
          })
          .setTitle(`🎉 ${prize}`)
          .setDescription(
            `> Hãy nhấn vào biểu tượng **${EMOJI_GA}** bên dưới để tham gia ngay!\n\n` +
            `• <a:dans:1393177512242053140> **Người tổ chức:** <@${message.author.id}>\n` +
            `• 🛡️ **Yêu cầu Role:** ${roleDisplay}\n` +
            `• 🏆 **Số suất trúng:** \`${winnerCount} giải\`\n` +
            `• ⏳ **Thời gian còn lại:** \`${formatTimeLeft(msRemaining)}\``
          )
          .setColor(0xFF69B4)
          .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
          .setImage(GA_GIF)
          .setFooter({
            text: `⏰ Kết thúc lúc`,
            iconURL: client.user.displayAvatarURL()
          })
          .setTimestamp(endTime);
      };

      const gaMessage = await message.channel.send({ embeds: [buildEmbed(durationMs)] });
      await gaMessage.react(EMOJI_GA).catch(() => {});
      lastCreatedMessage = gaMessage;

      const interval = setInterval(async () => {
        const remaining = endTime - Date.now();
        if (remaining <= 0) {
          clearInterval(interval);
        } else {
          await gaMessage.edit({ embeds: [buildEmbed(remaining)] }).catch(() => clearInterval(interval));
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
          return fetchedMsg.edit({ embeds: [endEmbed] });
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
            `• <a:dans:1393177512242053140> **Người tổ chức:** <@${message.author.id}>\n` +
            `• 🎉 **Người chiến thắng:** ${winnerMentions}`
          )
          .setColor(0xFF69B4);

        await fetchedMsg.edit({ embeds: [endEmbed] });

        const winAnnounceEmbed = new EmbedBuilder()
          .setAuthor({ name: '🎉 KẾT QUẢ GIVEAWAY 🎉', iconURL: message.guild.iconURL({ dynamic: true }) })
          .setTitle(`🎁 Phần thưởng: ${prize}`)
          .setDescription(
            `> Chúc mừng cậu chủ ${winnerMentions} đã may mắn bú đẫm giveaway!\n\n` +
            `• <a:dans:1393177512242053140> **Người trao quà:** <@${message.author.id}>\n` +
            `• 🏆 **Người trúng giải:** ${winnerMentions}`
          )
          .setColor(0xFF69B4)
          .setTimestamp();

        message.channel.send({ 
          content: `🎉 Chúc mừng ${winnerMentions} me đã trúng **${prize}** của <@${message.author.id}>!`, 
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
