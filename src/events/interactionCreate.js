const { Events } = require("discord.js");
const { getLogger } = require("log4js");
const logger = getLogger("InteractionCreate");

module.exports = {
  name: Events.InteractionCreate,
  /**
   * 
   * @param {import("discord.js").Interaction} interaction 
   */
  async execute(interaction) {
    logger.trace("Received interaction");
    if (!interaction.inGuild()) {
      return interaction.reply({ content: "This command is only available in guilds.", ephemeral: true });
    }
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) {
        interaction.reply({ content: "Unknown command", ephemeral: true });
        return;
      }
      try {
        await command.execute(interaction);
      } catch (error) {
        logger.error(error);
        if (interaction.deferred) {
          await interaction.editReply({ content: "An error occured while executing this command!", ephemeral: true });
        } else if (interaction.replied) {
          await interaction.followUp({ content: "An error occured while executing this command!", ephemeral: true });
        } else {
          await interaction.reply({ content: "An error occured while executing this command!", ephemeral: true });
        }
      }
    }
  }
}