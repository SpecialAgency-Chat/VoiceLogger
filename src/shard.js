const { ShardingManager } = require("discord.js");
const configLogger = require("./logger");
const { getLogger } = require("log4js");
configLogger();
const logger = getLogger("ShardingManager");
const manager = new ShardingManager("./src/index.js", {
  token: process.env.DISCORD_TOKEN,
});

manager.on("shardCreate", (shard) => {
  logger.info(`Launched shard ${shard.id}`);
});

manager.spawn();