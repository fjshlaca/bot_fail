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
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildModeration
  ]
});

// --- CẤU HÌNH ADMIN & ROLE QUẢN LÝ ---
const BOT_ADMIN_ID = '1247253243336069264';
const ALLOWED_ROLE_IDS = [
  '1539318114913620038',
  '1537508547234111639',
  '1537784243692769320'
];
const JAIL_CHANNEL_ID = '1567570022224625817';

const jailData = new Map();
const activeGiveaways = new Map();

// --- DATA CỐ ĐỊNH (Tối ưu RAM) ---
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

// CẬP NHẬT GIAO DIỆN: CHUYỂN EMOJI LÊN TITLE VÀ XÓA ✨
const FAIL_STORIES = [
  {
    title: "<:emoji_20:1567861679788658718> Suýt Chạm Tay Đến Báu Vật!",
    desc: `Người chơi {USER} vừa bỏ lỡ một chút nữa là tìm thấy bảo vật quý giá rồi!\n\nLời nhắn: Có lẽ bảo vật vẫn chưa muốn lộ diện, hãy tiếp tục hành trình khai mở kho báu và thử vận may lần nữa nhé!`
  },
  {
    title: "<:emoji_19:1567861657823346718> Báu Vật Suýt Được Khai Mở!",
    desc: `₊˚⊹ Người chơi {USER} vừa chạm đến ngưỡng cửa kho báu, nhưng món bảo vật vẫn chưa chịu xuất hiện!\n\n♡ Lời nhắn: Có lẽ duyên gặp gỡ vẫn chưa đến, hãy thử khai mở thêm lần nữa nhé!`
  },
  {
    title: "<:emoji_17:1567861637073866933> Chìa Khóa Chưa Tìm Được Ổ!",
    desc: `₊˚⊹ Người chơi {USER} đã tiến rất gần đến kho báu, tiếc rằng chiếc chìa khóa may mắn vẫn chưa nằm trong tay bạn!\n\n♡ Lời nhắn: Đừng vội bỏ cuộc, cánh cửa bí mật vẫn đang chờ người mở khóa!`
  },
  {
    title: "<:emoji_23:1567861756477571142> Bảo Vật Vẫn Đang Ẩn Mình!",
    desc: `₊˚⊹ Người chơi {USER} vừa suýt tìm thấy món bảo vật quý hiếm, nhưng nó vẫn chưa muốn lộ diện!\n\n♡ Lời nhắn: Kiên nhẫn thêm một chút, vận may có thể đang ở ngay lượt tiếp theo!`
  },
  {
    title: "<:emoji_22:1567861737187836024> Định Mệnh Chưa Gọi Tên!",
    desc: `₊˚⊹ Người chơi {USER} đã có một cuộc gặp gỡ hụt với bảo vật quý giá, nhưng định mệnh vẫn chưa chính thức xướng tên bạn!\n\n♡ Lời nhắn: Hãy tiếp tục chờ đón khoảnh khắc hữu duyên ấy nhé!`
  },
  {
    title: "<:emoji_21:1567861715767660615> Ngai Vàng Vẫn Chưa Có Chủ!",
    desc: `. ̊✢ Người chơi {USER} vừa bỏ lỡ cơ hội chạm tay đến danh vị quý giá!\n\n♡ Lời nhắn: Vương miện vẫn đang đợi chủ nhân xứng đáng, hãy tiếp tục thử vận may nhé!`
  }
];

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
const PREFIX = 'z';

const EMOJI_GA_ID = '1567468310419742810';
const EMOJI_GA = `<:emoji_11:${EMOJI_GA_ID}>`;
const GA_THUMBNAIL = 'https://media.discordapp.net/attachments/1425167406686404808/1567463399909097533/Photoroom_20261104_154923.png?ex=6aec458c&is=6aeaf40c&hm=42389ce875d5d5c835f606cb5a6fdf5ad8ab194d2b810c1ed3a8c429d39f0328&=&format=webp&quality=lossless&width=626&height=626';
const GA_GIF = 'https://media.discordapp.net/attachments/1425167406686404808/1567463400647426109/2FE0AAB4-BB1C-4A82-A922-3F7D419E7105.png?ex=6aec458c&is=6aeaf40c&hm=2e038e911c66cc7be4e1d8f577e4da653e15a8adb6ea2b63b242437f2fd38ef7&=&format=webp&quality=lossless&width=1111&height=626';

