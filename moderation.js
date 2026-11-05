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

module.exports = (client) => {
  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.toLowerCase().startsWith(config.PREFIX)) return;
    const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // CLEAR
    if (command === 'clear') {
      if (!isGAAdmin(message.member)) return message.reply('❌ **Bạn không có quyền!**');
      const amount = parseInt(args[0]);
      if (isNaN(amount) || amount <= 0 || amount > 100) return message.reply('❌ **Cú pháp:** `zclear <1-100>`');
      try {
        const deleted = await message.channel.bulkDelete(amount + 1, true);
        const confirm = await message.channel.send(`🧹 **Đã dọn dẹp ${deleted.size - 1} tin nhắn!**`);
        setTimeout(() => confirm.delete().catch(() => {}), 3000);
      } catch (err) { message.reply('❌ **Lỗi:** Không thể xóa tin nhắn!'); }
    }

    // MUTE
    if (command === 'mute') {
      if (!isGAAdmin(message.member)) return message.reply('❌ **Bạn không có quyền!**');
      const { member: targetUser, argsShift } = await getTargetMember(message);
      if (!targetUser) return message.reply('❌ **Cú pháp:** `@mention` hoặc **Reply** rồi gõ `zmute <thời_gian> [lý_do]`');
      const durationMs = parseCustomDuration(args[argsShift]);
      if (!durationMs) return message.reply('❌ **Thời gian không hợp lệ!**');
      const reason = args.slice(argsShift + 1).join(' ') || 'Không có lý do';
      try {
        await targetUser.timeout(durationMs, reason);
        const embed = new EmbedBuilder().setAuthor({ name: '🔇 MUTE', iconURL: message.guild.iconURL({ dynamic: true }) }).setDescription(`• **Phạt:** <@${targetUser.id}>\n• **Thời gian:** \`${formatTimeLeft(durationMs)}\`\n• **Lý do:** ${reason}`).setColor(0xC7A9C9);
        return message.channel.send({ embeds: [embed] });
      } catch (err) { message.reply('❌ Không thể Mute người này!'); }
    }

    // UNMUTE
    if (command === 'unmute') {
      if (!isGAAdmin(message.member)) return message.reply('❌ **Bạn không có quyền!**');
      const { member: targetUser, argsShift } = await getTargetMember(message);
      if (!targetUser) return message.reply('❌ **Cú pháp:** `@mention` hoặc **Reply** rồi gõ `zunmute [lý_do]`');
      const reason = args.slice(argsShift).join(' ') || 'Không có lý do';
      try {
        await targetUser.timeout(null, reason);
        const embed = new EmbedBuilder().setAuthor({ name: '🔊 UNMUTE', iconURL: message.guild.iconURL({ dynamic: true }) }).setDescription(`• **Gỡ Mute:** <@${targetUser.id}>\n• **Lý do:** ${reason}`).setColor(0x2ECC71);
        return message.channel.send({ embeds: [embed] });
      } catch (err) { message.reply('❌ Không thể Unmute người này!'); }
    }

    // BAN
    if (command === 'ban') {
      if (!isGAAdmin(message.member)) return message.reply('❌ **Bạn không có quyền!**');
      const { member: targetUser, argsShift } = await getTargetMember(message);
      if (!targetUser) return message.reply('❌ **Cú pháp:** `@mention` hoặc **Reply** rồi gõ `zban [lý_do]`');
      const reason = args.slice(argsShift).join(' ') || 'Không có lý do';
      try {
        await targetUser.ban({ reason });
        const embed = new EmbedBuilder().setAuthor({ name: '🔨 BAN', iconURL: message.guild.iconURL({ dynamic: true }) }).setDescription(`• **Bị Ban:** <@${targetUser.id}>\n• **Lý do:** ${reason}`).setColor(0xED4245);
        return message.channel.send({ embeds: [embed] });
      } catch (err) { message.reply('❌ Không thể Ban người này!'); }
    }

    // PHẠT TÙ (TU, TRON, ANCUT)
    if (command === 'tu') {
      if (!isGAAdmin(message.member)) return message.reply('❌ **Bạn không có quyền!**');
      const { member: targetUser, argsShift } = await getTargetMember(message);
      const amount = parseInt(args[argsShift]);
      if (!targetUser || isNaN(amount) || amount <= 0) return message.reply('❌ **Cú pháp:** `ztu <số_lần_ăn_cút> [lý_do]`');
      const reason = args.slice(argsShift + 1).join(' ') || 'Không có lý do';
      try {
        let jailRole = message.guild.roles.cache.find(r => r.name === 'Kẻ Tù Tội');
        if (!jailRole) {
          jailRole = await message.guild.roles.create({ name: 'Kẻ Tù Tội', color: 0x555555, reason: 'Hệ thống Phạt Tù' });
          message.guild.channels.cache.forEach(async (channel) => {
            const perms = channel.id === config.JAIL_CHANNEL_ID ? { ViewChannel: true, SendMessages: true, ReadMessageHistory: true } : { ViewChannel: false, SendMessages: false };
            await channel.permissionOverwrites.edit(jailRole, perms).catch(() => {});
          });
        }
        const oldRoleIds = targetUser.roles.cache.filter(r => r.id !== message.guild.id).map(r => r.id);
        client.jailData.set(targetUser.id, { required: amount, current: 0, roles: oldRoleIds, failTronCount: 0 });
        await targetUser.roles.set([jailRole.id]).catch(() => {});

        const embed = new EmbedBuilder().setAuthor({ name: 'Tù ngay con chó', iconURL: message.guild.iconURL({ dynamic: true }) }).setDescription(`• **Phạm nhân:** <@${targetUser.id}>\n• **Phạt:** \`zancut\` đủ **${amount} lần** tại <#${config.JAIL_CHANNEL_ID}>\n• **Lý do:** ${reason}`).setColor(0x34495E);
        message.channel.send({ embeds: [embed] });

        const jailChannel = message.guild.channels.cache.get(config.JAIL_CHANNEL_ID);
        if (jailChannel) {
          const guide = new EmbedBuilder().setTitle('🚨 BẢNG HƯỚNG DẪN CẢI TẠO PHẠT TÙ 🚨').setDescription(`Để tự do, gõ \`zancut\` **${amount} lần**.\n🔓 Type \`ztron\` để trốn (20% thành công).`).setColor(0xC7A9C9);
          jailChannel.send({ content: `<@${targetUser.id}>`, embeds: [guide] });
        }
      } catch (err) { message.reply('❌ Lỗi phạt tù!'); }
    }

    if (command === 'tron') {
      const userId = message.author.id;
      if (!client.jailData.has(userId)) return message.reply('❌ **Bạn có ở trong tù đâu mà đòi trốn!**');
      const pData = client.jailData.get(userId);
      if (Math.random() * 100 < 20) {
        try {
          const jailRole = message.guild.roles.cache.find(r => r.name === 'Kẻ Tù Tội');
          if (jailRole) await message.member.roles.remove(jailRole).catch(() => {});
          if (pData.roles?.length) await message.member.roles.add(pData.roles).catch(() => {});
          client.jailData.delete(userId);
          const esc = new EmbedBuilder().setTitle('🏃‍♂️ VƯỢT NGỤC THÀNH CÔNG!').setDescription(`• <@${userId}> đã được tự do!`).setColor(0xF1C40F);
          return message.channel.send({ content: `<@${userId}>`, embeds: [esc] });
        } catch (err) {}
      } else {
        pData.failTronCount++;
        let warn = `• ❌ Lần trượt thứ **${pData.failTronCount}/3**.`;
        if (pData.failTronCount >= 3) {
          pData.required *= 2;
          pData.failTronCount = 0;
          warn += `\n\n🚨 Phạt bị **NHÂN ĐÔI** thành **${pData.required} lần**!`;
        }
        const failEmbed = new EmbedBuilder().setAuthor({ name: '🚨 VƯỢT NGỤC BẤT THÀNH' }).setDescription(`> <@${userId}> bị bắt giữ!\n\n${warn}\n• 📌 Tiến độ: \`${pData.current}/${pData.required}\``).setColor(0xED4245);
        return message.channel.send({ embeds: [failEmbed] });
      }
    }

    if (command === 'ancut') {
      const userId = message.author.id;
      if (!client.jailData.has(userId)) return message.reply('❌ **Bạn đâu có bị phạt tù đâu!**');
      const pData = client.jailData.get(userId);
      const isVienMan = Math.random() * 100 < 20;
      pData.current += isVienMan ? 2 : 1;
      const randomTaunt = config.TAUNT_MESSAGES[Math.floor(Math.random() * config.TAUNT_MESSAGES.length)];

      if (pData.current >= pData.required) {
        try {
          const jailRole = message.guild.roles.cache.find(r => r.name === 'Kẻ Tù Tội');
          if (jailRole) await message.member.roles.remove(jailRole).catch(() => {});
          if (pData.roles?.length) await message.member.roles.add(pData.roles).catch(() => {});
          client.jailData.delete(userId);
          const free = new EmbedBuilder().setTitle('🎉 MÃ HẠN TÙ!').setDescription(`• <@${userId}> đã xong!\n*Lời nhắn:* "${randomTaunt}"`).setColor(0x2ECC71);
          return message.channel.send({ content: `<@${userId}>`, embeds: [free] });
        } catch (err) {}
      } else {
        const vienManText = isVienMan ? `\n\n🌟 **ĂN CỨT VIÊN MÃN!** Trừ thẳng 2 lần!` : '';
        const prog = new EmbedBuilder().setAuthor({ name: '💩 TIẾN ĐỘ CẢI TẠO' }).setDescription(`> *"${randomTaunt}"*\n${vienManText}\n\n• 📌 Đã làm: \`${pData.current}/${pData.required}\``).setColor(0xC7A9C9);
        return message.channel.send({ embeds: [prog] });
      }
    }
  });
};
