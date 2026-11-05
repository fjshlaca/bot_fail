const { EmbedBuilder } = require('discord.js');
const config = require('./config');

function isGAAdmin(member) {
  if (!member) return false;
  return member.id === config.BOT_ADMIN_ID || member.roles.cache.some(r => config.ALLOWED_ROLE_IDS.includes(r.id));
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

module.exports = (client) => {
  const EMOJI_GA = `<:emoji_11:${config.EMOJI_GA_ID}>`;

  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.toLowerCase().startsWith(config.PREFIX)) return;
    const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // GARR
    if (command === 'garr') {
      if (!isGAAdmin(message.member)) return message.reply('❌ **Bạn không có quyền!**');
      if (!message.reference?.messageId) return message.reply('❌ **Reply vào tin nhắn GA!**');
      try {
        const targetMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
        if (!targetMsg) return;
        await message.delete().catch(() => {});
        let reaction = targetMsg.reactions.cache.get(config.EMOJI_GA_ID) || targetMsg.reactions.cache.first();
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
        if (!availablePool.length) return message.reply('❌ Không còn người chơi hợp lệ!');
        const newWinner = `<@${availablePool[Math.floor(Math.random() * availablePool.length)]}>`;
        return targetMsg.reply({ content: `˚₊‧⊹ <:emoji_11:${config.EMOJI_GA_ID}> Chúc mừng ${newWinner} nhận __**${prizeName}**__ ⊹‧₊˚` });
      } catch (err) {}
    }

    // END GA
    if (command === 'end') {
      if (!isGAAdmin(message.member)) return message.reply('❌ **Bạn không có quyền!**');
      if (!message.reference?.messageId) return message.reply('❌ **Reply vào bài GA!**');
      const gaData = client.activeGiveaways.get(message.reference.messageId);
      if (!gaData) return message.reply('❌ **Không tìm thấy Giveaway đang chạy!**');
      await message.delete().catch(() => {});
      clearTimeout(gaData.timeoutId);
      clearInterval(gaData.intervalId);
      await gaData.endGaFunction();
      client.activeGiveaways.delete(message.reference.messageId);
    }

    // GA
    if (command === 'ga') {
      if (!isGAAdmin(message.member)) return message.reply('❌ **Bạn không có quyền!**');
      if (!args.length) return message.reply({ embeds: [new EmbedBuilder().setTitle('✨ Cách tạo GiveAway').setDescription(`> \`zga [@Role] <số_người> <thời_gian> [số_bài_ga] <phần_quà>\``).setColor(0xC7A9C9)] });

      let targetRoleId = null, winnerCount = 1, durationMs = null, giveawayCount = 1, prize = '', currentIndex = 0;
      const extractedId = args[0].replace(/\D/g, '');
      if (extractedId.length >= 15) { targetRoleId = extractedId; currentIndex = 1; }
      if (args[currentIndex] && !isNaN(parseInt(args[currentIndex]))) winnerCount = parseInt(args[currentIndex++]);
      if (args[currentIndex]) { durationMs = parseCustomDuration(args[currentIndex]); if (durationMs) currentIndex++; }
      if (args[currentIndex] && !isNaN(parseInt(args[currentIndex]))) giveawayCount = parseInt(args[currentIndex++]);
      prize = args.slice(currentIndex).join(' ');

      if (!durationMs || !prize) return message.reply('❌ **Thời gian hoặc phần thưởng không hợp lệ!**');
      await message.delete().catch(() => {});
      const isFlash = durationMs < 3600000;

      for (let i = 0; i < giveawayCount; i++) {
        const endTime = Date.now() + durationMs;
        const roleDisplay = targetRoleId ? `<@&${targetRoleId}>` : 'Everyone';

        const buildEmbed = (ms) => new EmbedBuilder()
          .setTitle(`<:emoji_11:${config.EMOJI_GA_ID}> 𝐖𝐈𝐍𝐄 𝐆𝐈𝐕𝐄𝐀𝐖𝐀𝐘 <:emoji_11:${config.EMOJI_GA_ID}>`)
          .setDescription(`✧ Một ly vang đỏ...\n\n<:emoji_9:1567468262512533514> **Chủ Tiệc:** <@${message.author.id}>\n<:emoji_10:1567468283764936836> **Điều kiện:** ${roleDisplay}\n<:emoji_13:1567468392544337972> **Phần quà:** ${prize}\n<:emoji_12:1567468350823731322> **Còn lại:** \`${formatTimeLeft(ms)}\``)
          .setColor(0xC7A9C9).setThumbnail(config.GA_THUMBNAIL).setImage(config.GA_GIF);

        const gaMessage = await message.channel.send({ embeds: [buildEmbed(durationMs)] });
        await gaMessage.react(EMOJI_GA).catch(() => {});

        const interval = setInterval(async () => {
          const rem = endTime - Date.now();
          if (rem <= 0) clearInterval(interval);
          else await gaMessage.edit({ embeds: [buildEmbed(rem)] }).catch(() => clearInterval(interval));
        }, 5000);

        const endGaFunction = async () => {
          clearInterval(interval);
          client.activeGiveaways.delete(gaMessage.id);
          const fetchedMsg = await message.channel.messages.fetch(gaMessage.id).catch(() => null);
          if (!fetchedMsg) return;

          let reaction = fetchedMsg.reactions.cache.get(config.EMOJI_GA_ID) || fetchedMsg.reactions.cache.first();
          let validUsers = reaction ? (await reaction.users.fetch()).filter(u => !u.bot) : new Map();

          if (targetRoleId) {
            const filtered = new Map();
            for (const [uid, uobj] of validUsers) {
              try { if ((await message.guild.members.fetch(uid)).roles.cache.has(targetRoleId)) filtered.set(uid, uobj); } catch (e) {}
            }
            validUsers = filtered;
          }

          await fetchedMsg.edit({ embeds: [buildEmbed(0)] }).catch(() => {});
          if (!validUsers.size) return fetchedMsg.reply(`˚₊‧⊹ Dạ tiệc kết thúc, món quà __**${prize}**__ vẫn còn nằm lại... ⊹‧₊˚`);

          const pool = [];
          for (const [uid] of validUsers) {
            let entries = 1;
            try {
              const m = await message.guild.members.fetch(uid);
              if (!isFlash) for (const [rid, ex] of Object.entries(config.ROLE_ENTRIES)) if (m.roles.cache.has(rid)) entries += ex;
            } catch (e) {}
            for (let k = 0; k < entries; k++) pool.push(uid);
          }

          const winners = [];
          while (winners.length < Math.min(winnerCount, validUsers.size) && pool.length) {
            const sel = pool[Math.floor(Math.random() * pool.length)];
            if (!winners.includes(sel)) winners.push(sel);
            for (let k = pool.length - 1; k >= 0; k--) if (pool[k] === sel) pool.splice(k, 1);
          }

          return fetchedMsg.reply(`˚₊‧⊹ Xin chúc mừng ${winners.map(id => `<@${id}>`).join(', ')} nhận __**${prize}**__ ⊹‧₊˚`);
        };

        client.activeGiveaways.set(gaMessage.id, { endGaFunction, timeoutId: setTimeout(endGaFunction, durationMs), intervalId: interval });
      }
    }
  });
};
