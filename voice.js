// LỆNH ÉP QUYỀN CHO FFMPEG - BẮT BUỘC ĐỂ TRÊN CÙNG
const ffmpegPath = require('ffmpeg-static');
process.env.FFMPEG_PATH = ffmpegPath;
try {
  const fs = require('fs');
  fs.chmodSync(ffmpegPath, '777');
} catch (e) {}

const { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  VoiceConnectionStatus, 
  entersState 
} = require('@discordjs/voice');
const googleTTS = require('google-tts-api');
const { Readable } = require('stream');
const config = require('./config');

function isGAAdmin(member) {
  if (!member) return false;
  return member.id === config.BOT_ADMIN_ID || member.roles.cache.some(r => config.ALLOWED_ROLE_IDS.includes(r.id));
}

module.exports = (client) => {
  // BỘ LỌC AFK: CHỈ ÁP DỤNG CHO ZJOIN (isPermanent = false) VÀ PHÒNG TRỐNG TỰ ĐỘNG OUT
  client.on('voiceStateUpdate', (oldState, newState) => {
    const guildId = oldState.guild.id || newState.guild.id;
    const sData = client.serverVoices.get(guildId);
    if (!sData || !sData.channelId) return;

    const guild = client.guilds.cache.get(guildId);
    const channel = guild.channels.cache.get(sData.channelId);
    if (!channel) return;

    // Đếm số người thật (không tính bot)
    const humanMembers = channel.members.filter(m => !m.user.bot).size;

    // KHI PHÒNG KHÔNG CÓ AI VÀ LÀ LỆNH ZJOIN (Không phải vĩnh viễn)
    if (humanMembers === 0 && !sData.isPermanent) {
      if (!sData.afkTimer) {
        sData.afkTimer = setTimeout(() => {
          if (sData.connection) {
            sData.connection.destroy();
          }
          client.serverVoices.delete(guildId);
        }, 5 * 60 * 1000); // Đếm lùi 5 phút
      }
    } else {
      // NẾU CÓ NGƯỜI TRONG PHÒNG, HOẶC LÀ ZJOINV -> HỦY BỘ ĐẾM OUT
      if (sData.afkTimer) {
        clearTimeout(sData.afkTimer);
        sData.afkTimer = null;
      }
    }
  });

  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.toLowerCase().startsWith(config.PREFIX)) return;
    const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // 🎤 LỆNH JOIN VÀ JOINV
    if (command === 'join' || command === 'joinv') {
      if (!isGAAdmin(message.member)) return message.reply('❌ **Bạn không có quyền!**');
      
      let targetVoiceChannel = null;
      if (message.channel.isVoiceBased()) targetVoiceChannel = message.channel;
      else if (message.channel.parentId) {
        targetVoiceChannel = message.guild.channels.cache.find(c => c.isVoiceBased() && c.parentId === message.channel.parentId);
      }
      if (!targetVoiceChannel && message.member.voice.channel) targetVoiceChannel = message.member.voice.channel;
      if (!targetVoiceChannel) return message.reply('❌ Hãy gõ lệnh khi đang ở trong phòng Voice!');

      const guildId = message.guild.id;
      const isPermanent = (command === 'joinv');
      const masterName = message.member.displayName || message.author.username;

      try {
        const connection = joinVoiceChannel({
          channelId: targetVoiceChannel.id,
          guildId: guildId,
          adapterCreator: message.guild.voiceAdapterCreator,
          selfDeaf: true, // Tai bịt lại để chống bị Discord phạt vì không nghe audio
          selfMute: false
        });

        // BÙA CHÚ BÁM RỄ VĨNH VIỄN: CHỐNG LẠI LỆNH ĐÁ AFK 5 PHÚT CỦA DISCORD API
        connection.on(VoiceConnectionStatus.Disconnected, async () => {
          try {
            await Promise.race([
              entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
              entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
            ]);
          } catch (error) {
            // Nếu bị server Discord đá ra (bị Disconnected) mà chưa bị Destroyed (chưa dùng zout)
            const voiceData = client.serverVoices.get(guildId);
            if (voiceData && voiceData.connection && voiceData.connection.state.status !== 'destroyed') {
              // Lập tức nhảy vào lại phòng để cắm rễ
              voiceData.connection.rejoin(); 
            }
          }
        });

        const player = createAudioPlayer();
        
        // Theo dõi lỗi chết yểu để kịp thời báo cáo
        player.on('error', error => {
          console.error('Lỗi phát Audio:', error.message);
        });

        connection.subscribe(player);

        client.serverVoices.set(guildId, { 
          connection, 
          isPermanent, 
          channelId: targetVoiceChannel.id, 
          masterName, 
          afkTimer: null, 
          player 
        });

        return message.reply(`✅ Nô tì đã tham gia phòng. Chế độ: **${isPermanent ? 'zjoinv (Bám rễ vĩnh viễn)' : 'zjoin (Out sau 5p nếu không có ai)'}**`);
      } catch (err) {
        return message.reply('❌ Lỗi kết nối vào voice!');
      }
    }

    // 🔊 LỆNH ZS - ĐÃ BYPASS 403 GOOGLE
    if (command === 'zs') {
      const guildId = message.guild.id;
      const existingVoice = client.serverVoices.get(guildId);

      if (!existingVoice) {
        return message.reply('❌ Bot chưa vào kênh thoại! Dùng `zjoin` hoặc `zjoinv` trước.');
      }

      const textToSpeak = args.join(' ');
      if (!textToSpeak) return message.reply('❌ **Nhập nội dung đi cậu chủ!** VD: `zs ê`');
      if (textToSpeak.length > 200) return message.reply('❌ **Nội dung quá dài!** Xin hãy nhập dưới 200 ký tự.');

      try {
        // TẢI AUDIO THÀNH CHUỖI MÃ BASE64 THAY VÌ LINK ĐỂ NE TRÁNH BỊ GOOGLE CHẶN IP / CHẶN FFMPEG
        const base64Audio = await googleTTS.getAudioBase64(textToSpeak, {
          lang: 'vi',
          slow: false,
          host: 'https://translate.google.com',
        });

        // Ép dữ liệu thành Stream âm thanh thô
        const audioBuffer = Buffer.from(base64Audio, 'base64');
        const stream = Readable.from(audioBuffer);

        const resource = createAudioResource(stream);
        existingVoice.player.play(resource);

        return message.react('🗣️').catch(() => {});
      } catch (err) {
        console.error("Lỗi khi tải TTS:", err);
        return message.reply('❌ Hệ thống giọng đọc đang gặp sự cố kết nối tới Google!');
      }
    }

    // 👋 LỆNH OUT VOICE
    if (command === 'out') {
      if (!isGAAdmin(message.member)) return message.reply('❌ **Bạn không có quyền!**');
      const guildId = message.guild.id;
      const existingVoice = client.serverVoices.get(guildId);
      if (!existingVoice) return message.reply('❌ Mình đang rảnh, có ở trong voice nào đâu!');
      
      // Hủy diệt connection -> State sẽ chuyển thành 'destroyed', event Disconnected ở trên sẽ không tự rejoin nữa!
      existingVoice.connection.destroy();
      if (existingVoice.afkTimer) clearTimeout(existingVoice.afkTimer);
      client.serverVoices.delete(guildId);
      
      return message.reply('Nô tì lui đây ạ!');
    }
  });
};
