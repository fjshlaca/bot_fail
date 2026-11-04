// ==========================================
  // 🎉 TẠO GIVEAWAY (zga / Zga)
  // ==========================================
  if (command === 'ga') {
    if (!isGAAdmin(message.member)) {
      return message.reply(`❌ **Bạn không có quyền quản lý Giveaway!**`);
    }

    if (args.length === 0) {
      const helpEmbed = new EmbedBuilder()
        .setAuthor({ name: '📖 HƯỚNG DẪN SỬ DỤNG LỆNH GIVEAWAY', iconURL: client.user.displayAvatarURL() })
        .setTitle('✨ Cách tạo GiveAway')
        .setDescription(
          `> \`zga [@Role] <thời_gian> [số_giải] [số_lượng_bài_ga] <nội_dung>\`\n\n` +
          `• 🌐 **Mở cho tất cả mọi người (Không cần tag role):**\n` +
          `  \`Zga 24h 1 1 100k\` hoặc \`zga 10m 100k\`\n\n` +
          `• 📌 **Tag trực tiếp Role:**\n` +
          `  \`Zga @Role 12h 1 1 Nitro\``
        )
        .setColor(0xC7A9C9);

      return message.reply({ embeds: [helpEmbed] });
    }

    let targetRoleId = null;
    let durationMs = null;
    let winnerCount = 1;
    let giveawayCount = 1;
    let prize = '';

    let currentIndex = 0;
    const firstArg = args[0];
    const extractedId = firstArg.replace(/\D/g, '');

    // Nếu tham số đầu tiên là Tag Role (ID dài >= 15 số)
    if (extractedId.length >= 15) {
      targetRoleId = extractedId;
      currentIndex = 1;
    }

    // Đọc thời gian (ví dụ: 24h, 30m, 1d)
    if (args[currentIndex]) {
      durationMs = parseCustomDuration(args[currentIndex]);
      if (durationMs) currentIndex++;
    }

    // Đọc Số lượng giải (ví dụ: 1 giải, 2 giải)
    if (args[currentIndex] && !isNaN(parseInt(args[currentIndex]))) {
      winnerCount = parseInt(args[currentIndex]);
      currentIndex++;
    }

    // Đọc Số lượng bài Giveaway tạo ra (ví dụ: 1 bài, 2 bài)
    if (args[currentIndex] && !isNaN(parseInt(args[currentIndex]))) {
      giveawayCount = parseInt(args[currentIndex]);
      currentIndex++;
    }

    // Tất cả chữ còn lại là Nội dung phần thưởng
    prize = args.slice(currentIndex).join(' ');

    if (!durationMs) {
      return message.reply('❌ **Thời gian không hợp lệ!** (Ví dụ: `Zga 24h 1 1 100k` hoặc `Zga 10m 100k`)');
    }
    if (!prize) {
      return message.reply('❌ **Chưa nhập nội dung giveaway!**');
    }

    await message.delete().catch(() => {});

    const isFlash = durationMs < 3600000;

    for (let i = 0; i < giveawayCount; i++) {
      const endTime = Date.now() + durationMs;
      const roleDisplay = targetRoleId ? `<@&${targetRoleId}>` : 'Mọi người (Everyone)';
      const wineTitleFont = '𝐖𝐈𝐍𝐄 𝐆𝐈𝐕𝐄𝐀𝐖𝐀𝐘';

      const buildEmbed = (msRemaining) => {
        return new EmbedBuilder()
          .setTitle(`<:emoji_11:1567468310419742810> ${wineTitleFont} <:emoji_11:1567468310419742810>`)
          .setDescription(
            `✧ Một ly vang đỏ, một món quà dành cho vị khách hữu duyên.\n\n` +
            `<:emoji_9:1567468262512533514> **Chủ Tiệc:** <@${message.author.id}>\n` +
            `<:emoji_10:1567468283764936836> **Điều kiện tham dự:** ${roleDisplay}\n` +
            `<:emoji_13:1567468392544337972> **Phần quà:** \`${prize}\`\n` +
            `<:emoji_12:1567468350823731322> **Thời gian khai tiệc còn lại:** \`${formatTimeLeft(msRemaining)}\``
          )
          .setColor(0xC7A9C9)
          .setThumbnail(GA_THUMBNAIL)
          .setImage(GA_GIF);
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
          const endedEmbed = EmbedBuilder.from(fetchedMsg.embeds[0]).setDescription(
            `✧ Một ly vang đỏ, một món quà dành cho vị khách hữu duyên.\n\n` +
            `<:emoji_9:1567468262512533514> **Chủ Tiệc:** <@${message.author.id}>\n` +
            `<:emoji_10:1567468283764936836> **Điều kiện tham dự:** ${roleDisplay}\n` +
            `<:emoji_13:1567468392544337972> **Phần quà:** \`${prize}\`\n` +
            `<:emoji_12:1567468350823731322> **Thời gian khai tiệc còn lại:** \`Tiệc đã kết thúc\``
          );
          await fetchedMsg.edit({ embeds: [endedEmbed] }).catch(() => {});

          return message.channel.send({
            content: `˚₊‧⊹  Dạ tiệc kết thúc, món quà vẫn còn nằm lại trên bàn tiệc…. ⊹‧₊˚`
          });
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

        const endedEmbed = EmbedBuilder.from(fetchedMsg.embeds[0]).setDescription(
          `✧ Một ly vang đỏ, một món quà dành cho vị khách hữu duyên.\n\n` +
          `<:emoji_9:1567468262512533514> **Chủ Tiệc:** <@${message.author.id}>\n` +
          `<:emoji_10:1567468283764936836> **Điều kiện tham dự:** ${roleDisplay}\n` +
          `<:emoji_13:1567468392544337972> **Phần quà:** \`${prize}\`\n` +
          `<:emoji_12:1567468350823731322> **Thời gian khai tiệc còn lại:** \`Tiệc đã kết thúc\``
        );
        await fetchedMsg.edit({ embeds: [endedEmbed] }).catch(() => {});

        return message.channel.send({
          content: `˚₊‧⊹ <:emoji_13:1567468392544337972> Rượu vang được nâng lên, xin chúc mừng ${winnerMentions} đã trở thành chủ nhân của món quà ${prize} …. ⊹‧₊˚`
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