// --- HELPER FUNCTIONS ---
function isGAAdmin(member) {
  if (!member) return false;
  return member.id === BOT_ADMIN_ID || member.roles.cache.some(r => ALLOWED_ROLE_IDS.includes(r.id));
}

function spinGacha() {
  const rand = Math.random() * 100;
  let cumulative = 0;
  for (const item of GACHA_POOL) {
    cumulative += item.weight;
    if (rand < cumulative) return item;
  }
  return GACHA_POOL[0];
}

function parseCustomDuration(str) {
  if (!str) return null;
  const regex = /(\d+)\s*([smhd])/gi;
  let match, totalMs = 0, found = false;
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
  const s = Math.floor((msLeft / 1000) % 60);
  const m = Math.floor((msLeft / (1000 * 60)) % 60);
  const h = Math.floor((msLeft / (1000 * 60 * 60)) % 24);
  const d = Math.floor(msLeft / (1000 * 60 * 60 * 24));
  let res = '';
  if (d > 0) res += `${d} ngày `;
  if (h > 0) res += `${h} giờ `;
  if (m > 0) res += `${m} phút `;
  res += `${s} giây`;
  return res.trim();
}

async function getTargetMember(message) {
  let member = message.mentions.members.first();
  let argsShift = 1;

  if (!member && message.reference && message.reference.messageId) {
    try {
      const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
      member = await message.guild.members.fetch(repliedMsg.author.id);
      argsShift = 0;
    } catch (err) {}
  }
  return { member, argsShift };
}

