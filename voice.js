const { 
  joinVoiceChannel, 
  VoiceConnectionStatus, 
  entersState
} = require('@discordjs/voice');

const config = require('./config');

function isGAAdmin(member) {
  if (!member) return false;
  const adminIds = Array.isArray(config.BOT_ADMIN_ID) ? config.BOT_ADMIN_ID : [config.BOT_ADMIN_ID];
  if (adminIds.includes(member.id)) return true;
  if (config.ALLOWED_ROLE_IDS && member.roles.cache.some(r => config.ALLOWED_ROLE_IDS.includes(r.id))) return true;
  return false;
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

    // LỆNH JOIN
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
          selfDeaf: true, 
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
              console.log(`[VOICE] Rớt kết nối, đang tự động rejoin...`);
              voiceData.connection.rejoin(); 
            }
          }
        });

        client.serverVoices.set(guildId, { 
          connection, 
          isPermanent, 
          channelId: targetVoiceChannel.id, 
          masterName, 
          afkTimer: null
        });

        return message.reply(`Em bé đến đây ạa >.< `);
      } catch (err) {
        console.error("Lỗi join voice:", err);
        return message.reply('❌ Lỗi, em bé hong vào rum đượcc ');
      }
    }

    // LỆNH OUT
    if (command === 'out') {
      if (!isGAAdmin(message.member)) return message.reply('❌ **Bạn không có quyền!**');
      const guildId = message.guild.id;
      const existingVoice = client.serverVoices.get(guildId);
      
      if (!existingVoice) return message.reply('❌ Em bé đang rảnh, không ở trong voice nào cả!');
      
      existingVoice.connection.destroy();
      if (existingVoice.afkTimer) clearTimeout(existingVoice.afkTimer);
      client.serverVoices.delete(guildId);
      
      return message.reply('Em bé đi đây ạ :c');
    }
  });
};
