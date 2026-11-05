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
  entersState,
  generateDependencyReport
} = require('@discordjs/voice');

const googleTTS = require('google-tts-api');

console.log("=== DISCORD VOICE DEPENDENCY REPORT ===");
console.log(generateDependencyReport());
console.log("=======================================");

const config = require('./config');

function isGAAdmin(member) {
  if (!member) return false;
  return member.id === config.BOT_ADMIN_ID || member.roles.cache.some(r => config.ALLOWED_ROLE_IDS.includes(r.id));
}

module.exports = (client) => {
  client.on('voiceStateUpdate', (oldState, newState) => {
    const guildId = oldState.guild.id || newState.guild.id;
    const sData = client.serverVoices.get(guildId);
    if (!sData || !sData.channelId) return;

    const guild = client.guilds.cache.get(guildId);
    const channel = guild.channels.cache.get(sData.channelId);
    if (!channel) return;

    const humanMembers = channel.members.filter(m => !m.user.bot).size;

    if (humanMembers === 0 && !sData.isPermanent) {
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
  });

  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.toLowerCase().startsWith(config.PREFIX)) return;
    const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // LỆNH JOIN VÀ JOINV
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
          selfDeaf: false,
          selfMute: false
        });

        connection.on(VoiceConnectionStatus.Disconnected, async () => {
          try {
            await Promise.race([
              entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
              entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
            ]);
          } catch (error) {
            const voiceData = client.serverVoices.get(guildId);
            if (voiceData && voiceData.connection && voiceData.connection.state.status !== 'destroyed') {
              voiceData.connection.rejoin(); 
            }
          }
        });

        const player = createAudioPlayer();
        player.on('error', error => console.error('Lỗi phát Audio Player:', error.message));
        connection.subscribe(player);

        client.serverVoices.set(guildId, { 
          connection, 
          isPermanent, 
          channelId: targetVoiceChannel.id, 
          masterName, 
          afkTimer: null, 
          player 
        });

        return message.reply(`✅ Nô tì đã vào phòng. Chế độ: **${isPermanent ? 'zjoinv (Bám rễ)' : 'zjoin (Out sau 5p)'}**`);
      } catch (err) {
        console.error("Lỗi join voice:", err);
        return message.reply('❌ Lỗi kết nối vào voice!');
      }
    }

    // LỆNH S (Đọc TTS hoặc phát âm thanh chuẩn qua FFmpeg)
    if (command === 's') {
      const guildId = message.guild.id;
      const existingVoice = client.serverVoices.get(guildId);

      if (!existingVoice) {
        return message.reply('❌ Bot chưa vào kênh thoại! Dùng `zjoin` trước.');
      }

      const textToSpeech = args.join(' ');
      
      try {
        let audioUrl = '';
        
        if (textToSpeech.length > 0) {
          // Tạo link Google TTS tiếng Việt từ nội dung người dùng gõ
          audioUrl = googleTTS.getAudioUrl(textToSpeech, {
            lang: 'vi',
            slow: false,
            host: 'https://translate.google.com',
          });
        } else {
          // Nếu chỉ gõ `zs` không có chữ gì thì phát nhạc mẫu test
          audioUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
        }

        console.log(`[TTS] Đang phát audio từ URL: ${audioUrl}`);

        // Dùng createAudioResource bọc qua FFmpeg để chạy mượt mà trên Linux
        const resource = createAudioResource(audioUrl, { inlineVolume: true });
        resource.volume.setVolume(2.0);
        
        existingVoice.player.play(resource);
        return message.react('🔊').catch(() => {});
      } catch (err) {
        console.error("Lỗi phát audio TTS:", err);
        return message.reply('❌ Lỗi xử lý âm thanh!');
      }
    }

    // LỆNH OUT
    if (command === 'out') {
      if (!isGAAdmin(message.member)) return message.reply('❌ **Bạn không có quyền!**');
      const guildId = message.guild.id;
      const existingVoice = client.serverVoices.get(guildId);
      if (!existingVoice) return message.reply('❌ Mình đang rảnh, không ở trong voice nào cả!');
      
      existingVoice.connection.destroy();
      if (existingVoice.afkTimer) clearTimeout(existingVoice.afkTimer);
      client.serverVoices.delete(guildId);
      
      return message.reply('Nô tì lui đây ạ!');
    }
  });
};
