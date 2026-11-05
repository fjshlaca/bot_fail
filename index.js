const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');

// --- CẤU HÌNH WEB SERVER TREO RENDER ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot Discord Giveaway & Moderation đang hoạt động!'));
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

// --- CẤU HÌNH ADMIN & ROLE QUẢN LÝ (Server Chính) ---
const BOT_ADMIN_ID = '1247253243336069264'; // ID cá nhân của Đức
const ALLOWED_ROLE_IDS = [
  '1539318114913620038',
  '1537508547234111639',
  '1537784243692769320'
];
const JAIL_CHANNEL_ID = '1567570022224625817'; // Kênh Phạt Tù

// Bộ nhớ lưu trữ tiến độ Phạt Tù & Giveaway
const jailData = new Map();
const activeGiveaways = new Map();

// 20 CÂU TRÊU NGƯƠI KHI GÕ zancut
const TAUNT_MESSAGES = [
  "Cố lên con trai, nhai kỹ nuốt chậm vào! 💩",
  "Hương vị này có làm em xao xuyến không hả phạm nhân? 😂",
  "Ngon thế nhờ, làm thêm miếng nữa đi cháu ơi! 🍽️",
  "Tay nhanh hơn não hay não chậm hơn miệng thế? Gõ tiếp đi chờ gì nữa! 🤡",
  "Ăn cứt rãnh tay thế, chắc ở ngoài nghiệp quật nhiều lắm hả? 💀",
  "Cứ từ từ thưởng thức đi, ở trong này thời gian dài lắm anh em ạ~ 🕰️",
  "Nốc cho đẫm vào rồi ngày mai lại được vào ăn tiếp nhé! 🍼",
  "Uống nước suối súc miệng xong chiến tiếp đi bẹn ơi! 🚰",
  "Độ mặn của món này hình như hơi quá hả? Thêm mấy chục nháy nữa cho vừa miệng nè! 🧂",
  "Kém sang thế nhờ, sao lại để bị bắt vào đây gặm cái này thế hả? 🐒",
  "Cố lên, nuốt trôi cục này là thấy ánh sáng cuối đường hầm liền (hoặc là ko)... 🕳️",
  "Nghiệp chướng do mồm gây ra thì mồm phải chịu thôi con ạ! 🤫",
  "Nhìn mặt thộn thế kia chắc đang cay cú lắm đúng không? Gõ tiếp đi cưng! 😼",
  "Mỗi lần gõ là một lần bớt dại, rèn luyện tư duy đỉnh cao ghê ta! 🧠",
  "Cẩn thận nghẹn đấy nhé, không ai cứu đằng ấy đâu nha~ 🥤",
  "Ăn nhiều vào cho mau lớn, lớn rồi thì đừng có báo nữa nghe chưa! 👶",
  "Húp trọn bát này xong chắc tinh thần sảng khoái hẳn lên nhỉ? ✨",
  "Đúng là tuổi trẻ tài cao, tài thì chưa thấy toàn thấy cút với chả đậu! 📉",
  "Cố tình gõ sai chính tả hay do tay run quá đấy hả đại vương? 🧓",
  "Sám hối kiểu này chắc Phật tổ cũng phải quỳ gối xin hàng luôn quá! 🙏"
];

function isGAAdmin(member) {
  if (!member) return false;
  if (member.id === BOT_ADMIN_ID) return true;
  return member.roles.cache.some(r => ALLOWED_ROLE_IDS.includes(r.id));
}

// --- CẤU HÌNH BONUS ENTRIES & GACHA ---
const ROLE_ENTRIES = {
  '1393150909327999006': 1,
  '1393151668144574474': 2,
  '1393151139972644905': 3,
  '1393170229072367758': 4
};

const REQUIRED_ROLE_ID = '1425167156668141728';

const GACHA_POOL = [
  { id: null,                  weight: 65, name: 'Chúc may mắn lần sau', level: 0 },
  { id: '1393170229072367758', weight: 25, name: 'Royal Role Cấp 5',   level: 5 },
  { id: '1393151668144574474', weight: 5,  name: 'Royal Role Cấp 4',   level: 4 },
  { id: '1393151139972644905', weight: 3,  name: 'Royal Role Cấp 3',   level: 3 },
  { id: '1393150909327999006', weight: 1,  name: 'Royal Role Cấp 2',   level: 2 },
  { id: '1393150502157680761', weight: 1,  name: 'Royal Role Cấp 1',   level: 1 }
];

const userGachaProgress = new Map();

function spinGacha() {
  const rand = Math.random() * 100;
  let cumulative = 0;
  for (const item of GACHA_POOL) {
    cumulative += item.weight;
    if (rand < cumulative) return item;
  }
  return GACHA_POOL[0];
}

const PREFIX = 'z';

// --- CẤU HÌNH EMOJI & ẢNH GIVEAWAY ---
const EMOJI_GA_ID = '1567468310419742810';
const EMOJI_GA = `<:emoji_11:${EMOJI_GA_ID}>`;

