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
const { Readable } = require('stream');
const https = require('https');
const config = require('./config');

function isGAAdmin(member) {
  if (!member) return false;
  return member.id === config.BOT_ADMIN_ID || member.roles.cache.some(r => config.ALLOWED_ROLE_IDS.includes(r.id));
}

// Hàm lấy trực tiếp buffer âm thanh tiếng Việt từ Google TTS không qua thư viện trung gian
function getGoogleTTSAudioStream(text) {
  return new Promise((resolve, reject) => {
    const encodedText = encodeURIComponent(text);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=vi&client=tw-ob`;

    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to load TTS, status code: ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', (err) => reject(err));
    }).on('error', (err) => reject(err));
  });
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
        player.on('error', error => console.error('Lỗi phát Audio:', error.message));
        connection.subscribe(player);

        client.serverVoices.set(guildId, { 
          connection, 
          isPermanent, 
          channelId: targetVoiceChannel.id, 
          masterName, 
          afkTimer: null, 
          player 
        });

        return message.reply(`✅ Nô tì đã vào phòng. Chế độ: **${isPermanent ? 'zjoinv (Bám rễ vĩnh viễn)' : 'zjoin (Out sau 5p phòng trống)'}**`);
      } catch (err) {
        return message.reply('❌ Lỗi kết nối vào voice!');
      }
    }

    // LỆNH ZS (PHÁT ÂM THANH TRỰC TIẾP TỪ STREAM GOOGLE TTS MỚI)
    if (command === 'zs') {
      const guildId = message.guild.id;
      const existingVoice = client.serverVoices.get(guildId);

      if (!existingVoice) {
        return message.reply('❌ Bot chưa vào kênh thoại! Dùng `zjoin` hoặc `zjoinv` trước.');
      }

      const textToSpeak = args.join(' ');
      if (!textToSpeak) return message.reply('❌ **Nhập nội dung đi!** VD: `zs ê`');
      if (textToSpeak.length > 200) return message.reply('❌ **Nội dung quá dài!** Xin hãy nhập dưới 200 ký tự.');

      try {
        const audioBuffer = await getGoogleTTSAudioStream(textToSpeak);
        const stream = Readable.from(audioBuffer);

        const resource = createAudioResource(stream, { inlineVolume: true });
        resource.volume.setVolume(2.5); 
        existingVoice.player.play(resource);

        return message.react('🗣️').catch(() => {});
      } catch (err) {
        console.error("Lỗi TTS:", err);
        return message.reply('❌ Không thể tạo giọng đọc cho nội dung này!');
      }
    }

    // LỆNH OUT
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
