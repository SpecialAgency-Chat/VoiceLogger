const { entersState, createAudioResource, StreamType, createAudioPlayer, AudioPlayerStatus, NoSubscriberBehavior, getVoiceConnection } = require("@discordjs/voice");

module.exports = function playRecordingSound(guildId) {
  const connection = getVoiceConnection(guildId);
  if (!connection) throw new Error("Not connected to voice channel");
  const player = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Pause,
    },
  });
  connection.subscribe(player);
  const resource = createAudioResource("./assets/recording.mp3", {
    inputType: StreamType.Arbitrary,
  });
  player.play(resource);
  return entersState(player, AudioPlayerStatus.Playing, 5e3);
}