const GA_THUMBNAIL = 'https://media.discordapp.net/attachments/1425167406686404808/1567463399909097533/Photoroom_20261104_154923.png?ex=6aec458c&is=6aeaf40c&hm=42389ce875d5d5c835f606cb5a6fdf5ad8ab194d2b810c1ed3a8c429d39f0328&=&format=webp&quality=lossless&width=626&height=626';
const GA_GIF = 'https://media.discordapp.net/attachments/1425167406686404808/1567463400647426109/2FE0AAB4-BB1C-4A82-A922-3F7D419E7105.png?ex=6aec458c&is=6aeaf40c&hm=2e038e911c66cc7be4e1d8f577e4da653e15a8adb6ea2b63b242437f2fd38ef7&=&format=webp&quality=lossless&width=1111&height=626';

function parseCustomDuration(str) {
  if (!str) return null;
  const regex = /(\d+)\s*([smhd])/gi;
  let match;
  let totalMs = 0;
  let found = false;

  while ((match = regex.exec(str)) !== null) {
    found = true;
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    if (unit === 's') totalMs += value * 1000;
    else if (unit === 'm') totalMs += value * 60 * 1000;
    else if (unit === 'h') totalMs += value * 60 * 60 * 1000;
    else if (unit === 'd') totalMs += value * 24 * 60 * 60 * 1000;
  }

  return found && totalMs > 0 ? totalMs : null;
}

