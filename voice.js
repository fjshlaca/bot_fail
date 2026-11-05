const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const config = require('./config');

function isGAAdmin(member) {
  if (!member) return false;
  return member.id === config.BOT_ADMIN_ID || member.roles.cache.some(r => config.ALLOWED_ROLE_IDS.includes(r.id));
}

module.exports = (client) => {
  // Quản lý AFK 5 phút khi phòng trống
  client.on('voiceStateUpdate', (oldState, newState) => {
    const guildId = oldState.guild.id || newState.guild.id;
    const sData = client.serverVoices.get(guildId);
    if (!sData || sData.isPermanent || !sData.channelId) return;

    if (oldState.channelId === sData.channelId || newState.channelId === sData.channelId) {
      const guild = client.guilds.cache.get(guildId);
      const channel = guild.channels.cache.get(sData.channelId);
      if (!channel) return;

      const humanMembers = channel.members.filter(m => !m.user.bot).size;
      if (humanMembers === 0) {
        if (!sData.afkTimer) {
          sData.afkTimer = setTimeout(() => {
            if (sData.connection) sData.connection.destroy();
            client.serverVoices.delete(guildId);
          }, 5 * 60 * 1000);
        }
      } else {
        if (sData.afkTimer) {
          clearTimeout(sData.afkTimer);
          sData.afkTimer = null;
        }
      }
    }
  });

  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.toLowerCase().startsWith(config.PREFIX)) return;
    const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // 🎤 LỆNH JOIN VOICE
    if (command === 'join' || command === 'joinv') {
      if (!isGAAdmin(message.member)) return message.reply('❌ **Bạn không có quyền!**');
      let targetVoiceChannel = null;
      if (message.channel.isVoiceBased()) targetVoiceChannel = message.channel;
      else if (message.channel.parentId) {
        targetVoiceChannel = message.guild.channels.cache.find(c => c.isVoiceBased() && c.parentId === message.channel.parentId);
      }
      if (!targetVoiceChannel && message.member.voice.channel) targetVoiceChannel = message.member.voice.channel;
      if (!targetVoiceChannel) return message.reply('❌ Hãy gõ tại khung chat voice hoặc khi bạn đang ở trong voice!');

      const guildId = message.guild.id;
      const existingVoice = client.serverVoices.get(guildId);
      if (existingVoice && existingVoice.channelId !== targetVoiceChannel.id) {
        const busyChannel = message.guild.channels.cache.get(existingVoice.channelId);
        return message.reply(`❌ Mình đang bận phục vụ cho cậu chủ **${existingVoice.masterName}** tại **${busyChannel ? busyChannel.name : 'phòng khác'}** rồi!`);
      }

      const isPermanent = (command === 'joinv');
      const masterName = message.member.displayName || message.author.username;

      try {
        const connection = joinVoiceChannel({
          channelId: targetVoiceChannel.id,
          guildId: guildId,
          adapterCreator: message.guild.voiceAdapterCreator,
          selfDeaf: false,
          selfMute: false
        });

        if (existingVoice && existingVoice.afkTimer) clearTimeout(existingVoice.afkTimer);
        client.serverVoices.set(guildId, { connection, isPermanent, channelId: targetVoiceChannel.id, masterName, afkTimer: null, player: createAudioPlayer() });
        connection.subscribe(client.serverVoices.get(guildId).player);

        return message.reply('Nô tì đến liền ạ');
      } catch (err) { message.reply('❌ Lỗi tham gia voice!'); }
    }

    // 🔊 LỆNH zs <nội_dung> — BOT NÓI TO TRONG VOICE
    if (command === 'zs') {
      const guildId = message.guild.id;
      const existingVoice = client.serverVoices.get(guildId);

      if (!existingVoice) {
        return message.reply('❌ Bot chưa ở trong kênh thoại nào cả! Hãy dùng lệnh `zjoin` hoặc `zjoinv` gọi bot vào trước nhé.');
      }

      const textToSpeak = args.join(' ');
      if (!textToSpeak) {
        return message.reply('❌ Vui lòng nhập nội dung cần bot nói! Ví dụ: `zs ăn cứt`');
      }

      try {
        // Sử dụng Google TTS API để dịch text thành link âm thanh tiếng Việt (vi)
        const encodedText = encodeURIComponent(textToSpeak);
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=vi&client=tw-ob`;

        const resource = createAudioResource(ttsUrl);
        existingVoice.player.play(resource);

        return message.react('🗣️').catch(() => {});
      } catch (err) {
        return message.reply('❌ Không thể phát âm thanh lúc này!');
      }
    }

    // 👋 LỆNH OUT VOICE
    if (command === 'out') {
      if (!isGAAdmin(message.member)) return message.reply('❌ **Bạn không có quyền!**');
      const guildId = message.guild.id;
      const existingVoice = client.serverVoices.get(guildId);
      if (!existingVoice) return message.reply('❌ Mình đang rảnh, có ở trong voice nào đâu!');
      existingVoice.connection.destroy();
      if (existingVoice.afkTimer) clearTimeout(existingVoice.afkTimer);
      client.serverVoices.delete(guildId);
      return message.reply('Nô tì lui đây ạ!');
    }
  });
};
