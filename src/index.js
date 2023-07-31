const { Client, GatewayIntentBits } = require("discord.js");
const client = new Client({
  intents: GatewayIntentBits.Guilds | GatewayIntentBits.GuildMessages | GatewayIntentBits.GuildVoiceStates,
  allowedMentions: { parse: [], repliedUser: false }
});
const vosk = require("vosk");
const fs = require("node:fs");
const configLogger = require("./logger");
const { getLogger } = require("log4js");
const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
const MODEL_PATHS = config.modelPaths;

configLogger();
vosk.setLogLevel(0);
const logger = getLogger("Main");

if (!fs.existsSync(MODEL_PATHS["ja"]) && !fs.existsSync(MODEL_PATHS["en"])) {
  logger.fatal("Please download the model from https://alphacephei.com/vosk/models and unpack as models/[lang] in the current folder.");
  process.exit()
}

logger.info("Loading model...");
/*
const models = {
  ja: new vosk.Model(MODEL_PATHS["ja"])
}*/
const models = Object.keys(MODEL_PATHS).reduce((obj, key) => {
  obj[key] = new vosk.Model(MODEL_PATHS[key]);
  return obj;
}, {});

client.models = models;

logger.info("Model loaded");


const eventFiles = fs.readdirSync("./src/events").filter(file => file.endsWith(".js"));
for (const file of eventFiles) {
  const event = require(`./events/${file}`);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}
logger.info("Loaded events");

client.commands = new Map();
const slashCommandFiles = fs.readdirSync("./src/commands");

for (const file of slashCommandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.name, command);
}

/** @type {Map<string, { createdAt: Date, userId: string, content: string }[]} */
client.minutes = new Map();

["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, () => {
    logger.info(`Received ${signal}. Exiting`);
    client.destroy();
    Object.values(models).forEach(model => model.free());
    process.exit(0);
  });
});

void client.login(process.env.DISCORD_TOKEN);