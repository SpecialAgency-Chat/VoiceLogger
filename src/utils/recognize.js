const fs = require("fs");
const wav = require("wav");
const { Readable } = require("stream");
const vosk = require("vosk");
const { getLogger } = require("log4js");
const logger = getLogger("Recognize");

/**
 * 
 * @param {fs.ReadStream} wavStream 
 * @param {string} language 
 * @param {import("discord.js").Client} client
 * @param {number} date
 * @returns {string}
 */
module.exports = async function recognize(wavStream, language, client, date) {
  const wfReader = new wav.Reader();
  const wfReadable = new Readable().wrap(wfReader);
  const promise = await new Promise((resolve) => {
    wfReader.on("format", async ({ sampleRate }) => {
      const rec = new vosk.Recognizer({ model: client.models[language], sampleRate });
      rec.setMaxAlternatives(1);
      rec.setWords(true);
      for await (const data of wfReadable) {
        rec.acceptWaveform(data);
      }
      const lastData = rec.finalResult(rec).alternatives[0].text;
      rec.free();
      fs.unlinkSync(`tmp/${date}.wav`);
      fs.unlinkSync(`tmp/${date}_mono.wav`);
      resolve(language === "ja" ? lastData.replaceAll(" ", "") : lastData);
    });
    wavStream.pipe(wfReader).on("finish", () => {
      logger.trace("Finished");
    });
  });
  return promise;
}