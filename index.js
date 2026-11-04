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

// --- CẤU HÌNH GACHA RANDOM ROLE ---
const REQUIRED_ROLE_ID = '1425167156668141728';

// --- CẤU HÌNH PHÂN QUYỀN BAN QUẢN TRỊ ---
const BOT_ADMIN_ID = '1247253243336069264'; // ID cá nhân của Đức (Quyền tối cao)
const GA_MANAGER_ROLE_ID = '1393170229072367758'; // ID Role Quản lý GA

// Hàm kiểm tra quyền dùng lệnh Quản lý GA (Đức HOẶC người có Role)
function isGAAdmin(member) {
  if (!member) return false;
  return member.id === BOT_ADMIN_ID || member.roles.cache.has(GA_MANAGER_ROLE_ID);
}

const GACHA_POOL = [
  { id: null,                  weight: 65, name: 'Chúc may mắn lần sau', level: 0 },
  { id: '1393170229072367758', weight: 25, name: 'Role Cấp 5',         level: 5 },
  { id: '1393151668144574474', weight: 5,  name: 'Role Cấp 4',         level: 4 },
  { id: '1393151139972644905', weight: 3,  name: 'Role Cấp 3',         level: 3 },
  { id: '1393150909327999006', weight: 1,  name: 'Role Cấp 2',         level: 2 },
  { id: '1393150502157680761', weight: 1,  name: 'Role Cấp 1',         level: 1 }
];

const userGachaProgress = new Map();
const activeGiveaways = new Map();

function spinGacha() {
  const rand = Math.random() * 100;
  let cumulative = 0;

  for (const item of GACHA_POOL) {
    cumulative += item.weight;
    if (rand < cumulative) {
      return item;
    }
  }
  return GACHA_POOL[0];
}

const PREFIX = 'z.';

// --- CẤU HÌNH EMOJI & ẢNH GIVEAWAY ---
const EMOJI_GA_ID = '1567468310419742810';
const EMOJI_GA = `<:emoji_11:${EMOJI_GA_ID}>`;

