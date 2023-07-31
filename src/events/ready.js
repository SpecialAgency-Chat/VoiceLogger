const { Events, ApplicationCommandOptionType } = require("discord.js");
const { getLogger } = require("log4js");
const { generateDependencyReport } = require("@discordjs/voice");
const logger = getLogger("Ready");

const config = require("../../config.json");
const MODEL_PATHS = config.modelPaths;
const LANG_MAP = config.langMap;
const defaultLang = config.defaultLang;

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    logger.info("Discord Bot Ready!");
    logger.debug(generateDependencyReport());
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
                description: `Language to transcribe. default to ${defaultLang}`,
                choices: Object.keys(MODEL_PATHS).map((key) => ({ name: LANG_MAP[key], value: key }))
              }
            ]
          },
          {
            type: ApplicationCommandOptionType.Subcommand,
            name: "stop",
            description: "Stop transcribing"
          }
        ]
      },
      {
        name: "ping",
        description: "Ping pong"
      }
    ]);
  }
}