const { getVoiceConnection, joinVoiceChannel, entersState, VoiceConnectionStatus, EndBehaviorType } = require("@discordjs/voice");
const { AttachmentBuilder } = require("discord.js");
const { getLogger } = require("log4js");
const playRecordingSound = require("../utils/playRecordingSound");
const OpusDecodingStream = require("../interfaces/OpusDecodingStream");
const encodePcmToMonoWav = require("../utils/encodePcmToMonoWav");
const recognize = require("../utils/recognize");
const logger = getLogger("Transcribe");

module.exports = {
  name: "transcribe",
  description: "Transcribe your voice",
  dmPermission: false,
  /**
   * 
   * @param {import("discord.js").ChatInputCommandInteraction} interaction 
   */
  async execute(interaction) {
    logger.trace("Received transcribe command");
    const client = interaction.client;
    const subCommand = interaction.options.getSubcommand(true);
    if (subCommand === "start") {
      logger.trace("Start command");
      const language = interaction.options.getString("language", false) || "ja";
      /** @type {import("discord.js").VoiceChannel} */
      const vc = interaction.member?.voice.channel;
      if (!vc) return interaction.reply({ ephemeral: true, content: "You must be in a voice channel" });
      if (!vc.joinable) return interaction.reply({ ephemeral: true, content: "I cannot join your voice channel" });
      if (client.minutes.has(interaction.guild.id)) return interaction.reply({ ephemeral: true, content: "I'm already transcribing" });
      await interaction.reply(`Transcribing in <#${vc.id}> ...`);
      this.startTranscribe(interaction.guild, vc, language);
    } else if (subCommand === "stop") {
      logger.trace("Stop command");
      const talkedData = client.minutes.get(interaction.guild.id);
      if (!talkedData) return interaction.reply({ ephemeral: true, content: "I'm not transcribing" });
      await interaction.deferReply();
      let result = talkedData.filter(data => data.content.trim() !== "");
      console.log(result);
      // 結合する
      result = result.reduce((arr, item) => {
        let previousItem = arr[arr.length - 1];
        if (previousItem && previousItem.userId === item.userId) {
          previousItem.content += item.content;
        } else {
          arr.push({ ...item });
        }
        return arr;
      }, []);
      console.log(result);
      result = result.map((data) => {
        const user = interaction.guild.members.cache.get(data.userId);
        return `${user?.displayName || "Unknown"} (${data.userId}): ${data.content}`;
      }).join("\n");
      await interaction.followUp({ files: [new AttachmentBuilder(Buffer.from(result, "utf-8"), { name: `${new Date().toISOString()}.txt` })] });
      client.minutes.delete(interaction.guild.id);
      const connection = getVoiceConnection(interaction.guild.id);
      if (connection) {
        connection.destroy();
        logger.trace(`Disconnected from ${connection.joinConfig.channelId}`);
      }
    }
  },
  async startTranscribe(guild, channel, language) {
    const client = guild.client;
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });
    logger.debug(`Joined ${channel.name}`);
    await entersState(connection, VoiceConnectionStatus.Ready, 1000 * 10);
    logger.debug("Ready");
    playRecordingSound(guild.id);
    const receiver = connection.receiver;
    receiver.speaking.on("start", async (userId) => {
      if (userId === client.user.id) return;
      logger.trace(`Speaking start: ${userId}`);
      const audioStream = connection.receiver.subscribe(userId, {
        end: {
          behavior: EndBehaviorType.AfterSilence,
          duration: 100
        }
      });
      /** @type {Uint8Array} */
      const bufferData = [];

      audioStream.pipe(new OpusDecodingStream()).on("data", (chunk) => {
        bufferData.push(chunk);
      });
      audioStream.on("end", async () => {
        logger.trace(`Speaking end: ${userId}`);
        const buffer = Buffer.concat(bufferData);
        const result = await this.transcribe(buffer, language, client);
        logger.trace(result);
        const talkedData = client.minutes.get(guild.id) || [];
        talkedData.push({ createdAt: new Date(), userId, content: result });
        client.minutes.set(guild.id, talkedData);
      });
    });
  },
  async transcribe(buffer, language, client) {
    const { wavStream, date } = await encodePcmToMonoWav(buffer);
    const result = await recognize(wavStream, language, client, date);
    return result;
  }
}