const GA_THUMBNAIL = 'https://media.discordapp.net/attachments/1425167406686404808/1567463399909097533/Photoroom_20261104_154923.png?ex=6aec458c&is=6aeaf40c&hm=42389ce875d5d5c835f606cb5a6fdf5ad8ab194d2b810c1ed3a8c429d39f0328&=&format=webp&quality=lossless&width=626&height=626';
const GA_GIF = 'https://media.discordapp.net/attachments/1425167406686404808/1567463400647426109/2FE0AAB4-BB1C-4A82-A922-3F7D419E7105.png?ex=6aec458c&is=6aeaf40c&hm=2e038e911c66cc7be4e1d8f577e4da653e15a8adb6ea2b63b242437f2fd38ef7&=&format=webp&quality=lossless&width=1111&height=626';

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
  console.log(`[VER 6.5 BOT ADMIN BYPASS LIVE] Đã đăng nhập: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  const contentLower = message.content.toLowerCase();
  if (message.author.bot || !contentLower.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // --- 1. LỆNH RANDOM ROLE / GACHA (z.rdrole / Z.rdrole) ---
  if (command === 'rdrole') {
    if (!message.member.roles.cache.has(REQUIRED_ROLE_ID)) {
      return message.reply(`❌ **Bạn cần sở hữu Role <@&${REQUIRED_ROLE_ID}> mới có thể tham gia Random Role!**`);
    }

    try {
      const result = spinGacha();
      const userId = message.author.id;

      if (result.id === null) {
        const outerFailMessages = [
          `✨ Cậu chủ <@${userId}> ơi, không sao đâu nè chỉ là mình thiếu chút may mắn hoi ><! Thử lại nha!`,
          `🌸 Cậu chủ <@${userId}> hông được nản nha, vòng quay đang tích năng lượng để dành quà bự cho cậu đó!`,
          `🥺 Hic, tý nữa là cậu chủ <@${userId}> ẵm được Role xịn rùi... Thử lại cái nữa xem sao nè!`,
          `✨ Cậu chủ <@${userId}> đừng buồn nhen, lượt này nhường xíu thôi chứ lượt sau là nổ hũ chắc luôn!`,
          `🎀 Ôm cậu chủ <@${userId}> một cái nè~ May mắn đang trên đường đến rồi, làm lượt nữa thôi nào!`,
          `💫 Suýt chút nữa là cậu chủ <@${userId}> rinh được Role rùi á! Thêm 1 lần nữa cho nó máu nhen!`,
          `🌷 Cậu chủ <@${userId}> ơi chớ vội nản, hũ ngon phải tích tụ lâu một xíu mới nổ to rực rỡ nè!`,
          `🍧 Thiếu có chút xíu tẹo teo thôi hà cậu chủ <@${userId}> ơi, bấm thử thêm phát nữa đi mà~`,
          `🌟 May mắn của cậu chủ <@${userId}> đang kẹt xe một chút xíu thôi, gõ thêm lệnh nữa là tới liền!`,
          `💖 Cậu chủ <@${userId}> dễ thương thế này chắc chắn lượt sau vũ trụ sẽ độ tràn bờ đê luôn!`,
          `🍀 Vòng quay thử thách độ kiên nhẫn của cậu chủ <@${userId}> xíu thôi, cố lên lượt nữa nhen!`,
          `🦄 Cậu chủ <@${userId}> ơi, nhân phẩm đỉnh cao sắp xuất hiện rùi, thử lại lần nữa xem sao nè!`,
          `🍬 Hông có sao hết á cậu chủ <@${userId}> ơi, đ keo này ta bày keo khác nha, chiến tiếp thôi!`,
          `🍰 Suýt nữa là lượm lúa rùi cậu chủ <@${userId}> ơi! Thử lại liền tay vận may sẽ đến nè!`,
          `🎁 Cậu chủ <@${userId}> ơi hít một hơi thật sâu rồi làm lại quả nhấp siêu phẩm nữa nào!`
        ];

        const innerFailMessages = [
          "Cậu chủ ơi, không sao đâu nè chỉ là mình thiếu chút may mắn hoi ><!",
          "Nhân phẩm của cậu chủ đang nạp năng lượng đó, lượt sau chắc chắn đỏ lềnh lềnh luôn!",
          "Đừng nản lòng nha cậu chủ ơi, vũ trụ đang chuẩn bị quà bự hơn cho cậu đó~",
          "Thêm một tí tẹo may mắn nữa thôi là Role về tay cậu chủ rùi, thử lại nha!",
          "Hơi tiếc một xíu xiu thôi nè, nhưng mà lượt quay tiếp theo nhất định sẽ bùng nổ!",
          "Tay cậu chủ hôm nay thơm lắm rùi, chỉ thiếu 1 milimet may mắn nữa thôi á!",
          "Vòng quay chỉ đang dạo đầu xíu thôi, siêu phẩm rực rỡ đang đợi cậu chủ ở lượt sau nè!",
          "Năng lượng may mắn đang tích tụ cực đại, lượt tới bấm phát là dính liền nhen cậu chủ!",
          "Một chút kiên trì sẽ mang lại phần thưởng xứng đáng nhất cho cậu chủ đó nha~",
          "Hôm nay trời đẹp thế này kiểu gì lượt tới cậu chủ cũng nổ hũ siêu to cho xem!",
          "Chỉ là chút thử thách nhỏ của hệ thống thôi, cậu chủ cứ tự tin thử lại nhen!",
          "Tấm vé trúng thưởng đang nằm ngay lượt tiếp theo kìa cậu chủ ơi, bấm liền đi nè!",
          "Cậu chủ tỏa ra năng lượng chiến thắng rùi đó, thử lại phát nữa là lượm Role ngay!",
          "Không sao hết nè, thần may mắn đang đứng ngay sau lưng cổ vũ cậu chủ đó nha!",
          "Tích tiểu thành đại, lượt sau nhất định cậu chủ sẽ khiến cả server trầm trồ!"
        ];

        const randomOuter = outerFailMessages[Math.floor(Math.random() * outerFailMessages.length)];
        const randomInner = innerFailMessages[Math.floor(Math.random() * innerFailMessages.length)];

        const failEmbed = new EmbedBuilder()
          .setAuthor({ 
            name: '🎲 VÒNG QUAY RANDOM ROLE', 
            iconURL: message.author.displayAvatarURL({ dynamic: true }) 
          })
          .setTitle('✨ Suýt Nữa Thì Trúng Rùi!')
          .setDescription(
            `> Người chơi <@${userId}> vừa suýt chút nữa là lượm được Role xịn rồi!\n\n` +
            `• 💫 **Lời nhắn:** ${randomInner}`
          )
          .setColor(0xC7A9C9)
          .setFooter({ text: 'Hệ thống Random Role • Emc4', iconURL: client.user.displayAvatarURL() })
          .setTimestamp();

        return message.channel.send({
          content: randomOuter,
          embeds: [failEmbed]
        });
      }

      if (!userGachaProgress.has(userId)) {
        userGachaProgress.set(userId, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
      }

      const userProgress = userGachaProgress.get(userId);
      userProgress[result.level] += 1;

      let isRoleAwarded = false;
      let outerMsg = "";
      let innerDesc = `> Người chơi <@${userId}> vừa quay trúng **<@&${result.id}>** (${result.name})!\n\n`;

      if (userProgress[result.level] >= 2) {
        isRoleAwarded = true;
        userProgress[result.level] = 0;

        await message.member.roles.add(result.id).catch((err) => {
          console.error("Lỗi cấp Role:", err);
        });

        const winOuterList = [
          `🎉 CHÚC MỪNGGG! Cậu chủ <@${userId}> đã tích đủ 2/2 và rinh trọn vẹn Role <@&${result.id}> rùi nè! 👑`,
          `🔥 BÙNG NỔ NHÂN PHẨM! Cậu chủ <@${userId}> xuất sắc ẵm thành công Role <@&${result.id}> siêu xịn! ✨`,
          `👑 Cả server dạt ra cho cậu chủ <@${userId}> tỏa sáng nào! Role <@&${result.id}> đã về tay chính chủ rùi! 🥳`,
          `🎉 Quá đẳng cấp cậu chủ <@${userId}> ơi! Hệ thống đã trao tận tay Role <@&${result.id}> cho cậu rùi nhen!`,
          `💖 Tuyệt vời ông mặt trời! Cậu chủ <@${userId}> đã chinh phục thành công Role <@&${result.id}> rùi nè~`
        ];

        const winInnerList = [
          `• 🔥 **TÍCH LŨY ĐỦ 2 LẦN!** Hệ thống đã tự động đeo Role **<@&${result.id}>** cực ngầu cho cậu chủ rùi đó! 🎉`,
          `• 🔥 **TÍCH LŨY ĐỦ 2 LẦN!** Sự kiên trì của cậu chủ đã được đền đáp xứng đáng bằng Role **<@&${result.id}>** siêu phẩm!`,
          `• 🔥 **TÍCH LŨY ĐỦ 2 LẦN!** Chúc mừng cậu chủ đã trở thành chủ nhân chính thức của Role **<@&${result.id}>**!`,
          `• 🔥 **TÍCH LŨY ĐỦ 2 LẦN!** Nhân phẩm đỉnh cao đã đưa Role **<@&${result.id}>** về ngay hồ sơ của cậu chủ rùi nè!`,
          `• 🔥 **TÍCH LŨY ĐỦ 2 LẦN!** Đã hoàn tất cấp Role **<@&${result.id}>** cho cậu chủ tỏa sáng khắp server!`
        ];

        outerMsg = winOuterList[Math.floor(Math.random() * winOuterList.length)];
        innerDesc += winInnerList[Math.floor(Math.random() * winInnerList.length)];

      } else {
        const progressOuterList = [
          `✨ Woohoo~ Cậu chủ <@${userId}> vừa hốt được 1 mảnh **<@&${result.id}>** rùi nha! Cố thêm phát nữa nè!`,
          `🌸 Tay thơm ghê chưa! Cậu chủ <@${userId}> đã thu thập được 1/2 **<@&${result.id}>** rùi á~`,
          `🎀 Nhân phẩm nổ nhẹ! Cậu chủ <@${userId}> vừa lượm được mảnh **<@&${result.id}>** đầu tiên nè!`,
          `💫 Chút nữa thôi cậu chủ <@${userId}> ơi! Đã có 1/2 **<@&${result.id}>** trong tay rùi đó!`,
          `🍧 Đỉnh quá cậu chủ <@${userId}> ơi~ 1 mảnh **<@&${result.id}>** đã về đội, làm lượt nữa để chốt sổ nhen!`
        ];

        const progressInnerList = [
          `• 📌 **Tiến độ tích lũy:** \`1 / 2 lần\` quay trúng loại này.\n*Cậu chủ ơi, cố lên thêm một lượt nữa thôi là Role về tay rùi!*`,
          `• 📌 **Tiến độ tích lũy:** \`1 / 2 lần\` quay trúng loại này.\n*Nhân phẩm đang lên cao trào, cậu chủ làm thêm cú nhấp nữa cho rực rỡ nhen!*`,
          `• 📌 **Tiến độ tích lũy:** \`1 / 2 lần\` quay trúng loại này.\n*Còn đúng 1 bước ngắn nữa thôi là cậu chủ rinh trọn vẹn Role rùi á~*`,
          `• 📌 **Tiến độ tích lũy:** \`1 / 2 lần\` quay trúng loại này.\n*Vũ trụ đang gửi tín hiệu chúc mừng, cậu chủ tự tin thử tiếp nha!*`,
          `• 📌 **Tiến độ tích lũy:** \`1 / 2 lần\` quay trúng loại này.\n*Tích được nửa đường rùi, lượt quay tới nhất định sẽ là cú nổ siêu to!*`
        ];

        outerMsg = progressOuterList[Math.floor(Math.random() * progressOuterList.length)];
        innerDesc += progressInnerList[Math.floor(Math.random() * progressInnerList.length)];
      }

      const successEmbed = new EmbedBuilder()
        .setAuthor({ 
          name: '🎲 VÒNG QUAY RANDOM ROLE', 
          iconURL: message.author.displayAvatarURL({ dynamic: true }) 
        })
        .setTitle(isRoleAwarded ? '🎉 CHÚC MỪNG ĐÃ NHẬN ĐƯỢC ROLE!' : '✨ QUAY TRÚNG MẢNH ROLE!')
        .setDescription(innerDesc)
        .setColor(0xC7A9C9)
        .setFooter({ text: 'Hệ thống Random Role • Emc4', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

      return message.channel.send({
        content: outerMsg,
        embeds: [successEmbed]
      });

    } catch (err) {
      console.error(err);
      return message.reply('❌ Đã xảy ra lỗi trong quá trình Random Role, vui lòng báo Admin kiểm tra quyền của Bot!');
    }
  }

  // --- 2. LỆNH REROLL GIVEAWAY (z.garr / Z.garr) ---
  if (command === 'garr') {
    if (!isGAAdmin(message.member)) {
      return message.reply(`❌ **Bạn không có quyền quản lý Giveaway!**`);
    }

    if (!message.reference || !message.reference.messageId) {
      return message.reply('❌ **Bạn phải reply (phản hồi) vào tin nhắn bài giveaway cần reroll rồi mới gõ `z.garr`!**');
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
        return message.reply('❌ Không tìm thấy lượt thả emoji tham gia nào ở bài giveaway này!');
      }

      let users = await reaction.users.fetch();
      let validUsers = users.filter(u => !u.bot);

      if (validUsers.size === 0) {
        return message.reply('❌ Không có người chơi hợp lệ nào khác tham gia bài giveaway này!');
      }

      let oldWinnersIds = new Set();
      if (targetMsg.embeds.length > 0) {
        const embedText = JSON.stringify(targetMsg.embeds[0]);
        const mentionRegex = /<@!?(\d+)>/g;
        let match;
        while ((match = mentionRegex.exec(embedText)) !== null) {
          oldWinnersIds.add(match[1]);
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

      const oldTitle = targetMsg.embeds[0]?.title || 'WINE GIVEAWAY';

      const rerollEmbed = new EmbedBuilder()
        .setAuthor({ name: '🔄 REROLL NGƯỜI THẮNG DẠ TIỆC', iconURL: message.guild.iconURL({ dynamic: true }) })
        .setTitle(oldTitle)
        .setDescription(
          `> Người trúng trước đó không hợp lệ hoặc không nhận quà, hệ thống đã chọn vị khách mới!\n\n` +
          `• <:emoji_11:1567468310419742810> **Chủ Tiệc:** <@${message.author.id}>\n` +
          `• 🏆 **Vị khách chiến thắng mới:** ${newWinnerMention}`
        )
        .setColor(0xC7A9C9)
        .setTimestamp();

      return message.channel.send({
        content: `🔄 **REROLL!** Chúc mừng vị khách ${newWinnerMention} đã may mắn được lựa chọn thay thế!`,
        embeds: [rerollEmbed]
      });

    } catch (err) {
      console.error("Lỗi Reroll:", err);
      return message.reply('❌ Đã xảy ra lỗi khi thực hiện reroll!');
    }
  }

  // --- 3. LỆNH END GIVEAWAY SỚM (z.end / Z.end) ---
  if (command === 'end') {
    if (!isGAAdmin(message.member)) {
      return message.reply(`❌ **Bạn không có quyền quản lý Giveaway!**`);
    }

    if (!message.reference || !message.reference.messageId) {
      return message.reply('❌ **Bạn phải reply (phản hồi) vào bài giveaway đang chạy rồi mới gõ `z.end`!**');
    }

    const targetMsgId = message.reference.messageId;
    const gaData = activeGiveaways.get(targetMsgId);

    if (!gaData) {
      return message.reply('❌ **Không tìm thấy bài Giveaway đang chạy nào ở tin nhắn này** (có thể nó đã kết thúc từ trước rồi)!');
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

  // --- 4. LỆNH GA (GIVEAWAY - z.ga / Z.ga) ---
  if (command === 'ga') {
    if (!isGAAdmin(message.member)) {
      return message.reply(`❌ **Bạn không có quyền quản lý Giveaway!**`);
    }

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
        .setColor(0xC7A9C9)
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

    const isFlash = durationMs < 3600000;

    for (let i = 0; i < giveawayCount; i++) {
      const endTime = Date.now() + durationMs;
      const roleDisplay = targetRoleId ? `<@&${targetRoleId}>` : ' Everyone ';
      const wineTitleFont = '𝐖𝐈𝐍𝐄 𝐆𝐈𝐕𝐄𝐀𝐖𝐀𝐘';

      const buildEmbed = (msRemaining) => {
        return new EmbedBuilder()
          .setTitle(`<:emoji_11:1567468310419742810> ${wineTitleFont} <:emoji_11:1567468310419742810>`)
          .setDescription(
            `✧ Một ly vang đỏ, một món quà dành cho vị khách hữu duyên.\n\n` +
            `<:emoji_9:1567468262512533514> **Chủ Tiệc:** <@${message.author.id}>\n` +
            `<:emoji_10:1567468283764936836> **Điều kiện tham dự:** ${roleDisplay}\n` +
            `<:emoji_13:1567468392544337972> **Số phần quà:** \`${winnerCount} giải\`\n` +
            `<:emoji_12:1567468350823731322> **Thời gian khai tiệc còn lại:** \`${formatTimeLeft(msRemaining)}\``
          )
          .setColor(0xC7A9C9)
          .setThumbnail(GA_THUMBNAIL)
          .setImage(GA_GIF)
          .setFooter({
            text: `⏰ Thời điểm kết thúc`,
            iconURL: client.user.displayAvatarURL()
          })
          .setTimestamp(endTime);
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
          const endEmbed = EmbedBuilder.from(fetchedMsg.embeds[0])
            .setTitle(`❌ [ĐÃ KẾT THÚC] WINE GIVEAWAY`)
            .setDescription(`> Không có vị khách hợp lệ nào tham gia dạ tiệc này!`)
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
          .setTitle(`🏆 [ĐÃ KẾT THÚC] WINE GIVEAWAY`)
          .setDescription(
            `> Dạ tiệc đã khép lại thành công!\n\n` +
            `• <:emoji_11:1567468310419742810> **Chủ Tiệc:** <@${message.author.id}>\n` +
            `• 🎉 **Vị khách may mắn chiến thắng:** ${winnerMentions}`
          )
          .setColor(0xC7A9C9);

        await fetchedMsg.edit({ embeds: [endEmbed] });

        const winAnnounceEmbed = new EmbedBuilder()
          .setAuthor({ name: '🎉 KẾT QUẢ DẠ TIỆC WINE GIVEAWAY 🎉', iconURL: message.guild.iconURL({ dynamic: true }) })
          .setTitle(`🍷 Phần thưởng: ${prize}`)
          .setDescription(
            `> Chúc mừng vị khách quý ${winnerMentions} đã may mắn nhận được phần quà từ dạ tiệc của chủ tiệc <@${message.author.id}>!\n\n` +
            `• <:emoji_11:1567468310419742810> **Chủ Tiệc:** <@${message.author.id}>\n` +
            `• 🏆 **Người trúng giải:** ${winnerMentions}`
          )
          .setColor(0xC7A9C9)
          .setTimestamp();

        message.channel.send({ 
          content: `🎉 Chúc mừng ${winnerMentions} đã rinh thành công **${prize}** từ dạ tiệc của <@${message.author.id}>!`, 
          embeds: [winAnnounceEmbed] 
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
