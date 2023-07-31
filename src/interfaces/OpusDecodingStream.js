const { Transform, Readable } = require("node:stream");
const { OpusEncoder } = require("@discordjs/opus");

module.exports = class OpusDecodingStream extends Transform {
  constructor() {
    super();
    this.encoder = new OpusEncoder(48000, 2);
  }

  _transform(data, encoding, callback) {
    this.push(this.encoder.decode(data));
    callback();
  }
}