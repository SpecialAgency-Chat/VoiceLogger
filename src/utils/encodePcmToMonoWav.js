const wavConverter = require("wav-converter");
const FFmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const { getLogger } = require("log4js");

const logger = getLogger("EncodePcmToMonoWav");

/**
 * 
 * @param {Buffer} pcmData 
 * @returns {{ wavStream: Promise<fs.ReadStream>, date: number }}
 */
module.exports = async function encodePcmToMonoWav(pcmData) {
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
    .addOption('-ac', 1)
    .addOption('-ar', 16000);
  const monoStream = await new Promise((resolve, reject) => {
    command.on('error', reject);
    command.on('end', () => {
      logger.trace("Finished converting to mono");
      resolve(fs.createReadStream(`tmp/${date}_mono.wav`, { highWaterMark: 4096 }));
    });
    command.saveToFile(`tmp/${date}_mono.wav`);
  });
  return { wavStream: monoStream, date };
}