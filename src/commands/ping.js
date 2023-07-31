module.exports = {
  name: "ping",
  description: "Ping!",
  /**
   * 
   * @param {import("discord.js").ChatInputCommandInteraction} interaction 
   */
  async execute(interaction) {
    const t = Date.now();
    await interaction.reply({ content: "Pinging" });
    await interaction.editReply({ content: `Pong!\nWebSocket: ${interaction.client.ws.ping}ms\nAPI: ${Date.now() - t}ms` });
  }
}