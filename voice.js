const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const googleTTS = require('google-tts-api');
const config = require('./config');
const fs = require('fs');
const { Readable } = require('stream');

// Sửa dứt điểm lỗi câm: Trỏ đường dẫn chính xác và ép quyền chạy cho FFmpeg trên Render
const ffmpegPath = require('ffmpeg-static');
process.env.FFMPEG_PATH = ffmpegPath;
try {
  if (ffmpegPath) fs.chmodSync(ffmpegPath, '777');
} catch (e) {}

function isGAAdmin(member) {
  if (!member) return false;
  return member.id === config.BOT_ADMIN_ID || member.roles.cache.some(r => config.ALLOWED_ROLE_IDS.includes(r.id));
}

module.exports = (client) => {
  // Quản lý AFK 5 phút
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
        
        const player = createAudioPlayer();
        
        // Bắt lỗi âm thanh để bot không chết ngầm
        player.on('error', error => {
          console.error('Lỗi phát âm thanh:', error.message);
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

        return message.reply('Nô tì đến liền ạ');
      } catch (err) {
        return message.reply('❌ Lỗi tham gia voice!');
      }
    }

    // 🔊 LỆNH zs <nội_dung> 
    if (command === 'zs') {
      const guildId = message.guild.id;
      const existingVoice = client.serverVoices.get(guildId);

      if (!existingVoice) {
        return message.reply('❌ Bot chưa ở trong kênh thoại nào cả! Hãy dùng lệnh `zjoin` hoặc `zjoinv` gọi bot vào trước nhé.');
      }

      const textToSpeak = args.join(' ');
      if (!textToSpeak) {
        return message.reply('❌ **Vui lòng nhập nội dung cần bot nói!** Ví dụ: `zs chao xìn`');
      }

      if (textToSpeak.length > 200) {
        return message.reply('❌ **Nội dung quá dài!** Vui lòng nhập dưới 200 ký tự.');
      }

      try {
        // Fix dứt điểm 403: Tải audio về làm bộ đệm ảo thay vì đưa URL mạng cho FFmpeg
        const base64Audio = await googleTTS.getAudioBase64(textToSpeak, {
          lang: 'vi',
          slow: false,
          host: 'https://translate.google.com',
        });
        
        const audioBuffer = Buffer.from(base64Audio, 'base64');
        const stream = Readable.from(audioBuffer);

        const resource = createAudioResource(stream, { 
          inlineVolume: true 
        });
        resource.volume.setVolume(2.5); 

        existingVoice.player.play(resource);
        return message.react('🗣️').catch(() => {});

      } catch (err) {
        console.error(err);
        return message.reply('❌ Đã xảy ra lỗi khi tạo giọng đọc!');
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