function formatTimeLeft(msLeft) {
  if (msLeft <= 0) return 'Tiệc đã kết thúc';
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
  console.log(`[VER 9.9 MAIN SERVER LIVE] Đã đăng nhập: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.toLowerCase().startsWith(PREFIX)) return;

  const rawContent = message.content.slice(PREFIX.length).trim();
  const args = rawContent.split(/ +/);
  const command = args.shift().toLowerCase();

  // ==========================================
  // 🧹 XÓA TIN NHẮN NHANH (zclear / Zclear)
  // ==========================================
  if (command === 'clear') {
    if (!isGAAdmin(message.member)) {
      return message.reply('❌ **Bạn không có quyền sử dụng lệnh Xóa Tin Nhắn!**');
    }

    const amount = parseInt(args[0]);

    if (isNaN(amount) || amount <= 0 || amount > 100) {
      return message.reply('❌ **Cú pháp:** `zclear <số_lượng>` (Số lượng từ 1 đến 100. Ví dụ: `zclear 10`)');
    }

    try {
      const deletedMessages = await message.channel.bulkDelete(amount + 1, true);
      const actualCount = deletedMessages.size - 1;

      const confirmMsg = await message.channel.send(`🧹 **Đã dọn dẹp thành công ${actualCount > 0 ? actualCount : 0} tin nhắn!**`);
      
      setTimeout(() => {
        confirmMsg.delete().catch(() => {});
      }, 3000);
      return;
    } catch (err) {
      console.error("Lỗi khi xóa tin nhắn:", err);
      return message.reply('❌ **Lỗi:** Không thể xóa các tin nhắn quá 14 ngày tuổi hoặc do thiếu quyền!');
    }
  }

  // ==========================================
  // 🔇 MUTE (zmute / Zmute)
  // ==========================================
  if (command === 'mute') {
    if (!isGAAdmin(message.member)) {
      return message.reply('❌ **Bạn không có quyền sử dụng lệnh Mute!**');
    }

    let targetUser = message.mentions.members.first();
    let durationArgIndex = 1;

    if (!targetUser && message.reference && message.reference.messageId) {
      const repliedMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
      if (repliedMsg) {
        targetUser = await message.guild.members.fetch(repliedMsg.author.id).catch(() => null);
        durationArgIndex = 0;
      }
    }

    if (!targetUser) {
      return message.reply('❌ **Cú pháp:** `@mention` hoặc **Reply** rồi gõ `zmute <thời_gian> [lý_do]`');
    }

    const durationMs = parseCustomDuration(args[durationArgIndex]);
    if (!durationMs) {
      return message.reply('❌ **Thời gian không hợp lệ!** Sử dụng: `s`, `m`, `h`, `d`. Ví dụ: `zmute 10m`');
    }

    const reason = args.slice(durationArgIndex + 1).join(' ') || 'Không có lý do';

    try {
      await targetUser.timeout(durationMs, reason);
      const muteEmbed = new EmbedBuilder()
        .setAuthor({ name: '🔇 MUTE', iconURL: message.guild.iconURL({ dynamic: true }) })
        .setDescription(
          `• **Thành viên bị phạt:** <@${targetUser.id}>\n` +
          `• **Thời gian:** \`${formatTimeLeft(durationMs)}\`\n` +
          `• **Người thực thi:** <@${message.author.id}>\n` +
          `• **Lý do:** ${reason}`
        )
        .setColor(0xC7A9C9);

      return message.channel.send({ embeds: [muteEmbed] });
    } catch (err) {
      console.error(err);
      return message.reply('❌ **Lỗi:** Không thể Mute người này!');
    }
  }

  // ==========================================
  // 🔊 UNMUTE (zunmute / Zunmute)
  // ==========================================
  if (command === 'unmute') {
    if (!isGAAdmin(message.member)) {
      return message.reply('❌ **Bạn không có quyền sử dụng lệnh Unmute!**');
    }

    let targetUser = message.mentions.members.first();
    let reasonIndex = 1;

    if (!targetUser && message.reference && message.reference.messageId) {
      const repliedMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
      if (repliedMsg) {
        targetUser = await message.guild.members.fetch(repliedMsg.author.id).catch(() => null);
        reasonIndex = 0;
      }
    }

    if (!targetUser) {
      return message.reply('❌ **Cú pháp:** `@mention` hoặc **Reply** rồi gõ `zunmute [lý_do]`');
    }

    const reason = args.slice(reasonIndex).join(' ') || 'Không có lý do';

    try {
      await targetUser.timeout(null, reason);
      const unmuteEmbed = new EmbedBuilder()
        .setAuthor({ name: '🔊 UNMUTE', iconURL: message.guild.iconURL({ dynamic: true }) })
        .setDescription(
          `• **Thành viên được gỡ Mute:** <@${targetUser.id}>\n` +
          `• **Người thực thi:** <@${message.author.id}>\n` +
          `• **Lý do:** ${reason}`
        )
        .setColor(0x2ECC71);

      return message.channel.send({ embeds: [unmuteEmbed] });
    } catch (err) {
      console.error(err);
      return message.reply('❌ **Lỗi:** Không thể Unmute người này!');
    }
  }

  // ==========================================
  // 🔨 BAN (zban / Zban)
  // ==========================================
  if (command === 'ban') {
    if (!isGAAdmin(message.member)) {
      return message.reply('❌ **Bạn không có quyền sử dụng lệnh Ban!**');
    }

    let targetUser = message.mentions.members.first();
    let reasonIndex = 1;

    if (!targetUser && message.reference && message.reference.messageId) {
      const repliedMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
      if (repliedMsg) {
        targetUser = await message.guild.members.fetch(repliedMsg.author.id).catch(() => null);
        reasonIndex = 0;
      }
    }

    if (!targetUser) {
      return message.reply('❌ **Cú pháp:** `@mention` hoặc **Reply** rồi gõ `zban [lý_do]`');
    }

    const reason = args.slice(reasonIndex).join(' ') || 'Không có lý do';

    try {
      await targetUser.ban({ reason });
      const banEmbed = new EmbedBuilder()
        .setAuthor({ name: '🔨 BAN', iconURL: message.guild.iconURL({ dynamic: true }) })
        .setDescription(
          `• **Thành viên bị Ban:** <@${targetUser.id}>\n` +
          `• **Người thực thi:** <@${message.author.id}>\n` +
          `• **Lý do:** ${reason}`
        )
        .setColor(0xED4245);

      return message.channel.send({ embeds: [banEmbed] });
    } catch (err) {
      console.error(err);
      return message.reply('❌ **Lỗi:** Không thể Ban người này!');
    }
  }

  // ==========================================
  // ⚖️ PHẠT TÙ (ztu / Ztu)
  // ==========================================
  if (command === 'tu') {
    if (!isGAAdmin(message.member)) {
      return message.reply('❌ **Bạn không có quyền sử dụng lệnh Phạt Tù!**');
    }

    let targetUser = message.mentions.members.first();
    let amountIndex = 1;

    if (!targetUser && message.reference && message.reference.messageId) {
      const repliedMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
      if (repliedMsg) {
        targetUser = await message.guild.members.fetch(repliedMsg.author.id).catch(() => null);
        amountIndex = 0;
      }
    }

    const amount = parseInt(args[amountIndex]);

    if (!targetUser || isNaN(amount) || amount <= 0) {
      return message.reply('❌ **Cú pháp:** `ztu <số_lần_ăn_cút> [lý_do]`');
    }

    const reason = args.slice(amountIndex + 1).join(' ') || 'Không có lý do';

    try {
      let jailRole = message.guild.roles.cache.find(r => r.name === 'Kẻ Tù Tội');
      if (!jailRole) {
        jailRole = await message.guild.roles.create({
          name: 'Kẻ Tù Tội',
          color: 0x555555,
          reason: 'Tạo Role phục vụ hệ thống Phạt Tù'
        });

        message.guild.channels.cache.forEach(async (channel) => {
          if (channel.id === JAIL_CHANNEL_ID) {
            await channel.permissionOverwrites.edit(jailRole, {
              ViewChannel: true,
              SendMessages: true,
              ReadMessageHistory: true
            }).catch(() => {});
          } else {
            await channel.permissionOverwrites.edit(jailRole, {
              ViewChannel: false,
              SendMessages: false
            }).catch(() => {});
          }
        });
      }

      const oldRoleIds = targetUser.roles.cache.filter(r => r.id !== message.guild.id).map(r => r.id);
      jailData.set(targetUser.id, {
        required: amount,
        current: 0,
        roles: oldRoleIds,
        failTronCount: 0
      });

      await targetUser.roles.set([jailRole.id]).catch(() => {});

      const jailEmbed = new EmbedBuilder()
        .setAuthor({ name: 'Tù ngay con chó', iconURL: message.guild.iconURL({ dynamic: true }) })
        .setDescription(
          `• **Phạm nhân:** <@${targetUser.id}>\n` +
          `• **Hình phạt:** Phải gõ \`zancut\` đủ **${amount} lần** tại kênh <#${JAIL_CHANNEL_ID}>\n` +
          `• **Người bắt:** <@${message.author.id}>\n` +
          `• **Lý do:** ${reason}`
        )
        .setColor(0x34495E);

      message.channel.send({ embeds: [jailEmbed] });

      const jailChannel = message.guild.channels.cache.get(JAIL_CHANNEL_ID);
      if (jailChannel) {
        const guideEmbed = new EmbedBuilder()
          .setTitle('🚨 BẢNG HƯỚNG DẪN CẢI TẠO PHẠT TÙ 🚨')
          .setDescription(
            `Chào mừng <@${targetUser.id}> đến với phòng giam!\n\n` +
            `• Để được tự do, bạn phải gõ lệnh \`zancut\` đúng **${amount} lần**.\n` +
            `• **Tiến độ hiện tại:** \`0 / ${amount}\` lần.\n\n` +
            `🔓 **Mẹo trốn tù:** Bạn có thể type \`ztron\` để có cơ hội trốn thoát (tỷ lệ thành công **20%**).\n` +
            `⚠️ **Cảnh báo:** Nếu trốn thất bại liên tiếp **3 lần**, hình phạt của bạn sẽ bị **NHÂN ĐÔI** số lần \`zancut\`!`
          )
          .setColor(0xC7A9C9);

        jailChannel.send({ content: `<@${targetUser.id}>`, embeds: [guideEmbed] });
      }
      return;
    } catch (err) {
      console.error(err);
      return message.reply('❌ **Lỗi:** Không thể thực thi phạt tù đối tượng này!');
    }
  }

  // ==========================================
  // 🔓 TRỐN TÙ (ztron / Ztron)
  // ==========================================
  if (command === 'tron') {
    const userId = message.author.id;
    if (!jailData.has(userId)) {
      return message.reply('❌ **Bạn có ở trong tù đâu mà đòi trốn!**');
    }

    const pData = jailData.get(userId);
    const successRoll = Math.random() * 100;

    if (successRoll < 20) {
      try {
        const jailRole = message.guild.roles.cache.find(r => r.name === 'Kẻ Tù Tội');
        if (jailRole) {
          await message.member.roles.remove(jailRole).catch(() => {});
        }

        if (pData.roles && pData.roles.length > 0) {
          await message.member.roles.add(pData.roles).catch(() => {});
        }

        jailData.delete(userId);

        const escapeEmbed = new EmbedBuilder()
          .setTitle('🏃‍♂️ VƯỢT NGỤC THÀNH CÔNG XUẤT SẮC!')
          .setDescription(
            `• Phạm nhân <@${userId}> đã vượt ngục thành công xuất sắc!\n` +
            `• Bạn đã được tự do, khôi phục toàn bộ quyền hạn mà không cần gõ \`zancut\` nữa!`
          )
          .setColor(0xF1C40F);

        return message.channel.send({ content: `<@${userId}>`, embeds: [escapeEmbed] });
      } catch (err) {
        console.error(err);
        return message.reply('🏃‍♂️ Bạn trốn thành công nhưng xảy ra lỗi khi khôi phục role!');
      }
    } else {
      pData.failTronCount += 1;
      let extraWarning = `• ❌ Trốn thất bại! Lần trượt thứ **${pData.failTronCount}/3** liên tiếp.`;

      if (pData.failTronCount >= 3) {
        pData.required *= 2;
        pData.failTronCount = 0;
        extraWarning += `\n\n🚨 **QUÁ TAM BA BẬN!** Bạn bị bắt quả tang, hình phạt bị **NHÂN ĐÔI** thành **${pData.required} lần** \`zancut\`!`;
      }

      const failTronEmbed = new EmbedBuilder()
        .setAuthor({ name: '🚨 VƯỢT NGỤC BẤT THÀNH', iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        .setDescription(
          `> Phạm nhân <@${userId}> định trốn cửa sau nhưng bị gác ngục bắt giữ!\n\n` +
          `${extraWarning}\n` +
          `• 📌 **Tiến độ hiện tại:** \`${pData.current} / ${pData.required}\` lần.`
        )
        .setColor(0xED4245);

      return message.channel.send({ embeds: [failTronEmbed] });
    }
  }

  // ==========================================
  // 💩 ĂN CÚT (zancut / Zancut)
  // ==========================================
  if (command === 'ancut') {
    const userId = message.author.id;
    if (!jailData.has(userId)) {
      return message.reply('❌ **Bạn đâu có bị phạt tù đâu!**');
    }

    const pData = jailData.get(userId);

    const isVienMan = Math.random() * 100 < 20;
    const addedCount = isVienMan ? 2 : 1;
    pData.current += addedCount;

    const randomTaunt = TAUNT_MESSAGES[Math.floor(Math.random() * TAUNT_MESSAGES.length)];

    if (pData.current >= pData.required) {
      try {
        const jailRole = message.guild.roles.cache.find(r => r.name === 'Kẻ Tù Tội');
        if (jailRole) {
          await message.member.roles.remove(jailRole).catch(() => {});
        }

        if (pData.roles && pData.roles.length > 0) {
          await message.member.roles.add(pData.roles).catch(() => {});
        }

        jailData.delete(userId);

        const freeEmbed = new EmbedBuilder()
          .setTitle('🎉 CHÚC MỪNG BẠN ĐÃ ĐƯỢC MÃ HẠN TÙ!')
          .setDescription(
            `• Phạm nhân <@${userId}> đã hoàn tất **${pData.required}/${pData.required}** lần \`zancut\`!\n` +
            `• Bạn đã chính thức được tự do.\n\n` +
            `*Lời nhắn lúc về:* "${randomTaunt}"`
          )
          .setColor(0x2ECC71);

        return message.channel.send({ content: `<@${userId}>`, embeds: [freeEmbed] });
      } catch (err) {
        console.error(err);
        return message.reply('🎉 Bạn đã hoàn thành án tù nhưng có lỗi khi khôi phục Role!');
      }
    } else {
      let vienManText = isVienMan ? `\n\n🌟 **ĂN CỨT VIÊN MÃN!** Quá trình thưởng thức cực kỳ thăng hoa, hệ thống thưởng nóng trừ thẳng **2 lần** luôn!` : '';

      const progressEmbed = new EmbedBuilder()
        .setAuthor({ name: '💩 BẢNG TIẾN ĐỘ CẢI TẠO', iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        .setDescription(
          `> Phạm nhân <@${userId}> vừa thực hiện một nhát sám hối!\n` +
          `> *"${randomTaunt}"*\n` +
          `${vienManText}\n\n` +
          `• 📌 **Tiến độ cải tạo:** \`${pData.current} / ${pData.required}\` lần \`zancut\`.\n` +
          `• ⏳ **Còn thiếu:** \`${pData.required - pData.current}\` lần nữa!`
        )
        .setColor(0xC7A9C9);

      return message.channel.send({ embeds: [progressEmbed] });
    }
  }

  // ==========================================
  // 💎 HÒM BÁU VẬT RANDOM ROLE (zrdrole / Zrdrole)
  // ==========================================
  if (command === 'rdrole') {
    if (!message.member.roles.cache.has(REQUIRED_ROLE_ID)) {
      return message.reply(`❌ **Bạn cần sở hữu Role <@&${REQUIRED_ROLE_ID}> mới có thể tham gia Khai Mở Kho Báu!**`);
    }

    try {
      const result = spinGacha();
      const userId = message.author.id;

      const failStories = [
        {
          title: "<:emoji_20:1567861679788658718> Suýt Chạm Tay Đến Báu Vật!",
          desc: `Người chơi <@${userId}> vừa bỏ lỡ một chút nữa là tìm thấy bảo vật quý giá rồi!\n\nLời nhắn: Có lẽ bảo vật vẫn chưa muốn lộ diện, hãy tiếp tục hành trình khai mở kho báu và thử vận may lần nữa nhé!`
        },
        {
          title: "<:emoji_19:1567861657823346718> Báu Vật Suýt Được Khai Mở!",
          desc: `₊˚⊹ Người chơi <@${userId}> vừa chạm đến ngưỡng cửa kho báu, nhưng món bảo vật vẫn chưa chịu xuất hiện!\n\n♡ Lời nhắn: Có lẽ duyên gặp gỡ vẫn chưa đến, hãy thử khai mở thêm lần nữa nhé!`
        },
        {
          title: "<:emoji_17:1567861637073866933> Chìa Khóa Chưa Tìm Được Ổ!",
          desc: `₊˚⊹ Người chơi <@${userId}> đã tiến rất gần đến kho báu, tiếc rằng chiếc chìa khóa may mắn vẫn chưa nằm trong tay bạn!\n\n♡ Lời nhắn: Đừng vội bỏ cuộc, cánh cửa bí mật vẫn đang chờ người mở khóa!`
        },
        {
          title: "<:emoji_23:1567861756477571142> Bảo Vật Vẫn Đang Ẩn Mình!",
          desc: `₊˚⊹ Người chơi <@${userId}> vừa suýt tìm thấy món bảo vật quý hiếm, nhưng nó vẫn chưa muốn lộ diện!\n\n♡ Lời nhắn: Kiên nhẫn thêm một chút, vận may có thể đang ở ngay lượt tiếp theo!`
        },
        {
          title: "<:emoji_22:1567861737187836024> Định Mệnh Chưa Gọi Tên!",
          desc: `₊˚⊹ Người chơi <@${userId}> đã có một cuộc gặp gỡ hụt với bảo vật quý giá, nhưng định mệnh vẫn chưa chính thức xướng tên bạn!\n\n♡ Lời nhắn: Hãy tiếp tục chờ đón khoảnh khắc hữu duyên ấy nhé!`
        },
        {
          title: "<:emoji_21:1567861715767660615> Ngai Vàng Vẫn Chưa Có Chủ!",
          desc: `₊˚⊹ Người chơi <@${userId}> vừa bỏ lỡ cơ hội chạm tay đến danh vị quý giá!\n\n♡ Lời nhắn: Vương miện vẫn đang đợi chủ nhân xứng đáng, hãy tiếp tục thử vận may nhé!`
        }
      ];

      if (result.id === null) {
        const selectedFail = failStories[Math.floor(Math.random() * failStories.length)];

        const failEmbed = new EmbedBuilder()
          .setAuthor({ name: '˚·.¸¸.<a:hgtt_kimcuong2:1567874404602618017> ¸¸.·° \nROYAL TREASURES', iconURL: message.author.displayAvatarURL({ dynamic: true }) })
          .setTitle(selectedFail.title)
          .setDescription(selectedFail.desc)
          .setColor(0xC7A9C9);

        return message.channel.send({ embeds: [failEmbed] });
      }

      if (!userGachaProgress.has(userId)) {
        userGachaProgress.set(userId, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
      }

      const userProgress = userGachaProgress.get(userId);
      userProgress[result.level] += 1;

      let storageStatus = "";

      if (userProgress[result.level] >= 2) {
        userProgress[result.level] = 0;
        await message.member.roles.add(result.id).catch((err) => {
          console.error("Lỗi cấp Role:", err);
        });
        storageStatus = "Đã được add role thành công";
      } else {
        storageStatus = `1 / 2 lần (Chưa đủ điều kiện add role)`;
      }

      const successEmbed = new EmbedBuilder()
        .setAuthor({ name: '˚₊‧꒰ა <a:hgtt_kimcuong2:1567874404602618017>  ໒꒱ ‧₊˚\n𝑹𝑶𝒀𝑨𝑳 𝑻𝑹𝑬𝑨𝑺𝑼𝑹𝑬𝑺', iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        .setTitle('✧ ˚₊‧⊹ Chúc Mừng Đã Tìm Thấy Bảo Vật! ⊹‧₊˚')
        .setDescription(
          `<:emoji_15:1567861576025772135> Nhà Sưu Tầm <@${userId}> vừa khai mở thành công chiếc rương báu và tìm thấy một bảo vật quý giá!\n\n` +
          `<:emoji_16:1567861598515896512> Bảo vật nhận được: <@&${result.id}>\n` +
          `<:emoji_17:1567861618975449218> Tiến độ tích luỹ: ${storageStatus}\n\n` +
          `            ˚₊‧꒰ა ♔ ໒꒱ ‧₊˚\n\n` +
          `             𝑹𝒐𝒚𝒂𝒍 𝑻𝒓𝒆𝒂𝒔𝒖𝒓𝒆𝒔\n` +
          ` ZeitHaven • The Royal Collection\n\n` +
          `Một báu vật đã tìm thấy chủ nhân. ♡`
        )
        .setColor(0xC7A9C9);

      return message.channel.send({ embeds: [successEmbed] });

    } catch (err) {
      console.error(err);
      return message.reply('❌ Đã xảy ra lỗi trong quá trình Khai Mở Kho Báu!');
    }
  }

  // ==========================================
  // 🔄 REROLL GIVEAWAY (zgarr / Zgarr)
  // ==========================================
  if (command === 'garr') {
    if (!isGAAdmin(message.member)) {
      return message.reply(`❌ **Bạn không có quyền quản lý Giveaway!**`);
    }

    if (!message.reference || !message.reference.messageId) {
      return message.reply('❌ **Bạn phải reply vào tin nhắn giveaway cần reroll rồi mới gõ `zgarr`!**');
    }

    try {
      const targetMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
      if (!targetMsg) {
        return message.reply('❌ Không tìm thấy tin nhắn giveaway được reply!');
      }

      await message.delete().catch(() => {});

      let reaction = targetMsg.reactions.cache.get(EMOJI_GA_ID) || 
                       targetMsg.reactions.cache.find(r => r.emoji.name === '🎁') || 
                       targetMsg.reactions.cache.first();

      if (!reaction) {
        return message.reply('❌ Không tìm thấy lượt thả emoji tham gia!');
      }

      let users = await reaction.users.fetch();
      let validUsers = users.filter(u => !u.bot);

      if (validUsers.size === 0) {
        return message.reply('❌ Không có người chơi hợp lệ nào khác!');
      }

      let oldWinnersIds = new Set();
      let prizeName = 'món quà';

      if (targetMsg.embeds.length > 0) {
        const embed = targetMsg.embeds[0];
        const embedText = JSON.stringify(embed);
        const mentionRegex = /<@!?(\d+)>/g;
        let match;
        while ((match = mentionRegex.exec(embedText)) !== null) {
          oldWinnersIds.add(match[1]);
        }

        // Trích xuất tên phần quà từ Description của Embed
        if (embed.description) {
          const prizeMatch = embed.description.match(/\*\*Phần quà:\*\*\s*(.+)/);
          if (prizeMatch && prizeMatch[1]) {
            prizeName = prizeMatch[1].trim();
          }
        }
      }

      oldWinnersIds.add(message.author.id);

      const availablePool = Array.from(validUsers.keys()).filter(id => !oldWinnersIds.has(id));

      if (availablePool.length === 0) {
        return message.reply('❌ Không còn người chơi hợp lệ nào khác để reroll!');
      }

      const randomIndex = Math.floor(Math.random() * availablePool.length);
      const newWinnerId = availablePool[randomIndex];
      const newWinnerMention = `<@${newWinnerId}>`;

      // Reply trực tiếp vào bài tin nhắn Giveaway (Phần quà vừa in đậm vừa gạch chân)
      return targetMsg.reply({
        content: `˚₊‧⊹ <:emoji_11:1567468310419742810> Hương vị thay đổi, xin chúc mừng ${newWinnerMention} trở thành chủ nhân mới của món quà __**${prizeName}**__ ⊹‧₊˚`
      });

    } catch (err) {
      console.error("Lỗi Reroll:", err);
      return message.reply('❌ Đã xảy ra lỗi khi thực hiện reroll!');
    }
  }

  // ==========================================
  // 🛑 END GIVEAWAY SỚM (zend / Zend)
  // ==========================================
  if (command === 'end') {
    if (!isGAAdmin(message.member)) {
      return message.reply(`❌ **Bạn không có quyền quản lý Giveaway!**`);
    }

    if (!message.reference || !message.reference.messageId) {
      return message.reply('❌ **Bạn phải reply vào bài giveaway đang chạy rồi mới gõ `zend`!**');
    }

    const targetMsgId = message.reference.messageId;
    const gaData = activeGiveaways.get(targetMsgId);

    if (!gaData) {
      return message.reply('❌ **Không tìm thấy bài Giveaway đang chạy ở tin nhắn này**!');
    }

    try {
      await message.delete().catch(() => {});
      clearTimeout(gaData.timeoutId);
      clearInterval(gaData.intervalId);

      await gaData.endGaFunction();
      activeGiveaways.delete(targetMsgId);
    } catch (err) {
      console.error("Lỗi khi kết thúc GA sớm:", err);
      return message.reply('❌ Đã xảy ra lỗi khi kết thúc Giveaway sớm!');
    }
  }

  // ==========================================
  // 🎉 TẠO GIVEAWAY (zga / Zga)
  // Cú pháp chuẩn: zga [Role] <số_người_trúng> <thời_gian> <số_lượng_ga> <nội_dung>
  // ==========================================
  if (command === 'ga') {
    if (!isGAAdmin(message.member)) {
      return message.reply(`❌ **Bạn không có quyền quản lý Giveaway!**`);
    }

    if (args.length === 0) {
      const helpEmbed = new EmbedBuilder()
        .setAuthor({ name: '📖 HƯỚNG DẪN SỬ DỤNG LỆNH GIVEAWAY', iconURL: client.user.displayAvatarURL() })
        .setTitle('✨ Cách tạo GiveAway')
        .setDescription(
          `> \`zga [@Role] <số_người_trúng> <thời_gian> [số_lượng_ga] <nội_dung>\`\n\n` +
          `• 🌐 **Tạo Giveaway thông thường:**\n` +
          `  \`zga 1 24h 1 100k\` hoặc \`Zga 2 10m 1 Nitro\`\n\n` +
          `• 📌 **Tag trực tiếp Role điều kiện:**\n` +
          `  \`zga @Role 1 12h 1 100k\``
        )
        .setColor(0xC7A9C9);

      return message.reply({ embeds: [helpEmbed] });
    }

    let targetRoleId = null;
    let winnerCount = 1;
    let durationMs = null;
    let giveawayCount = 1;
    let prize = '';

    let currentIndex = 0;
    const firstArg = args[0];
    const extractedId = firstArg.replace(/\D/g, '');

    // 1. Kiểm tra xem có tag Role ở vị trí đầu tiên không
    if (extractedId.length >= 15) {
      targetRoleId = extractedId;
      currentIndex = 1;
    }

    // 2. Đọc Số người trúng
    if (args[currentIndex] && !isNaN(parseInt(args[currentIndex]))) {
      winnerCount = parseInt(args[currentIndex]);
      currentIndex++;
    }

    // 3. Đọc Thời gian (24h, 10m,...)
    if (args[currentIndex]) {
      durationMs = parseCustomDuration(args[currentIndex]);
      if (durationMs) currentIndex++;
    }

    // 4. Đọc Số lượng bài GA muốn tạo
    if (args[currentIndex] && !isNaN(parseInt(args[currentIndex]))) {
      giveawayCount = parseInt(args[currentIndex]);
      currentIndex++;
    }

    // 5. Nội dung phần thưởng
    prize = args.slice(currentIndex).join(' ');

    if (!durationMs) {
      return message.reply('❌ **Thời gian không hợp lệ!** Cú pháp chuẩn: `zga <số_người_trúng> <thời_gian> <số_lượng_ga> <nội_dung>` (Ví dụ: `zga 1 24h 1 100k`)');
    }
    if (!prize) {
      return message.reply('❌ **Chưa nhập nội dung giveaway!**');
    }

    await message.delete().catch(() => {});

    const isFlash = durationMs < 3600000;

    for (let i = 0; i < giveawayCount; i++) {
      const endTime = Date.now() + durationMs;
      const roleDisplay = targetRoleId ? `<@&${targetRoleId}>` : 'Everyone';
      const wineTitleFont = '𝐖𝐈𝐍𝐄 𝐆𝐈𝐕𝐄𝐀𝐖𝐀𝐘';

      const buildEmbed = (msRemaining) => {
        return new EmbedBuilder()
          .setTitle(`<:emoji_11:1567468310419742810> ${wineTitleFont} <:emoji_11:1567468310419742810>`)
          .setDescription(
            `✧ Một ly vang đỏ, một món quà dành cho vị khách hữu duyên.\n\n` +
            `<:emoji_9:1567468262512533514> **Chủ Tiệc:** <@${message.author.id}>\n` +
            `<:emoji_10:1567468283764936836> **Điều kiện tham dự:** ${roleDisplay}\n` +
            `<:emoji_13:1567468392544337972> **Phần quà:** ${prize}\n` +
            `<:emoji_12:1567468350823731322> **Thời gian khai tiệc còn lại:** \`${formatTimeLeft(msRemaining)}\``
          )
          .setColor(0xC7A9C9)
          .setThumbnail(GA_THUMBNAIL)
          .setImage(GA_GIF);
      };

      const gaMessage = await message.channel.send({ embeds: [buildEmbed(durationMs)] });
      await gaMessage.react(EMOJI_GA).catch(() => {});

      const interval = setInterval(async () => {
        const remaining = endTime - Date.now();
        if (remaining <= 0) {
          clearInterval(interval);
        } else {
          await gaMessage.edit({ embeds: [buildEmbed(remaining)] }).catch(() => clearInterval(interval));
        }
      }, 5000);

      const endGaFunction = async () => {
        clearInterval(interval);
        activeGiveaways.delete(gaMessage.id);

        const fetchedMsg = await message.channel.messages.fetch(gaMessage.id).catch(() => null);
        if (!fetchedMsg) return;

        const reaction = fetchedMsg.reactions.cache.get(EMOJI_GA_ID) || fetchedMsg.reactions.cache.first();
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
          const endedEmbed = EmbedBuilder.from(fetchedMsg.embeds[0]).setDescription(
            `✧ Một ly vang đỏ, một món quà dành cho vị khách hữu duyên.\n\n` +
            `<:emoji_9:1567468262512533514> **Chủ Tiệc:** <@${message.author.id}>\n` +
            `<:emoji_10:1567468283764936836> **Điều kiện tham dự:** ${roleDisplay}\n` +
            `<:emoji_13:1567468392544337972> **Phần quà:** ${prize}\n` +
            `<:emoji_12:1567468350823731322> **Thời gian khai tiệc còn lại:** \`Tiệc đã kết thúc\``
          );
          await fetchedMsg.edit({ embeds: [endedEmbed] }).catch(() => {});

          // Reply bài GA khi không có người trúng
          return fetchedMsg.reply({
            content: `˚₊‧⊹ <:emoji_13:1567468392544337972> Dạ tiệc kết thúc, món quà __**${prize}**__ vẫn còn nằm lại trên bàn tiệc…. ⊹‧₊˚`
          });
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

        const endedEmbed = EmbedBuilder.from(fetchedMsg.embeds[0]).setDescription(
          `✧ Một ly vang đỏ, một món quà dành cho vị khách hữu duyên.\n\n` +
          `<:emoji_9:1567468262512533514> **Chủ Tiệc:** <@${message.author.id}>\n` +
          `<:emoji_10:1567468283764936836> **Điều kiện tham dự:** ${roleDisplay}\n` +
          `<:emoji_13:1567468392544337972> **Phần quà:** ${prize}\n` +
          `<:emoji_12:1567468350823731322> **Thời gian khai tiệc còn lại:** \`Tiệc đã kết thúc\``
        );
        await fetchedMsg.edit({ embeds: [endedEmbed] }).catch(() => {});

        // Reply bài GA khi có người trúng (Phần quà vừa in đậm vừa gạch chân)
        return fetchedMsg.reply({
          content: `˚₊‧⊹ <:emoji_13:1567468392544337972> Rượu vang được nâng lên, xin chúc mừng ${winnerMentions} đã trở thành chủ nhân của món quà __**${prize}**__ ⊹‧₊˚`
        });
      };

      const timeoutId = setTimeout(endGaFunction, durationMs);

      activeGiveaways.set(gaMessage.id, {
        endGaFunction,
        timeoutId,
        intervalId: interval
      });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