client.once('ready', () => {
  console.log(`[VER OPTIMIZED MAIN SERVER LIVE] Đã đăng nhập: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.toLowerCase().startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ==========================================
  // 🧹 XÓA TIN NHẮN (clear)
  // ==========================================
  if (command === 'clear') {
    if (!isGAAdmin(message.member)) return message.reply('❌ **Bạn không có quyền!**');
    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount <= 0 || amount > 100) return message.reply('❌ **Cú pháp:** `zclear <1-100>`');

    try {
      const deletedMessages = await message.channel.bulkDelete(amount + 1, true);
      const confirmMsg = await message.channel.send(`🧹 **Đã dọn dẹp ${deletedMessages.size - 1} tin nhắn!**`);
      setTimeout(() => confirmMsg.delete().catch(() => {}), 3000);
    } catch (err) {
      return message.reply('❌ **Lỗi:** Không thể xóa tin nhắn (quá 14 ngày hoặc thiếu quyền)!');
    }
  }

  // ==========================================
  // 🔇 MUTE (mute)
  // ==========================================
  if (command === 'mute') {
    if (!isGAAdmin(message.member)) return message.reply('❌ **Bạn không có quyền!**');
    
    const { member: targetUser, argsShift } = await getTargetMember(message);
    if (!targetUser) return message.reply('❌ **Cú pháp:** `@mention` hoặc **Reply** rồi gõ `zmute <thời_gian> [lý_do]`');

    const durationMs = parseCustomDuration(args[argsShift]);
    if (!durationMs) return message.reply('❌ **Thời gian không hợp lệ!** Ví dụ: `zmute 10m`');
    
    const reason = args.slice(argsShift + 1).join(' ') || 'Không có lý do';

    try {
      await targetUser.timeout(durationMs, reason);
      const muteEmbed = new EmbedBuilder()
        .setAuthor({ name: '🔇 MUTE', iconURL: message.guild.iconURL({ dynamic: true }) })
        .setDescription(`• **Phạt:** <@${targetUser.id}>\n• **Thời gian:** \`${formatTimeLeft(durationMs)}\`\n• **Lý do:** ${reason}`)
        .setColor(0xC7A9C9);
      return message.channel.send({ embeds: [muteEmbed] });
    } catch (err) {
      return message.reply('❌ **Lỗi:** Không thể Mute người này!');
    }
  }

  // ==========================================
  // 🔊 UNMUTE (unmute)
  // ==========================================
  if (command === 'unmute') {
    if (!isGAAdmin(message.member)) return message.reply('❌ **Bạn không có quyền!**');
    
    const { member: targetUser, argsShift } = await getTargetMember(message);
    if (!targetUser) return message.reply('❌ **Cú pháp:** `@mention` hoặc **Reply** rồi gõ `zunmute [lý_do]`');

    const reason = args.slice(argsShift).join(' ') || 'Không có lý do';

    try {
      await targetUser.timeout(null, reason);
      const unmuteEmbed = new EmbedBuilder()
        .setAuthor({ name: '🔊 UNMUTE', iconURL: message.guild.iconURL({ dynamic: true }) })
        .setDescription(`• **Gỡ Mute:** <@${targetUser.id}>\n• **Lý do:** ${reason}`)
        .setColor(0x2ECC71);
      return message.channel.send({ embeds: [unmuteEmbed] });
    } catch (err) {
      return message.reply('❌ **Lỗi:** Không thể Unmute người này!');
    }
  }

  // ==========================================
  // 🔨 BAN (ban)
  // ==========================================
  if (command === 'ban') {
    if (!isGAAdmin(message.member)) return message.reply('❌ **Bạn không có quyền!**');

    const { member: targetUser, argsShift } = await getTargetMember(message);
    if (!targetUser) return message.reply('❌ **Cú pháp:** `@mention` hoặc **Reply** rồi gõ `zban [lý_do]`');

    const reason = args.slice(argsShift).join(' ') || 'Không có lý do';

    try {
      await targetUser.ban({ reason });
      const banEmbed = new EmbedBuilder()
        .setAuthor({ name: '🔨 BAN', iconURL: message.guild.iconURL({ dynamic: true }) })
        .setDescription(`• **Bị Ban:** <@${targetUser.id}>\n• **Lý do:** ${reason}`)
        .setColor(0xED4245);
      return message.channel.send({ embeds: [banEmbed] });
    } catch (err) {
      return message.reply('❌ **Lỗi:** Không thể Ban người này!');
    }
  }

  // ==========================================
  // ⚖️ PHẠT TÙ (tu)
  // ==========================================
  if (command === 'tu') {
    if (!isGAAdmin(message.member)) return message.reply('❌ **Bạn không có quyền!**');

    const { member: targetUser, argsShift } = await getTargetMember(message);
    const amount = parseInt(args[argsShift]);

    if (!targetUser || isNaN(amount) || amount <= 0) {
      return message.reply('❌ **Cú pháp:** `ztu <số_lần_ăn_cút> [lý_do]`');
    }

    const reason = args.slice(argsShift + 1).join(' ') || 'Không có lý do';

    try {
      let jailRole = message.guild.roles.cache.find(r => r.name === 'Kẻ Tù Tội');
      if (!jailRole) {
        jailRole = await message.guild.roles.create({
          name: 'Kẻ Tù Tội', color: 0x555555, reason: 'Hệ thống Phạt Tù'
        });
        message.guild.channels.cache.forEach(async (channel) => {
          const perms = channel.id === JAIL_CHANNEL_ID 
            ? { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }
            : { ViewChannel: false, SendMessages: false };
          await channel.permissionOverwrites.edit(jailRole, perms).catch(() => {});
        });
      }

      const oldRoleIds = targetUser.roles.cache.filter(r => r.id !== message.guild.id).map(r => r.id);
      jailData.set(targetUser.id, { required: amount, current: 0, roles: oldRoleIds, failTronCount: 0 });
      await targetUser.roles.set([jailRole.id]).catch(() => {});

      const jailEmbed = new EmbedBuilder()
        .setAuthor({ name: 'Tù ngay con chó', iconURL: message.guild.iconURL({ dynamic: true }) })
        .setDescription(`• **Phạm nhân:** <@${targetUser.id}>\n• **Phạt:** \`zancut\` đủ **${amount} lần** tại <#${JAIL_CHANNEL_ID}>\n• **Lý do:** ${reason}`)
        .setColor(0x34495E);

      message.channel.send({ embeds: [jailEmbed] });

      const jailChannel = message.guild.channels.cache.get(JAIL_CHANNEL_ID);
      if (jailChannel) {
        const guideEmbed = new EmbedBuilder()
          .setTitle('🚨 BẢNG HƯỚNG DẪN CẢI TẠO PHẠT TÙ 🚨')
          .setDescription(`Để tự do, gõ \`zancut\` **${amount} lần**.\n🔓 Type \`ztron\` để trốn (20% thành công, xịt 3 lần x2 phạt).`)
          .setColor(0xC7A9C9);
        jailChannel.send({ content: `<@${targetUser.id}>`, embeds: [guideEmbed] });
      }
    } catch (err) {
      return message.reply('❌ **Lỗi:** Không thể phạt tù đối tượng này!');
    }
  }

  // ==========================================
  // 🔓 TRỐN TÙ (tron)
  // ==========================================
  if (command === 'tron') {
    const userId = message.author.id;
    if (!jailData.has(userId)) return message.reply('❌ **Bạn có ở trong tù đâu mà đòi trốn!**');

    const pData = jailData.get(userId);
    if (Math.random() * 100 < 20) {
      try {
        const jailRole = message.guild.roles.cache.find(r => r.name === 'Kẻ Tù Tội');
        if (jailRole) await message.member.roles.remove(jailRole).catch(() => {});
        if (pData.roles?.length) await message.member.roles.add(pData.roles).catch(() => {});
        jailData.delete(userId);

        const escapeEmbed = new EmbedBuilder()
          .setTitle('🏃‍♂️ VƯỢT NGỤC THÀNH CÔNG XUẤT SẮC!')
          .setDescription(`• Phạm nhân <@${userId}> đã được tự do!`)
          .setColor(0xF1C40F);
        return message.channel.send({ content: `<@${userId}>`, embeds: [escapeEmbed] });
      } catch (err) {}
    } else {
      pData.failTronCount++;
      let extraWarning = `• ❌ Lần trượt thứ **${pData.failTronCount}/3** liên tiếp.`;
      if (pData.failTronCount >= 3) {
        pData.required *= 2;
        pData.failTronCount = 0;
        extraWarning += `\n\n🚨 **QUÁ TAM BA BẬN!** Phạt bị **NHÂN ĐÔI** thành **${pData.required} lần** \`zancut\`!`;
      }
      const failTronEmbed = new EmbedBuilder()
        .setAuthor({ name: '🚨 VƯỢT NGỤC BẤT THÀNH' })
        .setDescription(`> Phạm nhân <@${userId}> bị bắt giữ!\n\n${extraWarning}\n• 📌 Tiến độ: \`${pData.current}/${pData.required}\``)
        .setColor(0xED4245);
      return message.channel.send({ embeds: [failTronEmbed] });
    }
  }

  // ==========================================
  // 💩 ĂN CÚT (ancut)
  // ==========================================
  if (command === 'ancut') {
    const userId = message.author.id;
    if (!jailData.has(userId)) return message.reply('❌ **Bạn đâu có bị phạt tù đâu!**');

    const pData = jailData.get(userId);
    const isVienMan = Math.random() * 100 < 20;
    pData.current += isVienMan ? 2 : 1;
    const randomTaunt = TAUNT_MESSAGES[Math.floor(Math.random() * TAUNT_MESSAGES.length)];

    if (pData.current >= pData.required) {
      try {
        const jailRole = message.guild.roles.cache.find(r => r.name === 'Kẻ Tù Tội');
        if (jailRole) await message.member.roles.remove(jailRole).catch(() => {});
        if (pData.roles?.length) await message.member.roles.add(pData.roles).catch(() => {});
        jailData.delete(userId);

        const freeEmbed = new EmbedBuilder()
          .setTitle('🎉 MÃ HẠN TÙ!')
          .setDescription(`• <@${userId}> đã xong **${pData.required}** lần!\n*Lời nhắn:* "${randomTaunt}"`)
          .setColor(0x2ECC71);
        return message.channel.send({ content: `<@${userId}>`, embeds: [freeEmbed] });
      } catch (err) {}
    } else {
      const vienManText = isVienMan ? `\n\n🌟 **ĂN CỨT VIÊN MÃN!** Trừ thẳng 2 lần!` : '';
      const progressEmbed = new EmbedBuilder()
        .setAuthor({ name: '💩 TIẾN ĐỘ CẢI TẠO' })
        .setDescription(`> *"${randomTaunt}"*\n${vienManText}\n\n• 📌 Đã làm: \`${pData.current}/${pData.required}\``)
        .setColor(0xC7A9C9);
      return message.channel.send({ embeds: [progressEmbed] });
    }
  }

  // ==========================================
  // 💎 HÒM BÁU VẬT (rdrole)
  // ==========================================
  if (command === 'rdrole') {
    if (!message.member.roles.cache.has(REQUIRED_ROLE_ID)) return message.reply(`❌ **Thiếu Role <@&${REQUIRED_ROLE_ID}>!**`);
    
    try {
      const result = spinGacha();
      const userId = message.author.id;
      const commonTitle = '˚₊‧꒰ა <a:hgtt_kimcuong2:1567874404602618017> ໒꒱ ‧₊˚\n𝑹𝑶𝒀𝑨𝑳 𝑻𝑹𝑬𝑨𝑺𝑼𝑹𝑬𝑺';

      if (!result.id) {
        const story = FAIL_STORIES[Math.floor(Math.random() * FAIL_STORIES.length)];
        
        // CHỈ RENDER IN ĐẬM VỚI TITLE CHỨA SẴN CẢ EMOJI BÊN TRONG, KHÔNG CÓ THÊM LOGIC ✨ SPARKLES NÀO NỮA
        const failEmbed = new EmbedBuilder()
          .setTitle(commonTitle)
          .setDescription(`**${story.title}**\n\n${story.desc.replace('{USER}', `<@${userId}>`)}`)
          .setColor(0xC7A9C9);
        return message.channel.send({ embeds: [failEmbed] });
      }

      if (!userGachaProgress.has(userId)) userGachaProgress.set(userId, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
      const p = userGachaProgress.get(userId);
      p[result.level]++;
      
      let storageStatus = "1 / 2 lần (Chưa đủ điều kiện)";
      if (p[result.level] >= 2) {
        p[result.level] = 0;
        await message.member.roles.add(result.id).catch(() => {});
        storageStatus = "Đã add role thành công";
      }

      const successEmbed = new EmbedBuilder()
        .setTitle(commonTitle)
        .setDescription(
          `✧ ˚₊‧⊹ Chúc Mừng Đã Tìm Thấy Bảo Vật! ⊹‧₊˚\n\n` +
          `<:emoji_15:1567861576025772135> Nhà Sưu Tầm <@${userId}> vừa mở rương báu!\n\n` +
          `<:emoji_16:1567861598515896512> Bảo vật: <@&${result.id}>\n` +
          `<:emoji_17:1567861618975449218> Tiến độ: ${storageStatus}\n\n` +
          `      ˚₊‧꒰ა ♔ ໒꒱ ‧₊˚\n\n` +
          `  𝑹𝒐𝒚𝒂𝙡 𝑻𝒓𝒆𝒂𝒔𝒖𝒓𝒆𝒔\n` +
          ` ZeitHaven • The Royal Collection\n\n` +
          `Một báu vật đã tìm thấy chủ nhân. ♡`
        ).setColor(0xC7A9C9);
      return message.channel.send({ embeds: [successEmbed] });
    } catch (err) {
      return message.reply('❌ Đã xảy ra lỗi!');
    }
  }

  // ==========================================
  // 🔄 REROLL GIVEAWAY (garr)
  // ==========================================
  if (command === 'garr') {
    if (!isGAAdmin(message.member)) return message.reply('❌ **Bạn không có quyền!**');
    if (!message.reference?.messageId) return message.reply('❌ **Reply vào tin nhắn GA!**');

    try {
      const targetMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
      if (!targetMsg) return;
      await message.delete().catch(() => {});

      let reaction = targetMsg.reactions.cache.get(EMOJI_GA_ID) || targetMsg.reactions.cache.find(r => r.emoji.name === '🎁') || targetMsg.reactions.cache.first();
      if (!reaction) return message.reply('❌ Không có lượt thả emoji!');

      let validUsers = (await reaction.users.fetch()).filter(u => !u.bot);
      let oldWinnersIds = new Set([message.author.id]);
      let prizeName = 'món quà';

      if (targetMsg.embeds.length > 0) {
        const embedText = JSON.stringify(targetMsg.embeds[0]);
        for (const match of embedText.matchAll(/<@!?(\d+)>/g)) oldWinnersIds.add(match[1]);
        const prizeMatch = targetMsg.embeds[0].description?.match(/\*\*Phần quà:\*\*\s*(.+)/);
        if (prizeMatch) prizeName = prizeMatch[1].trim();
      }

      const availablePool = Array.from(validUsers.keys()).filter(id => !oldWinnersIds.has(id));
      if (!availablePool.length) return message.reply('❌ Không còn người chơi hợp lệ để reroll!');

      const newWinner = `<@${availablePool[Math.floor(Math.random() * availablePool.length)]}>`;
      return targetMsg.reply({ content: `˚₊‧⊹ <:emoji_11:1567468310419742810> Hương vị thay đổi, chúc mừng ${newWinner} nhận __**${prizeName}**__ ⊹‧₊˚` });
    } catch (err) {}
  }

  // ==========================================
  // 🛑 END GIVEAWAY SỚM (end)
  // ==========================================
  if (command === 'end') {
    if (!isGAAdmin(message.member)) return message.reply('❌ **Bạn không có quyền!**');
    if (!message.reference?.messageId) return message.reply('❌ **Reply vào bài GA!**');

    const gaData = activeGiveaways.get(message.reference.messageId);
    if (!gaData) return message.reply('❌ **Không tìm thấy Giveaway đang chạy!**');

    await message.delete().catch(() => {});
    clearTimeout(gaData.timeoutId);
    clearInterval(gaData.intervalId);
    await gaData.endGaFunction();
    activeGiveaways.delete(message.reference.messageId);
  }

  // ==========================================
  // 🎉 TẠO GIVEAWAY (ga)
  // ==========================================
  if (command === 'ga') {
    if (!isGAAdmin(message.member)) return message.reply('❌ **Bạn không có quyền!**');

    if (!args.length) {
      return message.reply({ embeds: [new EmbedBuilder().setTitle('✨ Cách tạo GiveAway').setDescription(`> \`zga [@Role] <số_người> <thời_gian> [số_bài_ga] <phần_quà>\`\nVí dụ: \`zga 1 24h 1 Nitro\``).setColor(0xC7A9C9)] });
    }

    let targetRoleId = null, winnerCount = 1, durationMs = null, giveawayCount = 1, prize = '', currentIndex = 0;
    const extractedId = args[0].replace(/\D/g, '');

    if (extractedId.length >= 15) { targetRoleId = extractedId; currentIndex = 1; }
    if (args[currentIndex] && !isNaN(parseInt(args[currentIndex]))) winnerCount = parseInt(args[currentIndex++]);
    if (args[currentIndex]) { durationMs = parseCustomDuration(args[currentIndex]); if (durationMs) currentIndex++; }
    if (args[currentIndex] && !isNaN(parseInt(args[currentIndex]))) giveawayCount = parseInt(args[currentIndex++]);
    prize = args.slice(currentIndex).join(' ');

    if (!durationMs) return message.reply('❌ **Thời gian không hợp lệ!**');
    if (!prize) return message.reply('❌ **Chưa nhập phần thưởng!**');
    await message.delete().catch(() => {});

    const isFlash = durationMs < 3600000;

    for (let i = 0; i < giveawayCount; i++) {
      const endTime = Date.now() + durationMs;
      const roleDisplay = targetRoleId ? `<@&${targetRoleId}>` : 'Everyone';

      const buildEmbed = (ms) => new EmbedBuilder()
        .setTitle(`<:emoji_11:1567468310419742810> 𝐖𝐈𝐍𝐄 𝐆𝐈𝐕𝐄𝐀𝐖𝐀𝐘 <:emoji_11:1567468310419742810>`)
        .setDescription(`✧ Một ly vang đỏ...\n\n<:emoji_9:1567468262512533514> **Chủ Tiệc:** <@${message.author.id}>\n<:emoji_10:1567468283764936836> **Điều kiện:** ${roleDisplay}\n<:emoji_13:1567468392544337972> **Phần quà:** ${prize}\n<:emoji_12:1567468350823731322> **Còn lại:** \`${formatTimeLeft(ms)}\``)
        .setColor(0xC7A9C9).setThumbnail(GA_THUMBNAIL).setImage(GA_GIF);

      const gaMessage = await message.channel.send({ embeds: [buildEmbed(durationMs)] });
      await gaMessage.react(EMOJI_GA).catch(() => {});

      const interval = setInterval(async () => {
        const rem = endTime - Date.now();
        if (rem <= 0) clearInterval(interval);
        else await gaMessage.edit({ embeds: [buildEmbed(rem)] }).catch(() => clearInterval(interval));
      }, 5000);

      const endGaFunction = async () => {
        clearInterval(interval);
        activeGiveaways.delete(gaMessage.id);
        const fetchedMsg = await message.channel.messages.fetch(gaMessage.id).catch(() => null);
        if (!fetchedMsg) return;

        const reaction = fetchedMsg.reactions.cache.get(EMOJI_GA_ID) || fetchedMsg.reactions.cache.first();
        let validUsers = reaction ? (await reaction.users.fetch()).filter(u => !u.bot) : new Map();

        if (targetRoleId) {
          const filtered = new Map();
          for (const [uid, uobj] of validUsers) {
            try { if ((await message.guild.members.fetch(uid)).roles.cache.has(targetRoleId)) filtered.set(uid, uobj); } catch (e) {}
          }
          validUsers = filtered;
        }

        await fetchedMsg.edit({ embeds: [buildEmbed(0)] }).catch(() => {});

        if (!validUsers.size) return fetchedMsg.reply(`˚₊‧⊹ <:emoji_13:1567468392544337972> Dạ tiệc kết thúc, món quà __**${prize}**__ vẫn còn nằm lại... ⊹‧₊˚`);

        const pool = [];
        for (const [uid] of validUsers) {
          let entries = 1;
          try {
            const m = await message.guild.members.fetch(uid);
            if (!isFlash) for (const [rid, ex] of Object.entries(ROLE_ENTRIES)) if (m.roles.cache.has(rid)) entries += ex;
          } catch (e) {}
          for (let k = 0; k < entries; k++) pool.push(uid);
        }

        const winners = [];
        while (winners.length < Math.min(winnerCount, validUsers.size) && pool.length) {
          const sel = pool[Math.floor(Math.random() * pool.length)];
          if (!winners.includes(sel)) winners.push(sel);
          for (let k = pool.length - 1; k >= 0; k--) if (pool[k] === sel) pool.splice(k, 1);
        }

        return fetchedMsg.reply(`˚₊‧⊹ <:emoji_13:1567468392544337972> Xin chúc mừng ${winners.map(id => `<@${id}>`).join(', ')} nhận __**${prize}**__ ⊹‧₊˚`);
      };

      activeGiveaways.set(gaMessage.id, { endGaFunction, timeoutId: setTimeout(endGaFunction, durationMs), intervalId: interval });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
