require("dotenv").config();
const { Client, GatewayIntentBits, Events, ApplicationCommandOptionType, AttachmentBuilder } = require("discord.js");
const client = new Client({
  intents: GatewayIntentBits.Guilds | GatewayIntentBits.GuildMessages | GatewayIntentBits.GuildVoiceStates,
  allowedMentions: { parse: [], repliedUser: false }
});
const vosk = require("vosk");
const { joinVoiceChannel, createAudioPlayer, EndBehaviorType, getVoiceConnection } = require("@discordjs/voice");
vosk.setLogLevel(0);
const fs = require("node:fs");
const { OpusEncoder } = require("@discordjs/opus");
const wavConverter = require("wav-converter");
const { Transform, Readable } = require("node:stream");
const FFmpeg = require('fluent-ffmpeg');
const wav = require("wav");
const configLogger = require("./logger");
const { getLogger } = require("log4js");
const MODEL_PATHS = {
  "ja": "models/ja",
  "en": "models/en"
}

configLogger();
const logger = getLogger("Main");

if (!fs.existsSync(MODEL_PATHS["ja"]) && !fs.existsSync(MODEL_PATHS["en"])) {
  logger.fatal("Please download the model from https://alphacephei.com/vosk/models and unpack as " + MODEL_PATH + " in the current folder.")
  process.exit()
}

logger.info("Loading model...");
const models = {
  ja: new vosk.Model(MODEL_PATHS)
}
logger.info("Model loaded");

class OpusDecodingStream extends Transform {
  constructor() {
    super();
    this.encoder = new OpusEncoder(48000, 2);
  }

  _transform(data, encoding, callback) {
    this.push(this.encoder.decode(data));
    callback();
  }
}

client.on(Events.ClientReady, () => {
  logger.info("Discord Bot Ready!");
  client.application.commands.set([
    {
      name: "transcribe",
      description: "Transcribe your voice",
      dm_permission: false,
      options: [
        {
          type: ApplicationCommandOptionType.Subcommand,
          name: "start",
          description: "Start transcribing",
          options: [
            {
              type: ApplicationCommandOptionType.String,
              name: "language",
              description: "Language to transcribe. default to ja",
              choices: [
                {
                  name: "Japanese",
                  value: "ja"
                }
              ]
            }
          ]
        },
        {
          type: ApplicationCommandOptionType.Subcommand,
          name: "stop",
          description: "Stop transcribing"
        }
      ]
    }
  ]);
});

/** @type {Map<string, { createdAt: Date, userId: string, content: string }[]} */
const minutes = new Map();

client.on(Events.InteractionCreate, async (i) => {
  if (i.isChatInputCommand()) {
    const command = i.commandName;
    if (command === "transcribe") {
      const sub = i.options.getSubcommand(true);
      if (sub === "start") {
        logger.trace("Start command");
        const language = i.options.getString("language", false) || "ja";
        /** @type {import("discord.js").VoiceChannel} */
        const vc = i.member?.voice.channel;
        if (!vc) return i.reply({ ephemeral: true, content: "You must be in a voice channel" });
        if (!vc.joinable) return i.reply({ ephemeral: true, content: "I cannot join your voice channel" });
        if (minutes.has(i.guild.id)) return i.reply({ ephemeral: true, content: "I'm already transcribing" });
        const connection = joinVoiceChannel({
          guildId: i.guild.id,
          channelId: vc.id,
          adapterCreator: i.guild.voiceAdapterCreator,
          selfMute: true,
          selfDeaf: false
        });
        logger.debug(`Connected to ${vc.name}`);
        await i.reply({ ephemeral: true, content: `Connected to ${vc.name}` });

        const player = createAudioPlayer();
        connection.subscribe(player);
        connection.receiver.speaking.on("start", (userId) => {
          logger.trace(`Started speaking ${userId}`);
          const audio = connection.receiver.subscribe(userId, {
            end: {
              behavior: EndBehaviorType.AfterSilence,
              duration: 100
            }
          });
          /** @type {Uint8Array} */
          const bufferData = [];

          audio.pipe(new OpusDecodingStream()).on("data", (chunk) => {
            bufferData.push(chunk);
          });
          audio.on("end", async () => {
            logger.trace(`Stream from user ${userId} has ended`);
            const pcmData = Buffer.concat(bufferData);
            const wavData = wavConverter.encodeWav(pcmData, {
              numChannels: 2,
              sampleRate: 48000,
              byteRate: 16
            });
            const date = new Date().getTime();
            fs.writeFileSync(`tmp/${date}.wav`, wavData);
            const command = FFmpeg({
              source: `tmp/${date}.wav`
            })
              .addOption('-ac', 1);
            const monoStream = await new Promise((resolve, reject) => {
              command.on('error', reject);
              command.on('end', () => {
                logger.trace("Finished converting to mono");
                resolve(fs.createReadStream(`tmp/${date}_mono.wav`, { highWaterMark: 4096 }));
              });
              command.saveToFile(`tmp/${date}_mono.wav`);
            });

            const wfReader = new wav.Reader();
            const wfReadable = new Readable().wrap(wfReader);
            wfReader.on("format", async ({ sampleRate }) => {
              const rec = new vosk.Recognizer({ model: models[language], sampleRate });
              rec.setMaxAlternatives(1);
              rec.setWords(true);
              for await (const data of wfReadable) {
                rec.acceptWaveform(data);
              }
              const talkedData = minutes.get(i.guild.id) || [];
              const lastData = rec.finalResult(rec).alternatives[0].text;
              talkedData.push({
                createdAt: new Date(),
                userId,
                content: language === "ja" ? lastData.replaceAll(" ", "") : lastData
              });
              minutes.set(i.guild.id, talkedData);
              rec.free();
              fs.unlinkSync(`tmp/${date}.wav`);
              fs.unlinkSync(`tmp/${date}_mono.wav`);
            });
            monoStream.pipe(wfReader).on("finish", () => {
              logger.trace("Finished");
            })
          });
        });
      } else if (sub === "stop") {
        logger.trace("Stop command");
        await i.deferReply();
        const talkedData = minutes.get(i.guild.id) || [];
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
          const user = i.guild.members.cache.get(data.userId);
          return `${user?.displayName || "Unknown"} (${data.userId}): ${data.content}`;
        }).join("\n");
        await i.followUp({ files: [new AttachmentBuilder(Buffer.from(result, "utf-8"), { name: `${new Date().toISOString()}.txt`})] });
        minutes.delete(i.guild.id);
        const connection = getVoiceConnection(i.guild.id);
        if (connection) {
          connection.destroy();
          logger.trace(`Disconnected from ${connection.joinConfig.channelId}`);
        }
      }
    }
  }
});

["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, () => {
    logger.info(`Received ${signal}. Exiting`);
    client.destroy();
    model.free();
    process.exit(0);
  });
});

void client.login(process.env.DISCORD_TOKEN);