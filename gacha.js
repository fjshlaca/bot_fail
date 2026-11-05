const { EmbedBuilder } = require('discord.js');
const config = require('./config');

function spinGacha() {
  const rand = Math.random() * 100;
  let cumulative = 0;
  for (const item of config.GACHA_POOL) {
    cumulative += item.weight;
    if (rand < cumulative) return item;
  }
  return config.GACHA_POOL[0];
}

module.exports = (client) => {
  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.toLowerCase().startsWith(config.PREFIX)) return;
    const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'rdrole') {
      if (!message.member.roles.cache.has(config.REQUIRED_ROLE_ID)) return message.reply(`❌ **Thiếu Role yêu cầu!**`);
      try {
        const result = spinGacha();
        const userId = message.author.id;
        const commonTitle = '˚₊‧꒰ა <a:hgtt_kimcuong2:1567874404602618017> ໒꒱ ‧₊˚\n𝑹𝑶𝒀𝑨𝑳 𝑻𝑹𝑬𝑨𝑺𝑼𝑹𝑬𝑺';

        if (!result.id) {
          const story = config.FAIL_STORIES[Math.floor(Math.random() * config.FAIL_STORIES.length)];
          const failEmbed = new EmbedBuilder().setTitle(commonTitle).setDescription(`**${story.title}**\n\n${story.desc.replace('{USER}', `<@${userId}>`)}`).setColor(0xC7A9C9);
          return message.channel.send({ embeds: [failEmbed] });
        }

        if (!client.userGachaProgress.has(userId)) client.userGachaProgress.set(userId, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
        const p = client.userGachaProgress.get(userId);
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
      } catch (err) { message.reply('❌ Đã xảy ra lỗi!'); }
    }
  });
};
